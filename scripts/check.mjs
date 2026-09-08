import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);

function jsFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...jsFiles(path));
    else if (entry.isFile() && path.endsWith('.js')) files.push(path);
  }
  return files;
}

const sourceFiles = [join(root, 'server.js'), join(root, 'sw.js'), ...jsFiles(join(root, 'js')), ...jsFiles(join(root, 'plugins')), ...jsFiles(join(root, 'scripts'))];
for (const file of sourceFiles) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
const testFiles = readdirSync(join(root, 'tests'), { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith('.test.mjs')).map((entry) => join(root, 'tests', entry.name));
for (const file of testFiles) execFileSync(process.execPath, ['--test', file], { stdio: 'inherit' });
console.log(`Verified ${sourceFiles.length} JavaScript files and ${testFiles.length} deterministic test files.`);
