'use strict';
// Regression tests for behaviour that already works on main. These must keep
// passing while issues are fixed.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, fire, addTodoViaForm, items, itemFor, storedTodos } = require('./dom-stub.js');

describe('baseline: adding todos', () => {
  test('submitting the form adds a todo at the top of the list and clears the input', () => {
    const ctx = loadApp();
    addTodoViaForm(ctx, 'first');
    addTodoViaForm(ctx, '  second  ');

    assert.equal(ctx.todos.length, 2);
    assert.equal(ctx.todos[0].text, 'second', 'newest todo is first in state (trimmed)');
    assert.equal(ctx.todos[1].text, 'first');

    const texts = items(ctx).map(li => li.querySelector('.todo-text').textContent);
    assert.deepEqual(texts, ['second', 'first'], 'newest todo renders first');
    assert.equal(ctx.document.getElementById('new-todo').value, '', 'input is cleared');
  });

  test('createTodo() returns the documented shape', () => {
    const ctx = loadApp();
    const t = ctx.createTodo('  buy milk ');
    assert.equal(typeof t.id, 'string');
    assert.ok(t.id.length > 0);
    assert.equal(t.text, 'buy milk');
    assert.equal(t.completed, false);
    assert.equal(t.completedAt, null);
    assert.ok(!Number.isNaN(Date.parse(t.createdAt)), 'createdAt is an ISO date');
  });

  test('blank input is ignored', () => {
    const ctx = loadApp();
    addTodoViaForm(ctx, '   ');
    assert.equal(ctx.todos.length, 0);
    assert.equal(items(ctx).length, 0);
    assert.equal(ctx.localStorage.getItem('todos'), null, 'nothing saved');
  });
});

describe('baseline: completing todos', () => {
  test('toggling moves the todo to the completed section with a "Completed " timestamp', () => {
    const ctx = loadApp();
    addTodoViaForm(ctx, 'a');
    addTodoViaForm(ctx, 'b'); // order in DOM: b, a
    const [b, a] = ctx.todos;

    // Tick the checkbox of "b" (the first rendered item).
    itemFor(ctx, b.id).querySelector('input[type="checkbox"]').click();

    assert.equal(ctx.todos.find(t => t.id === b.id).completed, true);
    assert.ok(ctx.todos.find(t => t.id === b.id).completedAt, 'completedAt set');

    const lis = ctx.document.getElementById('todo-list').children;
    assert.deepEqual(lis.map(li => li.className), ['todo-item', 'divider', 'todo-item completed']);
    assert.equal(lis[0].dataset.id, a.id, 'active item first');
    assert.equal(lis[1].textContent, 'Completed', 'divider between sections');
    assert.equal(lis[2].dataset.id, b.id, 'completed item last');
    assert.ok(lis[2].querySelector('input[type="checkbox"]').checked);

    const stamp = lis[2].querySelector('.completed-at');
    assert.ok(stamp, 'completed item has a .completed-at element');
    assert.match(stamp.textContent, /^Completed \S/);
  });

  test('toggleComplete() twice returns the todo to active and clears completedAt', () => {
    const ctx = loadApp();
    addTodoViaForm(ctx, 'a');
    const id = ctx.todos[0].id;
    ctx.toggleComplete(id);
    ctx.toggleComplete(id);
    assert.equal(ctx.todos[0].completed, false);
    assert.equal(ctx.todos[0].completedAt, null);
    assert.equal(itemFor(ctx, id).className, 'todo-item');
    assert.equal(itemFor(ctx, id).querySelector('.completed-at'), null);
  });

  test('no divider is rendered when every todo is completed', () => {
    const ctx = loadApp();
    addTodoViaForm(ctx, 'a');
    ctx.toggleComplete(ctx.todos[0].id);
    assert.equal(ctx.document.querySelectorAll('.divider').length, 0);
    assert.equal(items(ctx).length, 1);
  });
});

describe('baseline: editing todos', () => {
  test('startEdit + Enter saves the new text and persists it', () => {
    const ctx = loadApp();
    addTodoViaForm(ctx, 'old');
    const id = ctx.todos[0].id;
    const li = itemFor(ctx, id);
    const textEl = li.querySelector('.todo-text');

    textEl.click(); // app wires click -> startEdit(id, li, textEl)
    const input = li.querySelector('input.todo-text-input');
    assert.ok(input, 'text is replaced by an input');
    assert.equal(li.querySelector('.todo-text'), null);
    assert.equal(input.value, 'old');
    assert.equal(ctx.document.activeElement, input, 'input is focused');

    input.value = 'new';
    fire(input, 'keydown', { key: 'Enter' });

    assert.equal(ctx.todos[0].text, 'new');
    assert.equal(storedTodos(ctx)[0].text, 'new', 'edit persisted');
    assert.equal(itemFor(ctx, id).querySelector('.todo-text').textContent, 'new', 're-rendered');
    assert.equal(itemFor(ctx, id).querySelector('.todo-text-input'), null);
  });

  test('Escape cancels the edit', () => {
    const ctx = loadApp();
    addTodoViaForm(ctx, 'keep');
    const id = ctx.todos[0].id;
    const li = itemFor(ctx, id);
    ctx.startEdit(id, li, li.querySelector('.todo-text'));
    const input = li.querySelector('.todo-text-input');
    input.value = 'discard';
    fire(input, 'keydown', { key: 'Escape' });
    assert.equal(ctx.todos[0].text, 'keep');
    assert.equal(itemFor(ctx, id).querySelector('.todo-text').textContent, 'keep');
  });

  test('completed todos are not editable', () => {
    const ctx = loadApp();
    addTodoViaForm(ctx, 'done');
    const id = ctx.todos[0].id;
    ctx.toggleComplete(id);
    const li = itemFor(ctx, id);
    li.querySelector('.todo-text').click();
    assert.equal(li.querySelector('.todo-text-input'), null);
    assert.ok(li.querySelector('.todo-text'));
  });
});

describe('baseline: deleting todos', () => {
  test('deleting one of two todos removes just that one without throwing', () => {
    const ctx = loadApp();
    addTodoViaForm(ctx, 'a');
    addTodoViaForm(ctx, 'b');
    const [b, a] = ctx.todos;

    assert.doesNotThrow(() => itemFor(ctx, b.id).querySelector('.todo-actions button').click());

    assert.deepEqual(Array.from(ctx.todos, t => t.id), [a.id]);
    assert.deepEqual(items(ctx).map(li => li.dataset.id), [a.id]);
    assert.deepEqual(storedTodos(ctx).map(t => t.id), [a.id], 'deletion persisted');
  });
});

describe('baseline: persistence', () => {
  test('state is saved to localStorage under the key "todos"', () => {
    const ctx = loadApp();
    addTodoViaForm(ctx, 'persist me');
    const stored = storedTodos(ctx);
    assert.ok(Array.isArray(stored));
    assert.equal(stored.length, 1);
    assert.equal(stored[0].text, 'persist me');
    assert.equal(stored[0].id, ctx.todos[0].id);
    assert.equal(stored[0].completed, false);
  });

  test('todos stored in localStorage are loaded and rendered on startup', () => {
    const seed = [
      { id: 'id-1', text: 'from storage', completed: false, completedAt: null, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'id-2', text: 'done one', completed: true, completedAt: '2026-01-02T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    const ctx = loadApp({ todos: seed });
    assert.equal(ctx.todos.length, 2);
    assert.deepEqual(Array.from(ctx.loadTodos(), t => t.id), ['id-1', 'id-2']);
    assert.deepEqual(items(ctx).map(li => li.dataset.id), ['id-1', 'id-2']);
    assert.ok(itemFor(ctx, 'id-2').classList.contains('completed'));
  });

  test('corrupt or missing storage yields an empty list', () => {
    assert.equal(loadApp().todos.length, 0);
    assert.equal(loadApp({ storage: { todos: '{not json' } }).todos.length, 0);
  });
});
