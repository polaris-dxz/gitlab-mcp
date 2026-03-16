/**
 * 在 MR 下发布一条评论（note）
 * 用法：node dist/tests/run-mr-note.js <project_id> <merge_request_iid> <body>
 * 若 body 含空格，可传单参数用 '' 包住，或使用环境变量 MR_NOTE_BODY
 */
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

import { createMergeRequestNote } from "../src/gitlab-client.js";

const argv = process.argv.slice(2);
const projectId = process.env.GITLAB_PROJECT_ID || argv[0];
const iidStr = process.env.GITLAB_PROJECT_ID ? argv[0] : argv[1];
const body = process.env.MR_NOTE_BODY || (process.env.GITLAB_PROJECT_ID ? argv.slice(1).join(" ") : argv.slice(2).join(" "));
if (!projectId || !iidStr || !body) {
  console.error("Usage: node run-mr-note.js <project_id> <merge_request_iid> <body>");
  console.error("Or:    MR_NOTE_BODY='...' node run-mr-note.js <project_id> <merge_request_iid>");
  process.exit(1);
}
const mergeRequestIid = parseInt(iidStr, 10);
if (Number.isNaN(mergeRequestIid)) {
  console.error("merge_request_iid must be a number");
  process.exit(1);
}

createMergeRequestNote(projectId, mergeRequestIid, body)
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
