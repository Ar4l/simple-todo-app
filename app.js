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
    description: "",
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

  // Text element
  const textEl = document.createElement('span');
  textEl.className = 'todo-text';
  textEl.textContent = todo.text;
  textEl.title = 'Click to edit';
  textEl.addEventListener('click', () => startEdit(todo.id, li, textEl));

  // Description area setup
  const descriptionContainer = document.createElement('div');
  descriptionContainer.className = 'todo-description-container';
  descriptionContainer.style.display = 'none'; // Hidden by default
  
  const descriptionToggle = document.createElement('span');
  descriptionToggle.className = 'description-toggle';
  descriptionToggle.textContent = '▶';
  descriptionToggle.title = 'View description';
  descriptionToggle.addEventListener('click', () => toggleDescriptionVisibility(todo.id, li));
  
  const descriptionTextEl = document.createElement('p');
  descriptionTextEl.className = 'todo-description-text';
  descriptionTextEl.textContent = todo.description || '';
  descriptionTextEl.title = 'Click to edit';
  descriptionTextEl.addEventListener('click', () => startDescriptionEdit(todo.id, li, descriptionTextEl));

  descriptionContainer.appendChild(descriptionToggle);
  descriptionContainer.appendChild(descriptionTextEl);
  
  body.appendChild(textEl);

  if (todo.completed && todo.completedAt) {
    const stamp = document.createElement('div');
    stamp.className = 'completed-at';
    stamp.textContent = 'Completed ' + formatTimestamp(todo.completedAt);
    body.appendChild(stamp);
  }

  // Add description container after text
  if (todo.description) {
    body.appendChild(descriptionContainer);
    // Initialize description state: If it's empty (e.g., loaded from storage but description field exists), it might still need expansion logic. 
    // Since it's hidden by default, we just append it.
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
      render();
    } else if (!newText) {
      todo.text = '';
      saveTodos(todos);
      render();
    }
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

function startDescriptionEdit(id, li, descriptionTextEl) {
  const todo = todos.find(t => t.id === id);
  if (!todo || todo.completed) return;

  const textarea = document.createElement('textarea');
  textarea.className = 'todo-description-input';
  textarea.value = todo.description;

  // Replace the text element with the textarea
  descriptionTextEl.replaceWith(textarea);
  textarea.focus();
  
  function commitDescription() {
    const newDescription = textarea.value.trim();
    // Update the todo object
    todo.description = newDescription;
    saveTodos(todos);
    // Re-render to restore the display (text element)
    render();
  }

  // Events for saving
  textarea.addEventListener('blur', commitDescription);
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shift) { // Save on Enter
      e.preventDefault();
      commitDescription();
    }
    if (e.key === 'Escape') { // Cancel
      textarea.value = todo.description;
      render();
    }
  });
}

function toggleDescriptionVisibility(id, li) {
  // Toggle visibility by checking current display state
  const container = li.querySelector('.todo-description-container');
  if (container) {
    const isHidden = container.style.display === 'none' || container.style.display === '';
    container.style.display = isHidden ? 'block' : 'none';
  }
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
  if (!text) return;
  
  // Create new todo with default empty description
  const newTodo = createTodo(text);
  todos.unshift(newTodo);
  
  saveTodos(todos);
  input.value = '';
  render();
});

render();
