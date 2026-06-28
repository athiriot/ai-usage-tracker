#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { projectRoot } from "../src/paths.js";

const ignored = new Set([".git", "node_modules"]);
const forbidden = [
  ["/", "Users", "/"].join(""),
  ["Cur", "sor"].join(""),
  ["Workos", "SessionToken"].join(""),
  ["session", "-token"].join("")
];
const failures = [];

function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      scan(path);
      continue;
    }
    const content = readFileSync(path, "utf8");
    for (const pattern of forbidden) {
      if (content.includes(pattern)) failures.push(`${relative(projectRoot, path)} contains forbidden public pattern: ${pattern}`);
    }
  }
}

scan(projectRoot);
if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Public-content scan passed.\n");
}
