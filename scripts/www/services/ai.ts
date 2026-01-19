import { GoogleGenAI } from "@google/genai";
import { AIProvider, TTSProvider, AppSettings } from "../types";
import { decodeBase64 } from "../utils/audioUtils";

// Helper to sanitize API keys
const cleanApiKey = (key: string): string => {
  if (!key) return '';
  return key.replace(/[^\x00-\x7F]/g, "").trim();
};

// --- DeepSeek Implementation ---
const callDeepSeek = async (apiKey: string, model: string, systemPrompt: string, userPrompt: string) => {
  const sanitizedKey = cleanApiKey(apiKey);
  if (!sanitizedKey) throw new Error("DeepSeek API Key is missing or invalid");
  
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sanitizedKey}`
      },
      body: JSON.stringify({
        model: model || "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`DeepSeek API Error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error("DeepSeek API 请求失败: 可能是跨域(CORS)限制或网络连接问题。");
    }
    throw error;
  }
};

// --- Gemini Implementation (Text) ---
const callGemini = async (apiKey: string, model: string, systemPrompt: string, userPrompt: string, jsonMode: boolean = false) => {
  const sanitizedKey = cleanApiKey(apiKey);
  if (!sanitizedKey) throw new Error("Gemini API Key is missing or invalid");

  const ai = new GoogleGenAI({ apiKey: sanitizedKey });
  
  const config: any = {
    systemInstruction: systemPrompt,
  };

  if (jsonMode) {
    config.responseMimeType = "application/json";
  }

  const targetModel = model || 'gemini-3-flash-preview';

  const response = await ai.models.generateContent({
    model: targetModel,
    contents: userPrompt,
    config: config
  });

  return response.text;
};

// --- Qwen TTS Implementation ---
const callQwenTTS = async (apiKey: string, model: string, text: string): Promise<string> => {
  const sanitizedKey = cleanApiKey(apiKey);
  if (!sanitizedKey) throw new Error("Qwen (DashScope) API Key is required for TTS");

  // Qwen TTS Endpoint (Using the multimodal generation endpoint as per previous setup, which works for specific qwen-tts models)
  const url = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sanitizedKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-SSE': 'disable'
      },
      body: JSON.stringify({
        model: model || "qwen3-tts-flash-2025-11-27",
        input: {
          text: text,
        },
        parameters: {
          voice: "sohee", // Updated to sohee as requested
          language_type: "Korean" // Optimization for Korean
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Qwen TTS API Error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    // Parse Qwen response to get audio URL
    // The response structure for multimodal generation usually contains choices[0].message.content[0].audio
    const audioUrl = data?.output?.choices?.[0]?.message?.content?.[0]?.audio;

    if (!audioUrl) {
      throw new Error("No audio URL found in Qwen response. Output: " + JSON.stringify(data));
    }

    // Fetch the actual audio data from the URL
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) throw new Error(`Failed to fetch audio file from URL: ${audioResponse.statusText}`);
    
    const arrayBuffer = await audioResponse.arrayBuffer();
    
    // Convert to Base64
    let binary = '';
    const bytes = new Uint8Array(arrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error("Qwen TTS 请求失败: 可能是 API 域名访问限制或网络连接问题。");
    }
    throw error;
  }
};

// --- Unified Text Generation ---
export const generateText = async (
  settings: AppSettings, 
  systemPrompt: string, 
  userPrompt: string, 
  forceJson: boolean = false
): Promise<string> => {
  if (settings.textProvider === AIProvider.DEEPSEEK) {
    return callDeepSeek(settings.deepseekKey, settings.deepseekModel, systemPrompt, userPrompt);
  } else {
    return callGemini(settings.geminiKey, settings.geminiModel, systemPrompt, userPrompt, forceJson);
  }
};

// --- Unified TTS Generation ---
export const generateSpeech = async (settings: AppSettings | string, text: string): Promise<string> => {
  let config: AppSettings;
  if (typeof settings === 'string') {
    config = {
      geminiKey: settings,
      textProvider: AIProvider.GEMINI,
      ttsProvider: TTSProvider.GEMINI,
      geminiModel: 'gemini-3-flash-preview',
      deepseekKey: '',
      deepseekModel: 'deepseek-chat',
      qwenKey: '',
      qwenTtsModel: 'qwen-tts-flash'
    } as AppSettings;
  } else {
    config = settings;
  }

  const cleanText = text.trim();
  if (!cleanText) throw new Error("Text is empty");

  if (config.ttsProvider === TTSProvider.QWEN) {
    return callQwenTTS(config.qwenKey, config.qwenTtsModel, cleanText);
  } else {
    return callGeminiTTS(config.geminiKey, cleanText);
  }
};

// --- Gemini TTS Implementation ---
const callGeminiTTS = async (apiKey: string, text: string): Promise<string> => {
  const sanitizedKey = cleanApiKey(apiKey);
  if (!sanitizedKey) throw new Error("Gemini API Key is required for TTS");

  const ai = new GoogleGenAI({ apiKey: sanitizedKey });
  
  const isDialogue = (text.includes("A:") || text.includes("A：")) && (text.includes("B:") || text.includes("B："));

  try {
    const config: any = {
        responseModalities: ['AUDIO'],
    };

    if (isDialogue) {
        config.speechConfig = {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                    {
                        speaker: 'A',
                        voiceConfig: {
                          prebuiltVoiceConfig: { voiceName: 'Kore' }
                        }
                    },
                    {
                        speaker: 'B',
                        voiceConfig: {
                          prebuiltVoiceConfig: { voiceName: 'Fenrir' }
                        }
                    }
              ]
            }
        };
    } else {
        config.speechConfig = {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
        };
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: {
        role: "user",
        parts: [{ text }]
      },
      config: config,
    });

    const candidate = response.candidates?.[0];
    const base64Audio = candidate?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      const textPart = candidate?.content?.parts?.[0]?.text;
      if (textPart) throw new Error(`Gemini returned text instead of audio: ${textPart}`);
      throw new Error(`No audio data received from Gemini.`);
    }

    return base64Audio;
  } catch (error: any) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
};