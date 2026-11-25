# IPLens · IP 检测雷达

现代响应式的 IP 检测网站：家宽判定、欺诈值、信任评分、代理 / VPN / Tor / 数据中心 / 移动 / 滥用威胁六项风险信号、地理位置地图、ASN 变化监控、DNS 泄露、WebRTC 泄露、IPv4/IPv6 出口检测与开放 API。

所有数据均来自真实公开数据源，无编造：

- **ipquery.io** + **ip-api.com** 双源交叉验证（机房 / 代理 / 移动网络任一源命中即采纳，避免单源漏判）
- **ipwho.is** 补全邮政编码
- **RIPE RIS Live** 实时 ASN 路由变化
- **Esri** 带标注地图底图

## 目录结构

```
web/                       前端静态文件（Pages 构建输出目录 / Workers 静态资源目录）
  index.html
  app.js
  styles.css
worker/
  index.ts                 Cloudflare Workers 入口（export default { fetch }）
wrangler.toml              Workers 部署配置（main + [assets] 绑定 ASSETS）
package.json               wrangler 依赖与部署脚本
functions/                 Cloudflare Pages Functions（根目录自动编译）
  functions/v1/app.ts      → 路由 /functions/v1/app
lib/
  handler.ts               共享后端逻辑（仅标准 Web API，可移植）
deno/
  index.ts                 Deno 入口（本地 / Qoder Sites 用）
dev/
  serve.mjs                本地开发服务器
```

两种部署形态共用同一份 `lib/handler.ts`：

| 形态 | 入口 | `/functions/v1/app` 由谁处理 |
| --- | --- | --- |
| Pages | `functions/functions/v1/app.ts`（Cloudflare 自动编译） | Pages Functions |
| Workers | `worker/index.ts` | Worker 先命中该路径，其余请求交给 `env.ASSETS` |

后端 `lib/handler.ts` 只用标准 Web API（fetch / Request / Response / Headers），同一份代码同时跑在 Cloudflare Workers 运行时与本地 Node/Deno。Cloudflare 会自动给请求带上 `cf-connecting-ip` 头，服务端据此识别访客真实 IP；ip-api 的 HTTP 请求在服务端发出，不受浏览器混合内容限制，双源校验完整保留。

## 部署到 Cloudflare Pages（GitHub 集成）

1. 将本仓库推送到 GitHub。
2. Cloudflare 控制台 → **Workers & Pages → Create → Pages → Connect to Git**，选择本仓库。
3. 构建设置：
   - **Framework preset**：`None`
   - **Build command**：留空
   - **Build output directory**：`web`
   - **Root directory**：`/`（默认）
4. 保存并部署。Cloudflare 会自动编译根目录 `functions/` 并把 `web/` 作为静态资源。
5. 完成后站点地址形如 `https://<项目名>.pages.dev`，打开即自动识别访客 IP。

每次 push 到生产分支会自动重新部署。

### 直接上传（可选，不用 GitHub）

```bash
npx wrangler pages deploy web --project-name=iplens
```

## 部署到 Cloudflare Workers

Workers 形态不走 Pages 的 `functions/` 自动编译，改由 `worker/index.ts` 统一入口，其余请求交给静态资源绑定。

```bash
npm install
npm run dev:worker   # 本地 Worker 运行时，默认 http://127.0.0.1:8787/
npm run dry          # 打包校验，不上传
npx wrangler login   # 首次部署前登录
npm run deploy       # 真正部署
```

`wrangler.toml` 关键配置：

```toml
name = "iplens"
main = "worker/index.ts"
compatibility_date = "2026-01-01"

[assets]
directory = "./web"
binding = "ASSETS"
run_worker_first = true
```

`run_worker_first = true` 是必需的。若不存在该配置，静态资源层会先接管请求，而 `/functions/v1/app` 没有对应的静态文件，会被直接返回 404，前端拿不到任何数据。

### GitHub 集成（Workers Builds）

控制台 **Workers & Pages → Create → Workers → Connect to Git** 选择本仓库，构建配置填：

- **Install command**：`npm ci`
- **Build command**：`npx wrangler deploy`

Worker 名称取自 `wrangler.toml` 的 `name`，之后每次 push 自动部署。

### 自定义域名

`iplens.imxiaohe.com` 若原本绑在 Pages 项目上，切到 Workers 时需在 Worker 的 **Settings → Domains & Routes → Add custom domain** 重新绑定，并先解绑 Pages 上的同域名，否则会报域名已被占用。

## 本地开发

```bash
node dev/serve.mjs
# 打开 http://127.0.0.1:4173/
```

本地无公网出口头时会回退到浏览器侧 IP 识别（icanhazip / ipify）。

## 开放 API

```bash
curl https://<站点>/functions/v1/app                 # 识别请求者 IP
curl "https://<站点>/functions/v1/app?q=1.1.1.1"      # 查询指定 IP
curl "https://<站点>/functions/v1/app?asn=15169&pfx=8.8.8.0/24"   # ASN 归属
```

结果在服务端缓存 15 分钟（ASN 归属缓存 1 小时），同一 IP 在缓存期内评分保持一致。