
import JSZip from 'jszip';
import { translateBatch } from './geminiService';
import { LLMConfig } from '../types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class DocxHandler {
  private zip: JSZip | null = null;
  private xmlDoc: Document | null = null;
  private paragraphNodes: Element[] = [];
  
  async load(file: File): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    const zipInstance = new JSZip();
    this.zip = await zipInstance.loadAsync(arrayBuffer);
    
    const documentXml = await this.zip.file("word/document.xml")?.async("string");
    if (!documentXml) throw new Error("Could not find word/document.xml in the package.");

    const parser = new DOMParser();
    this.xmlDoc = parser.parseFromString(documentXml, "application/xml");
    
    const wNamespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    let pCollection = this.xmlDoc.getElementsByTagNameNS(wNamespace, "p");
    if (pCollection.length === 0) pCollection = this.xmlDoc.getElementsByTagName("w:p") as any;
    this.paragraphNodes = Array.from(pCollection);
  }

  private getSafeText(pNode: Element): string {
    const textNodes = pNode.getElementsByTagName("w:t");
    let text = "";
    for (let i = 0; i < textNodes.length; i++) {
        text += textNodes[i].textContent;
    }
    return text;
  }

  private shouldSkip(pNode: Element): boolean {
    const fullContent = pNode.textContent || "";
    // Skip Table of Contents fields to prevent corruption
    return fullContent.includes("TOC \\") || fullContent.includes("PAGEREF");
  }

  getExtractableParagraphs(): { id: number; text: string }[] {
    return this.paragraphNodes
      .map((node, index) => {
        if (this.shouldSkip(node)) return { id: index, text: "" };
        return { id: index, text: this.getSafeText(node) };
      })
      .filter(item => item.text.trim().length > 0);
  }

  private isHeading(index: number): boolean {
    const node = this.paragraphNodes[index];
    const pPr = node?.getElementsByTagName("w:pPr")[0];
    const pStyle = pPr?.getElementsByTagName("w:pStyle")[0];
    const val = pStyle?.getAttribute("w:val");
    return val ? /heading|title|subtitle|chapter|part/i.test(val) : false;
  }

  private createChunks(items: { id: number; text: string }[]): { id: number; text: string }[][] {
    const chunks: { id: number; text: string }[][] = [];
    let currentChunk: { id: number; text: string }[] = [];
    let currentChunkLen = 0;
    const TARGET_CHUNK_SIZE = 3000; 

    for (const item of items) {
      const isHeader = this.isHeading(item.id);
      // New chunk if heading encountered or size exceeded
      if (currentChunk.length > 0 && (isHeader || currentChunkLen >= TARGET_CHUNK_SIZE)) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentChunkLen = 0;
      }
      currentChunk.push(item);
      currentChunkLen += item.text.length;
    }
    if (currentChunk.length > 0) chunks.push(currentChunk);
    return chunks;
  }

  async processAndTranslate(
    config: LLMConfig,
    onProgress: (completed: number, total: number, status: string) => void
  ): Promise<Blob> {
    if (!this.xmlDoc || !this.zip) throw new Error("Document not loaded");

    const itemsToTranslate = this.getExtractableParagraphs();
    const chunks = this.createChunks(itemsToTranslate);
    const totalChunks = chunks.length;
    const translationMap = new Map<number, string>();
    let processedChunks = 0;

    for (const chunk of chunks) {
      processedChunks++;
      onProgress(processedChunks, totalChunks, `Translating batch ${processedChunks}/${totalChunks}...`);
      
      let retries = 0;
      let batchSuccess = false;
      const MAX_RETRIES = 5;

      while (retries < MAX_RETRIES && !batchSuccess) {
        try {
          const results = await translateBatch(chunk, config);
          results.forEach((val, key) => translationMap.set(key, val));
          batchSuccess = true;
          // Small pause to avoid hitting rate limits instantly
          await delay(800); 
        } catch (e: any) {
          retries++;
          const errorMessage = e.message || "";
          const isRateLimit = errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED");
          // Exponential backoff: 5s, 10s, 20s... for rate limits; 2s, 4s... for others
          let waitTime = isRateLimit ? 5000 * Math.pow(2, retries - 1) : 2000 * retries;
          
          if (retries >= MAX_RETRIES) {
            throw new Error(`Failed to translate batch after ${MAX_RETRIES} attempts. Error: ${errorMessage}`);
          }
          
          onProgress(processedChunks, totalChunks, `Error: ${isRateLimit ? 'Rate limit' : 'Connection'}. Retrying in ${waitTime/1000}s...`);
          await delay(waitTime); 
        }
      }
    }

    onProgress(totalChunks, totalChunks, "Reassembling document...");
    this.applyTranslations(translationMap);
    
    const serializer = new XMLSerializer();
    const newXmlStr = serializer.serializeToString(this.xmlDoc);
    this.zip.file("word/document.xml", newXmlStr);
    
    return await this.zip.generateAsync({ type: "blob" });
  }

  private applyTranslations(translationMap: Map<number, string>) {
    translationMap.forEach((translatedText, index) => {
      if (!translatedText) return;
      const pNode = this.paragraphNodes[index];
      const textNodes = Array.from(pNode.getElementsByTagName("w:t"));
      if (textNodes.length > 0) {
        // We put all translated text in the first 't' node and clear the rest
        // This preserves the paragraph structure while updating the content
        textNodes[0].textContent = translatedText;
        textNodes[0].setAttribute("xml:space", "preserve");
        for (let i = 1; i < textNodes.length; i++) {
          textNodes[i].textContent = "";
        }
      }
    });
  }
}
