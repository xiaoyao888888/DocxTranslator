import { GoogleGenAI, Type, Schema } from "@google/genai";

// Safely access API key even in environments where process might be undefined
const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  return '';
};

// Initialize Gemini
const getAIClient = () => new GoogleGenAI({ apiKey: getApiKey() });

// Schema for batched translation to ensure structured JSON output
const translationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    translations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          translated_text: { type: Type.STRING }
        },
        required: ["id", "translated_text"]
      }
    }
  },
  required: ["translations"]
};

export interface TranslationItem {
  id: number;
  text: string;
}

export const translateBatch = async (items: TranslationItem[]): Promise<Map<number, string>> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }
  
  if (items.length === 0) return new Map();

  const ai = getAIClient();
  
  // Construct a prompt that includes strict rules for mixed languages
  const prompt = `
    You are a professional translator processing a document.
    
    Task:
    Translate the provided JSON array of text segments into English.
    
    CRITICAL RULES:
    1. **Chinese Text**: Translate to professional, clear English.
    2. **English Text**: If a segment is ALREADY in English, return it EXACTLY as is. Do NOT translate English to Chinese or rephrase it.
    3. **Mixed Text**: If a segment contains both (e.g., "Hello (你好)"), translate the Chinese part so the whole segment reads naturally in English (e.g., "Hello (Hello)").
    4. **Formatting**: Preserve all numbers, bullet points (•, -, 1.), and special symbols.
    5. **Context**: These segments are part of a larger document. Maintain consistent terminology.
    
    Input JSON:
    ${JSON.stringify(items)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: translationSchema,
        temperature: 0.3,
      }
    });

    let responseText = response.text;
    if (!responseText) {
        throw new Error("Empty response from AI");
    }

    // Clean up Markdown code blocks if present (e.g. ```json ... ```)
    responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');

    const parsed = JSON.parse(responseText);
    const resultMap = new Map<number, string>();

    if (parsed.translations && Array.isArray(parsed.translations)) {
        parsed.translations.forEach((t: any) => {
            // Only add if we have a valid string
            if (t.translated_text !== undefined && t.translated_text !== null) {
                resultMap.set(t.id, t.translated_text);
            }
        });
    }

    return resultMap;

  } catch (error) {
    console.error("Translation batch error:", error);
    // On error, return empty map so the app can handle partial failure or retry logic could be added
    return new Map();
  }
};