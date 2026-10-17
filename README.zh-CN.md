# shop-platform

基于 fullstack-toolkit 的电商演示：Next.js、Fastify、Prisma/PostgreSQL、Redis、BullMQ、pnpm 与 Turborepo。支付为模拟流程，不接入真实支付渠道。

[English](README.md) · [部署与恢复](docs/shop-deployment.md)

## 本地启动

使用 Node 22.14+、pnpm 11.7.0 与 Docker Compose v2。复制 `.env.example` 为私有 `.env` 后依次执行：

```sh
docker compose -f docker/compose.dev.yml up -d --wait
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

开发示例口令仅供可丢弃的本地数据库。`.env` 不得提交；生产数据库和 Redis 不公开端口。

## 使用入口

- `/shop`：公开商品目录。
- `/shop/cart`：当前账号的购物车、数量调整、优惠估算与下单。
- `/shop/orders`：当前账号的订单、模拟支付与取消待支付订单。
- `/`：继承的注册、登录和项目示例；商城的账号入口目前指向这里。
- USER 仅能访问自己的购物车和订单；ADMIN 接口可管理商品、库存、促销及成员。没有公开默认管理员。

## 质量与部署

执行 `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm size-check` 和 `pnpm e2e`。API/并发测试需要真实 PostgreSQL 与 Redis，只能使用独立测试环境。浏览器验收会创建账号和业务数据，不能直接对客户数据运行。

生产商城入口为 https://shop.purelamp.uk/shop 。独立目录 `/opt/shop-platform`、Compose 项目 `shop-platform`、回环端口 3280/3281，与 toolkit 服务分离。运行环境、数据备份、迁移及回退步骤见部署文档；域名参数本身不会配置 DNS、证书或服务器凭据。

## 已知边界

支付仅为模拟。源码定义了延迟取消 worker，但当前 API 入口没有启动该 worker，不能承诺自动超时取消；手动取消是独立流程。尚不宣称真实支付对账、高可用、异地灾难恢复或线上吞吐 SLA。商城主要使用英语，继承的账号页面提供中英文切换。

旧 toolkit 文档是背景资料，涉及 SQLite、toolkit 端口及部署目录的命令不适用于商城。本 README 和 `docs/shop-deployment.md` 为商城环境的当前依据。
