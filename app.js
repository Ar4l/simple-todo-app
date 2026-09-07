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

function createTodo(text, description = '') {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    description: description,
  };
}

function formatTimestamp(iso) {
  const d = new Date(iso);
  return d.toLocaleString();
}

let todos = loadTodos();
const expandedStates = {};

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

  // Reset expansion states to collapsed (hidden) at start of render
  Object.keys(expandedStates).forEach(id => expandedStates[id] = false);

  active.forEach(todo => {
    list.appendChild(buildItem(todo));
  });

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
      .forEach(todo => {
        list.appendChild(buildItem(todo));
      });
  }

  // Apply expansion states to description visibility
  const itemEls = document.querySelectorAll('.todo-item');
  Object.keys(expandedStates).forEach(id => {
    const el = Array.from(itemEls).find(el => el.dataset.id === id);
    if (el && el.querySelector('.description-wrapper')) {
      const descWrapper = el.querySelector('.description-wrapper');
      const chevron = el.querySelector('.chevron');
      
      if (expandedStates[id]) {
        descWrapper.classList.add('expanded');
        if (chevron) chevron.textContent = '▼';
      } else {
        descWrapper.classList.remove('expanded');
        if (chevron) chevron.textContent = '▶';
      }
    }
  });

  // Show/collapse description input based on expansion state
  const inputs = document.querySelectorAll('.todo-description-input');
  inputs.forEach(input => {
    const li = input.closest('li');
    const id = li.dataset.id;
    
    if (expandedStates[id]) {
      input.style.display = 'block';
    } else {
      input.style.display = 'none';
    }
  });

  // Listen for escape key to close description inputs
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const descInput = Array.from(document.querySelectorAll('.todo-description-input')).find(
        a => a.matches(e.target)
      );
      if (descInput) {
        const todo = todos.find(t => t.id === descInput.closest('li').dataset.id);
        if (todo) descInput.value = todo.description || '';
        descInput.blur();
      }
    }
  });
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

  // Description section - always create if description field exists
  const descWrapper = document.createElement('div');
  descWrapper.className = 'description-wrapper';
  
  if (todo.description) {
    const chevron = document.createElement('span');
    chevron.className = 'chevron';
    
    const descEl = document.createElement('div');
    descEl.className = 'todo-description';
    descEl.textContent = todo.description;
    descEl.title = 'Click to edit';
    descEl.addEventListener('click', () => startDescriptionEdit(todo.id, li));

    // Create input for editing description (always exist in wrapper)
    const descInput = document.createElement('textarea');
    descInput.className = 'todo-description-input';
    descInput.rows = 1;
    descInput.value = todo.description || '';
    
    descWrapper.appendChild(chevron);
    descWrapper.appendChild(descEl);
    descWrapper.appendChild(descInput);

    body.appendChild(descWrapper);
  } else {
    // Even without description, we can still show chevron for empty description
    // or hide entirely. Let's hide it to keep things clean but show input when clicking.
    const chevron = document.createElement('span');
    chevron.className = 'chevron';
    descWrapper.appendChild(chevron);

    body.appendChild(descWrapper);
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

function startDescriptionEdit(id, li) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;

  const descWrapper = li.querySelector('.description-wrapper');
  const descInput = descWrapper.querySelector('.todo-description-input');
  
  // Update existing input with current description value
  if (descInput) {
    descInput.value = todo.description || '';
    
    function commit() {
      const newValue = descInput.value.trim();
      if (newValue !== todo.description) {
        todo.description = newValue;
        saveTodos(todos);
      }
      render();
    }

    descInput.addEventListener('blur', commit);
    descInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') descInput.blur();
      if (e.key === 'Escape') {
        descInput.value = todo.description;
        descInput.blur();
      }
    });

    // On blur outside the element, collapse if not expanded
    descInput.addEventListener('focusout', () => {
      const currentExpanded = expandedStates[id];
      if (!currentExpanded) {
        descWrapper.classList.remove('expanded');
        render();
      }
    });
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
  if (index === -1) return;

  // Remove expanded state for this todo
  delete expandedStates[id];

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
  
  todos.unshift(createTodo(text, ''));
  saveTodos(todos);
  input.value = '';
  render();
});

render();
