# GitLab MCP

基于 [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) 的 GitLab 服务端，将 GitLab REST API 暴露为一组工具，可在 Cursor、Claude Desktop 或任意 MCP 客户端中管理项目、合并请求与 CI/CD 流水线。

[English](./README.md)

## 配置

1. **克隆与安装**
   ```bash
   git clone <你的仓库地址> gitlab-mcp && cd gitlab-mcp
   npm install
   ```

2. **环境变量**
   - 在仓库根目录将 `.env.example` 复制为 `.env`。
   - 设置 `GITLAB_URL`（如 `https://gitlab.com` 或自建实例地址）。
   - 设置 `GITLAB_TOKEN`（Personal Access Token 或 Project Access Token，需具备 `api` 权限）。

3. **构建与验证**
   - `npm run build` — 编译 TypeScript 到 `dist/`。
   - `npm run check` — 验证环境与 API 连通性。

4. **作为 MCP 运行**
   - 在 MCP 配置中添加上报（见下方 [MCP 配置示例](#mcp-配置示例)）。
   - 确保 MCP 进程的环境中有 `GITLAB_URL` 和 `GITLAB_TOKEN`。

## MCP 配置示例

使用 **command + args** 启动本服务，并通过环境变量传入 `GITLAB_URL` 和 `GITLAB_TOKEN`。`args` 中请使用 **绝对路径**（下面示例请按本机路径替换）。

### Cursor

在 **Cursor 设置 → MCP**，或项目下的 `.cursor/mcp.json` 中增加：

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

- 将 `/path/to/gitlab-mcp` 改成你本机克隆的仓库路径（在仓库根目录执行 `npm run build` 后可用 `$(pwd)/dist/src/index.js` 或写死绝对路径）。
- 若使用自建 GitLab，将 `GITLAB_URL` 改为实例地址（如 `https://gitlab.example.com`）。

### 通用（stdio）

任何支持 **command + args + env** 的 MCP 客户端均可按以下方式配置：

| 配置项   | 值 |
|----------|-----|
| `command` | `node` |
| `args`    | `["/path/to/gitlab-mcp/dist/src/index.js"]` |
| `env`     | 设置 `GITLAB_URL`、`GITLAB_TOKEN` |

首次使用前请在仓库下执行 `npm run build`，确保存在 `dist/src/index.js`。

## 支持的功能（工具列表）

### 项目
| 工具 | 说明 |
|------|------|
| `list_projects` | 列出 GitLab 项目，可选 `search`、`visibility`（public / internal / private）。 |

### 合并请求 (MR)
| 工具 | 说明 |
|------|------|
| `list_merge_requests` | 列出项目的 MR。可选：`state`（opened / closed / merged / all）、`per_page`、`author_username`。 |
| `update_merge_request` | 更新 MR：设置 `title` 和/或 `state_event`（close 关闭 / reopen 重新打开）。必须提供 `title` 或 `state_event` 至少其一。 |
| `approve_merge_request` | 审批 MR（当前用户须具备审批资格）。可选：`sha`（须与当前 HEAD 一致）。 |
| `create_merge_request_note` | 在 MR 下添加评论，`body` 支持 Markdown。 |
| `set_merge_request_assignees_reviewers` | 按 GitLab 用户名设置指派人或审阅人，二者至少填其一。 |

### 流水线与作业
| 工具 | 说明 |
|------|------|
| `list_pipelines` | 列出项目的流水线；可选 `ref`（如 `refs/merge-requests/12754/head` 表示 MR !12754）。 |
| `list_merge_request_pipelines` | 列出某条 MR 的流水线。 |
| `get_pipeline` | 获取单条流水线及其作业列表。 |
| `list_pipeline_jobs` | 列出某条流水线的作业；流水线作业较多时建议 `per_page` 设为 200+。 |
| `get_job_logs` | 获取单个作业的日志（trace）。 |
| `trigger_pipeline` | 按 `ref`（分支或标签）触发流水线；可选 `variables`。 |
| `play_job` | 运行需手动的作业（如 bridge/trigger 类作业）。可先通过 `trigger_pipeline` + `list_pipeline_jobs` 得到 `job_id`。 |

### Bridge 与下游流水线
| 工具 | 说明 |
|------|------|
| `list_pipeline_bridges` | 列出流水线中的 bridge 作业；bridge 较多时建议 `per_page` 设为 200+。 |
| `get_downstream_pipeline_id` | 根据 bridge 名称获取其下游（子）流水线 ID。需先 play 该 bridge；若下游尚未创建可稍等后重试。 |
| `play_bridge_jobs_by_name` | 按名称查找 bridge 作业并执行。可用于当前流水线或下游流水线。 |
| `trigger_and_play_manual_jobs` | 一步完成：按 ref 触发流水线 → 等待 → 按名称执行指定的 bridge 作业。等价于 `trigger_pipeline` + 等待 + `play_bridge_jobs_by_name`。 |

## 脚本命令

| 命令 | 说明 |
|------|------|
| `npm run build` | 将 TypeScript 编译到 `dist/`。 |
| `npm run start` | 启动 MCP 服务（stdio）。 |
| `npm run check` | 检查 `GITLAB_URL` / `GITLAB_TOKEN` 及 API 是否可用。 |
| `npm run trigger-and-play` | 本地 CLI：触发流水线并 play（见 `tests/run-trigger-and-play.ts`）。 |
| `npm run inspector` | 启动 MCP Inspector 用于调试。 |

### 本地测试 / CLI 脚本（`tests/`）

先执行 `npm run build`，再通过 `node dist/tests/<脚本名>.js` 运行：

| 脚本 | 用法 |
|------|------|
| `check-connection` | `node dist/tests/check-connection.js` — 检查环境与 API。 |
| `run-update-mr-title` | `node dist/tests/run-update-mr-title.js <project_id> <iid> <title>` — 修改 MR 标题。 |
| `run-mr-note` | `node dist/tests/run-mr-note.js <project_id> <iid> <body>` — 在 MR 下发一条评论。 |
| `run-mr-changes` | `node dist/tests/run-mr-changes.js <project_id> <iid>` — 列出 MR 变更文件。 |
| `run-mr-file-diff` | `node dist/tests/run-mr-file-diff.js <project_id> <iid> <file_path>` — 查看某文件的 diff。 |
| `run-mr-diff-comment` | `node dist/tests/run-mr-diff-comment.js <project_id> <iid> <file_path> <body> [new_line]` — 在 diff 某行添加行内评论。 |
