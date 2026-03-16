/**
 * 检测 GitLab MCP 环境变量与 API 连通性
 * 用法: 在仓库根目录执行 npm run check
 * 需先配置 .env 或设置 GITLAB_URL、GITLAB_TOKEN
 */
import { config } from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });
import * as gitlab from "../src/gitlab-client.js";

async function main() {
  const url = process.env.GITLAB_URL ?? "https://gitlab.com";
  const hasToken = Boolean(process.env.GITLAB_TOKEN);

  console.log("GitLab MCP 配置检测\n");
  console.log("  GITLAB_URL:", url);
  console.log("  GITLAB_TOKEN:", hasToken ? "***已设置***" : "(未设置)");

  if (!hasToken) {
    console.error("\n错误: 请设置 GITLAB_TOKEN（Personal Access Token 或 Project Access Token）");
    process.exit(1);
  }

  try {
    const projects = await gitlab.listProjects({});
    console.log("\n连接成功。当前可见项目数量:", Array.isArray(projects) ? projects.length : 0);
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("\nAPI 请求失败:", message);
    process.exit(1);
  }
}

main();
