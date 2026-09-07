import { spawn } from 'node:child_process';
import { mkdir, lstat, rm, rmdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { existsSync, readdirSync, readlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import net from 'node:net';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const abortError = () => Object.assign(new Error('browser startup aborted'), { name: 'AbortError' });
const diagnostic = (phase, detail) => new Error(`browser ${phase}: ${detail}`);

async function absentOrDangling(file) {
  try { await lstat(file); return false; } catch (e) { if (e.code === 'ENOENT') return true; throw e; }
}

export async function assertProfileAvailable(profileDir) {
  for (const name of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    if (!await absentOrDangling(path.join(profileDir, name))) {
      throw diagnostic('profile', `existing Chrome lock: ${path.join(profileDir, name)}`);
    }
  }
}

async function procIdentity(pid, profile, expectedStart) {
  if (process.platform !== 'linux') return null;
  try {
    const cmd = (await readFile(`/proc/${pid}/cmdline`)).toString().split('\0');
    const stat = (await readFile(`/proc/${pid}/stat`, 'utf8')).trim();
    const close = stat.lastIndexOf(')');
    const fields = stat.slice(close + 2).split(' ');
    // fields begin at process state: pgrp is index 2, starttime is index 19.
    const pgrp = Number(fields[2]), start = fields[19];
    const profileFlag = `--user-data-dir=${profile}`;
    return { ok: cmd.some(value => value.includes(profileFlag)) && (!expectedStart || start === expectedStart), pgrp, start };
  } catch { return null; }
}

async function listenerOwned(pid, port) {
  // Linux-only fail-closed proof: loopback TCP listener inode must occur in the
  // launched process's fd table. Chromium's main process normally owns it.
  try {
    const rows = (await readFile('/proc/net/tcp', 'utf8')).trim().split('\n').slice(1);
    const wanted = port.toString(16).padStart(4, '0').toUpperCase();
    const inodes = new Set(rows.map(x => x.trim().split(/\s+/)).filter(x =>
      x[1] === `0100007F:${wanted}` && x[3] === '0A').map(x => x[9]));
    if (!inodes.size) return false;
    for (const fd of readdirSync(`/proc/${pid}/fd`)) {
      try { if (inodes.has((readlinkSync(`/proc/${pid}/fd/${fd}`).match(/^socket:\[(\d+)\]$/) || [])[1])) return true; } catch {}
    }
    return false;
  } catch { return false; }
}

function validEndpoint(value, port, browserPath) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || Number(url.port) !== port || url.search || url.hash || url.pathname !== browserPath) return null;
  return url;
}

async function getJson(url, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(timeout, 1000));
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

async function cdpClose(endpoint) {
  // A tiny native websocket client is sufficient for the one Browser.close command.
  const url = new URL(endpoint), key = Buffer.from(randomUUID()).toString('base64');
  await new Promise(resolve => {
    const socket = net.connect(Number(url.port), url.hostname);
    const timer = setTimeout(() => { socket.destroy(); resolve(); }, 750);
    let upgraded = false, input = '';
    socket.on('connect', () => socket.write(`GET ${url.pathname} HTTP/1.1\r\nHost: ${url.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
    socket.on('data', data => {
      if (!upgraded) { input += data; if (!input.includes('\r\n\r\n')) return; if (!/^HTTP\/1\.1 101\b/.test(input)) { socket.destroy(); return; } upgraded = true;
        const body = Buffer.from(JSON.stringify({ id: 1, method: 'Browser.close' }));
        const mask = Buffer.from(randomUUID().replaceAll('-', '').slice(0, 4));
        const payload = Buffer.alloc(body.length); for (let i = 0; i < body.length; i++) payload[i] = body[i] ^ mask[i % 4];
        socket.write(Buffer.concat([Buffer.from([0x81, 0x80 | body.length]), mask, payload]));
      }
    });
    socket.on('close', () => { clearTimeout(timer); resolve(); }); socket.on('error', () => { clearTimeout(timer); resolve(); });
  });
}

/** Start and exclusively own a headful, loopback-only Chromium instance. */
export async function startBrowser({ executable, profileDir, runtimeDir, signal, timeoutMs = 15000, logger = () => {} }) {
  if (process.platform !== 'linux') throw diagnostic('platform', `unsupported: ${process.platform}`);
  const profile = path.resolve(profileDir), runtime = path.resolve(runtimeDir);
  if (!path.isAbsolute(executable)) throw diagnostic('spawn', 'executable must be absolute');
  if (signal?.aborted) throw abortError();
  await mkdir(profile, { recursive: true, mode: 0o700 });
  await chmod(profile, 0o700).catch(() => {});
  await assertProfileAvailable(profile);
  const lock = path.join(profile, '.pi-lease-browser-lock');
  try { await mkdir(lock, { mode: 0o700 }); } catch (e) { if (e.code === 'EEXIST') throw diagnostic('profile', `existing lease lock: ${lock}`); throw e; }
  let child, stateFile, closed = false, startIdentity, abortListener;
  // rmdir (not recursive removal) ensures a replaced/non-empty foreign lock is untouched.
  const cleanupLock = async () => { await rmdir(lock).catch(() => {}); };
  try {
    // It is only safe to delete a stale port file after winning our lock and
    // proving Chrome itself left no profile lock behind.
    await rm(path.join(profile, 'DevToolsActivePort'), { force: true });
    const args = [`--user-data-dir=${profile}`, '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank'];
    logger('spawn', { profile });
    child = spawn(executable, args, { detached: true, stdio: ['ignore', 'ignore', 'ignore'] });
    const exited = new Promise(resolve => child.once('exit', (code, sig) => resolve({ code, signal: sig })));
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    const ownershipDeadline = Date.now() + Math.min(timeoutMs, 2000);
    while (Date.now() < ownershipDeadline) {
      startIdentity = await procIdentity(child.pid, profile);
      if (startIdentity?.ok && startIdentity.pgrp === child.pid) break;
      await sleep(25);
    }
    if (!startIdentity?.ok || startIdentity.pgrp !== child.pid) throw diagnostic('ownership', `cannot prove launched PID ${child.pid}`);
    const deadline = Date.now() + timeoutMs;
    abortListener = () => { void close(); };
    signal?.addEventListener('abort', abortListener, { once: true });
    let endpoint;
    while (Date.now() < deadline) {
      if (signal?.aborted) throw abortError();
      const early = await Promise.race([exited.then(x => x), sleep(0).then(() => null)]);
      if (early) throw diagnostic('readiness', `PID ${child.pid} exited`);
      try {
        const portLines = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/);
        const port = Number(portLines[0]), browserPath = portLines[1];
        if (!Number.isInteger(port) || port < 1 || port > 65535 || !browserPath?.startsWith('/devtools/browser/')) throw new Error('invalid port file');
        const version = await getJson(`http://127.0.0.1:${port}/json/version`, deadline - Date.now());
        endpoint = validEndpoint(version.webSocketDebuggerUrl, port, browserPath);
        const identity = await procIdentity(child.pid, profile, startIdentity.start);
        if (!endpoint || !identity?.ok || !await listenerOwned(child.pid, port)) throw new Error('unverified endpoint');
        const targets = await getJson(`http://127.0.0.1:${port}/json/list`, deadline - Date.now());
        if (!Array.isArray(targets) || !targets.some(x => x.type === 'page' && typeof x.webSocketDebuggerUrl === 'string')) throw new Error('no usable page');
        break;
      } catch { endpoint = null; await sleep(50); }
    }
    if (!endpoint) throw diagnostic('readiness', `timeout for PID ${child.pid}`);
    await mkdir(runtime, { recursive: true, mode: 0o700 }); await chmod(runtime, 0o700).catch(() => {});
    stateFile = path.join(runtime, `browser-${randomUUID()}.json`);
    await writeFile(stateFile, JSON.stringify({ id: path.basename(stateFile), pid: child.pid, profile, endpoint: endpoint.toString() }), { mode: 0o600 });
    async function close() {
      if (closed) return; closed = true;
      signal?.removeEventListener('abort', abortListener);
      const identity = await procIdentity(child.pid, profile, startIdentity.start);
      if (identity?.ok && endpoint) await cdpClose(endpoint.toString());
      let done = await Promise.race([exited.then(() => true), sleep(1000).then(() => false)]);
      for (const sig of done ? [] : ['SIGTERM', 'SIGKILL']) {
        const current = await procIdentity(child.pid, profile, startIdentity.start);
        if (!current?.ok || current.pgrp !== child.pid) break;
        try { process.kill(-child.pid, sig); } catch {}
        done = await Promise.race([exited.then(() => true), sleep(sig === 'SIGTERM' ? 1000 : 250).then(() => false)]);
      }
      if (stateFile) await rm(stateFile, { force: true }).catch(() => {});
      await cleanupLock();
    }
    return { pid: child.pid, endpoint: endpoint.toString(), close, child, exited };
  } catch (error) {
    signal?.removeEventListener('abort', abortListener);
    if (child && startIdentity?.ok) { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
    await cleanupLock();
    throw error;
  }
}
