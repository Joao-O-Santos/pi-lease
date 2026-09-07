import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, chmod, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startBrowser } from '../src/browser.js';

const fake = path.resolve('test/fixtures/fake-browser.js');
async function dirs() { const root = await mkdtemp(path.join(tmpdir(), 'lease-browser-')); return { profileDir: path.join(root, 'profile'), runtimeDir: path.join(root, 'run') }; }

test('starts verified fake browser and idempotently closes it', { skip: process.platform !== 'linux' }, async () => {
  await chmod(fake, 0o755);
  const browser = await startBrowser({ executable: fake, ...await dirs(), timeoutMs: 3000 });
  assert.match(browser.endpoint, /^ws:\/\/127\.0\.0\.1:/);
  assert.ok(browser.pid > 0);
  await browser.close(); await browser.close();
  assert.ok(await browser.exited);
});

test('rejects Chrome and lease profile conflicts', async () => {
  const d = await dirs(); await mkdir(d.profileDir, { recursive: true });
  await symlink('/missing-target', path.join(d.profileDir, 'SingletonLock'));
  await assert.rejects(startBrowser({ executable: fake, ...d, timeoutMs: 100 }), /Chrome lock/);
});

test('abort during startup releases ownership', { skip: process.platform !== 'linux' }, async () => {
  const d = await dirs(), controller = new AbortController(); controller.abort();
  await assert.rejects(startBrowser({ executable: fake, ...d, signal: controller.signal }), { name: 'AbortError' });
});
