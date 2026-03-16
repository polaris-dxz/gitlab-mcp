import { z } from "zod";
import * as gitlab from "./gitlab-client.js";

export const listProjectsSchema = z.object({
  search: z.string().optional(),
  visibility: z.enum(["public", "internal", "private"]).optional(),
});

export const listPipelinesSchema = z.object({
  project_id: z.union([z.string(), z.number()]).describe("Project ID or path"),
  ref: z.string().optional().describe("Filter by ref, e.g. refs/merge-requests/12754/head for MR !12754"),
});

export const listMergeRequestPipelinesSchema = z.object({
  project_id: z.union([z.string(), z.number()]).describe("Project ID or path (e.g. elementary/higgs/higgs-frontend)"),
  merge_request_iid: z.number().describe("Merge request IID (e.g. 12754 for !12754)"),
});

export const listMergeRequestsSchema = z.object({
  project_id: z.union([z.string(), z.number()]).describe("Project ID or path"),
  state: z.enum(["opened", "closed", "merged", "all"]).optional().describe("opened = 未合并, merged = 已合并, default opened"),
  per_page: z.number().optional(),
  author_username: z.string().optional().describe("Filter by author GitLab username"),
});

export const updateMergeRequestSchema = z
  .object({
    project_id: z.union([z.string(), z.number()]).describe("Project ID or path"),
    merge_request_iid: z.number().describe("Merge request IID (e.g. 12754 for !12754)"),
    title: z.string().optional().describe("New title for the MR (e.g. add prefix/suffix like OpenClaw)"),
    description: z.string().optional().describe("New description for the MR (replaces entire description)"),
    state_event: z.enum(["close", "reopen"]).optional().describe("close = 关闭 MR, reopen = 重新打开"),
  })
  .refine(
    (data) =>
      data.title !== undefined || data.description !== undefined || data.state_event !== undefined,
    { message: "At least one of title, description or state_event must be provided" }
  );

export const approveMergeRequestSchema = z.object({
  project_id: z.union([z.string(), z.number()]).describe("Project ID or path"),
  merge_request_iid: z.number().describe("Merge request IID (e.g. 12754 for !12754)"),
  sha: z.string().optional().describe("Optional: HEAD commit SHA of the MR (must match current)"),
});

export const createMergeRequestNoteSchema = z.object({
  project_id: z.union([z.string(), z.number()]).describe("Project ID or path"),
  merge_request_iid: z.number().describe("Merge request IID (e.g. 12754 for !12754)"),
  body: z.string().describe("Comment body (supports Markdown)"),
});

export const setMergeRequestAssigneesReviewersSchema = z
  .object({
    project_id: z.union([z.string(), z.number()]).describe("Project ID or path"),
    merge_request_iid: z.number().describe("Merge request IID (e.g. 12754 for !12754)"),
    assignee_usernames: z.array(z.string()).optional().describe("GitLab usernames to set as assignees"),
    reviewer_usernames: z.array(z.string()).optional().describe("GitLab usernames to set as reviewers"),
  })
  .refine((data) => (data.assignee_usernames?.length ?? 0) > 0 || (data.reviewer_usernames?.length ?? 0) > 0, {
    message: "At least one of assignee_usernames or reviewer_usernames must be non-empty",
  });

export const getPipelineSchema = z.object({
  project_id: z.union([z.string(), z.number()]),
  pipeline_id: z.number(),
});

export const listPipelineJobsSchema = z.object({
  project_id: z.union([z.string(), z.number()]),
  pipeline_id: z.number(),
  per_page: z.number().optional().describe("Max jobs to return (default 20), use 200+ to get all jobs in large pipelines"),
});

export const getJobLogsSchema = z.object({
  project_id: z.union([z.string(), z.number()]),
  job_id: z.number(),
});

export const triggerPipelineSchema = z.object({
  project_id: z.union([z.string(), z.number()]),
  ref: z.string().describe("Branch or tag name"),
  variables: z.record(z.string()).optional(),
});

export const playJobSchema = z.object({
  project_id: z.union([z.string(), z.number()]).describe("Project ID or path"),
  job_id: z.number().describe("Job ID (e.g. from list_pipeline_jobs), used to play a manual job and trigger downstream"),
});

export const listPipelineBridgesSchema = z.object({
  project_id: z.union([z.string(), z.number()]),
  pipeline_id: z.number(),
  per_page: z.number().optional().describe("Max bridges to return (default 20), use 200+ for pipelines with many bridge jobs"),
});

export const getDownstreamPipelineIdSchema = z.object({
  project_id: z.union([z.string(), z.number()]).describe("Project ID or path"),
  pipeline_id: z.number().describe("Parent pipeline ID"),
  bridge_name: z.string().describe("Exact name of the bridge job that creates the downstream (e.g. trigger-ssp-app). Returns that bridge's downstream_pipeline.id if present."),
  per_page: z.number().optional(),
});

export const playBridgeJobsByNameSchema = z.object({
  project_id: z.union([z.string(), z.number()]).describe("Project ID or path"),
  pipeline_id: z.number().describe("Pipeline ID (e.g. from trigger_pipeline or list_pipelines)"),
  job_names: z.array(z.string()).describe("Exact bridge job names to play"),
  per_page: z.number().optional().describe("Max bridges to fetch (default 200)"),
});

export const triggerAndPlayManualJobsSchema = z.object({
  project_id: z.union([z.string(), z.number()]).describe("Project ID or path"),
  ref: z.string().describe("Branch or tag"),
  job_names: z.array(z.string()).describe("Bridge job names to play after trigger"),
  variables: z.record(z.string()).optional(),
  wait_seconds: z.number().optional().describe("Seconds to wait after trigger (default 25)"),
});

export async function listProjects(args: z.infer<typeof listProjectsSchema>) {
  const result = await gitlab.listProjects({
    search: args.search,
    visibility: args.visibility,
  });
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], isError: false };
}

export async function listPipelines(args: z.infer<typeof listPipelinesSchema>) {
  const result = await gitlab.listPipelines(args.project_id, { ref: args.ref });
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], isError: false };
}

export async function listMergeRequestPipelines(args: z.infer<typeof listMergeRequestPipelinesSchema>) {
  const result = await gitlab.listMergeRequestPipelines(args.project_id, args.merge_request_iid);
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], isError: false };
}

export async function listMergeRequests(args: z.infer<typeof listMergeRequestsSchema>) {
  const result = await gitlab.listMergeRequests(args.project_id, {
    state: args.state,
    perPage: args.per_page,
    authorUsername: args.author_username,
  });
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], isError: false };
}

export async function updateMergeRequest(args: z.infer<typeof updateMergeRequestSchema>) {
  const body: Parameters<typeof gitlab.updateMergeRequest>[2] = {};
  if (args.title !== undefined) body.title = args.title;
  if (args.description !== undefined) body.description = args.description;
  if (args.state_event !== undefined) body.state_event = args.state_event;
  const result = await gitlab.updateMergeRequest(args.project_id, args.merge_request_iid, body);
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], isError: false };
}

export async function approveMergeRequest(args: z.infer<typeof approveMergeRequestSchema>) {
  const result = await gitlab.approveMergeRequest(args.project_id, args.merge_request_iid, {
    sha: args.sha,
  });
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], isError: false };
}

export async function createMergeRequestNote(args: z.infer<typeof createMergeRequestNoteSchema>) {
  const result = await gitlab.createMergeRequestNote(args.project_id, args.merge_request_iid, args.body);
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], isError: false };
}

export async function setMergeRequestAssigneesReviewers(
  args: z.infer<typeof setMergeRequestAssigneesReviewersSchema>
) {
  const assigneeIds =
    args.assignee_usernames?.length ?
      await Promise.all(args.assignee_usernames.map((u) => gitlab.getUserIdByUsername(u)))
    : undefined;
  const reviewerIds =
    args.reviewer_usernames?.length ?
      await Promise.all(args.reviewer_usernames.map((u) => gitlab.getUserIdByUsername(u)))
    : undefined;
  const result = await gitlab.updateMergeRequest(args.project_id, args.merge_request_iid, {
    ...(assigneeIds?.length && { assignee_ids: assigneeIds }),
    ...(reviewerIds?.length && { reviewer_ids: reviewerIds }),
  });
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], isError: false };
}

export async function getPipeline(args: z.infer<typeof getPipelineSchema>) {
  const result = await gitlab.getPipeline(args.project_id, args.pipeline_id);
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], isError: false };
}

export async function listPipelineJobs(args: z.infer<typeof listPipelineJobsSchema>) {
  const result = await gitlab.listPipelineJobs(args.project_id, args.pipeline_id, {
    perPage: args.per_page,
  });
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], isError: false };
}

export async function getJobLogs(args: z.infer<typeof getJobLogsSchema>) {
  const result = await gitlab.getJobLogs(args.project_id, args.job_id);
  return { content: [{ type: "text" as const, text: result }], isError: false };
}

export async function triggerPipeline(args: z.infer<typeof triggerPipelineSchema>) {
  const result = await gitlab.triggerPipeline(args.project_id, args.ref, args.variables);
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], isError: false };
}

export async function playJob(args: z.infer<typeof playJobSchema>) {
  const result = await gitlab.playJob(args.project_id, args.job_id);
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], isError: false };
}

export async function listPipelineBridges(args: z.infer<typeof listPipelineBridgesSchema>) {
  const result = await gitlab.listPipelineBridges(args.project_id, args.pipeline_id, { perPage: args.per_page });
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], isError: false };
}

/**
 * 根据 bridge 名称取该 bridge 的 downstream_pipeline.id。用于「先 play 某 bridge，再在其下游 pipeline 里 play 其他 job」的流程。
 * 无 hardcode，调用方传入 bridge_name。
 */
export async function getDownstreamPipelineId(args: z.infer<typeof getDownstreamPipelineIdSchema>) {
  const perPage = args.per_page ?? 200;
  const bridges = await gitlab.listPipelineBridges(args.project_id, args.pipeline_id, { perPage });
  for (const b of bridges) {
    const bridge = b as { name: string; downstream_pipeline?: { id: number } };
    if (bridge.name === args.bridge_name && bridge.downstream_pipeline?.id) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ downstream_pipeline_id: bridge.downstream_pipeline.id, bridge_name: args.bridge_name }, null, 2) }], isError: false };
    }
  }
  return { content: [{ type: "text" as const, text: JSON.stringify({ downstream_pipeline_id: null, bridge_name: args.bridge_name, message: "Bridge not found or has no downstream yet (run the bridge first, then wait and retry)." }, null, 2) }], isError: false };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 从 bridge 列表中按名称取要播放的 job（bridge 即 trigger job，有 id/name） */
function findBridgesByName(bridges: unknown[], names: string[]): { id: number; name: string }[] {
  const set = new Set(names);
  const out: { id: number; name: string }[] = [];
  for (const b of bridges) {
    const bridge = b as { id: number; name: string };
    if (set.has(bridge.name)) out.push({ id: bridge.id, name: bridge.name });
  }
  return out;
}

/**
 * 通用、可组合：对已有 pipeline 按 bridge job 名称批量 play，不触发新 pipeline。
 * 可与 trigger_pipeline + 自行等待 组合使用，或对任意已有 pipeline_id 使用。
 */
export async function playBridgeJobsByName(args: z.infer<typeof playBridgeJobsByNameSchema>) {
  const perPage = args.per_page ?? 200;
  const bridges = await gitlab.listPipelineBridges(args.project_id, args.pipeline_id, { perPage });
  const toPlay = findBridgesByName(bridges, args.job_names);
  const results: { name: string; job_id: number; ok: boolean; error?: string }[] = [];
  for (const { id, name } of toPlay) {
    try {
      await gitlab.playJob(args.project_id, id);
      results.push({ name, job_id: id, ok: true });
    } catch (e) {
      results.push({ name, job_id: id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const summary = {
    pipeline_id: args.pipeline_id,
    played: results,
    not_found: args.job_names.filter((n) => !toPlay.some((p) => p.name === n)),
  };
  return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }], isError: false };
}

/**
 * 便捷一步：触发 pipeline → 等待 → 在当前 pipeline 的 bridges 中按名称 play。无 fallback，不跨 pipeline。
 */
export async function triggerAndPlayManualJobs(args: z.infer<typeof triggerAndPlayManualJobsSchema>) {
  const waitMs = (args.wait_seconds ?? 25) * 1000;
  const pipeline = (await gitlab.triggerPipeline(args.project_id, args.ref, args.variables)) as { id: number; web_url?: string };
  await sleep(waitMs);
  const playResult = await playBridgeJobsByName({
    project_id: args.project_id,
    pipeline_id: pipeline.id,
    job_names: args.job_names,
    per_page: 200,
  });
  const text = playResult.content[0]?.type === "text" ? playResult.content[0].text : "";
  const summary = text ? { ...JSON.parse(text), pipeline_id: pipeline.id, pipeline_url: pipeline.web_url } : { pipeline_id: pipeline.id, pipeline_url: pipeline.web_url, played: [], not_found: args.job_names };
  return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }], isError: false };
}
