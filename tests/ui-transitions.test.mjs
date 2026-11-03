import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function findFiles(dir, exts) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(findFiles(fullPath, exts));
    } else if (exts.some(ext => file.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

test('no transition-all exists in src/', () => {
  const files = findFiles(path.resolve('src'), ['.tsx', '.ts', '.css']);
  const violations = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('transition-all')) {
      violations.push(path.relative(process.cwd(), file));
    }
  }
  assert.equal(violations.length, 0, `Found transition-all in: ${violations.join(', ')}`);
});
