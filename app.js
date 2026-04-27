const STORAGE_KEY = 'todos';

function loadTodos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTodos(todos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function createTodo(text) {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
}

function formatTimestamp(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

let todos = loadTodos();

function render() {
  const list = document.getElementById('todo-list');
  list.innerHTML = '';

  const active = todos.filter(t => !t.completed);
  const done = todos.filter(t => t.completed);

  active.forEach(todo => list.appendChild(buildItem(todo)));

  if (done.length > 0) {
    if (active.length > 0) {
      const divider = document.createElement('li');
      divider.className = 'divider';
      divider.textContent = 'Completed';
      list.appendChild(divider);
    }
    done
      .slice()
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .forEach(todo => list.appendChild(buildItem(todo)));
  }
}

function buildItem(todo) {
  const li = document.createElement('li');
  li.className = 'todo-item' + (todo.completed ? ' completed' : '');
  li.dataset.id = todo.id;

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = todo.completed;
  checkbox.addEventListener('change', () => toggleComplete(todo.id));

  // Body
  const body = document.createElement('div');
  body.className = 'todo-body';

  const textEl = document.createElement('span');
  textEl.className = 'todo-text';
  textEl.textContent = todo.text;
  textEl.title = 'Click to edit';
  textEl.addEventListener('click', () => startEdit(todo.id, li, textEl));

  body.appendChild(textEl);

  if (todo.completed && todo.completedAt) {
    const stamp = document.createElement('div');
    stamp.className = 'completed-at';
    stamp.textContent = 'Completed ' + formatTimestamp(todo.completedAt);
    body.appendChild(stamp);
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'todo-actions';

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '✕';
  deleteBtn.title = 'Delete';
  deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

  actions.appendChild(deleteBtn);

  li.appendChild(checkbox);
  li.appendChild(body);
  li.appendChild(actions);

  return li;
}

function startEdit(id, li, textEl) {
  const todo = todos.find(t => t.id === id);
  if (!todo || todo.completed) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'todo-text-input';
  input.value = todo.text;

  textEl.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    const newText = input.value.trim();
    if (newText && newText !== todo.text) {
      todo.text = newText;
      saveTodos(todos);
    }
    render();
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      input.value = todo.text;
      input.blur();
    }
  });
}

function toggleComplete(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  todo.completed = !todo.completed;
  todo.completedAt = todo.completed ? new Date().toISOString() : null;
  saveTodos(todos);
  render();
}

function deleteTodo(id) {
  const index = todos.findIndex(t => t.id === id);
  todos.splice(index, 1);
  saveTodos(todos);
  render();
}

// Form submit
document.getElementById('add-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('new-todo');
  const text = input.value.trim();
  if (!text) return;
  todos.unshift(createTodo(text));
  saveTodos(todos);
  input.value = '';
  render();
});

render();
