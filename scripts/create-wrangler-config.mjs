import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const required = ["WORKER_NAME", "D1_DATABASE_NAME", "D1_DATABASE_ID"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  throw new Error(`Missing deployment configuration: ${missing.join(", ")}`);
}

const output = resolve(process.argv[2] ?? ".wrangler/deployment.json");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify({
  name: process.env.WORKER_NAME,
  main: "dist/server/index.js",
  compatibility_date: "2026-08-22",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [{
    binding: "DB",
    database_name: process.env.D1_DATABASE_NAME,
    database_id: process.env.D1_DATABASE_ID,
    migrations_dir: "drizzle",
  }],
}, null, 2)}\n`);

console.log(`Created ${output} for ${process.env.WORKER_NAME}.`);
