/**
 * 本地脚本：更新指定 MR 的 title。
 * 用法：node dist/tests/run-update-mr-title.js <project_id> <merge_request_iid> <title>
 * 例：node dist/tests/run-update-mr-title.js group/repo 12754 openclaw
 */
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

import { updateMergeRequest } from "../src/gitlab-client.js";

const argv = process.argv.slice(2);
const projectId = process.env.GITLAB_PROJECT_ID || argv[0];
const iidStr = process.env.GITLAB_PROJECT_ID ? argv[0] : argv[1];
const title = process.env.GITLAB_PROJECT_ID ? argv[1] : argv[2];
if (!projectId || !iidStr || !title) {
  console.error("Usage: node run-update-mr-title.js <project_id> <merge_request_iid> <title>");
  console.error("Or:    GITLAB_PROJECT_ID=group/repo node run-update-mr-title.js 12754 openclaw");
  process.exit(1);
}
const mergeRequestIid = parseInt(iidStr, 10);
if (Number.isNaN(mergeRequestIid)) {
  console.error("merge_request_iid must be a number");
  process.exit(1);
}

updateMergeRequest(projectId, mergeRequestIid, { title })
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
