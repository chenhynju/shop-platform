# packages/ai 服务设计文档（规格说明书）

> 本文档是 `packages/ai` 的**实施规格**。实现者（codex / 开发者）应严格按本文件执行，
> 每完成一个里程碑必须满足对应验收标准。本文件同时是 ADR 0005 的素材。

- 状态：设计已定稿，待实现
- 目标端口：3002（web:3000 / api:3001 / ai:3002）
- 技术基线：Python 3.12、uv、FastAPI、pydantic v2

---

## 1. 目标与定位

为 fullstack-toolkit 增加 **AI 能力层**，作为用户作品集 AI 方向的底座（后续 A2 企业知识库 RAG、
A4 Text-to-SQL、A9 评测平台均基于它扩展），同时证明 **TS + Python 多语言 Monorepo** 的工程能力：
统一 CI 门禁、统一契约、统一交付。

核心原则：

1. **零外部依赖即可跑通**（默认 mock LLM provider + 内存向量存储），CI 与本地开发不需要任何 API key；
2. **契约驱动**：所有端点自动生成 OpenAPI，再生成 TS 类型给前端，杜绝接口漂移；
3. **与现有门禁同标准**：ruff / mypy / pytest 覆盖率阈值 / 契约快照，全绿才可合并。

## 2. 技术选型与理由

| 选型                                                               | 理由                                                 | 备选（为什么不用）                     |
| ------------------------------------------------------------------ | ---------------------------------------------------- | -------------------------------------- |
| Python 3.12                                                        | LLM 生态母语；3.12 性能与类型语法改进                | 3.11 亦可，锁 3.12                     |
| FastAPI + uvicorn                                                  | 异步、Pydantic v2 原生、自动 OpenAPI                 | Flask（异步弱）、Django（过重）        |
| uv（包管理与虚拟环境）                                             | 快、`uv.lock` 确定性、单二进制                       | poetry（慢）、pip+requirements（无锁） |
| httpx                                                              | 异步 HTTP 客户端，LLM SDK 底层同款                   | requests（同步）                       |
| pydantic-settings                                                  | 环境变量强类型校验                                   | 手写 os.environ                        |
| 开发向量存储：内存实现（numpy）                                    | 零依赖、CI 零成本                                    | 直接上 Qdrant（开发门槛高）            |
| 生产向量存储接口：Qdrant / pgvector                                | 见 §6                                                | —                                      |
| 测试：pytest + pytest-asyncio + coverage                           | 生态标准                                             | unittest                               |
| 质量：ruff（lint+format）、mypy（strict）                          | 快、规则集中、Pyright 兼容                           | flake8+black+isort（三件套维护成本高） |
| LLM provider：**适配器模式**抽象（mock/openai/deepseek/anthropic） | 与仓库 api 端 F11 的支付适配器思想一致，展示架构能力 | 直接写死某 SDK                         |

## 3. 目录结构（目标形态）

```
packages/ai/
├── pyproject.toml            # uv 项目定义 + ruff/mypy/pytest 配置（全部集中在此）
├── uv.lock                   # 提交到 git
├── README.md                 # 快速开始（uv sync → uv run uvicorn ...）
├── DESIGN.md                 # 本文件
├── Dockerfile                # 多阶段：uv 安装 → 运行（见 §9）
├── app/
│   ├── __init__.py
│   ├── main.py               # create_app() 工厂；挂载路由、CORS、异常处理器
│   ├── config.py             # Settings(pydantic-settings)：环境变量见 §7
│   ├── api/
│   │   ├── __init__.py
│   │   ├── health.py         # GET  /api/ai/health
│   │   ├── chat.py           # POST /api/ai/chat（含 SSE 流式）
│   │   ├── embed.py          # POST /api/ai/embed
│   │   └── rag.py            # POST /api/ai/rag/ingest、POST /api/ai/rag/query
│   ├── services/
│   │   ├── __init__.py
│   │   ├── llm.py            # provider 适配器抽象 + 注册表（§5）
│   │   ├── embeddings.py     # 嵌入 provider 抽象（mock=哈希向量 / openai / 本地）
│   │   └── retriever.py      # 内存向量检索 + 关键词(BM25 简化版)混合检索（§6）
│   └── schemas/
│       ├── __init__.py
│       └── contracts.py      # 全部 Pydantic 请求/响应模型（与 TS 类型一一对应）
├── tests/
│   ├── conftest.py           # TestClient fixture（mock provider 注入）
│   ├── test_health.py
│   ├── test_chat.py          # 含流式解析测试
│   ├── test_rag.py           # 含检索质量评估集（§8）
│   └── test_openapi_snapshot.py  # 契约快照测试（§8）
└── scripts/                  # 放仓库根 scripts/ 亦可，见 §5.2
```

## 4. API 契约（v1）

统一前缀 `/api/ai`，错误格式与仓库 api 端对齐：`{ "error": { "code": string, "message": string } }`。

### 4.1 GET /api/ai/health

```json
{ "status": "ok", "provider": "mock", "model": "mock-1", "uptime": 12.3 }
```

### 4.2 POST /api/ai/chat

请求：

```json
{
  "messages": [{ "role": "user", "content": "你好" }],
  "model": "mock-1", // 可选，缺省用配置默认
  "temperature": 0.7, // 可选 0–2
  "stream": false // 可选；true 时返回 SSE
}
```

非流式响应：

```json
{ "content": "mock: 你好", "usage": { "prompt_tokens": 2, "completion_tokens": 4 } }
```

流式（`stream: true`）：`text/event-stream`，事件格式：

```
data: {"delta": "mock: "}
data: {"delta": "你好"}
data: {"usage": {"prompt_tokens":2,"completion_tokens":4}}
data: [DONE]
```

> web 端以 fetch + ReadableStream 消费（与现有 ApiStatus 的 fetch 模式一致）。

### 4.3 POST /api/ai/embed

```json
{ "texts": ["hello", "world"] }
→ { "embeddings": [[0.1, ...], [0.2, ...]], "dim": 8 }
```

mock 实现：对文本做确定性哈希 → 归一化向量（dim 默认 8，可配）。

### 4.4 POST /api/ai/rag/ingest

```json
{ "documents": [{ "id": "doc-1", "text": "……", "metadata": {} }] }
→ { "indexed": 2 }
```

幂等：相同 id 覆盖写入。

### 4.5 POST /api/ai/rag/query

```json
{ "query": "问题", "top_k": 3 }
→ {
  "answer": "基于检索的答案",
  "sources": [{ "id": "doc-1", "score": 0.92, "text": "原文片段" }]
}
```

实现路径：混合检索（向量相似度 + 关键词命中加权）→ top_k → 拼接上下文 → 调 chat 生成带引用的回答。
**幻觉抑制**：无任何来源命中（score < 阈值）时必须返回 `answer: "知识库中没有相关信息"` 并附空 sources，禁止编造。

## 5. 关键设计

### 5.1 LLM provider 适配器

```python
class LLMProvider(Protocol):
    async def chat(self, messages: list[Message], *, model: str | None,
                   temperature: float, stream: bool) -> AsyncIterator[ChatChunk]: ...
```

- 注册表：`get_provider(name) -> LLMProvider`，按 `AI_LLM_PROVIDER` 选择；
- `MockProvider`：确定性回显（`f"mock: {last_user_message}"`），流式按字分块 + 小延迟；**CI 与测试唯一依赖**；
- `OpenAICompatibleProvider`：httpx 调用 `/chat/completions`（兼容 openai/deepseek 等 base_url）；
- provider 工厂在 `create_app` 时注入（依赖注入），测试可替换。

### 5.2 契约 → TS 类型生成

1. FastAPI 启动导出 `openapi.json`（测试里用 `TestClient.get("/openapi.json")` 生成）；
2. 仓库根脚本 `scripts/gen-ai-types.mjs`：调用 `pnpm dlx openapi-typescript`（或直接依赖 openapi-typescript）把 `packages/ai/openapi.json` 生成到 `packages/types/src/ai.ts`；
3. `packages/types/src/index.ts` 增加 `export type * from './ai';`；
4. 契约快照测试保证 openapi.json 变更被 CI 发现（§8）。

> 生成产物提交 git，CI 门禁校验生成结果与提交一致（`git diff --exit-code`）。

### 5.3 web 侧集成

- `apps/web/next.config.ts` rewrites 增加：
  `{ source: '/api/ai/:path*', destination: 'http://localhost:3002/api/ai/:path*' }`
  （生产走 `AI_INTERNAL_URL` 环境变量，模式与现有 API_INTERNAL_URL 相同）；
- 新增客户端组件 `apps/web/components/ai-chat.tsx`：一个最小聊天框，调用 `/api/ai/chat`（非流式）展示集成效果；
- 首页 `page.tsx` 的"内置能力"卡片增加 AI 行；`ApiStatus` 旁可加 `AiStatus`（可选，M2 完成）。

## 6. 检索与存储演进路径

| 阶段         | 向量存储                                                                      | 触发条件                 |
| ------------ | ----------------------------------------------------------------------------- | ------------------------ |
| dev（默认）  | `app/services/retriever.py` 内存实现（numpy 余弦相似度 + 简化 BM25 关键词分） | 零依赖                   |
| staging/prod | Qdrant（docker-compose 加服务）或 pgvector（复用 Postgres）                   | `AI_VECTOR_STORE=qdrant` |

retriever 抽象：

```python
class Retriever(Protocol):
    async def ingest(self, docs: list[Document]) -> int: ...
    async def search(self, query: str, top_k: int) -> list[SourceHit]: ...
```

混合打分：`score = 0.7 * cosine + 0.3 * keyword_hit_ratio`（权重可配，写进测试）。

## 7. 环境变量（app/config.py 集中定义）

| 变量              | 默认           | 说明                          |
| ----------------- | -------------- | ----------------------------- |
| AI_HOST / AI_PORT | 0.0.0.0 / 3002 | 监听                          |
| AI_LLM_PROVIDER   | mock           | mock \| openai-compatible     |
| AI_LLM_MODEL      | mock-1         | 默认模型名                    |
| AI_API_KEY        | （空）         | 真实 provider 时才需要        |
| AI_BASE_URL       | （空）         | openai-compatible 的 base_url |
| AI_EMBED_DIM      | 8              | mock 嵌入维度                 |
| AI_VECTOR_STORE   | memory         | memory \| qdrant              |
| AI_LOG_LEVEL      | info           | 日志级别                      |

约束：mock 模式下任何端点都不得因缺 key 失败。

## 8. 质量门禁（与仓库其余包同标准）

| 门禁              | 命令                                                                     | 阈值                                  |
| ----------------- | ------------------------------------------------------------------------ | ------------------------------------- |
| lint              | `uv run ruff check .`                                                    | 零错误                                |
| format            | `uv run ruff format --check .`                                           | 零差异                                |
| 类型              | `uv run mypy app --strict`                                               | 零错误                                |
| 单测              | `uv run pytest --cov=app --cov-fail-under=80`                            | 覆盖率 ≥ 80%                          |
| 契约快照          | `uv run pytest tests/test_openapi_snapshot.py`                           | openapi.json 变更必须更新 golden 文件 |
| E2E（web 侧已有） | 复用 Playwright：新增 `ai.spec.ts`（首页聊天框发一条消息得到 mock 回复） | 通过                                  |

**检索质量评估集（test_rag.py 内置）**：准备 10 条 QA（中文），ingest 3–5 篇短文档，
断言 `sources` 中正确答案文档排第一的命中率 ≥ 80%（mock 向量 + 关键词检索下可稳定达成）。
这是"带评估的 RAG"的最小可运行示范。

## 9. CI 与 Docker 集成

### 9.1 CI（.github/workflows/ci.yml 增加 ai job）

```yaml
ai:
  runs-on: ubuntu-latest
  timeout-minutes: 15
  steps:
    - uses: actions/checkout@v4
    - uses: astral-sh/setup-uv@v5 # 或手动 pip install uv
      with: { python-version: '3.12' }
    - run: cd packages/ai && uv sync --frozen
    - run: cd packages/ai && uv run ruff check .
    - run: cd packages/ai && uv run ruff format --check .
    - run: cd packages/ai && uv run mypy app --strict
    - run: cd packages/ai && uv run pytest --cov=app --cov-fail-under=80
```

并将 `ai` 加入分支保护 Required checks。

### 9.2 Dockerfile（多阶段）

```dockerfile
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS build
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY app ./app
FROM python:3.12-slim AS runtime
COPY --from=build /app /app
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 3002
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "3002"]
```

> `create_app` 需写成工厂函数（`--factory` 调用 `create_app()`）。

### 9.3 docker-compose

在 `docker/docker-compose.yml` 增加 `ai` 服务（build `docker/Dockerfile.ai` 或 `packages/ai/Dockerfile`），
web 的 `AI_INTERNAL_URL=http://ai:3002`。

## 10. 里程碑与验收标准（执行顺序不可跳）

### M1 服务骨架（health + mock + 门禁）

- [ ] `pyproject.toml`（uv + ruff + mypy + pytest 配置齐备）、`uv.lock` 提交
- [ ] `create_app()` 工厂 + `GET /api/ai/health`（返回 provider/model）
- [ ] MockProvider 可被工厂注入；config.py 完整读取 §7 变量
- [ ] `ruff check`、`ruff format --check`、`mypy --strict`、`pytest --cov-fail-under=80` 全绿
- **验收**：`cd packages/ai && uv sync && uv run uvicorn app.main:create_app --factory --port 3002` 后
  `curl localhost:3002/api/ai/health` 返回 200 JSON

### M2 契约与集成（chat + 类型生成 + web 消费）

- [ ] `POST /api/ai/chat`（非流式 + SSE 流式）+ 单测（含流式解析）
- [ ] 契约快照测试 + `scripts/gen-ai-types.mjs` 生成 `packages/types/src/ai.ts`
- [ ] web rewrites + `apps/web/components/ai-chat.tsx` 聊天框 + 首页展示
- [ ] Playwright `ai.spec.ts`：真实浏览器发消息 → 收到 mock 回复
- **验收**：`pnpm dev` 后 http://localhost:3000 首页聊天框可对话；`pnpm e2e` 全绿；CI ai job 全绿

### M3 RAG（ingest/query + 评估集）

- [ ] `POST /api/ai/rag/ingest`、`POST /api/ai/rag/query`（混合检索 + 幻觉抑制）
- [ ] 10 条 QA 评估集，top-1 命中率 ≥ 80% 断言
- [ ] `AI_VECTOR_STORE=qdrant` 的适配器骨架（可不实现真实连接，接口与文档齐备）
- **验收**：评估集测试全绿；README 附「检索质量报告」段落（引用测试输出数字）

### M4 交付与文档

- [ ] CI ai job 接入 + 分支保护清单更新
- [ ] Dockerfile.ai + docker-compose 更新
- [ ] `packages/ai/README.md`：快速开始、API 文档链接（/docs）、环境变量表
- [ ] 根 README Roadmap 勾选；新增 ADR 0005（本文件的决策摘录）
- **验收**：GitHub Actions 全绿徽章；`docker compose up` 后三服务互通

## 11. 明确不做（防止范围膨胀）

- ❌ 不接真实向量数据库的完整实现（只留接口与配置骨架）
- ❌ 不做模型微调、评测平台 UI（那是 A8/A9 独立项目，复用本服务）
- ❌ 不做用户体系/计费（mock 阶段无鉴权；真实 provider 时再加，见 §7 约束）
- ❌ 不在本包引入 LangChain/LlamaIndex（保持"手写管线、讲得清细节"的作品集原则）
