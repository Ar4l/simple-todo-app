'use strict';
// Issue #2: Optional description field.
// Contract:
//  - createTodo(text) returns description: ''  (and the field is persisted).
//  - A todo with a non-empty description renders an element with class
//    `todo-toggle` inside its `.todo-item`; a todo with an empty description
//    renders no `.todo-toggle`.
//  - Clicking `.todo-toggle` toggles the visibility of an element with class
//    `todo-description` (inside the same `.todo-item`) whose textContent
//    contains the description. Hidden by default. "Hidden" may be expressed
//    as the `hidden` property/attribute, a `hidden` class, display:none, or
//    by not rendering the element until expanded.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, addTodoViaForm, itemFor, storedTodos, isHidden } = require('./dom-stub.js');

function seeded(description) {
  const todo = {
    id: 'todo-1', text: 'title', completed: false, completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', description,
  };
  const ctx = loadApp({ todos: [todo] });
  return { ctx, todo, li: itemFor(ctx, todo.id) };
}

describe('issue #2: description field', () => {
  test('createTodo() defaults description to ""', () => {
    const ctx = loadApp();
    const t = ctx.createTodo('x');
    assert.ok('description' in t, 'todo has a description field');
    assert.equal(t.description, '');
  });

  test('a todo added through the form is persisted with description ""', () => {
    const ctx = loadApp();
    addTodoViaForm(ctx, 'x');
    assert.equal(storedTodos(ctx)[0].description, '');
  });

  test('a todo with a description renders a .todo-toggle inside its .todo-item', () => {
    const { li } = seeded('some notes');
    assert.ok(li, 'todo item rendered');
    assert.equal(li.querySelectorAll('.todo-toggle').length, 1);
  });

  test('a todo with an empty description renders no .todo-toggle', () => {
    const { li } = seeded('');
    assert.ok(li, 'todo item rendered');
    assert.equal(li.querySelectorAll('.todo-toggle').length, 0);
    assert.equal(li.querySelector('.todo-text').textContent, 'title', 'looks like today');
  });

  test('the description is hidden by default', () => {
    const { li } = seeded('some notes');
    const desc = li.querySelector('.todo-description');
    assert.ok(isHidden(desc), '.todo-description must be hidden (or absent) before toggling');
  });

  test('clicking .todo-toggle shows the description; clicking again hides it', () => {
    const { ctx, todo } = seeded('detailed notes here');

    let li = itemFor(ctx, todo.id);
    li.querySelector('.todo-toggle').click();

    li = itemFor(ctx, todo.id); // the app may re-render
    const desc = li.querySelector('.todo-description');
    assert.ok(desc, '.todo-description is rendered inside the .todo-item after expanding');
    assert.ok(!isHidden(desc), '.todo-description is visible after expanding');
    assert.ok(desc.textContent.includes('detailed notes here'), 'description text is shown');

    li.querySelector('.todo-toggle').click();
    li = itemFor(ctx, todo.id);
    assert.ok(isHidden(li.querySelector('.todo-description')), 'collapsed again');
  });

  test('description round-trips through localStorage', () => {
    const { ctx } = seeded('persist me');
    assert.equal(ctx.todos[0].description, 'persist me', 'loaded from storage');
    ctx.todos[0].description = 'edited';
    ctx.saveTodos(ctx.todos);
    assert.equal(storedTodos(ctx)[0].description, 'edited');
    assert.equal(ctx.loadTodos()[0].description, 'edited');
  });
});
