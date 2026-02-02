
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { LLMConfig } from "../types";

const getSystemApiKey = () => {
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  return '';
};

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

function extractJson(text: string): string {
  const startIndex = text.indexOf('{');
  const endIndex = text.lastIndexOf('}');
  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) {
    // Fallback for markdown blocks if indices are weird
    return text.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
  }
  return text.substring(startIndex, endIndex + 1);
}

async function translateWithGemini(items: TranslationItem[], config: LLMConfig): Promise<Map<number, string>> {
  const apiKey = config.apiKey || getSystemApiKey();
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = getPrompt(items);

  const response = await ai.models.generateContent({
    model: config.model || 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: translationSchema,
      temperature: 0.1,
    }
  });

  return parseResponse(response.text || "");
}

async function translateWithOpenAI(items: TranslationItem[], config: LLMConfig): Promise<Map<number, string>> {
  const apiKey = config.apiKey || getSystemApiKey();
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  
  const prompt = getPrompt(items);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: "You are a professional technical translator specializing in software manuals and engineering documents. You must respond ONLY with the requested JSON format." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API Error: ${response.status} ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  return parseResponse(content || "");
}

function getPrompt(items: TranslationItem[]): string {
  return `
    Task: Translate the provided technical document segments from Chinese to English.
    
    STRICT COMPLIANCE RULES:
    1. NUMBERING & IDENTIFIERS: Keep all codes, numbering, and IDs exactly as they are. For example, if you see "2- 101", "3.1.2", or "[ID-404]", DO NOT change their formatting or spaces.
    2. ABBREVIATIONS & GLOSSARY: If a segment looks like a Chinese definition in an abbreviation table (e.g., "异步采样率转换器"), DO NOT translate it to English. Return the original Chinese.
    3. PRESERVE TAGS: If the text contains any special symbols like < > { } [ ], leave them untouched.
    4. ENGLISH ALREADY: If a segment is already entirely in English, return it exactly as provided.
    5. CONTEXT: This is a professional technical manual. Use formal engineering English.

    Return a JSON object with a "translations" key containing an array of objects. Each object must have "id" (integer) and "translated_text" (string).
    
    Data to translate:
    ${JSON.stringify(items)}
  `;
}

function parseResponse(responseText: string): Map<number, string> {
  try {
    const cleanJson = extractJson(responseText);
    const parsed = JSON.parse(cleanJson);
    const resultMap = new Map<number, string>();

    if (parsed.translations && Array.isArray(parsed.translations)) {
      parsed.translations.forEach((t: any) => {
        if (t.translated_text !== undefined) {
          resultMap.set(Number(t.id), t.translated_text);
        }
      });
    }
    return resultMap;
  } catch (e) {
    console.error("JSON Parsing failed for text:", responseText);
    throw new Error("The AI returned an invalid JSON response. Please try again.");
  }
}

export const translateBatch = async (items: TranslationItem[], config: LLMConfig): Promise<Map<number, string>> => {
  if (items.length === 0) return new Map();

  if (config.provider === 'gemini') {
    return translateWithGemini(items, config);
  } else {
    return translateWithOpenAI(items, config);
  }
};
