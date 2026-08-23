import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const required = ["WORKER_NAME", "D1_DATABASE_NAME", "D1_DATABASE_ID"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  throw new Error(`Missing deployment configuration: ${missing.join(", ")}`);
}

const output = resolve(process.argv[2] ?? ".wrangler/deployment.json");
const migrationsDir = relative(dirname(output), resolve("drizzle")).replaceAll("\\", "/");
const mainFile = relative(dirname(output), resolve("worker/index.ts")).replaceAll("\\", "/");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify({
  name: process.env.WORKER_NAME,
  main: mainFile,
  compatibility_date: "2026-08-22",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [{
    binding: "DB",
    database_name: process.env.D1_DATABASE_NAME,
    database_id: process.env.D1_DATABASE_ID,
    migrations_dir: migrationsDir,
  }],
  r2_buckets: process.env.R2_BUCKET_NAME ? [{
    binding: "DOCUMENTS",
    bucket_name: process.env.R2_BUCKET_NAME,
  }] : [],
  vars: {
    ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "admin@example.com",
  },
  triggers: {
    crons: ["*/15 * * * *"],
  },
  observability: {
    enabled: true,
  },
}, null, 2)}\n`);

console.log(`Created ${output} for ${process.env.WORKER_NAME}.`);
