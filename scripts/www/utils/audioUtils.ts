
// Helper to decode Base64 string
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Global AudioContext singleton to better handle iOS lifecycle
let globalAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!globalAudioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    globalAudioContext = new AudioContextClass({ sampleRate: 24000 });
  }
  return globalAudioContext;
}

// iOS Safari requires audio context to be resumed inside a user interaction
async function unlockAudioContext(ctx: AudioContext) {
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}

// Manual PCM decoder for raw audio (Gemini Fallback)
async function decodeRawPCM(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export async function playPCMData(base64Audio: string): Promise<void> {
  // 1. Convert Base64 to Uint8Array
  const bytes = decodeBase64(base64Audio);
  
  // 2. Try HTML5 Audio (Blob) method FIRST. 
  // This is most stable on iOS for MP3/WAV/Container formats (Qwen/Some Gemini modes)
  try {
    const blob = new Blob([bytes], { type: 'audio/mp3' }); // Try generic mime first
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    
    // Attempt to play as standard audio file
    await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("HTML5 Audio failed"));
        // This play must be triggered by user interaction in the call stack
        audio.play().catch(reject);
    });
    
    URL.revokeObjectURL(audioUrl);
    return;
  } catch (e) {
    // If HTML5 Audio fails (likely Raw PCM or unknown format), fall back to Web Audio API
    // console.debug("HTML5 Audio playback failed, falling back to Web Audio API", e);
  }

  // 3. Web Audio API Fallback (For Raw PCM or strict environments)
  const audioContext = getAudioContext();
  await unlockAudioContext(audioContext);

  try {
    let audioBuffer: AudioBuffer;

    try {
      // Try native decode first (browser detects header)
      // Must copy buffer because decodeAudioData detaches it
      const bufferCopy = bytes.buffer.slice(0);
      audioBuffer = await audioContext.decodeAudioData(bufferCopy);
    } catch (e) {
      // Fallback: Assume Raw PCM (Gemini default is often 24kHz Mono S16LE)
      audioBuffer = await decodeRawPCM(bytes, audioContext, 24000, 1);
    }

    return new Promise((resolve, reject) => {
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      source.onended = () => {
        resolve();
      };
      
      // Removed source.onerror as it is not supported on AudioBufferSourceNode
      
      source.start(0);
    });
  } catch (error) {
    console.error("Fatal Error playing audio:", error);
    throw error;
  }
}