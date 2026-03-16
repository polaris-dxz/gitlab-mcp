/**
 * 在 MR 的 diff 指定行创建讨论（line comment）
 * 用法：node dist/tests/run-mr-diff-comment.js <project_id> <merge_request_iid> <file_path> <body> [new_line]
 * 若省略 new_line，则从 diff 中查找包含 "initConsoleInterceptor" 的行号（仅当 file_path 为 app.ts 时）；否则必须传 new_line。
 */
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

import {
  getMergeRequest,
  getMergeRequestDiffs,
  createMergeRequestDiscussion,
  type MergeRequestDiscussionPosition,
} from "../src/gitlab-client.js";

const argv = process.argv.slice(2);
const projectId = process.env.GITLAB_PROJECT_ID ?? argv[0];
const iidStr = process.env.GITLAB_PROJECT_ID ? argv[0] : argv[1];
const filePath = (process.env.GITLAB_PROJECT_ID ? argv[1] : argv[2]) ?? "";
const body = process.env.MR_NOTE_BODY ?? (process.env.GITLAB_PROJECT_ID ? argv[2] : argv[3]) ?? "";
const newLineArg = process.env.GITLAB_PROJECT_ID ? argv[3] : argv[4];

if (!projectId || !iidStr || !filePath || !body) {
  console.error("Usage: node run-mr-diff-comment.js <project_id> <merge_request_iid> <file_path> <body> [new_line]");
  process.exit(1);
}
const mergeRequestIid = parseInt(iidStr, 10);
if (Number.isNaN(mergeRequestIid)) {
  console.error("merge_request_iid must be a number");
  process.exit(1);
}

type DiffEntry = { old_path?: string; new_path?: string; diff?: string };

/** 从 diff 文本中找包含 search 的「新文件」行号；找不到返回 null */
function findNewLineInDiff(diff: string, search: string): number | null {
  let newLine: number | null = null;
  const lines = diff.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const m = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (m && m[1]) {
      newLine = parseInt(m[1], 10);
      continue;
    }
    if (newLine == null) continue;
    if (line.startsWith("+") && line.includes(search)) return newLine;
    if (line.startsWith(" ") || line.startsWith("+")) newLine++;
  }
  return null;
}

const normalize = (p: string) => p.replace(/^\//, "");

async function main() {
  const pid = String(projectId ?? "");
  const mr = (await getMergeRequest(pid, mergeRequestIid)) as {
    diff_refs?: { base_sha?: string; start_sha?: string; head_sha?: string };
  };
  const refs = mr?.diff_refs;
  if (!refs?.base_sha || !refs.start_sha || !refs.head_sha) {
    console.error("MR diff_refs 为空，无法创建 diff 评论（MR 可能刚创建尚未就绪）");
    process.exit(1);
  }

  let newLine: number | undefined =
    newLineArg != null && newLineArg !== "" ? parseInt(String(newLineArg), 10) : undefined;
  if (newLine !== undefined && Number.isNaN(newLine)) {
    console.error("new_line 必须是数字");
    process.exit(1);
  }

  const pathNorm = normalize(String(filePath));
  if (newLine == null) {
    const diffs = await getMergeRequestDiffs(pid, mergeRequestIid, { perPage: 200 });
    const entry = (diffs as DiffEntry[]).find((d) => {
      const np = d.new_path ?? "";
      const op = d.old_path ?? "";
      return normalize(np) === pathNorm || normalize(op) === pathNorm;
    });
    if (entry?.diff) {
      const found = findNewLineInDiff(String(entry.diff), "initConsoleInterceptor");
      if (found != null) newLine = found;
    }
  }

  if (newLine == null || newLine === undefined) {
    console.error("请提供 new_line 参数，或确保 diff 中存在包含 initConsoleInterceptor 的行");
    process.exit(1);
  }

  const baseSha = refs.base_sha ?? "";
  const startSha = refs.start_sha ?? "";
  const headSha = refs.head_sha ?? "";
  const position: MergeRequestDiscussionPosition = {
    base_sha: baseSha,
    start_sha: startSha,
    head_sha: headSha,
    position_type: "text",
    new_path: pathNorm,
    old_path: pathNorm,
    new_line: Number(newLine),
  };

  const result = await createMergeRequestDiscussion(pid, mergeRequestIid, {
    body: String(body ?? ""),
    position,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
