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

  // Safe method to get text ONLY from text runs, ignoring field codes (instrText)
  private getSafeText(pNode: Element): string {
    // We only want <w:t> elements. <w:instrText> contains field codes (like TOC, PAGEREF) 
    // which we must NOT translate or display.
    const textNodes = pNode.getElementsByTagName("w:t");
    let text = "";
    for (let i = 0; i < textNodes.length; i++) {
        text += textNodes[i].textContent;
    }
    return text;
  }

  // Detect if paragraph is a TOC or Field-heavy line that should be skipped
  private shouldSkip(pNode: Element): boolean {
    // Check the FULL content (including hidden codes) to detect Field instructions
    const fullContent = pNode.textContent || "";
    
    // If it contains "TOC \" or "PAGEREF", it is a Table of Contents or Reference line.
    // Converting these to text breaks the dynamic link in Word.
    // It's better to leave them as-is; the user can update the TOC in Word manually.
    if (fullContent.includes("TOC \\") || fullContent.includes("PAGEREF")) {
        return true;
    }
    return false;
  }

  // Extract text content from paragraphs to display/process
  getExtractableParagraphs(): { id: number; text: string }[] {
    return this.paragraphNodes
      .map((node, index) => {
        if (this.shouldSkip(node)) {
            return { id: index, text: "" }; // Skip this node
        }
        return {
          id: index,
          text: this.getSafeText(node)
        };
      })
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
    const TARGET_CHUNK_SIZE = 3000; 

    for (const item of items) {
      const isHeader = this.isHeading(item.id);
      
      const shouldBreak = (currentChunk.length > 0) && (isHeader || currentChunkLen >= TARGET_CHUNK_SIZE);

      if (shouldBreak) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentChunkLen = 0;
      }

      currentChunk.push(item);
      currentChunkLen += item.text.length;
    }

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
      
      let retries = 0;
      let batchSuccess = false;
      
      while (retries < 3 && !batchSuccess) {
        try {
          const results = await translateBatch(chunk);
          results.forEach((val, key) => translationMap.set(key, val));
          batchSuccess = true;
          await delay(200); 
        } catch (e) {
          console.warn(`Section ${processedChunks} failed, retrying (${retries + 1}/3)...`, e);
          retries++;
          await delay(1000 * retries); 
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
      // Only select <w:t> nodes to replace.
      // Important: We do NOT want to touch <w:fldChar> or <w:instrText> nodes, 
      // as that would break fields like Captions (Figure 1) or Page Numbers.
      const textNodes = Array.from(pNode.getElementsByTagName("w:t"));

      if (textNodes.length > 0) {
        // Set the first text node to the full translation
        textNodes[0].textContent = translatedText;

        // Empty the rest of the TEXT nodes to avoid duplication,
        // but this keeps the field structure (fldChar/instrText) intact if they exist as siblings.
        for (let i = 1; i < textNodes.length; i++) {
            textNodes[i].textContent = "";
        }
      }
    });
  }
}