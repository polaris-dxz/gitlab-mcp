/**
 * List pipelines for a merge request.
 * Usage: from packages/gitlab-mcp run: pnpm exec tsx tests/run-list-mr-pipelines.ts
 * Or: pnpm build && node dist/tests/run-list-mr-pipelines.js
 * Requires .env with GITLAB_URL and GITLAB_TOKEN.
 */
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

import * as gitlab from "../src/gitlab-client.js";

const PROJECT_ID = "elementary/higgs/higgs-frontend";
const MERGE_REQUEST_IID = 12754;

async function main() {
  if (!process.env.GITLAB_TOKEN) {
    console.error("Set GITLAB_TOKEN in .env");
    process.exit(1);
  }
  try {
    const pipelines = await gitlab.listMergeRequestPipelines(PROJECT_ID, MERGE_REQUEST_IID);
    console.log(JSON.stringify(pipelines, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
