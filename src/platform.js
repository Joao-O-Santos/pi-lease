import { access } from "node:fs/promises";
import path from "node:path";

async function executable(file) {
	try {
		await access(file, 0o1);
		return true;
	} catch {
		return false;
	}
}

async function fromPath(name, env) {
	for (const directory of (env.PATH || "").split(path.delimiter)) {
		if (!directory) continue;
		const candidate = path.resolve(directory, name);
		if (await executable(candidate)) return candidate;
	}
	return null;
}

/** Locate a supported browser without invoking a shell. */
export async function discoverBrowser(
	override,
	{ env = process.env, platform = process.platform } = {},
) {
	if (platform !== "linux") {
		throw new Error(`browser discovery unsupported on platform: ${platform}`);
	}
	if (override) {
		const candidate = path.resolve(override);
		if (!(await executable(candidate)))
			throw new Error(`browser executable is not executable: ${candidate}`);
		return candidate;
	}
	// Keep Chromium variants ahead of all Chrome variants.
	for (const name of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
		const found = await fromPath(name, env);
		if (found) return found;
	}
	throw new Error("no supported Chromium or Chrome executable found on PATH");
}
