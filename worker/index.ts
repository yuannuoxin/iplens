// Cloudflare Workers 入口
// 与 Pages Functions 共用同一份 lib/handler.ts：
//   Workers  → /functions/v1/app 由本入口转发给 handler，其余路径交给静态资源绑定
//   Pages    → functions/functions/v1/app.ts 由 Pages 自动编译，无需本文件
import { handler } from "../lib/handler.ts";

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

const API_PATH = "/functions/v1/app";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === API_PATH || pathname === `${API_PATH}/`) {
      return handler(request);
    }
    return env.ASSETS.fetch(request);
  },
};
