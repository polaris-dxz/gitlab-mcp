#!/usr/bin/env node

import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// 仅当 MCP 未传入 GITLAB_TOKEN 时才从包根目录加载 .env（MCP 配置里的 env 优先生效，可配置多组）
if (!process.env.GITLAB_TOKEN) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  config({ path: join(__dirname, "..", ".env") });
}

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as tools from "./tools.js";

const server = new Server(
  {
    name: "gitlab-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const TOOLS = [
  {
    name: "list_projects",
    description: "List GitLab projects (optional search/visibility filter)",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: { type: "string" },
        visibility: { type: "string", enum: ["public", "internal", "private"] },
      },
    },
  },
  {
    name: "list_pipelines",
    description: "List pipelines for a project. Optional ref to filter (e.g. refs/merge-requests/12754/head for MR !12754).",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "Project ID or path" },
        ref: { type: "string", description: "Filter by ref, e.g. refs/merge-requests/12754/head" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "list_merge_request_pipelines",
    description: "List all pipelines for a merge request (e.g. pipelines triggered by MR commits)",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. elementary/higgs/higgs-frontend)" },
        merge_request_iid: { type: "number", description: "Merge request IID (e.g. 12754 for !12754)" },
      },
      required: ["project_id", "merge_request_iid"],
    },
  },
  {
    name: "list_merge_requests",
    description: "List merge requests of a project. state=opened for open (not merged) MRs. Optional author_username to filter by author.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string" },
        state: { type: "string", enum: ["opened", "closed", "merged", "all"], description: "Default opened" },
        per_page: { type: "number" },
        author_username: { type: "string", description: "Filter by author GitLab username" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "update_merge_request",
    description: "Update a merge request: set title, description and/or close/reopen. Provide at least one of title, description or state_event.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "Project ID or path (e.g. group/repo)" },
        merge_request_iid: { type: "number", description: "MR IID (e.g. 12754 for !12754)" },
        title: { type: "string", description: "New MR title" },
        description: { type: "string", description: "New MR description (replaces entire description)" },
        state_event: { type: "string", enum: ["close", "reopen"], description: "close = 关闭 MR, reopen = 重新打开" },
      },
      required: ["project_id", "merge_request_iid"],
    },
  },
  {
    name: "approve_merge_request",
    description: "Approve a merge request. Authenticated user must be an eligible approver.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string" },
        merge_request_iid: { type: "number", description: "MR IID (e.g. 12754 for !12754)" },
        sha: { type: "string", description: "Optional: HEAD commit SHA (must match current)" },
      },
      required: ["project_id", "merge_request_iid"],
    },
  },
  {
    name: "create_merge_request_note",
    description: "Add a comment (note) to a merge request. Body supports Markdown.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string" },
        merge_request_iid: { type: "number", description: "MR IID (e.g. 12754 for !12754)" },
        body: { type: "string", description: "Comment content" },
      },
      required: ["project_id", "merge_request_iid", "body"],
    },
  },
  {
    name: "set_merge_request_assignees_reviewers",
    description: "Set assignees and/or reviewers on a merge request by GitLab username(s).",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string" },
        merge_request_iid: { type: "number", description: "MR IID (e.g. 12754 for !12754)" },
        assignee_usernames: { type: "array", items: { type: "string" }, description: "Usernames as assignees" },
        reviewer_usernames: { type: "array", items: { type: "string" }, description: "Usernames as reviewers" },
      },
      required: ["project_id", "merge_request_iid"],
    },
  },
  {
    name: "get_pipeline",
    description: "Get a single pipeline details and job list",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string" },
        pipeline_id: { type: "number" },
      },
      required: ["project_id", "pipeline_id"],
    },
  },
  {
    name: "list_pipeline_jobs",
    description: "List jobs for a pipeline (use per_page 200+ for pipelines with many jobs)",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string" },
        pipeline_id: { type: "number" },
        per_page: { type: "number", description: "Max jobs to return, default 20" },
      },
      required: ["project_id", "pipeline_id"],
    },
  },
  {
    name: "get_job_logs",
    description: "Get trace/logs for a single job",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string" },
        job_id: { type: "number" },
      },
      required: ["project_id", "job_id"],
    },
  },
  {
    name: "trigger_pipeline",
    description: "Trigger a pipeline by ref (branch/tag), optional variables",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string" },
        ref: { type: "string", description: "Branch or tag name" },
        variables: { type: "object", additionalProperties: { type: "string" } },
      },
      required: ["project_id", "ref"],
    },
  },
  {
    name: "play_job",
    description:
      "Play a manual job in a pipeline (e.g. trigger-aecc-app, trigger-no-region). Use after trigger_pipeline + list_pipeline_jobs to get job_id. Each play triggers that job and its downstream.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string", description: "Project ID or path" },
        job_id: { type: "number", description: "Job ID from list_pipeline_jobs" },
      },
      required: ["project_id", "job_id"],
    },
  },
  {
    name: "list_pipeline_bridges",
    description:
      "List bridge jobs of a pipeline. Each bridge may have downstream_pipeline.id (child pipeline created when that bridge runs). Use per_page 200+ for many bridges. To play jobs in a bridge's downstream: play that bridge, then use get_downstream_pipeline_id with the bridge name, then play_bridge_jobs_by_name with the returned pipeline_id.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string" },
        pipeline_id: { type: "number" },
        per_page: { type: "number", description: "Max bridges to return, default 20" },
      },
      required: ["project_id", "pipeline_id"],
    },
  },
  {
    name: "get_downstream_pipeline_id",
    description:
      "Get the downstream (child) pipeline id for a given bridge name in a pipeline. Call after playing that bridge; if downstream not created yet, wait and retry. Use the returned downstream_pipeline_id with play_bridge_jobs_by_name to play jobs in that downstream. No hardcode: caller provides bridge_name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string" },
        pipeline_id: { type: "number" },
        bridge_name: { type: "string", description: "Exact bridge job name that creates the downstream (e.g. trigger-ssp-app)" },
        per_page: { type: "number" },
      },
      required: ["project_id", "pipeline_id", "bridge_name"],
    },
  },
  {
    name: "play_bridge_jobs_by_name",
    description:
      "Find bridge jobs by exact name in a pipeline and play them. pipeline_id can be the parent pipeline or a downstream pipeline id (from get_downstream_pipeline_id). Use for both same-level and downstream-level jobs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string" },
        pipeline_id: { type: "number" },
        job_names: { type: "array", items: { type: "string" } },
        per_page: { type: "number", description: "Max bridges to fetch, default 200" },
      },
      required: ["project_id", "pipeline_id", "job_names"],
    },
  },
  {
    name: "trigger_and_play_manual_jobs",
    description:
      "Convenience: trigger a pipeline by ref, wait, then play given bridge job names. Same as trigger_pipeline + wait + play_bridge_jobs_by_name. For more control use those tools separately.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_id: { type: "string" },
        ref: { type: "string" },
        job_names: { type: "array", items: { type: "string" } },
        variables: { type: "object", additionalProperties: { type: "string" } },
        wait_seconds: { type: "number" },
      },
      required: ["project_id", "ref", "job_names"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case "list_projects": {
        const parsed = tools.listProjectsSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.listProjects(parsed.data);
      }
      case "list_pipelines": {
        const parsed = tools.listPipelinesSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.listPipelines(parsed.data);
      }
      case "list_merge_request_pipelines": {
        const parsed = tools.listMergeRequestPipelinesSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.listMergeRequestPipelines(parsed.data);
      }
      case "list_merge_requests": {
        const parsed = tools.listMergeRequestsSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.listMergeRequests(parsed.data);
      }
      case "update_merge_request": {
        const parsed = tools.updateMergeRequestSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.updateMergeRequest(parsed.data);
      }
      case "approve_merge_request": {
        const parsed = tools.approveMergeRequestSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.approveMergeRequest(parsed.data);
      }
      case "create_merge_request_note": {
        const parsed = tools.createMergeRequestNoteSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.createMergeRequestNote(parsed.data);
      }
      case "set_merge_request_assignees_reviewers": {
        const parsed = tools.setMergeRequestAssigneesReviewersSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.setMergeRequestAssigneesReviewers(parsed.data);
      }
      case "get_pipeline": {
        const parsed = tools.getPipelineSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.getPipeline(parsed.data);
      }
      case "list_pipeline_jobs": {
        const parsed = tools.listPipelineJobsSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.listPipelineJobs(parsed.data);
      }
      case "get_job_logs": {
        const parsed = tools.getJobLogsSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.getJobLogs(parsed.data);
      }
      case "trigger_pipeline": {
        const parsed = tools.triggerPipelineSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.triggerPipeline(parsed.data);
      }
      case "play_job": {
        const parsed = tools.playJobSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.playJob(parsed.data);
      }
      case "list_pipeline_bridges": {
        const parsed = tools.listPipelineBridgesSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.listPipelineBridges(parsed.data);
      }
      case "get_downstream_pipeline_id": {
        const parsed = tools.getDownstreamPipelineIdSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.getDownstreamPipelineId(parsed.data);
      }
      case "play_bridge_jobs_by_name": {
        const parsed = tools.playBridgeJobsByNameSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.playBridgeJobsByName(parsed.data);
      }
      case "trigger_and_play_manual_jobs": {
        const parsed = tools.triggerAndPlayManualJobsSchema.safeParse(args ?? {});
        if (!parsed.success) throw new Error(parsed.error.message);
        return await tools.triggerAndPlayManualJobs(parsed.data);
      }
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: message }],
      isError: true,
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch(console.error);
