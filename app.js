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

function createTodo(text, dueDate) {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    dueDate: dueDate || null,
  };
}

function formatTimestamp(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  textEl.addEventListener('click', () => startEdit(todo.id, li, textEl));

  body.appendChild(textEl);

  // Due Date Display
  if (todo.dueDate) {
    const formattedDate = formatDate(todo.dueDate);
    const dateLabel = document.createElement('span');
    dateLabel.textContent = `due ${formattedDate}`;
    dateLabel.className = 'todo-due-date';

    const now = new Date();
    const due = new Date(todo.dueDate);
    
    // Overdue highlighting: if due date is in the past and item is not completed
    if (!todo.completed && due < now) {
      dateLabel.style.color = 'red';
    }

    body.appendChild(dateLabel);
  }

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
  deleteBtn.textContent = 'x';
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

  const editContainer = document.createElement('div');
  editContainer.className = 'todo-edit-container';

  // Text Input
  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = 'todo-text-input';
  textInput.value = todo.text;

  // Date Input
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.className = 'todo-date-input';
  dateInput.value = todo.dueDate ? todo.dueDate.substring(0, 10) : ''; // YYYY-MM-DD format expected by input[type=date]

  editContainer.appendChild(textInput);
  if (todo.dueDate) {
    editContainer.appendChild(dateInput);
  }

  // Replace the text span with the edit container
  const body = li.querySelector('.todo-body');
  if (body) {
    body.replaceChild(editContainer, textEl);
  }

  // Commit function
  function commit() {
    const newText = textInput.value.trim();
    let newDueDate = todo.dueDate;

    if (todo.dueDate) {
      // If a date input was present, update it. If empty, remove dueDate.
      if (dateInput.value) {
        newDueDate = dateInput.value;
      } else {
        newDueDate = null;
      }
    }
    
    // Check if changes occurred
    const textChanged = newText !== todo.text;
    const dateChanged = newDueDate !== todo.dueDate;

    if (textChanged || dateChanged) {
      todo.text = newText;
      todo.dueDate = newDueDate;
      saveTodos(todos);
      render();
    }
  }

  // Event listeners
  const handleInput = () => {
    // Debounce or simply check changes on input for real-time feedback/draft saving?
    // For simplicity, we only commit on blur/Enter as per original logic.
  };

  const handleBlur = () => commit();
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      // Focus on commit when Enter is pressed
      commit();
    }
    if (e.key === 'Escape') {
      // Revert changes
      textInput.value = todo.text;
      if (todo.dueDate) {
        dateInput.value = todo.dueDate.substring(0, 10);
      }
      render();
    }
  };

  // Attach listeners to inputs
  textInput.addEventListener('blur', handleBlur);
  textInput.addEventListener('keydown', handleKeyDown);
  dateInput.addEventListener('change', handleBlur);
  dateInput.addEventListener('keydown', handleKeyDown);
  
  // Focus initial element
  textInput.focus();
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
  const input = document.getElementById('new-todo');
  const text = input.value.trim();
  const dateInput = document.getElementById('new-todo-due');
  const dueDate = dateInput ? dateInput.value : null;

  if (!text) return;
  todos.unshift(createTodo(text, dueDate));
  saveTodos(todos);
  input.value = '';
  dateInput ? dateInput.value = '' : null;
  render();
});

render();
