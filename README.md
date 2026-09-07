# simple-todo-app

A minimal todo app in three files. No build step, no dependencies.

![Todo app with active and completed items](assets/screenshot.png)

## Live demo

- **Current `main`:** https://aral.cc/simple-todo-app/?demo
- **Open pull requests:** every PR from a branch in this repo is published at
  `https://aral.cc/simple-todo-app/pr/<number>/`. The list is at
  https://aral.cc/simple-todo-app/pr/. The link is also posted as a comment on the PR.

Add `?demo` to any URL to start with a few sample todos when the list is empty.

## Running locally

```bash
open index.html                 # or:
python3 -m http.server 8000     # then visit http://localhost:8000/?demo
```

Todos are persisted in `localStorage`.

## Features

- Add, edit, and delete todo items
- Check off items. Completed items move to the bottom with a timestamp
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

## Workshop issues

This repo is the target for the *build a local coding agent* workshop. The agent
gets an issue number, edits the code, and opens a pull request. Three issues are open:

- [#1 Crash when deleting the only remaining todo](https://github.com/Ar4l/simple-todo-app/issues/1), a one-line bug
- [#2 Add optional description field to todo items](https://github.com/Ar4l/simple-todo-app/issues/2), a small feature
- [#3 Add due date support to todo items](https://github.com/Ar4l/simple-todo-app/issues/3), a larger feature

Compare the "before" (`main`) and "after" (PR preview) links above to see the result.

## Regenerating the screenshot

```bash
uv run --with playwright python scripts/screenshot.py
```

Or, with Node: `npx playwright screenshot --viewport-size=720,620 --wait-for-selector=.todo-item "http://localhost:8000/?demo" assets/screenshot.png` while `python3 -m http.server 8000` is running.
