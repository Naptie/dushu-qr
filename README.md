# dushu-qr

自建「慧湖通」学生公寓通行二维码，静态 PWA。

## 架构

- **SvelteKit 3 + Svelte 5 + TypeScript**，`@sveltejs/adapter-static` 预渲染，部署到 **GitHub Pages**（`.github/workflows/deploy.yml`，路径 `/dushu-qr`）。
- **shadcn-svelte** 组件（zinc 主题，从官方 registry vendored 到 `src/lib/components/ui`）；按钮图标统一取自 **@lucide/svelte**。
- **PWA**：手写 Service Worker（`static/sw.js`）+ `static/manifest.webmanifest` + `static/icons/*`（`pnpm icons` 用 sharp 从装饰性二维码生成）。
- **数据流**：openId 保存在浏览器 localStorage，所有请求由用户浏览器直连官方 API，用户数据不离开设备。

## 开发

```bash
pnpm install
pnpm dev            # 开发服务器
pnpm check          # svelte-check
pnpm lint           # eslint
pnpm format         # prettier
pnpm icons          # 重新生成 PWA 图标
pnpm build          # 静态构建到 build/
pnpm preview        # 预览生产构建
```

## 部署

推送到 `main` 分支后 GitHub Actions 自动构建并部署到 GitHub Pages（`PATH_BASE=/dushu-qr`）。

## 注意事项

- **openId 即账号凭证**：存在浏览器 localStorage；页面无任何第三方脚本或 CDN 引用，无数据外发。
- **token 单会话**：页面换发 token 会踢掉小程序的登录态（小程序重新打开即恢复）；反之小程序登录会踢掉页面的 token，页面下次轮询自动重换。
- **刷新节奏**：与小程序一致为 10 秒；浏览器后台标签页会被节流（约 20 秒），出示给门禁前请保持页面在前台。
