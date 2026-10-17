import { readFile, writeFile } from 'node:fs/promises';
const manual = JSON.parse(
  await readFile(new URL('../apps/web/content/manual.json', import.meta.url), 'utf8')
);
for (const [locale, content] of Object.entries(manual)) {
  const body =
    '# ' +
    content.title +
    '\n\n' +
    content.intro +
    '\n\n' +
    content.sections
      .map(
        (section) =>
          '## ' +
          section.title +
          '\n\n' +
          section.steps.map((step, index) => `${index + 1}. ${step}`).join('\n\n')
      )
      .join('\n\n') +
    '\n';
  await writeFile(new URL(`../docs/user-manual.${locale}.md`, import.meta.url), body);
}
console.log('Generated English and Chinese manuals from the same content used by /manual');
