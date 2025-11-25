import JSZip from 'jszip';
import { translateBatch } from './geminiService';

// Helper to wait to avoid rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class DocxHandler {
  private zip: JSZip | null = null;
  private xmlDoc: Document | null = null;
  private paragraphNodes: Element[] = [];
  
  // Load the DOCX file
  async load(file: File): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    // Use 'new JSZip()' then loadAsync for maximum compatibility
    const zipInstance = new JSZip();
    this.zip = await zipInstance.loadAsync(arrayBuffer);
    
    const documentXml = await this.zip.file("word/document.xml")?.async("string");
    if (!documentXml) {
      throw new Error("Invalid DOCX file: word/document.xml not found");
    }

    const parser = new DOMParser();
    this.xmlDoc = parser.parseFromString(documentXml, "application/xml");
    
    // Attempt to find paragraphs safely handling XML namespaces
    const wNamespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    let pCollection = this.xmlDoc.getElementsByTagNameNS(wNamespace, "p");
    
    // Fallback if NS lookup fails or isn't strict
    if (pCollection.length === 0) {
      pCollection = this.xmlDoc.getElementsByTagName("w:p") as any;
    }

    this.paragraphNodes = Array.from(pCollection);
  }

  getTotalParagraphs(): number {
    return this.paragraphNodes.length;
  }

  // Extract text content from paragraphs to display/process
  getExtractableParagraphs(): { id: number; text: string }[] {
    return this.paragraphNodes
      .map((node, index) => ({
        id: index,
        text: node.textContent || ""
      }))
      .filter(item => item.text.trim().length > 0);
  }

  // Detect if a paragraph is likely a Heading based on styles
  private isHeading(index: number): boolean {
    const node = this.paragraphNodes[index];
    if (!node) return false;
    
    // Try to find paragraph properties <w:pPr> -> <w:pStyle>
    const pPr = node.getElementsByTagName("w:pPr")[0];
    if (!pPr) return false;
    
    const pStyle = pPr.getElementsByTagName("w:pStyle")[0];
    if (!pStyle) return false;
    
    const val = pStyle.getAttribute("w:val");
    // Check for standard Heading 1-9, Title, Subtitle, Chapter, etc.
    return val ? /heading|title|subtitle|chapter|part/i.test(val) : false;
  }

  // Create semantic chunks based on length and headings
  private createChunks(items: { id: number; text: string }[]): { id: number; text: string }[][] {
    const chunks: { id: number; text: string }[][] = [];
    let currentChunk: { id: number; text: string }[] = [];
    let currentChunkLen = 0;
    
    // Target ~3000 chars per chunk. 
    // This allows sufficient context for the LLM while staying safe within output limits.
    const TARGET_CHUNK_SIZE = 3000; 

    for (const item of items) {
      const isHeader = this.isHeading(item.id);
      
      // Break chunk if:
      // 1. We have content AND
      // 2. We hit a Heading (start of new section) OR we exceeded target size
      const shouldBreak = (currentChunk.length > 0) && (isHeader || currentChunkLen >= TARGET_CHUNK_SIZE);

      if (shouldBreak) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentChunkLen = 0;
      }

      currentChunk.push(item);
      currentChunkLen += item.text.length;
    }

    // Add remaining items
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  // Main processing function
  async processAndTranslate(
    onProgress: (completed: number, total: number, status: string) => void
  ): Promise<Blob> {
    if (!this.xmlDoc || !this.zip) throw new Error("Document not loaded");

    const itemsToTranslate = this.getExtractableParagraphs();
    
    // Use smart chunking
    const chunks = this.createChunks(itemsToTranslate);
    const totalChunks = chunks.length;
    
    const translationMap = new Map<number, string>();
    let processedChunks = 0;

    for (const chunk of chunks) {
      processedChunks++;
      const percentage = Math.round(((processedChunks - 1) / totalChunks) * 100);
      onProgress(
        processedChunks, 
        totalChunks, 
        `Translating section ${processedChunks}/${totalChunks} (${percentage}%)...`
      );
      
      // Retry logic for robustness
      let retries = 0;
      let batchSuccess = false;
      
      while (retries < 3 && !batchSuccess) {
        try {
          const results = await translateBatch(chunk);
          results.forEach((val, key) => translationMap.set(key, val));
          batchSuccess = true;
          // Small delay to prevent rate limiting
          await delay(200); 
        } catch (e) {
          console.warn(`Section ${processedChunks} failed, retrying (${retries + 1}/3)...`, e);
          retries++;
          await delay(1000 * retries); // Exponential backoff
        }
      }
    }

    onProgress(totalChunks, totalChunks, "Reassembling document...");
    this.applyTranslations(translationMap);

    // Serialize XML back to string
    const serializer = new XMLSerializer();
    const newXmlStr = serializer.serializeToString(this.xmlDoc);

    // Update the zip
    this.zip.file("word/document.xml", newXmlStr);

    // Generate blob
    return await this.zip.generateAsync({ type: "blob" });
  }

  private applyTranslations(translationMap: Map<number, string>) {
    // Strategy: Replace text in the first run of the paragraph, clear others.
    // This preserves paragraph-level structure (tables, lists, alignment) 
    // but may lose run-level formatting (like bolding a single word in a sentence)
    // which is acceptable for large-scale doc translation.

    translationMap.forEach((translatedText, index) => {
      // If translation returned empty/null, keep original
      if (!translatedText) return;

      const pNode = this.paragraphNodes[index];
      const textNodes = Array.from(pNode.getElementsByTagName("w:t"));

      if (textNodes.length > 0) {
        // Set the first node to the full translation
        textNodes[0].textContent = translatedText;

        // Empty the rest to avoid duplication of old parts
        for (let i = 1; i < textNodes.length; i++) {
            textNodes[i].textContent = "";
        }
      }
    });
  }
}