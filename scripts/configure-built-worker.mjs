import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const required = ["WORKER_NAME", "D1_DATABASE_NAME", "D1_DATABASE_ID"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  throw new Error(`Missing deployment configuration: ${missing.join(", ")}`);
}

const output = resolve(process.argv[2] ?? "dist/server/wrangler.json");
const config = JSON.parse(readFileSync(output, "utf8"));
const database = config.d1_databases?.find((entry) => entry.binding === "DB");
if (!database) {
  throw new Error(`Built Worker config ${output} does not contain the DB binding.`);
}

config.name = process.env.WORKER_NAME;
database.database_name = process.env.D1_DATABASE_NAME;
database.database_id = process.env.D1_DATABASE_ID;
config.vars = {
  ...(config.vars ?? {}),
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? config.vars?.ADMIN_EMAIL ?? "admin@example.com",
};

writeFileSync(output, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Configured ${output} for ${config.name} and ${database.database_name}.`);
