# ADR 0001：选用 pnpm workspace + Turborepo 作为 Monorepo 基座

- 状态：已接受
- 日期：2026-02

## 背景

需要一个能承载 web（Next.js）、api（Fastify）与多个共享包的仓库结构，
并希望：依赖安装快、构建缓存好、任务编排简单。

## 决策

- 包管理：pnpm（内容寻址存储、安装速度快、磁盘占用小；`workspace:*` 协议天然支持 Monorepo）。
- 任务编排：Turborepo（按文件哈希缓存任务输出、`dependsOn` 声明任务依赖、`affected` 增量执行）。
- 替代方案：Nx（多语言支持更强，但本模板以 TypeScript 单栈为主，Turborepo 更轻）；
  Yarn/Bun workspaces（无任务缓存与增量构建）。

## 后果

- 优点：安装/构建速度快，`pnpm --filter` 可精确操作单包。
- 代价：共享包变更需重新安装/构建后才对消费方可见（见 ADR 0002）。
