import { rm } from "node:fs/promises";
import path from "node:path";

// `next build` may copy local .env files into .next/standalone. The Docker
// image and the self-hosted standalone server get configuration from the
// process environment, so never ship a local .env or a local database snapshot.
const standalone = path.join(process.cwd(), ".next", "standalone");
const forbidden = [".env", ".env.local", ".env.development", ".env.production", ".env.example", ".data"];

for (const name of forbidden) {
  await rm(path.join(standalone, name), { recursive: true, force: true });
}
