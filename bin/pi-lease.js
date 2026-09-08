#!/usr/bin/env node
import { spawn as nodeSpawn } from "node:child_process";
import { statSync } from "node:fs";
import { mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startBrowser } from "../src/browser.js";
import { discoverBrowser } from "../src/platform.js";

const upstream = "https://github.com/citrolabs/pi-chrome-use";
const here = path.dirname(fileURLToPath(import.meta.url));
const promptPath = path.resolve(here, "../prompts/pi-lease.md");

export function leasePaths(env = process.env, platform = process.platform) {
	const home = env.HOME;
	if (!home) throw new Error("HOME is required to determine Pi-lease browser paths");
	if (platform === "darwin") {
		const base = path.join(home, "Library", "Application Support", "pi-lease");
		return {
			profile: path.join(base, "chromium"),
			cache: path.join(home, "Library", "Caches", "pi-lease"),
			runtime: path.join(base, "runtime"),
		};
	}
	const config = env.XDG_CONFIG_HOME || path.join(home, ".config");
	const data = env.XDG_DATA_HOME || config;
	const cache = env.XDG_CACHE_HOME || path.join(home, ".cache");
	const runtime = env.XDG_RUNTIME_DIR || env.XDG_STATE_HOME || config;
	return {
		profile: path.join(data, "pi-lease", "chromium"),
		cache: path.join(cache, "pi-lease"),
		runtime: path.join(runtime, "pi-lease"),
	};
}

function timeout(env) {
	const value = env.PI_LEASE_TIMEOUT_MS;
	if (value === undefined) return 15000;
	if (!/^\d+$/.test(value) || Number(value) < 100 || Number(value) > 120000)
		throw new Error("PI_LEASE_TIMEOUT_MS must be a whole number from 100 to 120000 milliseconds");
	return Number(value);
}
function childResult(child) {
	return new Promise((resolve, reject) => {
		child.once("error", reject);
		child.once("exit", (code, signal) => resolve({ code, signal }));
	});
}
async function defaultRegistry() {
	if (process.env.PI_OFFLINE === "1")
		throw new Error("PI_OFFLINE=1: latest pi-chrome-use preflight requires npm registry access");
	const response = await fetch("https://registry.npmjs.org/pi-chrome-use/latest");
	if (!response.ok) throw new Error(`npm registry returned HTTP ${response.status}`);
	const metadata = await response.json();
	const repository =
		typeof metadata.repository === "string" ? metadata.repository : metadata.repository?.url;
	if (!repository || repository.replace(/^git\+/, "").replace(/\.git$/, "") !== upstream)
		throw new Error(
			`pi-chrome-use registry repository is not upstream (${repository || "missing"})`,
		);
	return { version: metadata.version, repository };
}
async function defaultPreflight() {
	const child = nodeSpawn("pi", ["-e", "npm:pi-chrome-use", "--help"], { stdio: "inherit" });
	const result = await childResult(child);
	if (result.code !== 0)
		throw new Error(
			`pi-chrome-use temporary extension load failed (Pi exit ${result.code ?? result.signal})`,
		);
}
async function validateDirectory(input) {
	let resolved;
	try {
		resolved = await realpath(input);
	} catch {
		throw new Error(`working directory does not exist: ${input}`);
	}
	if (!statSync(resolved).isDirectory())
		throw new Error(`working directory is not a directory: ${resolved}`);
	return resolved;
}

/** Foreground launcher. Dependencies are injectable for deterministic tests. */
export async function main(argv = process.argv.slice(2), env = process.env, deps = {}) {
	const log = deps.log || console.log;
	if (argv.length > 1)
		throw new Error("usage: pi-lease [working-directory] (only one directory is allowed)");
	const cwd = await validateDirectory(argv[0] || process.cwd());
	const paths = (deps.paths || leasePaths)(env, deps.platform || process.platform);
	const timeoutMs = timeout(env);
	if (env.PI_OFFLINE === "1")
		throw new Error(
			"PI_OFFLINE=1: cannot verify the latest upstream pi-chrome-use package; unset it and retry",
		);
	const registry = await (deps.registry || defaultRegistry)();
	log(`Pi-lease preflight: pi-chrome-use ${registry.version} (${upstream})`);
	await (deps.preflight || defaultPreflight)();
	await mkdir(paths.cache, { recursive: true, mode: 0o700 });
	await mkdir(paths.runtime, { recursive: true, mode: 0o700 });
	const executable = await (deps.discoverBrowser || discoverBrowser)(env.PI_LEASE_BROWSER, {
		env,
		platform: deps.platform || process.platform,
	});
	const controller = new AbortController();
	let browser,
		pi,
		stopping = false;
	const stop = async (signal) => {
		if (stopping) return;
		stopping = true;
		controller.abort();
		if (pi && !pi.killed) {
			try {
				pi.kill(signal);
			} catch {}
		}
		if (browser) await browser.close();
	};
	const signals = ["SIGINT", "SIGTERM"];
	const handlers = Object.fromEntries(
		signals.map((signal) => [
			signal,
			() => {
				void stop(signal);
			},
		]),
	);
	for (const signal of signals) process.once(signal, handlers[signal]);
	try {
		browser = await (deps.startBrowser || startBrowser)({
			executable,
			profileDir: paths.profile,
			runtimeDir: paths.runtime,
			timeoutMs,
			signal: controller.signal,
		});
		log(
			`Pi-lease privileged mode | cwd: ${cwd} | profile: ${paths.profile} | browser PID: ${browser.pid}`,
		);
		const piEnv = { ...env, BU_CDP_WS: browser.endpoint };
		pi = (deps.piSpawn || nodeSpawn)(
			"pi",
			["-e", "npm:pi-chrome-use", "--prompt-template", promptPath],
			{ cwd, env: piEnv, stdio: "inherit" },
		);
		const piExit = childResult(pi);
		const browserExit = browser.exited.then(() => ({ browserExited: true }));
		const outcome = await Promise.race([piExit, browserExit]);
		if (outcome.browserExited) {
			if (!pi.killed) pi.kill("SIGTERM");
			await piExit;
			throw new Error("browser exited unexpectedly; Pi was terminated");
		}
		if (outcome.code !== null) return outcome.code;
		return 128 + ({ SIGHUP: 1, SIGINT: 2, SIGTERM: 15 }[outcome.signal] || 1);
	} finally {
		for (const signal of signals) process.removeListener(signal, handlers[signal]);
		await stop("SIGTERM");
	}
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main()
		.then((code) => {
			process.exitCode = code;
		})
		.catch((error) => {
			console.error(`pi-lease: ${error.message}`);
			process.exitCode = 1;
		});
}
