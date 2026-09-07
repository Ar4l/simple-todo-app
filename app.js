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

function createTodo(text, dueDate = null) {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    dueDate: dueDate ? parseDate(dueDate) : null,
  };
}

function parseDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatTimestamp(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[d.getMonth()] + ' ' + d.getDate();
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const dueDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate < today;
}

let todos = loadTodos();

// Visiting index.html?demo on an empty list seeds a few sample todos.
const SAMPLE_TODOS = [
  ['Write the tool-call loop', false],
  ['Fix #1: crash when deleting the last todo', false],
  ['Add due dates (#3) and descriptions (#2)', false],
  ['Pull a local model with ollama pull', true],
  ['Fork simple-todo-app', true],
];
if (todos.length === 0 && new URLSearchParams(location.search).has('demo')) {
  todos = SAMPLE_TODOS.map(([text, done], i) => {
    const t = createTodo(text);
    if (done) {
      t.completed = true;
      t.completedAt = new Date(Date.now() - (i + 1) * 3600 * 1000).toISOString();
    }
    return t;
  });
  saveTodos(todos);
}

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
  textEl.addEventListener('click', () => startEdit(todo.id));

  body.appendChild(textEl);

  if (todo.completed && todo.completedAt) {
    const stamp = document.createElement('div');
    stamp.className = 'completed-at';
    stamp.textContent = 'Completed ' + formatTimestamp(todo.completedAt);
    body.appendChild(stamp);
  } else if (todo.dueDate) {
    const dueStamp = document.createElement('span');
    dueStamp.className = 'due-date';
    dueStamp.textContent = 'due ' + formatDate(todo.dueDate);
    dueStamp.classList.toggle('overdue', isOverdue(todo.dueDate));
    body.appendChild(dueStamp);
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'todo-actions';

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'x';
  deleteBtn.title = 'Delete';
  deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

  const dueDateBtn = document.createElement('button');
  dueDateBtn.type = 'button';
  dueDateBtn.title = 'Edit due date';
  dueDateBtn.dataset.id = todo.id; // Store id for easier lookup
  dueDateBtn.addEventListener('click', () => editDueDate(todo.id));
  
  actions.appendChild(dueDateBtn);
  actions.appendChild(deleteBtn);

  li.appendChild(checkbox);
  li.appendChild(body);
  li.appendChild(actions);

  return li;
}

function startEdit(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo || todo.completed) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'todo-text-input';
  input.value = todo.text;

  const textEl = document.querySelector('.todo-text');
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

function editDueDate(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo || todo.completed) return;

  // Get the date input from the form
  const dateInputEl = document.getElementById('new-due-date');
  
  // Hide button by default, show when there's a due date to edit
  if (dateInputEl) {
    // Hide input by default, show when there's a due date to edit
    if (todo.dueDate) {
      dateInputEl.value = formatDate(todo.dueDate.split('T')[0]);
      dateInputEl.style.display = 'block';
    } else {
      dateInputEl.value = '';
      dateInputEl.style.display = 'none';
    }
  }

  const dueDateBtn = document.querySelector('[title*="due date"]');
  if (dueDateBtn) {
    // Show button when there's a due date, hide when no due date
    if (todo.dueDate) {
      dueDateBtn.textContent = '📅';
    } else {
      dueDateBtn.textContent = '🗓️';
      dueDateBtn.style.display = 'none';
    }
  }

  // Save the original value for restoration on ESC
  const originalValue = dateInputEl ? dateInputEl.value : '';

  if (!dateInputEl) return;

  dateInputEl.addEventListener('change', () => {
    const val = dateInputEl.value.trim();
    if (!val) {
      todo.dueDate = null;
    } else {
      todo.dueDate = parseDate(val);
    }
    saveTodos(todos);
    render();
  });

  dateInputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      dateInputEl.blur();
    }
    if (e.key === 'Escape') {
      dateInputEl.value = originalValue;
      dateInputEl.blur();
    }
  });

  document.body.appendChild(dateInputEl);
  dateInputEl.focus();
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
  // Move focus to the next item's delete button so the user can keep deleting with keyboard
  const items = document.querySelectorAll('.todo-item');
  items[Math.min(index, items.length - 1)].querySelector('.todo-actions button').focus();
}

// Form submit
document.getElementById('add-form').addEventListener('submit', e => {
  e.preventDefault();
  const textInput = document.getElementById('new-todo');
  const text = textInput.value.trim();
  if (!text) return;

  // Get due date from optional input if exists
  let dueDate = null;
  const dateInput = document.getElementById('new-due-date');
  if (dateInput && dateInput.value) {
    dueDate = dateInput.value;
  }

  todos.unshift(createTodo(text, dueDate));
  saveTodos(todos);
  
  // Hide the date input after submission
  if (dateInput) {
    dateInput.value = '';
  }
  render();
});

render();
