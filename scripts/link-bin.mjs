import { access, chmod, mkdir, symlink, unlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const cliPath = join(root, "dist", "cli.js");
const binDir = join(root, "node_modules", ".bin");
const binPath = join(binDir, "db-introspector-mcp");

try {
  await access(cliPath);
} catch {
  // dist/ still missing (fresh clone before first build) — skip
  process.exit(0);
}

await chmod(cliPath, 0o755);
await mkdir(binDir, { recursive: true });
try {
  await unlink(binPath);
} catch {
  // ignore missing link
}
await symlink(join("..", "..", "dist", "cli.js"), binPath);
