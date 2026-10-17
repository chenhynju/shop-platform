# @repo/ai（AI 服务）

Python/Fastify 风格的 FastAPI 微服务：LLM 网关 + RAG 检索，是作品集 AI 方向的底座。

> **状态：设计已定稿，代码待实现。** 详细规格见 [DESIGN.md](./DESIGN.md)。

- 端口：3002
- 技术栈：Python 3.12 + uv + FastAPI + pydantic v2
- 零外部依赖可跑通：默认 mock LLM provider + 内存向量存储，CI 无需任何 API key
- 质量门禁：ruff / mypy --strict / pytest 覆盖率 ≥ 80% / OpenAPI 契约快照

## 快速开始（实现完成后生效）

```bash
cd packages/ai
uv sync
uv run uvicorn app.main:create_app --factory --port 3002
# http://localhost:3002/api/ai/health
# http://localhost:3002/docs （Swagger UI）
```

## 里程碑

按 [DESIGN.md §10](./DESIGN.md) 顺序执行：M1 服务骨架 → M2 契约与 web 集成 → M3 RAG 与评估集 → M4 交付。
