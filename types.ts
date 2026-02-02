
export interface TranslationChunk {
  id: number;
  originalText: string;
  translatedText: string | null;
  status: 'pending' | 'translating' | 'completed' | 'error';
}

export interface ProcessingStats {
  totalParagraphs: number;
  translatedParagraphs: number;
  currentOperation: string;
  estimatedTimeRemaining: string;
}

export enum AppState {
  IDLE,
  PARSING,
  TRANSLATING,
  REASSEMBLING,
  COMPLETED,
  ERROR
}

export type LLMProvider = 'gemini' | 'openai';

export interface LLMConfig {
  provider: LLMProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
}
