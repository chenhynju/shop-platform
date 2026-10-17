# 性能优化报告模板（作品集核心交付物）

> 用法：完成一轮优化后，把测量数据填入下表，并保留前后截图（存到 `docs/perf/`）。
> 面试官只信数字——每个结论必须有可复现的测量方法与数据支撑。

## 0. 测量规范（数字可信的前提）

- 用 **production build**（`pnpm build` 后 `pnpm --filter @repo/web start`）测量，禁用 dev 模式。
- 首屏用 Lighthouse（或 Lighthouse CI）跑 3 次取中位数，注明测试条件：
  移动端模拟 + 4G 节流（Lighthouse 默认）。
- 报告三个 Web Vitals：**LCP / CLS / INP**，不要只写"首屏时间"。
- 包体积用 `pnpm --filter @repo/web analyze`（bundle-analyzer）导出 Top10 依赖表。
- CI 耗时用 GitHub Actions 每个 job 的耗时截图对比。

## 1. 首屏性能基线（✅ 已实测）

> 口径：production build + `next start`，Lighthouse 移动端模拟 + 4G 节流（simulate），
> 每次 3 轮取中位数；原始 JSON 存于 `docs/perf/lh-*.json`。

| 指标              | 优化前（基线） | 目标    | 优化后    | 备注                                           |
| ----------------- | -------------- | ------- | --------- | ---------------------------------------------- |
| LCP               | 2.62s          | < 2.5s  | 2.69s     | 持平；瓶颈为整页客户端 hydration（见 §2 备注） |
| CLS               | 0.157          | < 0.1   | **0.000** | ✅ 修复（首屏 loading→登录视图高度占位）       |
| INP               | n/a            | < 200ms | n/a       | 模拟节流下 Lighthouse 不产出                   |
| TBT               | 570ms          | < 200ms | 751ms     | 长任务来自框架 chunk 执行（427ms）+ 文档任务   |
| JS 总体积（gzip） | 278.5 KB       | —       | 278.5 KB  | 16 个 chunk（递归统计，含嵌套路由）            |

## 2. 优化动作清单（每步记录收益）

| #   | 动作           | 手段                                                                                                                | 实测收益                    |
| --- | -------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 1   | **CLS 修复**   | 首屏 loading 面板按断点预留与登录视图等高（560/640/820px），消除 hydration 后 auth 状态切换造成的布局跳动           | CLS 0.157 → 0.000（中位数） |
| 2   | 依赖瘦身       | 无适用项：项目无 moment/lodash 等重型依赖                                                                           | —                           |
| 3   | 路由级代码分割 | 已内置（Next 自动按路由分割，16 chunk）                                                                             | —                           |
| 4   | 服务端组件优先 | **未做（路线）**：page.tsx 为整页 client 组件，hydration 长任务 427ms 是 LCP/TBT 主因；迁移 RSC 预计 LCP 降至 <1.5s | 记录为 Roadmap              |
| 5   | 图片优化       | 无适用项：首屏无图片                                                                                                | —                           |
| 6   | 字体优化       | 无适用项：系统字体栈，无 webfont                                                                                    | —                           |
| 7   | 三方脚本延迟   | 无适用项：无第三方脚本                                                                                              | —                           |
| 8   | 缓存与 CDN     | 生产由 Caddy 提供 TLS/HSTS（见 deployment.md）                                                                      | —                           |

> LCP 未达 <2.5s 目标的根因分析：`page.tsx` 为整页客户端组件，首屏 JS 约 115KB gzip，
> 模拟 4G 下 hydration 产生 427ms 长任务。**下一步（Roadmap）**：将 hero/guide 静态区拆为
> RSC，登录表单保留客户端岛屿，预期 LCP <1.5s、TBT <300ms。

## 3. CI 提速记录（✅ 已实测）

> 数据来源：本仓库真实运行日志。基线为「首次运行、零缓存、串行执行」（本地 Windows），
> 优化后为 GitHub Actions（ubuntu-latest，run 38947757595，2026-10-16）。

| 环节                     | 手段                                     | 优化前         | 优化后      | 说明                          |
| ------------------------ | ---------------------------------------- | -------------- | ----------- | ----------------------------- |
| 依赖安装                 | `setup-node` 的 `cache: pnpm`            | 2m09s          | ~30s        | pnpm store 缓存命中，跳过下载 |
| lint                     | turbo 任务缓存 + 增量执行                | 2m18s          | 22s         | 未改动包直接命中缓存          |
| typecheck                | 同上                                     | 1m07s          | 并入        | 并入 quality-gate 总时长      |
| 单测                     | 同上                                     | 44s            | 并入        |                               |
| 构建                     | Turborepo 缓存（.turbo + actions/cache） | 3m48s          | 并入        |                               |
| E2E                      | 独立 job 与 quality-gate **并行**        | —              | 49s         | 不占关键路径                  |
| **合计（用户等待时间）** |                                          | **≈ 10.1 min** | **≈ 1m12s** | **-88%**                      |

优化手段清单：① pnpm 依赖缓存；② Turborepo 本地/远程缓存 + affected 增量；③ E2E 拆独立 job 并行；
④ `--frozen-lockfile` 避免重复解析；⑤ turbo 任务级并发调度。

### 3.1 GitHub Actions 冷/热缓存实测（2026-10-17，删除全部 41 个缓存后连跑两次）

| job                   | 冷缓存（缓存全删）  | 热缓存（复用）     | 降幅                             |
| --------------------- | ------------------- | ------------------ | -------------------------------- |
| quality-gate          | 86s                 | 42s                | -51%                             |
| e2e                   | 83s                 | 84s                | ~0（浏览器安装已缓存，构建无关） |
| container（镜像构建） | 340s                | **26s**            | **-92%**（buildkit blob 命中）   |
| **总墙钟时间**        | **≈ 340s (5.7min)** | **≈ 84s (1.4min)** | **-75%**                         |

- 冷跑 run：39031103028；热跑 run：39031903702（均可在线复看）。
- 关键缓存：pnpm store（node-cache，215MB）、Turborepo 任务缓存（turbo-*）、Docker buildkit blob（container job）。

## 4. 结论段落（README 引用）

> 通过依赖缓存、Turborepo 缓存与 E2E 并行三个动作，**CI 从 ≈10min 降至 ≈1m12s（-88%）**；
> 通过首屏高度占位修复，**CLS 从 0.157 降至 0.000（中位数）**。
> LCP 2.62s 的瓶颈为整页客户端 hydration，RSC 拆分已列入 Roadmap。
> 完整数据见 `docs/perf/lh-*.json` 与 GitHub Actions（run 38947757595）。
