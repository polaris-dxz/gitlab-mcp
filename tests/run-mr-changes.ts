/**
 * 列出指定 MR 的变更文件
 * 用法：node dist/tests/run-mr-changes.js <project_id> <merge_request_iid>
 */
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

import { getMergeRequestDiffs } from "../src/gitlab-client.js";

const argv = process.argv.slice(2);
const projectId = process.env.GITLAB_PROJECT_ID || argv[0];
const iidStr = process.env.GITLAB_PROJECT_ID ? argv[0] : argv[1];
if (!projectId || !iidStr) {
  console.error("Usage: node run-mr-changes.js <project_id> <merge_request_iid>");
  process.exit(1);
}
const mergeRequestIid = parseInt(iidStr, 10);
if (Number.isNaN(mergeRequestIid)) {
  console.error("merge_request_iid must be a number");
  process.exit(1);
}

getMergeRequestDiffs(projectId, mergeRequestIid, { perPage: 200 })
  .then((diffs) => {
    type Diff = { old_path?: string; new_path?: string; new_file?: boolean; deleted_file?: boolean };
    const files = (diffs as Diff[]).map((d) => ({
      path: d.new_path ?? d.old_path ?? "?",
      status: d.new_file ? "added" : d.deleted_file ? "deleted" : "modified",
    }));
    console.log(JSON.stringify(files, null, 2));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
