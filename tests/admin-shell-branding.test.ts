import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const readWorkspaceFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin shell uses the generated Model Center brand assets', () => {
  const nav = readWorkspaceFile('components/nav.tsx');

  assert.match(nav, /\/brand\/model-center-mark\.png/);
  assert.equal(existsSync(new URL('../public/brand/model-center-mark.png', import.meta.url)), true);
  assert.equal(existsSync(new URL('../app/icon.png', import.meta.url)), true);
});

test('every admin page reserves fixed responsive space below its content', () => {
  const layout = readWorkspaceFile('app/(admin)/layout.tsx');
  const globals = readWorkspaceFile('app/globals.css');

  assert.match(layout, /admin-page-content/);
  assert.match(globals, /\.admin-page-content\s*{[^}]*padding-bottom:\s*6rem;/s);
  assert.match(globals, /@media\s*\(min-width:\s*640px\)[^{]*{[^}]*\.admin-page-content\s*{[^}]*padding-bottom:\s*8rem;/s);
});
