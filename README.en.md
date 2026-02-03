# DocxTranslator Pro

English | [简体中文](./README.md)

DocxTranslator Pro is an enterprise-grade document translation tool designed to perfectly preserve the original layout and formatting of documents. Built with React 19 and Vite, it supports various Large Language Model (LLM) backends, such as Google Gemini and OpenAI-compatible interfaces.

## Key Features

- **Layout Preservation**: Completely retains all images, headers, footers, and complex styles during translation.
- **Large File Support**: Uses intelligent chapter-based chunking to easily handle valid translation tasks for very large documents.
- **Universal API Support**: Built-in support for Google Gemini, also compatible with DeepSeek or any OpenAI-formatted LLM API.
- **Privacy & Security**: File structure is processed locally; only text content is sent to the API for translation.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Build for Production

```bash
npm run build
```

## User Guide

1. Launch the application and configure your API key in the settings section (Gemini model is recommended by default).
2. Drag and drop a `.docx` file into the upload area or click to select a file.
3. Click the "Begin Translation Process" button.
4. Wait for the translation to complete, then click the download button to get your translated document.

## Tech Stack

- **Frontend Framework**: React 19, Vite
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Document Processing**: JSZip
- **AI Integration**: Google GenAI SDK

## License

MIT
