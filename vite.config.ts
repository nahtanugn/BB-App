import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

const databaseBinding = "DB";
const databaseName = process.env.D1_DATABASE_NAME ?? "bb-company-app-db";
const databaseId = process.env.D1_DATABASE_ID ?? "00000000-0000-0000-0000-000000000000";
const workerName = process.env.WORKER_NAME ?? "bb-company-app";
const r2BucketName = process.env.R2_BUCKET_NAME;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  name: workerName,
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  workers_dev: true,
  preview_urls: false,
  d1_databases: [
    {
      binding: databaseBinding,
      database_name: databaseName,
      database_id: databaseId,
    },
  ],
  r2_buckets: r2BucketName
    ? [
        {
          binding: "DOCUMENTS",
          bucket_name: r2BucketName,
        },
      ]
    : [],
  vars: {
    ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "admin@example.com",
  },
  triggers: {
    // The database scheduler claims only the configured Malaysia-time periods.
    crons: ["*/15 * * * *"],
  },
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
