'use strict';
// Issue #3: Due date support.
// Contract:
//  - createTodo(text) returns dueDate: null (and the field is persisted).
//  - A todo whose dueDate is an ISO date string ('YYYY-MM-DD') renders an
//    element with class `due-date` inside its `.todo-item`; its textContent
//    contains the day-of-month digits (e.g. '15' for '2026-05-15') or the raw
//    ISO string. A todo with dueDate null renders no `.due-date`.
//  - If dueDate is before today and the todo is not completed, `.due-date`
//    also has class `overdue`. Completed todos never have `overdue`.
//    Future dates never have `overdue`.
// Dates are evaluated in UTC (the test harness sets TZ=UTC).
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, addTodoViaForm, itemFor, storedTodos } = require('./dom-stub.js');

function seeded(dueDate, completed = false) {
  const todo = {
    id: 'todo-1', text: 'title', completed, completedAt: completed ? '2026-01-02T00:00:00.000Z' : null,
    createdAt: '2026-01-01T00:00:00.000Z', dueDate,
  };
  const ctx = loadApp({ todos: [todo] });
  return { ctx, todo, li: itemFor(ctx, todo.id) };
}

describe('issue #3: due dates', () => {
  test('createTodo() defaults dueDate to null', () => {
    const ctx = loadApp();
    const t = ctx.createTodo('x');
    assert.ok('dueDate' in t, 'todo has a dueDate field');
    assert.equal(t.dueDate, null);
  });

  test('a todo added through the form is persisted with dueDate null', () => {
    const ctx = loadApp();
    addTodoViaForm(ctx, 'x');
    const stored = storedTodos(ctx)[0];
    assert.ok('dueDate' in stored);
    assert.equal(stored.dueDate, null);
  });

  test('a todo with a dueDate renders a .due-date showing the day', () => {
    const { li } = seeded('2999-05-15');
    assert.ok(li, 'todo item rendered');
    const due = li.querySelectorAll('.due-date');
    assert.equal(due.length, 1, 'exactly one .due-date inside the .todo-item');
    const text = due[0].textContent;
    assert.ok(text.includes('15') || text.includes('2999-05-15'), `due date text "${text}" shows the day`);
  });

  test('a todo with dueDate null renders no .due-date', () => {
    const { li } = seeded(null);
    assert.ok(li, 'todo item rendered');
    assert.equal(li.querySelectorAll('.due-date').length, 0);
  });

  test('a past dueDate on an active todo is marked .overdue', () => {
    const { li } = seeded('2000-01-01');
    const due = li.querySelector('.due-date');
    assert.ok(due, '.due-date rendered');
    assert.ok(due.classList.contains('overdue'), '.due-date has class "overdue"');
  });

  test('a past dueDate on a completed todo is NOT marked .overdue', () => {
    const { li } = seeded('2000-01-01', true);
    const due = li.querySelector('.due-date');
    assert.ok(due, '.due-date is still rendered for completed todos');
    assert.ok(!due.classList.contains('overdue'), 'completed todos ignore overdue highlighting');
  });

  test('a future dueDate is NOT marked .overdue', () => {
    const { li } = seeded('2999-12-31');
    const due = li.querySelector('.due-date');
    assert.ok(due, '.due-date rendered');
    assert.ok(!due.classList.contains('overdue'));
  });

  test('dueDate round-trips through localStorage', () => {
    const { ctx } = seeded('2999-05-15');
    assert.equal(ctx.todos[0].dueDate, '2999-05-15', 'loaded from storage');
    ctx.todos[0].dueDate = '2999-06-01';
    ctx.saveTodos(ctx.todos);
    assert.equal(storedTodos(ctx)[0].dueDate, '2999-06-01');
    assert.equal(ctx.loadTodos()[0].dueDate, '2999-06-01');
    ctx.todos[0].dueDate = null;
    ctx.saveTodos(ctx.todos);
    assert.equal(storedTodos(ctx)[0].dueDate, null, 'clearing the date persists null');
  });
});
