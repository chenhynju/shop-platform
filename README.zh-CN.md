# fullstack-toolkit

可复用的单仓全栈模板：**Next.js 15 + Fastify 5 + Prisma + pnpm + Turborepo**。

[English](README.md) · [中文操作手册](docs/user-manual.zh-CN.md) · [English user manual](docs/user-manual.en.md)

界面以英语为默认工作语言，可切换简体中文并保存偏好。完整网页手册位于 `/manual`，与两份 Markdown 手册使用同一内容源。独立的 `@toolkit/i18n` 包可被其他框架复用；复用边界见 [基础设施接入指南](docs/foundation-adoption.md) 和 [i18n 开发说明](docs/i18n.md)。

首个已有项目试点采用 InvoiceFlow 的隔离副本，保留其组织权限与票据业务，不替换或迁移现有生产服务。见 [试点说明](examples/invoiceflow/README.md) 和 [后续验收](docs/i18n-verification.md)。这套底座并非所有项目共享数据库或登录态的中央平台。

这不是只有工程配置的空壳。示例应用提供账号注册、登录与退出、私人项目看板、项目增删改查、状态流转，以及管理员成员目录。前后端共享 TypeScript 契约，权限与归属检查在服务端执行。

## 本地启动

需要 Node **22.14+** 和 package.json 锁定的 **pnpm 11.7.0**。

```sh
corepack enable
# 将 .env.example 复制成根目录 .env（也可保留开发默认值）
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

访问 http://localhost:3000，自行创建账号。API 默认 3001。根命令通过 scripts/run.mjs 加载根目录 .env。SQLite 默认文件在 packages/db/prisma/dev.db；不要提交或公开数据库。

已有旧版 db push 数据库时，**先备份并核对旧 User 表结构**，再按 docs/deployment.md 建立初始迁移基线。不要 reset 或删除原数据。

## 实际功能与边界

- 异步 scrypt 密码哈希、随机盐；不在响应与日志输出密码。
- 数据库会话保存随机令牌的 SHA-256 摘要，7 天过期；退出删除会话。
- HttpOnly / SameSite=Lax cookie，生产启用 Secure；写请求验证 CSRF header 与 Origin。
- 匿名只能注册 USER；ADMIN 需由操作者显式配置，不存在默认公开管理员。
- 项目访问以 userId 过滤；其他账号的项目查询、更新、删除均返回 404。
- 严格输入校验、请求 ID、统一错误 envelope、结构化脱敏日志、限流与安全头。
- SQLite **单实例**部署，版本化迁移、持久卷、独立端口、健康检查；并不宣称 PostgreSQL/HA 已实现。
- 无邮箱验证、找回密码、生产监控告警及自动异地备份。这些是下一阶段运营需求。

## 常用命令

| 命令                            | 用途                                                     |
| ------------------------------- | -------------------------------------------------------- |
| pnpm dev                        | 同时启动前后端                                           |
| pnpm db:migrate                 | 应用版本化数据库迁移                                     |
| pnpm db:push                    | 仅限临时开发原型；正式环境不用                           |
| pnpm db:seed                    | 显式 bootstrap 管理员，要求 ADMIN_EMAIL / ADMIN_PASSWORD |
| pnpm lint / pnpm typecheck      | 所有包的静态检查                                         |
| pnpm test                       | 单测与真实临时数据库集成测试，带覆盖率门禁               |
| pnpm build                      | 生产构建                                                 |
| pnpm size-check                 | 生产 JS gzip 总量预算                                    |
| pnpm e2e                        | 构建后用真实 Chromium 验证浏览器业务链路                 |
| pnpm format / pnpm format:check | Prettier 格式处理                                        |
| pnpm analyze                    | 前端 bundle 分析                                         |

测试使用独立临时 SQLite，E2E 使用配置的应用数据库并创建测试账号。外部验收设置 E2E_BASE_URL。管理员 E2E 需要显式 E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD，缺失时报告 skipped。

Windows 的普通 build 不生成需要符号链接权限的 standalone 目录；Docker 构建显式设置 BUILD_STANDALONE=1 并验证 Linux 运行产物。依赖有变化时 pnpm 脚本直接报错并提示先安装，避免检查过程中自动并发安装。

## 目录

```text
apps/web                  Next.js 登录、看板、成员目录与浏览器测试
apps/api                  Fastify 认证、权限、项目 API 与集成测试
packages/db               Prisma client、schema、版本化迁移与显式管理员 bootstrap
packages/types            共享公开 API 契约
packages/ui               共享基础组件
packages/config-*         ESLint / TypeScript / Tailwind 共享配置
docker                    多阶段镜像、Compose 与 Caddy 示例
scripts                   环境加载、性能预算、源码打包与发布脚本
.github/workflows         CI 门禁、浏览器/镜像构建与手动部署
docs                      设计、复用、部署与验证证据
```

## CI 与缓存

Actions 配置涵盖格式、lint、类型、覆盖率、构建、体积预算、真实浏览器和 Docker 镜像构建。pnpm store、Turbo 和 Docker BuildKit 各自缓存不同层；相关环境变量与 lockfile 参与任务哈希，数据库测试和 E2E 禁用任务缓存。

需要仓库维护者在 GitHub 配置分支保护、必需检查、production Environment 与部署 secrets。**提供 YAML 不代表 Actions 已实际运行或合并规则已生效。**

## 一键 Docker 启动

准备外部受保护的环境文件，写入 APP_ORIGIN=https://你的域名；再运行：

```sh
docker compose --env-file /secure/runtime.env -f docker/docker-compose.yml up -d --build
```

容器在迁移完成、数据库健康后启动；web/api 只绑定本机 3180/3181，数据库保留在独立卷中。域名、DNS、HTTPS 和 Caddy 配置步骤见部署文档。部署账号与 SSH 主机指纹应由操作者显式配置。

## 交付文档

- [设计与验收清单](docs/implementation-plan.md)
- [下一项目复用指南](docs/reuse.md)
- [部署、升级、备份与回滚](docs/deployment.md)
- [架构决策](docs/adr/0001-pnpm-turborepo.md)
- [验证记录](docs/verification.md)

最终可发布状态以验证记录为准。性能报告模板中的数值需真实测量后填写。
