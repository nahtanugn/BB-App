import { readFileSync, writeFileSync } from "node:fs";

const appUrl = process.env.APP_URL?.trim();
if (!appUrl) throw new Error("APP_URL is required for a desktop build.");

const appName = process.env.DESKTOP_APP_NAME?.trim() || "BB App";
const publisher = process.env.DESKTOP_PUBLISHER?.trim() || "BB Company App contributors";
const path = "src-tauri/tauri.conf.json";
const config = JSON.parse(readFileSync(path, "utf8"));
config.productName = appName;
config.build.frontendDist = appUrl;
config.app.windows[0].title = appName;
config.app.windows[0].url = appUrl;
config.bundle.publisher = publisher;
config.bundle.homepage = appUrl;
config.bundle.shortDescription = `Desktop edition of ${appName}.`;
config.bundle.longDescription = `${appName} connects securely to the configured company web service.`;
writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
