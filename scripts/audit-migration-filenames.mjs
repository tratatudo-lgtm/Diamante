#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const directory = join(process.cwd(), "supabase", "migrations");
const entries = (await readdir(directory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .sort();

const groups = new Map();
const invalid = [];
for (const filename of entries) {
  const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(filename);
  if (!match) {
    invalid.push(filename);
    continue;
  }
  const versions = groups.get(match[1]) ?? [];
  versions.push(filename);
  groups.set(match[1], versions);
}

const duplicates = [...groups.entries()].filter(([, files]) => files.length > 1);
console.log(`Scanned ${entries.length} SQL migration files.`);
if (invalid.length) {
  console.error("\nInvalid migration filenames:");
  for (const filename of invalid) console.error(`  - ${filename}`);
}
if (duplicates.length) {
  console.error("\nDuplicate migration version prefixes:");
  for (const [version, files] of duplicates) {
    console.error(`  ${version}`);
    for (const filename of files) console.error(`    - ${filename}`);
  }
}
if (invalid.length || duplicates.length) {
  console.error("\nMigration filename audit failed. Do not auto-renumber: first reconcile applied history and SQL equivalence.");
  process.exitCode = 1;
} else {
  console.log("Migration filename audit passed: all versions are unique and filenames are valid.");
}
