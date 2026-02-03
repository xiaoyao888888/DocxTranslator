# DocxTranslator Pro

[English](./README.en.md) | 简体中文

DocxTranslator Pro 是一款企业级的文档翻译工具，旨在完美保留文档原有的排版和布局。项目基于 React 19 和 Vite 构建，支持多种大语言模型（LLM）后端，如 Google Gemini 和 OpenAI 兼容接口。

## 主要功能

- **排版保护**：在翻译过程中完整保留所有图片、页眉、页脚及复杂的文档样式。
- **大文件支持**：采用智能分章节处理机制，轻松应对超大文档的翻译任务。
- **通用 API 支持**：内置支持 Google Gemini，同时兼容 DeepSeek 或任何 OpenAI 格式的 LLM API。
- **隐私安全**：文件结构在本地处理，仅文本内容会被发送至 API 进行翻译。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 构建生产版本

```bash
npm run build
```

## 使用指南

1. 启动应用后，在配置区域设置您的 API 密钥（默认推荐使用 Gemini 模型）。
2. 将 `.docx` 文件拖拽到上传区域，或点击选择文件。
3. 点击 "Begin Translation Process"（开始翻译）按钮。
4. 等待翻译完成后，点击下载按钮获取翻译好的文档。

## 技术栈

- **前端框架**: React 19, Vite
- **语言**: TypeScript
- **样式**: TailwindCSS
- **文档处理**: JSZip
- **AI 集成**: Google GenAI SDK

## 许可证

MIT
