# 用户认证接口 curl 示例

以下命令可直接在 PowerShell 中执行。Windows PowerShell 建议使用 `curl.exe`，避免 `curl` 被解析成 `Invoke-WebRequest`。

## 0. 公共变量

```powershell
$BASE_URL = "http://127.0.0.1:3001"
$EMAIL = "curl-demo@example.com"
$PASSWORD = "StrongPass123"
```

重复注册前请更换 `$EMAIL`。

## 1. 注册

```powershell
curl.exe -i -X POST "$BASE_URL/api/auth/register" `
  -H "Content-Type: application/json" `
  -d '{"email":"curl-demo@example.com","password":"StrongPass123","nickname":"CurlUser"}'
```

成功返回 `200`：

```json
{
  "user": {
    "id": "<userId>",
    "email": "curl-demo@example.com",
    "nickname": "CurlUser",
    "avatarUrl": null,
    "llmConfig": {
      "provider": "deepseek",
      "model": "deepseek-chat",
      "configured": false,
      "apiTokenMasked": null
    }
  },
  "accessToken": "<accessToken>",
  "refreshToken": "<refreshToken>",
  "expiresIn": 900
}
```

从响应中复制 token：

```powershell
$ACCESS_TOKEN = "<这里替换为响应中的 accessToken>"
$REFRESH_TOKEN = "<这里替换为响应中的 refreshToken>"
```

## 2. 登录

```powershell
curl.exe -i -X POST "$BASE_URL/api/auth/login" `
  -H "Content-Type: application/json" `
  -d '{"email":"curl-demo@example.com","password":"StrongPass123"}'
```

成功后返回新的 `accessToken` 和 `refreshToken`。

错误密码示例：

```powershell
curl.exe -i -X POST "$BASE_URL/api/auth/login" `
  -H "Content-Type: application/json" `
  -d '{"email":"curl-demo@example.com","password":"WrongPassword123"}'
```

预期返回 `401 INVALID_CREDENTIALS`。

## 3. 查询当前用户

```powershell
curl.exe -i -X GET "$BASE_URL/api/auth/me" `
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

成功返回当前用户信息，不会返回密码哈希或 LLM Key 明文。

## 4. 更新当前用户和 LLM 配置

```powershell
curl.exe -i -X PATCH "$BASE_URL/api/auth/me" `
  -H "Authorization: Bearer $ACCESS_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"nickname":"UpdatedCurlUser","avatarUrl":null,"llmConfig":{"provider":"deepseek","model":"deepseek-chat","apiToken":"sk-curl-demo-1234"}}'
```

成功返回 `200`，其中：

- `nickname` 为 `UpdatedCurlUser`
- `llmConfig.configured` 为 `true`
- `llmConfig.apiTokenMasked` 只显示掩码
- 响应中不会出现 `sk-curl-demo-1234` 明文

清空 LLM Key：

```powershell
curl.exe -i -X PATCH "$BASE_URL/api/auth/me" `
  -H "Authorization: Bearer $ACCESS_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"llmConfig":{"provider":"deepseek","model":"deepseek-chat","apiToken":null}}'
```

## 5. 刷新登录状态

```powershell
curl.exe -i -X POST "$BASE_URL/api/auth/refresh" `
  -H "Content-Type: application/json" `
  -d '{"refreshToken":"<这里替换为当前 refreshToken>"}'
```

建议使用变量：

```powershell
curl.exe -i -X POST "$BASE_URL/api/auth/refresh" `
  -H "Content-Type: application/json" `
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
```

成功返回新的 `accessToken` 和 `refreshToken`。旧 refresh token 会立即失效，请更新变量：

```powershell
$ACCESS_TOKEN = "<替换为刷新响应中的 accessToken>"
$REFRESH_TOKEN = "<替换为刷新响应中的 refreshToken>"
```

再次使用旧 refresh token 应返回 `401`。

## 6. 登出

撤销当前 refresh token：

```powershell
curl.exe -i -X POST "$BASE_URL/api/auth/logout" `
  -H "Authorization: Bearer $ACCESS_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
```

成功返回：

```json
{
  "ok": true
}
```

撤销当前用户的全部有效 refresh token：

```powershell
curl.exe -i -X POST "$BASE_URL/api/auth/logout" `
  -H "Authorization: Bearer $ACCESS_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{}'
```

登出后再次调用刷新接口，预期返回 `401 UNAUTHORIZED`。
