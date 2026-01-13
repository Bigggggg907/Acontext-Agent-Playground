# ACONTEXT Agent Playground - 启动模板

**ACONTEXT Agent Playground** 是一个生产就绪的启动模板，用于构建由 [Acontext](https://acontext.io) 驱动的上下文感知自主 AI 智能体。该模板提供了完整的认证、聊天界面、工具集成和会话管理功能，让您能够快速构建和自定义自己的 AI 智能体应用。

## 🚀 这是什么？

这是一个**启动模板**，继承了 **Acontext 平台**的强大功能，包括：

- **会话管理**：具有自动上下文管理的持久对话会话
- **语义搜索**：智能检索相关对话历史
- **文件和工件管理**：通过 Acontext Disk 上传、存储和管理文件
- **经验学习**：从用户 Space 中搜索和重用已学习的技能
- **上下文压缩**：自动 token 管理和上下文优化
- **工具集成**：可扩展的工具系统，支持自定义功能

## ✨ 功能特性

### 核心能力

- **🔐 身份认证**：使用 Supabase 的邮箱/密码认证
- **💬 聊天界面**：功能完整的聊天 UI，包含消息历史、流式响应和工具调用可视化
- **🎨 可自定义 UI**：基于 Tailwind CSS 和 shadcn/ui 组件构建 - 完全可自定义
- **🤖 头像支持**：轻松自定义智能体头像和品牌标识
- **🛠️ 可扩展工具**：添加您自己的自定义工具或修改现有工具
- **📁 文件上传**：支持上传 PDF、图片和文档
- **🌐 浏览器自动化**：集成 Browser Use SDK 用于网页自动化任务
- **🌓 主题支持**：使用 next-themes 的深色/浅色模式

### Acontext 集成

- **会话持久化**：每个聊天会话映射到一个 Acontext Session
- **语义上下文搜索**：在生成回复前自动检索相关历史上下文
- **磁盘存储**：文件存储在 Acontext Disk 中，支持自动工具访问
- **经验搜索**：利用用户 Space 中已学习的技能来改进回复
- **上下文压缩**：自动 token 管理，支持手动压缩选项

## 🛠️ 技术栈

- **框架**：Next.js 15+ (App Router)
- **认证和数据库**：Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- **AI 平台**：Acontext (`@acontext/acontext`)
- **LLM**：OpenAI (`openai` SDK) - 兼容 OpenAI API
- **浏览器智能体**：Browser Use SDK (`browser-use-sdk`)
- **UI 组件**：Tailwind CSS, shadcn/ui, Lucide 图标
- **语言**：TypeScript
- **主题**：next-themes

## 📦 快速开始

### 前置要求

- Node.js 18+ 和 npm/yarn/pnpm
- Supabase 账户（[在此创建](https://database.new)）
- Acontext 账户（[在此注册](https://acontext.io)）
- OpenAI API 密钥（或兼容的 API 端点）

### 安装步骤

1. **克隆仓库**

```bash
git clone <your-repo-url> nextjs-with-supabase-acontext
cd nextjs-with-supabase-acontext
```

2. **安装依赖**

```bash
npm install
# 或
yarn install
# 或
pnpm install
```

3. **设置 Supabase**

   - 在 [Supabase Dashboard](https://database.new) 创建新项目
   - 记录您的 `Project URL` 和 `Anon (publishable) key`

4. **配置环境变量**

   在根目录创建 `.env.local` 文件：

```env
# Supabase (必需)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key

# Acontext (完整功能需要)
ACONTEXT_API_KEY=your-acontext-api-key
ACONTEXT_BASE_URL=https://api.acontext.com/api/v1  # 可选，默认为此值

# OpenAI LLM (必需)
OPENAI_LLM_ENDPOINT=https://api.openai.com/v1
OPENAI_LLM_API_KEY=your-openai-api-key
OPENAI_LLM_MODEL=gpt-4o-mini  # 或 gpt-3.5-turbo, gpt-4 等
OPENAI_LLM_TEMPERATURE=0.7
OPENAI_LLM_MAX_TOKENS=2000

# Browser Use Cloud (可选，用于浏览器自动化)
BROWSER_USE_API_KEY=your-browser-use-cloud-api-key
```

5. **设置数据库架构**

   - 打开您的 Supabase 项目
   - 进入 **SQL Editor**
   - 运行 `specs/001-chatbot-openai/schema.sql` 中的 SQL
   - 这将创建 `chat_sessions` 和 `chat_messages` 表
   - 对于 Acontext 集成，还需运行 `specs/001-chatbot-openai/migration-acontext.sql`

6. **运行开发服务器**

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
```

访问 `http://localhost:3000` 查看您的应用。

## 🎨 自定义指南

### 自定义 UI

UI 使用 **Tailwind CSS** 和 **shadcn/ui** 组件构建，易于自定义：

1. **主题颜色**：编辑 `tailwind.config.ts` 更改配色方案
2. **组件**：所有 UI 组件都在 `components/ui/` 目录中 - 根据需要修改
3. **布局**：主页面在 `app/` 目录中
4. **首页**：自定义 `app/page.tsx` 作为您的着陆页
5. **聊天界面**：修改 `components/chatbot-panel.tsx` 进行聊天 UI 更改

### 自定义头像

智能体头像可以通过多种方式自定义：

1. **角色图片**：用您自己的角色/Logo 替换 `components/parallax-character.tsx`
2. **首页头像**：更新视差角色组件或首页 hero 部分
3. **聊天头像**：修改 `components/chatbot-panel.tsx` 中的头像显示

示例位置：
- `components/parallax-character.tsx` - 首页视差角色
- `public/acontext-character.png` - 角色资源
- `app/page.tsx` - 首页布局

### 添加自定义工具

工具定义为 OpenAI 函数调用架构。要添加您自己的工具：

1. **在 `lib/` 中创建工具文件**（例如 `lib/my-custom-tool.ts`）：

```typescript
export function getMyToolSchema() {
  return {
    type: "function" as const,
    function: {
      name: "my_custom_tool",
      description: "描述您的工具功能",
      parameters: {
        type: "object",
        properties: {
          param1: {
            type: "string",
            description: "参数描述",
          },
        },
        required: ["param1"],
      },
    },
  };
}

export async function executeMyTool(args: { param1: string }) {
  // 您的工具逻辑
  return {
    result: "工具执行结果",
  };
}
```

2. **在 `lib/openai-client.ts` 中注册工具**：

```typescript
// 添加到 getAvailableTools 函数
if (shouldIncludeMyTool) {
  tools.push(getMyToolSchema());
}

// 添加到 executeToolCall 函数
if (name === "my_custom_tool") {
  const args = JSON.parse(argsJson || "{}");
  return await executeMyTool(args);
}
```

3. **在 `app/api/chatbot/route.ts` 中接入聊天 API**：

```typescript
// 调用 chatCompletionStream 时工具会自动包含
```

**现有工具示例：**
- `lib/browser-use.ts` - 浏览器自动化
- `lib/acontext-disk-tools.ts` - 文件系统操作
- `lib/acontext-experience-search-tool.ts` - 经验搜索
- `lib/acontext-todo-tool.ts` - Todo 管理

### 自定义 Acontext 集成

Acontext 集成是模块化的，可以自定义：

- **会话管理**：`lib/acontext-integration.ts` - 修改会话创建和管理
- **客户端配置**：`lib/acontext-client.ts` - 调整 Acontext 客户端设置
- **工具集成**：`lib/acontext-disk-tools.ts` - 自定义磁盘工具行为
- **经验搜索**：`lib/acontext-experience-search-tool.ts` - 修改搜索逻辑

## 📚 项目结构

```
nextjs-with-supabase-acontext/
├── app/                    # Next.js app 目录
│   ├── api/               # API 路由
│   │   ├── acontext/      # Acontext API 端点
│   │   ├── chatbot/       # 聊天 API 端点
│   │   └── tools/         # 工具 API 端点
│   ├── auth/              # 认证页面
│   ├── protected/         # 受保护的聊天页面
│   └── page.tsx           # 首页
├── components/             # React 组件
│   ├── ui/                # shadcn/ui 组件
│   ├── chatbot-panel.tsx  # 主聊天界面
│   └── parallax-character.tsx  # 首页角色
├── lib/                   # 核心库
│   ├── acontext-*.ts      # Acontext 集成
│   ├── openai-client.ts   # OpenAI 客户端包装器
│   ├── browser-use.ts    # 浏览器自动化
│   └── supabase/          # Supabase 工具
├── specs/                 # 项目规范
└── types/                 # TypeScript 类型
```

## 🔧 可用工具

### 内置工具

1. **Browser Use Task** (`browser_use_task`)
   - 执行网页自动化任务
   - 需要 Browser Use Cloud API 密钥
   - 位置：`lib/browser-use.ts`

2. **Acontext Disk 工具**
   - `write_file`, `read_file`, `replace_string`, `list_artifacts`, `download_file`
   - Acontext Disk 上的文件系统操作
   - 位置：`lib/acontext-disk-tools.ts`

3. **经验搜索** (`experience_search`)
   - 从 Acontext Space 搜索用户已学习的技能
   - 位置：`lib/acontext-experience-search-tool.ts`

4. **Todo 管理** (`todo`)
   - 在聊天会话中创建和管理待办事项
   - 位置：`lib/acontext-todo-tool.ts`

### 添加您自己的工具

请参阅上面的[自定义指南](#添加自定义工具)部分。

## 🌐 环境变量

| 变量 | 描述 | 必需 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | 是 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon 密钥 | 是 |
| `ACONTEXT_API_KEY` | Acontext API 密钥 | 是（完整功能需要） |
| `ACONTEXT_BASE_URL` | Acontext API 基础 URL | 否（有默认值） |
| `OPENAI_LLM_ENDPOINT` | OpenAI 兼容 API 端点 | 是 |
| `OPENAI_LLM_API_KEY` | OpenAI API 密钥 | 是 |
| `OPENAI_LLM_MODEL` | 模型名称（例如 `gpt-4o-mini`） | 是 |
| `OPENAI_LLM_TEMPERATURE` | 温度（0-2） | 否（默认：0.7） |
| `OPENAI_LLM_MAX_TOKENS` | 响应最大 token 数 | 否（默认：2000） |
| `BROWSER_USE_API_KEY` | Browser Use Cloud API 密钥 | 否（可选） |

## 🚢 部署

### Vercel（推荐）

1. 将代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入您的仓库
3. 在 Vercel 仪表板中添加环境变量
4. 部署！

### 其他平台

这是一个标准的 Next.js 应用，可以部署到任何支持 Next.js 的平台：
- Netlify
- Railway
- Render
- AWS Amplify
- 使用 Node.js 自托管

## 📖 文档

- [Acontext 文档](https://docs.acontext.io)
- [Next.js 文档](https://nextjs.org/docs)
- [Supabase 文档](https://supabase.com/docs)
- [shadcn/ui 文档](https://ui.shadcn.com)

## 🤝 贡献

这是一个启动模板 - 欢迎 Fork 并根据您的需求自定义！

## 📄 许可证

请查看仓库中的 LICENSE 文件。

## 🆘 支持

- **Acontext**：[文档](https://docs.acontext.io) | [支持](https://acontext.io)
- **问题**：在仓库中提交 issue

---

**使用 Acontext 平台构建 ❤️**

