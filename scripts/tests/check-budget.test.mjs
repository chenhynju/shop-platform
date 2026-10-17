import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
test('nested route assets cannot bypass the budget; invalid limits fail closed', () => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'toolkit-budget-'));
  const chunks = path.join(fixture, 'apps/web/.next/static/chunks');
  mkdirSync(path.join(chunks, 'app/manual'), { recursive: true });
  writeFileSync(path.join(chunks, 'shared.js'), 'x'.repeat(100));
  writeFileSync(path.join(chunks, 'app/manual/page.js'), randomBytes(4096));
  const script = fileURLToPath(new URL('../check-budget.mjs', import.meta.url));
  const run = (limit) =>
    spawnSync(process.execPath, [script], {
      cwd: fixture,
      env: { ...process.env, BUDGET_KB: limit },
      encoding: 'utf8'
    });
  try {
    assert.equal(run('1').status, 1);
    assert.equal(run('invalid').status, 1);
    const valid = run('300');
    assert.equal(valid.status, 0);
    assert.match(valid.stdout, /2 JS chunks/);
  } finally {
    const resolved = path.resolve(fixture);
    assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep));
    assert.ok(path.basename(resolved).startsWith('toolkit-budget-'));
    rmSync(resolved, { recursive: true, force: true });
  }
});
