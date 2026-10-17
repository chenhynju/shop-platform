// Sum independent gzip sizes of ALL emitted JS chunks, including nested app routes.
// This is an aggregate asset budget, not a browser transfer or First Load JS measurement.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, resolve } from 'node:path';
const chunksDir = resolve('apps/web/.next/static/chunks');
const budgetKB = Number(process.env.BUDGET_KB ?? 300);
if (!Number.isFinite(budgetKB) || budgetKB <= 0) {
  console.error('[budget] BUDGET_KB must be a positive finite number');
  process.exit(1);
}
function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory()
      ? collect(file)
      : entry.isFile() && entry.name.endsWith('.js')
        ? [file]
        : [];
  });
}
let files;
try {
  files = collect(chunksDir);
} catch {
  console.error('[budget] Build output not found. Run pnpm build first.');
  process.exit(1);
}
if (!files.length) {
  console.error('[budget] No JS chunks found');
  process.exit(1);
}
let rawTotal = 0;
let gzipTotal = 0;
for (const file of files) {
  const bytes = readFileSync(file);
  rawTotal += bytes.length;
  gzipTotal += gzipSync(bytes).length;
}
console.log(
  `[budget] ${files.length} JS chunks (recursive): raw ${(rawTotal / 1024).toFixed(1)} KB / gzip ${(gzipTotal / 1024).toFixed(1)} KB; limit ${budgetKB} KB gzip`
);
if (gzipTotal > budgetKB * 1024) {
  console.error(
    '[budget] Limit exceeded. Inspect route splitting and dependencies with pnpm analyze.'
  );
  process.exit(1);
}
console.log('[budget] PASS');
