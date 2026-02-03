<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DocxTranslator Pro

**DocxTranslator Pro** is a modern, enterprise-grade document translation tool designed to preserve the exact layout and formatting of your Word documents (`.docx`) while providing high-quality technical translations using advanced Large Language Models (LLMs).

Unlike traditional translation tools that often break formatting, DocxTranslator uses safe XML parsing to ensure that **images, tables, headers, footers, and complex styles remain 100% intact**.

## 🚀 Key Features

*   **Zero Layout Loss**: Parses and reconstructs the underlying XML structure (`word/document.xml`) to guarantee the translated document looks exactly like the original.
*   **Context-Aware Translation**: extracting text intelligently (skipping TOCs and metadata) and chunking by chapters to ensure the AI understands the context.
*   **Multi-Model Support**:
    *   **Google Gemini**:  Native integration with the latest Gemini models (e.g., `gemini-1.5-flash`, `gemini-1.5-pro`).
    *   **OpenAI Compatible**: Support for any OpenAI-compatible API, including **GPT-4o**, **DeepSeek**, **Claude** (via proxies), and local models (via Ollama/vLLM).
*   **Smart Resilience**: Built-in exponential backoff and retry mechanisms to handle API rate limits and network instability automatically.
*   **User-Friendly Configuration**: 
    *   **Persistent Settings**: API keys and model preferences are automatically saved to your browser's local storage—set it once, and it remembers.
    *   Real-time progress tracking with visualized status bars.
*   **Privacy Focused**: Your documents are processed locally in the browser memory and sent to the LLM API only for text translation. No file storage on intermediate servers.

## 🛠️ Tech Stack

*   **Frontend**: React 18, TypeScript, Vite
*   **Styling**: Tailwind CSS, Lucide React (Icons)
*   **Core Logic**: `jszip` (Document manipulation), `@google/genai` (AI SDK)

## 🏁 Getting Started

### Prerequisites

*   **Node.js**: Version 18 or higher (v20+ recommended).

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/xiaoyao888888/DocxTranslator.git
    cd DocxTranslator
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Run the development server**
    ```bash
    npm run dev
    ```

4.  Open your browser and navigate to `http://localhost:3000` (or the URL shown in your terminal).

## 📖 Usage Guide

1.  **Configure API**:
    *   Click the **Settings** icon (gear) at the top of the app.
    *   Choose your provider: **Google Gemini** or **OpenAI Compatible**.
    *   Enter your API Model (e.g., `gemini-1.5-flash` or `gpt-4o`) and your API Key.
    *   *Note: Your settings are saved locally in your browser.*

2.  **Upload Document**:
    *   Drag and drop your `.docx` file into the upload area.
    *   Ensure the file is not currently open in Microsoft Word.

3.  **Start Translation**:
    *   Click **"Begin Translation Process"**.
    *   Wait for the parsing, translating, and reassembling stages to complete.

4.  **Download**:
    *   Once finished, click **"Download Translated DOCX"** to get your file.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

*Built with ❤️ for global communication.*
