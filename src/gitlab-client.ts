/**
 * GitLab REST API 客户端封装
 * 环境变量: GITLAB_URL, GITLAB_TOKEN (PRIVATE-TOKEN)
 */

const getBaseUrl = (): string => {
  const url = process.env.GITLAB_URL ?? "https://gitlab.com";
  return url.replace(/\/$/, "");
};

const getToken = (): string => {
  const token = process.env.GITLAB_TOKEN;
  if (!token) throw new Error("GITLAB_TOKEN environment variable is required");
  return token;
};

function headers(): Record<string, string> {
  return {
    "PRIVATE-TOKEN": getToken(),
    "Content-Type": "application/json",
  };
}

export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const base = getBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...headers(), ...(options.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitLab API ${res.status}: ${text}`);
  }
  if (res.headers.get("content-type")?.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return res.text() as Promise<T>;
}

/**
 * 按 username 查询用户，返回第一个匹配用户的 id
 * @see https://docs.gitlab.com/ee/api/users.html#list-users
 */
export async function getUserIdByUsername(username: string): Promise<number> {
  const q = new URLSearchParams();
  q.set("username", username);
  const data = await request<{ id: number }[]>(`/api/v4/users?${q.toString()}`);
  const first = Array.isArray(data) ? data[0] : undefined;
  if (first == null) throw new Error(`User not found: ${username}`);
  return first.id;
}

export async function listProjects(params?: { search?: string; visibility?: string }): Promise<unknown[]> {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.visibility) q.set("visibility", params.visibility);
  const suffix = q.toString() ? `?${q}` : "";
  const data = await request<unknown[]>(`/api/v4/projects${suffix}`);
  return Array.isArray(data) ? data : [];
}

export async function listPipelines(
  projectId: string | number,
  options?: { ref?: string }
): Promise<unknown[]> {
  const q = new URLSearchParams();
  if (options?.ref) q.set("ref", options.ref);
  const suffix = q.toString() ? `?${q}` : "";
  const data = await request<unknown[]>(
    `/api/v4/projects/${encodeURIComponent(String(projectId))}/pipelines${suffix}`
  );
  return Array.isArray(data) ? data : [];
}

/**
 * List pipelines for a merge request.
 * @see https://docs.gitlab.com/ee/api/merge_requests.html#list-mr-pipelines
 */
export async function listMergeRequestPipelines(
  projectId: string | number,
  mergeRequestIid: number
): Promise<unknown[]> {
  const data = await request<unknown[]>(
    `/api/v4/projects/${encodeURIComponent(String(projectId))}/merge_requests/${mergeRequestIid}/pipelines`
  );
  return Array.isArray(data) ? data : [];
}

/**
 * 获取单条 Merge Request（含 diff_refs，用于在 diff 上创建 line comment）
 * @see https://docs.gitlab.com/ee/api/merge_requests.html#get-single-mr
 */
export async function getMergeRequest(
  projectId: string | number,
  mergeRequestIid: number
): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(
    `/api/v4/projects/${encodeURIComponent(String(projectId))}/merge_requests/${mergeRequestIid}`
  );
}

/**
 * 列出项目的 Merge Requests
 * @see https://docs.gitlab.com/ee/api/merge_requests.html#list-project-merge-requests
 */
export async function listMergeRequests(
  projectId: string | number,
  options?: { state?: "opened" | "closed" | "merged" | "all"; perPage?: number; authorUsername?: string }
): Promise<unknown[]> {
  const q = new URLSearchParams();
  q.set("state", options?.state ?? "opened");
  q.set("scope", "all");
  if (options?.perPage) q.set("per_page", String(options.perPage));
  if (options?.authorUsername) q.set("author_username", options.authorUsername);
  const suffix = q.toString();
  const data = await request<unknown[]>(
    `/api/v4/projects/${encodeURIComponent(String(projectId))}/merge_requests?${suffix}`
  );
  return Array.isArray(data) ? data : [];
}

/**
 * 更新 Merge Request（关闭/重开、assignees、reviewers 等）
 * @see https://docs.gitlab.com/ee/api/merge_requests.html#update-mr
 */
export async function updateMergeRequest(
  projectId: string | number,
  mergeRequestIid: number,
  body: {
    title?: string;
    description?: string;
    state_event?: "close" | "reopen";
    assignee_ids?: number[];
    reviewer_ids?: number[];
  }
): Promise<unknown> {
  return request<unknown>(
    `/api/v4/projects/${encodeURIComponent(String(projectId))}/merge_requests/${mergeRequestIid}`,
    { method: "PUT", body: JSON.stringify(body) }
  );
}

/**
 * 对 Merge Request 执行 approve（需为项目合法 approver）
 * @see https://docs.gitlab.com/ee/api/merge_request_approvals.html#approve-merge-request
 */
export async function approveMergeRequest(
  projectId: string | number,
  mergeRequestIid: number,
  options?: { sha?: string }
): Promise<unknown> {
  const q = new URLSearchParams();
  if (options?.sha) q.set("sha", options.sha);
  const suffix = q.toString() ? `?${q}` : "";
  return request<unknown>(
    `/api/v4/projects/${encodeURIComponent(String(projectId))}/merge_requests/${mergeRequestIid}/approve${suffix}`,
    { method: "POST" }
  );
}

/**
 * 获取 Merge Request 的 diff 列表（变更文件）
 * @see https://docs.gitlab.com/ee/api/merge_requests.html#list-merge-request-diffs
 */
export async function getMergeRequestDiffs(
  projectId: string | number,
  mergeRequestIid: number,
  options?: { perPage?: number }
): Promise<unknown[]> {
  const q = new URLSearchParams();
  if (options?.perPage) q.set("per_page", String(options.perPage));
  const suffix = q.toString() ? `?${q}` : "";
  const data = await request<unknown[]>(
    `/api/v4/projects/${encodeURIComponent(String(projectId))}/merge_requests/${mergeRequestIid}/diffs${suffix}`
  );
  return Array.isArray(data) ? data : [];
}

/**
 * 在 Merge Request 下创建评论（note）
 * @see https://docs.gitlab.com/ee/api/notes.html#create-new-merge-request-note
 */
export async function createMergeRequestNote(
  projectId: string | number,
  mergeRequestIid: number,
  body: string
): Promise<unknown> {
  return request<unknown>(
    `/api/v4/projects/${encodeURIComponent(String(projectId))}/merge_requests/${mergeRequestIid}/notes`,
    { method: "POST", body: JSON.stringify({ body }) }
  );
}

/**
 * Position 用于在 MR diff 的某一行创建讨论（line comment）
 * @see https://docs.gitlab.com/ee/api/discussions.html#create-new-merge-request-thread
 */
export type MergeRequestDiscussionPosition = {
  base_sha: string;
  start_sha: string;
  head_sha: string;
  position_type: "text";
  new_path: string;
  old_path: string;
  new_line?: number;
  old_line?: number;
};

/**
 * 在 MR 的 diff 指定行创建讨论（line comment / diff note）
 * 需先通过 getMergeRequest 获取 diff_refs（base_sha, start_sha, head_sha）
 * @see https://docs.gitlab.com/ee/api/discussions.html#create-new-merge-request-thread
 */
export async function createMergeRequestDiscussion(
  projectId: string | number,
  mergeRequestIid: number,
  params: { body: string; position: MergeRequestDiscussionPosition }
): Promise<unknown> {
  return request<unknown>(
    `/api/v4/projects/${encodeURIComponent(String(projectId))}/merge_requests/${mergeRequestIid}/discussions`,
    { method: "POST", body: JSON.stringify(params) }
  );
}

export async function getPipeline(projectId: string | number, pipelineId: number): Promise<unknown> {
  return request(`/api/v4/projects/${encodeURIComponent(String(projectId))}/pipelines/${pipelineId}`);
}

/**
 * 列出 pipeline 的 bridge jobs（触发下游/子 pipeline 的 job），用于获取 downstream_pipeline.id 或按名称 play
 * @see https://docs.gitlab.com/ee/api/jobs.html#list-pipeline-bridges
 */
export async function listPipelineBridges(
  projectId: string | number,
  pipelineId: number,
  options?: { perPage?: number }
): Promise<unknown[]> {
  const q = new URLSearchParams();
  if (options?.perPage) q.set("per_page", String(options.perPage));
  const suffix = q.toString() ? `?${q}` : "";
  const data = await request<unknown[]>(
    `/api/v4/projects/${encodeURIComponent(String(projectId))}/pipelines/${pipelineId}/bridges${suffix}`
  );
  return Array.isArray(data) ? data : [];
}

export async function listPipelineJobs(
  projectId: string | number,
  pipelineId: number,
  options?: { perPage?: number }
): Promise<unknown[]> {
  const q = new URLSearchParams();
  if (options?.perPage) q.set("per_page", String(options.perPage));
  const suffix = q.toString() ? `?${q}` : "";
  const data = await request<unknown[]>(
    `/api/v4/projects/${encodeURIComponent(String(projectId))}/pipelines/${pipelineId}/jobs${suffix}`
  );
  return Array.isArray(data) ? data : [];
}

export async function getJobLogs(projectId: string | number, jobId: number): Promise<string> {
  const trace = await request<string>(
    `/api/v4/projects/${encodeURIComponent(String(projectId))}/jobs/${jobId}/trace`
  );
  return typeof trace === "string" ? trace : JSON.stringify(trace);
}

export async function triggerPipeline(
  projectId: string | number,
  ref: string,
  variables?: Record<string, string>
): Promise<unknown> {
  return request(`/api/v4/projects/${encodeURIComponent(String(projectId))}/pipeline`, {
    method: "POST",
    body: JSON.stringify({ ref, variables: variables ? Object.entries(variables).map(([k, v]) => ({ key: k, value: v })) : undefined }),
  });
}

/**
 * 触发 pipeline 中的某个手动 job（Play 按钮），常用于 trigger-xxx 类 job 以启动下游 pipeline
 * @see https://docs.gitlab.com/ee/api/jobs.html#run-a-job
 */
export async function playJob(projectId: string | number, jobId: number): Promise<unknown> {
  return request(
    `/api/v4/projects/${encodeURIComponent(String(projectId))}/jobs/${jobId}/play`,
    { method: "POST" }
  );
}
