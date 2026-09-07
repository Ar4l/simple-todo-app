'use strict';
// Issue #1: Crash when deleting the only remaining todo.
// Contract: deleteTodo(id) never throws, regardless of list size or position;
// the todo is removed from state, storage and the DOM.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, addTodoViaForm, items, itemFor, storedTodos } = require('./dom-stub.js');

describe('issue #1: deleting the only todo', () => {
  test('deleteTodo() on the only todo does not throw and leaves an empty list', () => {
    const ctx = loadApp();
    addTodoViaForm(ctx, 'only one');
    const id = ctx.todos[0].id;

    assert.doesNotThrow(() => ctx.deleteTodo(id));

    assert.equal(ctx.todos.length, 0);
    assert.equal(items(ctx).length, 0);
    assert.deepEqual(storedTodos(ctx), []);
  });

  test('clicking the delete button of the only todo does not throw', () => {
    const ctx = loadApp();
    addTodoViaForm(ctx, 'only one');
    const li = itemFor(ctx, ctx.todos[0].id);

    assert.doesNotThrow(() => li.querySelector('.todo-actions button').click());

    assert.equal(ctx.todos.length, 0);
    assert.equal(ctx.document.getElementById('todo-list').children.length, 0);
  });

  test('deleting the last of several todos still works', () => {
    const ctx = loadApp();
    addTodoViaForm(ctx, 'a');
    addTodoViaForm(ctx, 'b');
    addTodoViaForm(ctx, 'c'); // DOM order: c, b, a
    const last = ctx.todos[ctx.todos.length - 1];

    assert.doesNotThrow(() => ctx.deleteTodo(last.id));

    assert.deepEqual(Array.from(ctx.todos, t => t.text), ['c', 'b']);
    assert.deepEqual(items(ctx).map(li => li.querySelector('.todo-text').textContent), ['c', 'b']);
  });

  test('deleting every todo one by one never throws', () => {
    const ctx = loadApp();
    for (const t of ['a', 'b', 'c']) addTodoViaForm(ctx, t);
    assert.doesNotThrow(() => {
      while (ctx.todos.length) ctx.deleteTodo(ctx.todos[0].id);
    });
    assert.equal(items(ctx).length, 0);
    assert.deepEqual(storedTodos(ctx), []);
  });
});
