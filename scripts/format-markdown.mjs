#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const MARKDOWN_FILES = ["README.md", "prompts/pi-lease.md"];

const PANDOC_ARGS = [
	"--from",
	"markdown",
	"--to",
	"markdown+pipe_tables-simple_tables-multiline_tables-grid_tables",
	"--wrap=auto",
	"--columns=72",
];

function splitFrontMatter(markdown) {
	const match = markdown.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n\r?\n?)([\s\S]*)$/);
	return match ? { frontMatter: match[1], body: match[2] } : { frontMatter: "", body: markdown };
}

export function formatMarkdown(markdown, path = "<input>") {
	const { frontMatter, body } = splitFrontMatter(markdown);
	const result = spawnSync("pandoc", [...PANDOC_ARGS], {
		encoding: "utf8",
		input: body,
		maxBuffer: 10 * 1024 * 1024,
	});
	if (result.error) throw new Error(`Unable to run Pandoc for ${path}: ${result.error.message}`);
	if (result.status !== 0)
		throw new Error(
			`Pandoc failed for ${path}: ${result.stderr?.trim() || `exit ${result.status}`}`,
		);
	return frontMatter + result.stdout;
}

async function main() {
	const fix = process.argv.includes("--write");
	const changed = [];
	for (const path of MARKDOWN_FILES) {
		const before = await readFile(path, "utf8");
		const after = formatMarkdown(before, path);
		if (before === after) continue;
		changed.push(path);
		if (fix) {
			const temporary = join(dirname(path), `.${basename(path)}.tmp`);
			await writeFile(temporary, after);
			await rename(temporary, path);
		}
	}
	if (changed.length) {
		if (fix) console.log(`Formatted Markdown:\n${changed.join("\n")}`);
		else {
			console.error(
				`Markdown differs from Pandoc 72-column formatting:\n${changed.join("\n")}\nRun npm run markdown:fix.`,
			);
			process.exitCode = 1;
		}
	} else console.log("Markdown matches Pandoc 72-column formatting.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
