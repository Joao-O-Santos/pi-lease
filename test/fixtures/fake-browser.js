#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const profile = process.argv.find((x) => x.startsWith("--user-data-dir="))?.slice(16);
if (!profile) process.exit(2);
const server = http.createServer((req, res) => {
	const port = server.address().port;
	if (req.url === "/json/version")
		return res.end(
			JSON.stringify({ webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/browser/fake` }),
		);
	if (req.url === "/json/list")
		return res.end(
			JSON.stringify([
				{ type: "page", webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/fake` },
			]),
		);
	res.statusCode = 404;
	res.end();
});
server.listen(0, "127.0.0.1", () =>
	fs.writeFileSync(
		path.join(profile, "DevToolsActivePort"),
		`${server.address().port}\n/devtools/browser/fake\n`,
	),
);
process.on("SIGTERM", () => server.close(() => process.exit()));
process.on("SIGINT", () => server.close(() => process.exit()));
