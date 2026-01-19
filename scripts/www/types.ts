export enum AIProvider {
  GEMINI = 'GEMINI',
  DEEPSEEK = 'DEEPSEEK'
}

export enum TTSProvider {
  GEMINI = 'GEMINI',
  QWEN = 'QWEN'
}

export enum Difficulty {
  BEGINNER = '初级',
  INTERMEDIATE = '中级',
  ADVANCED = '高级'
}

export enum LearningStatus {
  LEARNING = 'learning',
  LEARNED = 'learned'
}

export interface AppSettings {
  geminiKey: string;
  deepseekKey: string;
  qwenKey: string;
  textProvider: AIProvider;
  ttsProvider: TTSProvider;
  geminiModel: string;
  deepseekModel: string;
  qwenTtsModel: string;
}

export interface VocabularyItem {
  word: string;
  pronunciation: string;
  meaning: string;
  example_kr: string;
  example_cn: string;
}

export interface ArticleData {
  title_kr: string;
  title_cn: string;
  content_kr: string;
  content_cn: string;
  key_words: VocabularyItem[];
  audio_cache?: { [key: number]: string };
}

export interface ListeningData {
  script_kr: string;
  script_cn: string;
  question_cn: string;
  answer_cn: string;
  audio_cache?: string;
}

export interface SavedItem<T> {
  id: string;
  data: T;
  difficulty: Difficulty;
  status: LearningStatus;
  timestamp: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// --- Tutor Types ---

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
  audio_cache?: string; // base64 audio
}

export interface TutorCourse {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  icon: string; // Emoji or Lucide icon name mapping
  systemPrompt: string;
  initialMessage: string;
}

export interface ChatSession {
  courseId: string;
  messages: ChatMessage[];
  lastUpdated: number;
  summary?: string; // AI summary of user's performance in this chat
}