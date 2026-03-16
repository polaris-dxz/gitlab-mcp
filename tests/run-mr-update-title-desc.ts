/**
 * 获取 MR 当前 title/description，追加指定后缀后更新（用于批量加 openclaw 等）
 * 用法：node dist/tests/run-mr-update-title-desc.js <project_id> <merge_request_iid> <suffix>
 * 例：node dist/tests/run-mr-update-title-desc.js elementary/higgs/higgs-frontend 12754 openclaw
 */
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

import { getMergeRequest, updateMergeRequest } from "../src/gitlab-client.js";

const argv = process.argv.slice(2);
const projectId = argv[0] ?? "";
const iidStr = argv[1] ?? "";
const suffix = argv[2] ?? "openclaw";
if (!projectId || !iidStr) {
  console.error("Usage: node run-mr-update-title-desc.js <project_id> <merge_request_iid> [suffix]");
  process.exit(1);
}
const mergeRequestIid = parseInt(iidStr, 10);
if (Number.isNaN(mergeRequestIid)) {
  console.error("merge_request_iid must be a number");
  process.exit(1);
}

async function main() {
  const mr = (await getMergeRequest(String(projectId), mergeRequestIid)) as {
    title?: string;
    description?: string | null;
  };
  const currentTitle = (mr?.title ?? "").trim();
  const currentDesc = (mr?.description ?? "").trim();
  const titleAlreadyHasSuffix = currentTitle.endsWith(` ${suffix}`);
  const newTitle =
    currentTitle === ""
      ? suffix
      : titleAlreadyHasSuffix
        ? currentTitle
        : `${currentTitle} ${suffix}`;
  const descAlreadyHasSuffix = currentDesc.endsWith(suffix) || currentDesc.endsWith(`\n\n${suffix}`);
  const newDescription =
    currentDesc === ""
      ? suffix
      : descAlreadyHasSuffix
        ? currentDesc
        : `${currentDesc}\n\n${suffix}`;

  console.log("Updating MR:");
  console.log("  title:", newTitle);
  console.log("  description (last 80 chars):", newDescription.slice(-80));
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const descriptionDedup = newDescription.replace(
    new RegExp(`(\\n\\n${escaped})+\\s*$`),
    `\n\n${suffix}`
  );
  const result = await updateMergeRequest(String(projectId), mergeRequestIid, {
    title: newTitle,
    description: descriptionDedup,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
