# dushu-qr

自建「慧湖通」学生公寓通行二维码，静态 PWA。

## 架构

- **SvelteKit 3 + Svelte 5 + TypeScript**，部署到 **GitHub Pages**。
- **shadcn-svelte** 组件（zinc 主题）；按钮图标统一取自 **@lucide/svelte**。
- **PWA**：Service Worker（`static/sw.js`）+ `static/manifest.webmanifest`。
- **数据流**：openId 保存在本机（桌面端浏览器与手机 App 的存储互相独立），所有请求由用户浏览器直连官方 API，用户数据不离开设备。

## 开发

```bash
pnpm install
pnpm dev            # 开发服务器
pnpm check          # svelte-check
pnpm lint           # eslint
pnpm format         # prettier
pnpm icons          # 重新生成 PWA 图标
pnpm hdr            # 重新生成 HDR 白底图
pnpm build          # 静态构建到 build/
pnpm preview        # 预览生产构建
```

## 部署

推送到 `main` 分支后 GitHub Actions 自动构建并部署到 GitHub Pages（`PATH_BASE=/dushu-qr`）。

## 注意事项

- **openId 即账号凭证**：存在设备本地；页面无任何第三方脚本或 CDN 引用，无数据外发。
- **验证与轮询会换发 token**：桌面端验证及手机端轮询会踢掉小程序的登录态（小程序重新打开即恢复）。
