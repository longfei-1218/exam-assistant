# 备考助手（exam-assistant）

一个 AI 驱动的背诵型题库自测工具。当前仓库为 `exam-assiant`，一期正在逐步实现。

## 环境要求

- Node.js >= 22
- pnpm 10.12.1

## 安装依赖

在项目根目录执行：

```bash
pnpm install
```

## 启动前端

前端使用 Vite + antd-mobile 开发服务器：

```bash
pnpm --filter @exam/web dev
```

默认地址：

```text
http://127.0.0.1:5173
```

如果只想启动 Web，也可以在根目录执行：

```bash
pnpm dev:web
```

## 启动 API

API 服务目前只有基础健康检查接口，可以单独启动：

```bash
pnpm --filter @exam/api dev
```

默认地址：

```text
http://127.0.0.1:3001/health
```

如果本机已配置好数据库和环境变量，可以在根目录同时启动 API 与 Web：

```bash
pnpm dev
```

## 常用命令

```bash
pnpm --filter @exam/web build
pnpm --filter @exam/web typecheck
pnpm --filter @exam/web lint
pnpm --filter @exam/web test
```

## 当前前端说明

第 5、6 步的前端目前使用浏览器 `localStorage` 做本地 mock，不需要数据库即可体验登录注册、考试列表和类目管理。页面已经切换为 antd-mobile 纯移动 H5 组件风格。打开注册页后，用任意邮箱和密码注册即可进入系统；没有预置账号。
