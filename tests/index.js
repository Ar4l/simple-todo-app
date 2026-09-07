'use strict';
// Aggregator so that `node --test tests/` (a directory argument, which node's
// test runner does not expand itself) runs every *.test.js in this folder in
// one process. Running a single file (`node --test tests/issue-1.test.js`) or
// a glob (`node --test tests/*.test.js`) works without this file.
const fs = require('node:fs');
const path = require('node:path');
for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort()) {
  require(path.join(__dirname, f));
}
