/**
 * 输出指定 MR 中某个文件的 diff
 * 用法：node dist/tests/run-mr-file-diff.js <project_id> <merge_request_iid> <file_path>
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
const filePath = process.env.GITLAB_PROJECT_ID ? argv[1] : argv[2];
if (!projectId || !iidStr || !filePath) {
  console.error("Usage: node run-mr-file-diff.js <project_id> <merge_request_iid> <file_path>");
  process.exit(1);
}
const mergeRequestIid = parseInt(iidStr, 10);
if (Number.isNaN(mergeRequestIid)) {
  console.error("merge_request_iid must be a number");
  process.exit(1);
}

type DiffEntry = { old_path?: string; new_path?: string; diff?: string; new_file?: boolean; deleted_file?: boolean };
const normalize = (p: string) => p.replace(/^\//, "");

getMergeRequestDiffs(projectId, mergeRequestIid, { perPage: 200 })
  .then((diffs) => {
    const want = normalize(filePath);
    const entry = (diffs as DiffEntry[]).find(
      (d) => normalize(d.new_path ?? "") === want || normalize(d.old_path ?? "") === want
    );
    if (!entry) {
      console.error("File not found in MR:", filePath);
      process.exit(1);
    }
    if (entry.deleted_file) {
      console.log("(file deleted)\n");
      if (entry.diff) console.log(entry.diff);
      return;
    }
    if (entry.new_file) console.log("(new file)\n");
    if (entry.diff) console.log(entry.diff);
    else console.log("(no diff content returned by API)");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
