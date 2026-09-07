'use strict';
// Minimal, dependency-free fake browser environment for running app.js under
// node's `vm` module. It is deliberately small: just enough DOM, localStorage
// and crypto for this todo app. Nothing here is a real browser; see README.
//
// Notable deviations from a real browser, chosen on purpose for testability:
//  - Exceptions thrown inside event listeners PROPAGATE to the code that
//    dispatched the event (browsers swallow them and log to the console).
//  - innerHTML only supports clearing children ('' ) or setting plain text.
//  - The selector engine understands tag, #id, .class, [attr], [attr="v"],
//    descendant (space) and child (>) combinators, and comma lists.
//  - Values created by app.js (arrays, objects) belong to the vm realm: use
//    Array.from(...) before assert.deepStrictEqual, which checks prototypes.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const nodeCrypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const VOID_TAGS = new Set(['input', 'meta', 'link', 'br', 'img', 'hr']);

// --------------------------------------------------------------------------
// Events
// --------------------------------------------------------------------------
class Event {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = init.bubbles !== undefined ? !!init.bubbles : !['focus', 'blur'].includes(type);
    this.cancelable = init.cancelable !== undefined ? !!init.cancelable : true;
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this._stopped = false;
  }
  preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
  stopPropagation() { this._stopped = true; }
  stopImmediatePropagation() { this._stopped = true; }
}
class KeyboardEvent extends Event {
  constructor(type, init = {}) {
    super(type, init);
    this.key = init.key || '';
    this.code = init.code || '';
  }
}
class MouseEvent extends Event {}
class InputEvent extends Event {}

// --------------------------------------------------------------------------
// Nodes
// --------------------------------------------------------------------------
class Node {
  constructor(doc) {
    this.ownerDocument = doc;
    this.parentNode = null;
    this.childNodes = [];
    this._listeners = new Map();
  }
  get parentElement() { return this.parentNode instanceof Element ? this.parentNode : null; }
  get children() { return this.childNodes.filter(n => n.nodeType === 1); }
  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  get firstElementChild() { return this.children[0] || null; }
  get lastElementChild() { const c = this.children; return c[c.length - 1] || null; }
  get nextSibling() {
    if (!this.parentNode) return null;
    const s = this.parentNode.childNodes; return s[s.indexOf(this) + 1] || null;
  }
  get previousSibling() {
    if (!this.parentNode) return null;
    const s = this.parentNode.childNodes; return s[s.indexOf(this) - 1] || null;
  }
  get nextElementSibling() {
    let n = this.nextSibling; while (n && n.nodeType !== 1) n = n.nextSibling; return n;
  }
  get isConnected() {
    let n = this; while (n.parentNode) n = n.parentNode; return n === this.ownerDocument;
  }
  contains(other) {
    for (let n = other; n; n = n.parentNode) if (n === this) return true;
    return false;
  }

  appendChild(child) {
    if (child instanceof DocumentFragment) {
      for (const c of [...child.childNodes]) this.appendChild(c);
      return child;
    }
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  append(...nodes) { for (const n of nodes) this.appendChild(this._toNode(n)); }
  prepend(...nodes) {
    const first = this.firstChild;
    for (const n of nodes) this.insertBefore(this._toNode(n), first);
  }
  insertBefore(child, ref) {
    if (!ref) return this.appendChild(child);
    if (child.parentNode) child.parentNode.removeChild(child);
    const i = this.childNodes.indexOf(ref);
    if (i < 0) throw new Error('insertBefore: reference node is not a child');
    child.parentNode = this;
    this.childNodes.splice(i, 0, child);
    return child;
  }
  removeChild(child) {
    const i = this.childNodes.indexOf(child);
    if (i < 0) throw new Error('removeChild: node is not a child');
    this.childNodes.splice(i, 1);
    child.parentNode = null;
    return child;
  }
  replaceChild(newChild, oldChild) {
    this.insertBefore(newChild, oldChild);
    this.removeChild(oldChild);
    return oldChild;
  }
  replaceWith(...nodes) {
    const parent = this.parentNode;
    if (!parent) return;
    const ref = this.nextSibling;
    parent.removeChild(this);
    for (const n of nodes) parent.insertBefore(this._toNode(n), ref);
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  _toNode(n) { return n instanceof Node ? n : this.ownerDocument.createTextNode(String(n)); }

  // --- events -------------------------------------------------------------
  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    const list = this._listeners.get(type);
    if (!list.includes(fn)) list.push(fn);
  }
  removeEventListener(type, fn) {
    const list = this._listeners.get(type);
    if (list) { const i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); }
  }
  dispatchEvent(event) {
    if (!(event instanceof Event)) throw new TypeError('dispatchEvent expects an Event');
    event.target = event.target || this;
    let node = this;
    while (node) {
      event.currentTarget = node;
      const inline = node['on' + event.type];
      if (typeof inline === 'function') inline.call(node, event);
      for (const fn of [...(node._listeners.get(event.type) || [])]) {
        if (typeof fn === 'function') fn.call(node, event);
        else if (fn && typeof fn.handleEvent === 'function') fn.handleEvent(event);
        if (event._stopped) break;
      }
      if (event._stopped || !event.bubbles) break;
      node = node.parentNode;
    }
    event.currentTarget = null;
    return !event.defaultPrevented;
  }
}

class TextNode extends Node {
  constructor(doc, text) { super(doc); this.nodeType = 3; this.nodeName = '#text'; this.data = String(text); }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
  get nodeValue() { return this.data; }
  set nodeValue(v) { this.data = String(v); }
}

class DocumentFragment extends Node {
  constructor(doc) { super(doc); this.nodeType = 11; this.nodeName = '#document-fragment'; }
  querySelectorAll(sel) { return queryAll(this, sel); }
  querySelector(sel) { return queryAll(this, sel)[0] || null; }
}

class ClassList {
  constructor(el) { this._el = el; }
  _get() { return this._el.className.split(/\s+/).filter(Boolean); }
  _set(list) { this._el.className = list.join(' '); }
  get length() { return this._get().length; }
  contains(c) { return this._get().includes(c); }
  add(...cs) { const l = this._get(); for (const c of cs) if (!l.includes(c)) l.push(c); this._set(l); }
  remove(...cs) { this._set(this._get().filter(c => !cs.includes(c))); }
  toggle(c, force) {
    const has = this.contains(c);
    const want = force === undefined ? !has : !!force;
    if (want && !has) this.add(c); else if (!want && has) this.remove(c);
    return want;
  }
  replace(a, b) { if (!this.contains(a)) return false; this.remove(a); this.add(b); return true; }
  item(i) { return this._get()[i] ?? null; }
  forEach(fn) { this._get().forEach(fn); }
  [Symbol.iterator]() { return this._get()[Symbol.iterator](); }
  toString() { return this._el.className; }
  get value() { return this._el.className; }
}

class Element extends Node {
  constructor(doc, tag) {
    super(doc);
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.nodeName = this.tagName;
    this.localName = tag.toLowerCase();
    this.className = '';
    this.id = '';
    this.title = '';
    this.type = this.localName === 'input' ? 'text' : (this.localName === 'button' ? 'submit' : '');
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.tabIndex = -1;
    this.placeholder = '';
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.classList = new ClassList(this);
  }

  // --- content -------------------------------------------------------------
  get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
  set textContent(v) {
    this._clear();
    if (v !== '' && v !== null && v !== undefined) this.appendChild(new TextNode(this.ownerDocument, v));
  }
  get innerText() { return this.textContent; }
  set innerText(v) { this.textContent = v; }
  get innerHTML() { return this.textContent; }
  set innerHTML(v) {
    this._clear();
    const text = String(v ?? '').replace(/<[^>]*>/g, '');
    if (text) this.appendChild(new TextNode(this.ownerDocument, text));
  }
  _clear() { for (const c of this.childNodes) c.parentNode = null; this.childNodes = []; }

  // --- attributes ----------------------------------------------------------
  setAttribute(name, value) {
    value = String(value);
    this.attributes[name] = value;
    if (name === 'class') this.className = value;
    else if (name === 'id') this.id = value;
    else if (name === 'type') this.type = value;
    else if (name === 'title') this.title = value;
    else if (name === 'value') this.value = value;
    else if (name === 'placeholder') this.placeholder = value;
    else if (name === 'hidden') this.hidden = true;
    else if (name === 'checked') this.checked = true;
    else if (name === 'disabled') this.disabled = true;
    else if (name === 'tabindex') this.tabIndex = Number(value);
    else if (name.startsWith('data-')) this.dataset[camel(name.slice(5))] = value;
  }
  getAttribute(name) {
    if (name === 'class') return this.className || null;
    if (name === 'id') return this.id || null;
    if (name === 'hidden') return this.hidden ? '' : null;
    if (name in this.attributes) return this.attributes[name];
    if (name.startsWith('data-')) { const v = this.dataset[camel(name.slice(5))]; return v === undefined ? null : v; }
    if (['type', 'title', 'value', 'placeholder'].includes(name)) return this[name] || null;
    return null;
  }
  hasAttribute(name) { return this.getAttribute(name) !== null; }
  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'class') this.className = '';
    else if (name === 'id') this.id = '';
    else if (name === 'hidden') this.hidden = false;
    else if (name === 'checked') this.checked = false;
    else if (name === 'disabled') this.disabled = false;
    else if (name.startsWith('data-')) delete this.dataset[camel(name.slice(5))];
  }

  // --- querying ------------------------------------------------------------
  querySelectorAll(sel) { return queryAll(this, sel); }
  querySelector(sel) { return queryAll(this, sel)[0] || null; }
  getElementsByClassName(c) { return queryAll(this, '.' + c); }
  getElementsByTagName(t) { return queryAll(this, t); }
  matches(sel) { return parseSelectorList(sel).some(s => matchesComplex(this, s)); }
  closest(sel) { for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (n.matches(sel)) return n; return null; }

  // --- user-ish interactions ------------------------------------------------
  focus() {
    if (this.ownerDocument.activeElement === this) return;
    this.ownerDocument.activeElement = this;
    this.dispatchEvent(new Event('focus', { bubbles: false }));
  }
  blur() {
    if (this.ownerDocument.activeElement !== this) return;
    this.ownerDocument.activeElement = this.ownerDocument.body;
    this.dispatchEvent(new Event('blur', { bubbles: false }));
  }
  select() {}
  click() {
    if (this.disabled) return;
    if (this.localName === 'input' && (this.type === 'checkbox' || this.type === 'radio')) {
      this.checked = !this.checked;
      this.dispatchEvent(new MouseEvent('click'));
      this.dispatchEvent(new Event('change'));
      return;
    }
    const notCancelled = this.dispatchEvent(new MouseEvent('click'));
    if (notCancelled && this.localName === 'button' && this.type === 'submit') {
      const form = this.closest('form');
      if (form) form.requestSubmit();
    }
  }
  requestSubmit() { this.dispatchEvent(new Event('submit')); }
  submit() {}
  reset() { for (const i of queryAll(this, 'input')) { i.value = ''; i.checked = false; } }
  getBoundingClientRect() { return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  scrollIntoView() {}

  get outerHTML() {
    const attrs = [];
    if (this.id) attrs.push(` id="${this.id}"`);
    if (this.className) attrs.push(` class="${this.className}"`);
    if (this.hidden) attrs.push(' hidden');
    for (const [k, v] of Object.entries(this.dataset)) attrs.push(` data-${kebab(k)}="${v}"`);
    if (this.localName === 'input') {
      attrs.push(` type="${this.type}"`);
      if (this.value) attrs.push(` value="${this.value}"`);
      if (this.checked) attrs.push(' checked');
    }
    const inner = this.childNodes.map(n => (n.nodeType === 1 ? n.outerHTML : n.textContent)).join('');
    return VOID_TAGS.has(this.localName)
      ? `<${this.localName}${attrs.join('')}>`
      : `<${this.localName}${attrs.join('')}>${inner}</${this.localName}>`;
  }
}

function camel(s) { return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }
function kebab(s) { return s.replace(/[A-Z]/g, c => '-' + c.toLowerCase()); }

// --------------------------------------------------------------------------
// Selector engine (tiny)
// --------------------------------------------------------------------------
function parseSelectorList(sel) {
  return String(sel).split(',').map(s => s.trim()).filter(Boolean).map(parseComplex);
}
function parseComplex(sel) {
  // Tokenise into compounds and combinators (' ' or '>').
  const tokens = sel.replace(/\s*>\s*/g, ' > ').trim().split(/\s+/);
  const parts = [];
  let combinator = ' ';
  for (const t of tokens) {
    if (t === '>') { combinator = '>'; continue; }
    parts.push({ combinator, compound: parseCompound(t) });
    combinator = ' ';
  }
  return parts;
}
function parseCompound(s) {
  const c = { tag: null, id: null, classes: [], attrs: [] };
  const re = /^([a-zA-Z][\w-]*|\*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:([~|^$*]?=)"?([^"\]]*)"?)?\]/g;
  let m, consumed = 0;
  while ((m = re.exec(s))) {
    consumed = re.lastIndex;
    if (m[1] !== undefined) c.tag = m[1] === '*' ? null : m[1].toLowerCase();
    else if (m[2] !== undefined) c.id = m[2];
    else if (m[3] !== undefined) c.classes.push(m[3]);
    else if (m[4] !== undefined) c.attrs.push({ name: m[4], op: m[5] || null, value: m[6] });
  }
  if (consumed !== s.length) throw new Error(`dom-stub: unsupported selector "${s}"`);
  return c;
}
function matchesCompound(el, c) {
  if (el.nodeType !== 1) return false;
  if (c.tag && el.localName !== c.tag) return false;
  if (c.id && el.id !== c.id) return false;
  if (c.classes.length && !c.classes.every(k => el.classList.contains(k))) return false;
  for (const a of c.attrs) {
    const v = el.getAttribute(a.name);
    if (a.op === null) { if (v === null) return false; continue; }
    if (v === null) return false;
    if (a.op === '=' && v !== a.value) return false;
    if (a.op === '^=' && !v.startsWith(a.value)) return false;
    if (a.op === '$=' && !v.endsWith(a.value)) return false;
    if (a.op === '*=' && !v.includes(a.value)) return false;
    if (a.op === '~=' && !v.split(/\s+/).includes(a.value)) return false;
  }
  return true;
}
function matchesComplex(el, parts) {
  let i = parts.length - 1;
  if (!matchesCompound(el, parts[i].compound)) return false;
  let node = el;
  while (--i >= 0) {
    const { compound } = parts[i];
    const comb = parts[i + 1].combinator;
    if (comb === '>') {
      node = node.parentNode;
      if (!node || !matchesCompound(node, compound)) return false;
    } else {
      node = node.parentNode;
      while (node && !matchesCompound(node, compound)) node = node.parentNode;
      if (!node) return false;
    }
  }
  return true;
}
function descendants(root, out = []) {
  for (const c of root.childNodes) { if (c.nodeType === 1) out.push(c); descendants(c, out); }
  return out;
}
function queryAll(root, sel) {
  const selectors = parseSelectorList(sel);
  return descendants(root).filter(el => selectors.some(s => matchesComplex(el, s)));
}

// --------------------------------------------------------------------------
// Document
// --------------------------------------------------------------------------
class Document extends Node {
  constructor() {
    super(null);
    this.ownerDocument = this;
    this.nodeType = 9;
    this.nodeName = '#document';
    this.activeElement = null;
    this.documentElement = null;
    this.head = null;
    this.body = null;
    this.readyState = 'complete';
    this.title = '';
  }
  createElement(tag) { return new Element(this, tag); }
  createTextNode(text) { return new TextNode(this, text); }
  createDocumentFragment() { return new DocumentFragment(this); }
  getElementById(id) { return descendants(this).find(e => e.id === id) || null; }
  querySelectorAll(sel) { return queryAll(this, sel); }
  querySelector(sel) { return queryAll(this, sel)[0] || null; }
  getElementsByClassName(c) { return queryAll(this, '.' + c); }
  getElementsByTagName(t) { return queryAll(this, t); }
}

// --------------------------------------------------------------------------
// Tiny HTML parser: enough for index.html (tags, attributes, text, void tags,
// comments, doctype). <script>/<style> bodies are kept as text, never run.
// --------------------------------------------------------------------------
function parseHTML(html, doc) {
  const root = doc.createDocumentFragment();
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[\w-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[0].startsWith('<!')) continue;
    if (m[1]) { // closing tag
      const name = m[1].toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].localName === name) { stack.length = i; break; }
      }
    } else if (m[2]) { // opening tag
      const el = doc.createElement(m[2]);
      const attrRe = /([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
      let a;
      while ((a = attrRe.exec(m[3] || ''))) el.setAttribute(a[1], a[2] ?? a[3] ?? a[4] ?? '');
      top.appendChild(el);
      const name = el.localName;
      if (!VOID_TAGS.has(name) && !m[4]) {
        if (name === 'script' || name === 'style') {
          const close = new RegExp(`</${name}\\s*>`, 'i');
          const rest = html.slice(re.lastIndex);
          const idx = rest.search(close);
          const body = idx >= 0 ? rest.slice(0, idx) : rest;
          if (body.trim()) el.appendChild(doc.createTextNode(body));
          re.lastIndex += idx >= 0 ? idx + rest.match(close)[0].length : rest.length;
        } else {
          stack.push(el);
        }
      }
    } else if (m[5] !== undefined) {
      if (m[5].trim()) top.appendChild(doc.createTextNode(m[5]));
    }
  }
  return root;
}

function createDocument(html) {
  const doc = new Document();
  const frag = parseHTML(html, doc);
  let htmlEl = frag.children.find(e => e.localName === 'html');
  if (!htmlEl) { htmlEl = doc.createElement('html'); for (const c of [...frag.childNodes]) htmlEl.appendChild(c); }
  let head = htmlEl.children.find(e => e.localName === 'head');
  let body = htmlEl.children.find(e => e.localName === 'body');
  if (!head) { head = doc.createElement('head'); htmlEl.insertBefore(head, htmlEl.firstChild); }
  if (!body) {
    body = doc.createElement('body');
    for (const c of [...htmlEl.childNodes]) if (c !== head) body.appendChild(c);
    htmlEl.appendChild(body);
  }
  doc.appendChild(htmlEl);
  doc.documentElement = htmlEl;
  doc.head = head;
  doc.body = body;
  doc.activeElement = body;
  const t = head.querySelector('title');
  if (t) doc.title = t.textContent;
  return doc;
}

// --------------------------------------------------------------------------
// localStorage
// --------------------------------------------------------------------------
function createLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, String(v)]));
  return {
    getItem: k => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => { store.set(String(k), String(v)); },
    removeItem: k => { store.delete(String(k)); },
    clear: () => { store.clear(); },
    key: i => [...store.keys()][i] ?? null,
    get length() { return store.size; },
    // test convenience
    _dump: () => Object.fromEntries(store),
  };
}

// --------------------------------------------------------------------------
// loadApp: fresh context + index.html tree + app.js executed inside it.
// --------------------------------------------------------------------------
const DEFAULT_HTML = `<!DOCTYPE html><html><head><title>Todo</title></head><body>
<div id="app"><h1>Todo</h1>
<form id="add-form"><input id="new-todo" type="text" placeholder="Add a new todo..." autocomplete="off"><button type="submit">Add</button></form>
<ul id="todo-list"></ul></div></body></html>`;

/**
 * Build a fresh fake browser, run app.js in it and return the context.
 *
 * The returned object is the vm global: every top-level `function` in app.js
 * is a property on it (createTodo, deleteTodo, toggleComplete, render,
 * buildItem, loadTodos, saveTodos, startEdit, ...). The module-scoped
 * `let todos` is exposed through a live accessor as `ctx.todos`.
 * Also available: ctx.document, ctx.localStorage, ctx.Event, ctx.KeyboardEvent.
 *
 * @param {object} [opts]
 * @param {object} [opts.storage]  initial localStorage contents ({ key: string })
 * @param {any[]}  [opts.todos]    convenience: initial todos array (JSON-stored under 'todos')
 * @param {string} [opts.html]     HTML to seed the document with (default: repo index.html)
 * @param {string} [opts.appPath]  path to app.js (default: repo app.js)
 */
function loadApp(opts = {}) {
  process.env.TZ = 'UTC'; // deterministic date formatting for tests
  const htmlPath = path.join(ROOT, 'index.html');
  const html = opts.html ?? (fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : DEFAULT_HTML);
  const appPath = opts.appPath ?? path.join(ROOT, 'app.js');

  const document = createDocument(html);
  const storage = { ...(opts.storage || {}) };
  if (opts.todos) storage.todos = JSON.stringify(opts.todos);
  const localStorage = createLocalStorage(storage);

  const sandbox = {
    document,
    localStorage,
    sessionStorage: createLocalStorage(),
    crypto: { randomUUID: () => nodeCrypto.randomUUID(), getRandomValues: a => nodeCrypto.webcrypto.getRandomValues(a) },
    console,
    Event, KeyboardEvent, MouseEvent, InputEvent, Node, Element, Document, DocumentFragment,
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    requestAnimationFrame: fn => setTimeout(() => fn(Date.now()), 0),
    cancelAnimationFrame: clearTimeout,
    alert: () => {}, confirm: () => true, prompt: () => null,
    navigator: { userAgent: 'node-dom-stub', language: 'en-US' },
    location: { href: 'file:///index.html', hash: '', search: '', pathname: '/index.html', reload() {} },
    addEventListener: (...a) => document.addEventListener(...a),
    removeEventListener: (...a) => document.removeEventListener(...a),
    dispatchEvent: e => document.dispatchEvent(e),
    Intl,
    structuredClone,
    URL, URLSearchParams, TextEncoder, TextDecoder,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);

  const src = fs.readFileSync(appPath, 'utf8');
  vm.runInContext(src, sandbox, { filename: appPath });

  // Expose script-scoped `let todos` (not a global property) via live accessors.
  try {
    const acc = vm.runInContext(
      '({ get todos() { return todos; }, set todos(v) { todos = v; } })',
      sandbox, { filename: 'dom-stub-accessor.js' },
    );
    Object.defineProperty(sandbox, 'todos', {
      configurable: true, enumerable: true,
      get: () => acc.todos, set: v => { acc.todos = v; },
    });
  } catch { /* app.js no longer has a `todos` binding; leave it */ }

  return sandbox;
}

// --------------------------------------------------------------------------
// Test helpers
// --------------------------------------------------------------------------
/** Dispatch a synthetic event on an element (e.g. fire(el, 'keydown', { key: 'Enter' })). */
function fire(el, type, init = {}) {
  const ev = type === 'keydown' || type === 'keyup' || type === 'keypress'
    ? new KeyboardEvent(type, init) : new Event(type, init);
  el.dispatchEvent(ev);
  return ev;
}

/** Type text into #new-todo and submit #add-form, like a user pressing Enter/Add. */
function addTodoViaForm(ctx, text) {
  const input = ctx.document.getElementById('new-todo');
  input.value = text;
  return fire(ctx.document.getElementById('add-form'), 'submit');
}

/** All rendered .todo-item elements, in DOM order. */
function items(ctx) { return ctx.document.querySelectorAll('.todo-item'); }

/** The rendered .todo-item for a given todo id (or null). */
function itemFor(ctx, id) { return items(ctx).find(li => li.dataset.id === id) || null; }

/** Parsed contents of localStorage['todos'] (or null). */
function storedTodos(ctx) {
  const raw = ctx.localStorage.getItem('todos');
  return raw === null ? null : JSON.parse(raw);
}

/**
 * Is an element hidden? Accepts any of the common conventions:
 * `hidden` property/attribute, a `hidden` class, or inline display:none.
 * An element that is null / detached counts as hidden.
 */
function isHidden(el) {
  if (!el || !el.isConnected) return true;
  for (let n = el; n && n.nodeType === 1; n = n.parentNode) {
    if (n.hidden === true) return true;
    if (n.classList.contains('hidden')) return true;
    if (n.style && n.style.display === 'none') return true;
  }
  return false;
}

module.exports = {
  loadApp, createDocument, createLocalStorage, parseHTML,
  Event, KeyboardEvent, Element, Document,
  fire, addTodoViaForm, items, itemFor, storedTodos, isHidden,
};
