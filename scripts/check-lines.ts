import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// Walk source folders only. Dependencies and exported documents are not source code.
async function checkDirectory(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (["node_modules", "dist", "coverage"].includes(entry.name)) continue;
    if (entry.isDirectory()) {
      await checkDirectory(path);
    } else if (/\.(ts|tsx|css|js)$/.test(entry.name)) {
      const lines = (await readFile(path, "utf8")).trimEnd().split("\n").length;
      if (lines > 5000) {
        console.error(`${path}: ${lines} lines exceeds the 5000-line limit.`);
        process.exitCode = 1;
      } else if (lines > 3500) {
        console.warn(`${path}: ${lines} lines. Consider splitting by responsibility.`);
      }
    }
  }
}

for (const directory of ["packages", "scripts", "examples"]) {
  await checkDirectory(directory);
}
