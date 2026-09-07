# simple-todo-app

A minimal todo app. No build step, no dependencies.

## Running

Open `index.html` in a browser:

```bash
open index.html
```

Todos are persisted in `localStorage`.

## Features

- Add, edit, and delete todo items
- Check off items - completed items move to the bottom with a timestamp
- Data survives page refreshes

## Running the tests

The tests need only Node.js (>= 20); there is nothing to install.

```bash
npm test                              # same as: node --test tests/
node --test tests/baseline.test.js    # regression tests for existing behaviour
node --test tests/issue-1.test.js     # one file per GitHub issue; exit code 1 while the issue is open
node --test --test-reporter=tap tests/
```

`tests/dom-stub.js` is a tiny fake browser (DOM, `localStorage`, `crypto`) that
runs `app.js` inside a Node `vm` context seeded with the element tree from
`index.html`. `baseline.test.js` must always pass; each `issue-N.test.js` fails
until issue N is fixed and documents the exact DOM/data contract expected.
