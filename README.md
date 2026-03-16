# GitLab MCP

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that exposes GitLab REST API as tools. Use it from Cursor, Claude Desktop, or any MCP client to manage projects, merge requests, and CI/CD pipelines.

[中文说明](./README.zh-CN.md)

## Setup

1. **Clone and install**
   ```bash
   git clone <your-repo-url> gitlab-mcp && cd gitlab-mcp
   npm install
   ```

2. **Environment**
   - Copy `.env.example` to `.env` in the repo root.
   - Set `GITLAB_URL` (e.g. `https://gitlab.com` or your self-hosted instance).
   - Set `GITLAB_TOKEN` (Personal Access Token or Project Access Token with `api` scope).

3. **Build and verify**
   - `npm run build` — compile TypeScript to `dist/`.
   - `npm run check` — verify env and API connectivity.

4. **Run as MCP**
   - Add the server to your MCP config (see [MCP configuration](#mcp-configuration) below).
   - Ensure `GITLAB_URL` and `GITLAB_TOKEN` are set in the MCP server environment.

## MCP configuration

Configure your client to start this server with **command + args** and pass the environment variables. Use the **absolute path** to `dist/src/index.js` (replace the path below with your clone path).

### Cursor

In **Cursor Settings → MCP**, or in your project as `.cursor/mcp.json`, add:

```json
{
  "mcpServers": {
    "gitlab-mcp": {
      "command": "node",
      "args": [
        "/path/to/gitlab-mcp/dist/src/index.js"
      ],
      "env": {
        "GITLAB_URL": "https://gitlab.com",
        "GITLAB_TOKEN": "glpat-xxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

- Replace `/path/to/gitlab-mcp` with your repo path (e.g. `$(pwd)/dist/src/index.js` when run from the repo root after `npm run build`).
- For self-hosted GitLab, set `GITLAB_URL` to your instance (e.g. `https://gitlab.example.com`).

### Generic (stdio)

Any MCP client that supports **command + args + env** can use:

| Field     | Value |
|----------|--------|
| `command` | `node` |
| `args`    | `["/path/to/gitlab-mcp/dist/src/index.js"]` |
| `env`     | `GITLAB_URL`, `GITLAB_TOKEN` |

Run `npm run build` in the repo before starting the server so that `dist/src/index.js` exists.

## Supported tools (features)

### Projects
| Tool | Description |
|------|-------------|
| `list_projects` | List GitLab projects with optional `search` and `visibility` (public / internal / private). |

### Merge requests
| Tool | Description |
|------|-------------|
| `list_merge_requests` | List MRs for a project. Optional: `state` (opened / closed / merged / all), `per_page`, `author_username`. |
| `update_merge_request` | Update an MR: set `title` and/or `state_event` (close / reopen). At least one of `title` or `state_event` required. |
| `approve_merge_request` | Approve an MR (user must be an eligible approver). Optional: `sha` (must match current HEAD). |
| `create_merge_request_note` | Add a comment (note) to an MR. `body` supports Markdown. |
| `set_merge_request_assignees_reviewers` | Set assignees and/or reviewers by GitLab username(s). At least one of the two required. |

### Pipelines and jobs
| Tool | Description |
|------|-------------|
| `list_pipelines` | List pipelines for a project. Optional `ref` (e.g. `refs/merge-requests/12754/head` for MR !12754). |
| `list_merge_request_pipelines` | List pipelines for a merge request. |
| `get_pipeline` | Get a single pipeline and its job list. |
| `list_pipeline_jobs` | List jobs for a pipeline. Use `per_page` 200+ for large pipelines. |
| `get_job_logs` | Get trace/logs for a single job. |
| `trigger_pipeline` | Trigger a pipeline by `ref` (branch or tag). Optional: `variables`. |
| `play_job` | Play a manual job (e.g. bridge/trigger jobs). Use after `trigger_pipeline` + `list_pipeline_jobs` to get `job_id`. |

### Bridge jobs and downstream pipelines
| Tool | Description |
|------|-------------|
| `list_pipeline_bridges` | List bridge jobs of a pipeline. Use `per_page` 200+ for many bridges. |
| `get_downstream_pipeline_id` | Get the downstream (child) pipeline ID for a given bridge name. Call after playing that bridge; wait and retry if not created yet. |
| `play_bridge_jobs_by_name` | Find bridge jobs by exact name and play them. Works for parent or downstream pipeline. |
| `trigger_and_play_manual_jobs` | One-shot: trigger pipeline by ref, wait, then play given bridge job names. Same as `trigger_pipeline` + wait + `play_bridge_jobs_by_name`. |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm run start` | Run the MCP server (stdio). |
| `npm run check` | Verify `GITLAB_URL` / `GITLAB_TOKEN` and API connectivity. |
| `npm run trigger-and-play` | CLI for trigger + play (see `tests/run-trigger-and-play.ts`). |
| `npm run inspector` | Run MCP inspector for debugging. |

### Local test / CLI scripts (`tests/`)

Run with `node dist/tests/<script>.js` after `npm run build`. Requires `.env` in the repo root.

## Pushing to a new repository

This package is self-contained. To publish to a separate repo:

1. Create a new empty repo (e.g. on GitLab or GitHub).
2. From this directory:  
   `git init && git remote add origin <new-repo-url>`
3. Add, commit, and push:  
   `git add . && git commit -m "Initial commit" && git push -u origin main`
4. New users: clone the new repo, then `npm install`, copy `.env.example` to `.env`, and `npm run build`.

| Script | Usage |
|--------|--------|
| `check-connection` | `node dist/tests/check-connection.js` — verify env and API. |
| `run-update-mr-title` | `node dist/tests/run-update-mr-title.js <project_id> <iid> <title>` — update MR title. |
| `run-mr-note` | `node dist/tests/run-mr-note.js <project_id> <iid> <body>` — post a note on an MR. |
| `run-mr-changes` | `node dist/tests/run-mr-changes.js <project_id> <iid>` — list changed files in an MR. |
| `run-mr-file-diff` | `node dist/tests/run-mr-file-diff.js <project_id> <iid> <file_path>` — show diff for one file. |
| `run-mr-diff-comment` | `node dist/tests/run-mr-diff-comment.js <project_id> <iid> <file_path> <body> [new_line]` — add a line comment on the diff. |
