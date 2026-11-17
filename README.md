# 备考助手（exam-assistant）

## 安装

```powershell
pnpm install
```

## 启动

同时启动前后端：

```powershell
pnpm dev
```

| 服务 | 地址 |
| --- | --- |
| 前端 | http://127.0.0.1:5173 |
| 后端 | http://127.0.0.1:3001 |

分别启动：

```powershell
pnpm dev:api
pnpm dev:web
```

## Prisma Studio

```powershell
pnpm --filter @exam/api exec prisma studio
```

默认地址：http://localhost:5555
