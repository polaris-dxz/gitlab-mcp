/**
 * 本地测试脚本（MCP 不会调用）：用 CLI 调用与 MCP 相同的工具逻辑。
 * 支持「父 pipeline 的 bridge」+ 可选「该 bridge 下游的 job」。
 *
 * 用法：
 *   <project> <ref> <parent_bridge_name> [--downstream <downstream_job1> [downstream_job2 ...]]
 * 例：node dist/tests/run-trigger-and-play.js elementary/higgs/higgs-frontend main trigger-aecc-app --downstream trigger-no-region
 */
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

import {
  triggerAndPlayManualJobs,
  triggerAndPlayManualJobsSchema,
  getDownstreamPipelineId,
  getDownstreamPipelineIdSchema,
  playBridgeJobsByName,
  playBridgeJobsByNameSchema,
} from "../src/tools.js";

const argv = process.argv.slice(2);
const downstreamIdx = argv.indexOf("--downstream");
const projectArg = argv[0];
const refArg = argv[1];
const parentJobNames = downstreamIdx >= 0 ? argv.slice(2, downstreamIdx) : argv.slice(2);
const downstreamJobNames = downstreamIdx >= 0 ? argv.slice(downstreamIdx + 1) : [];

if (!projectArg || !refArg || parentJobNames.length === 0) {
  console.error("Usage: node run-trigger-and-play.js <project> <ref> <parent_bridge> [--downstream <downstream_job> ...]");
  process.exit(1);
}

async function main() {
  const parsed = triggerAndPlayManualJobsSchema.safeParse({
    project_id: projectArg,
    ref: refArg,
    job_names: parentJobNames,
    wait_seconds: 25,
  });
  if (!parsed.success) {
    console.error(parsed.error.message);
    process.exit(1);
  }

  const out = await triggerAndPlayManualJobs(parsed.data);
  const text = out.content?.[0]?.type === "text" ? out.content[0].text : "";
  console.log(text);
  if (out.isError) process.exit(1);

  if (downstreamJobNames.length === 0) {
    return;
  }

  const summary = JSON.parse(text || "{}");
  const pipelineId = summary.pipeline_id;
  if (pipelineId == null) {
    console.error("No pipeline_id in result");
    process.exit(1);
  }
  const bridgeForDownstream = parentJobNames[0];
  console.log("\nWaiting 15s for downstream of", bridgeForDownstream, "...");
  await new Promise((r) => setTimeout(r, 15_000));

  const downParsed = getDownstreamPipelineIdSchema.safeParse({
    project_id: projectArg,
    pipeline_id: pipelineId,
    bridge_name: bridgeForDownstream,
    per_page: 200,
  });
  if (!downParsed.success) {
    console.error(downParsed.error.message);
    process.exit(1);
  }
  const downOut = await getDownstreamPipelineId(downParsed.data);
  const downText = downOut.content?.[0]?.type === "text" ? downOut.content[0].text : "";
  const downSummary = JSON.parse(downText || "{}");
  const downstreamId = downSummary.downstream_pipeline_id;
  if (downstreamId == null) {
    console.error("Downstream not found:", downSummary.message || downText);
    process.exit(1);
  }
  console.log("Downstream pipeline_id:", downstreamId);

  const playDownParsed = playBridgeJobsByNameSchema.safeParse({
    project_id: projectArg,
    pipeline_id: downstreamId,
    job_names: downstreamJobNames,
    per_page: 200,
  });
  if (!playDownParsed.success) {
    console.error(playDownParsed.error.message);
    process.exit(1);
  }
  const playDownOut = await playBridgeJobsByName(playDownParsed.data);
  const playDownText = playDownOut.content?.[0]?.type === "text" ? playDownOut.content[0].text : "";
  console.log("\nDownstream play result:", playDownText);
  if (playDownOut.isError) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
