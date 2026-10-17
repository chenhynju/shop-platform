import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9-]{1,49}$/.test(name)) {
  console.error(
    '[init] Supply a project name of 2–50 lowercase letters, digits or hyphens, starting with a letter.'
  );
  process.exit(1);
}
const manifestPath = new URL('package.json', root);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.name = name;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
for (const filename of ['README.md', 'README.zh-CN.md']) {
  const readme = new URL(filename, root);
  if (existsSync(readme))
    writeFileSync(readme, readFileSync(readme, 'utf8').replace(/^# .+$/m, '# ' + name));
}
const env = new URL('.env', root);
if (!existsSync(env)) copyFileSync(new URL('.env.example', root), env);
console.log('[init] Initialized', name, 'at', fileURLToPath(root));
console.log(
  '[init] Existing .env preserved. Next: pnpm install --frozen-lockfile, pnpm db:migrate, pnpm dev'
);
