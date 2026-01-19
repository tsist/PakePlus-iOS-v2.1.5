import React, { useState } from 'react';
import { Settings, X, Key, Cpu, Check, MessageSquare, Headphones } from 'lucide-react';
import { AppSettings, AIProvider, TTSProvider } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6 transition-all duration-300">
      <div 
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 flex flex-col max-h-[90dvh]"
      >
        <div className="flex justify-between items-center p-5 md:p-6 border-b border-gray-100 bg-white z-10">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-6 h-6 text-indigo-600" />
            系统设置
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 md:p-6 space-y-8 overflow-y-auto custom-scrollbar">
          
          {/* Text Provider Selection */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-slate-500" />
              AI 文本生成模型 (题目/文章)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setLocalSettings({ ...localSettings, textProvider: AIProvider.GEMINI })}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all duration-200 ${
                  localSettings.textProvider === AIProvider.GEMINI
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-gray-100 bg-white text-slate-500 hover:border-indigo-100'
                }`}
              >
                <span className="font-bold text-sm">Gemini</span>
                {localSettings.textProvider === AIProvider.GEMINI && <Check className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setLocalSettings({ ...localSettings, textProvider: AIProvider.DEEPSEEK })}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all duration-200 ${
                  localSettings.textProvider === AIProvider.DEEPSEEK
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                    : 'border-gray-100 bg-white text-slate-500 hover:border-indigo-100'
                }`}
              >
                <span className="font-bold text-sm">DeepSeek</span>
                {localSettings.textProvider === AIProvider.DEEPSEEK && <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* TTS Provider Selection */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Headphones className="w-4 h-4 text-slate-500" />
              AI 语音合成服务 (TTS)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setLocalSettings({ ...localSettings, ttsProvider: TTSProvider.GEMINI })}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all duration-200 ${
                  localSettings.ttsProvider === TTSProvider.GEMINI
                    ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-sm'
                    : 'border-gray-100 bg-white text-slate-500 hover:border-purple-100'
                }`}
              >
                <span className="font-bold text-sm">Gemini</span>
                {localSettings.ttsProvider === TTSProvider.GEMINI && <Check className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setLocalSettings({ ...localSettings, ttsProvider: TTSProvider.QWEN })}
                className={`flex items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all duration-200 ${
                  localSettings.ttsProvider === TTSProvider.QWEN
                    ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-sm'
                    : 'border-gray-100 bg-white text-slate-500 hover:border-purple-100'
                }`}
              >
                <span className="font-bold text-sm">Qwen (阿里)</span>
                {localSettings.ttsProvider === TTSProvider.QWEN && <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Gemini Config */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
              <Cpu className="w-4 h-4" /> Gemini 配置
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase tracking-wider font-bold ml-1">API Key</label>
              <div className="relative">
                <Key className="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={localSettings.geminiKey}
                  onChange={(e) => setLocalSettings({ ...localSettings, geminiKey: e.target.value })}
                  placeholder="AIza..."
                  className="w-full pl-11 pr-4 py-3 border border-gray-100 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase tracking-wider font-bold ml-1">Model Name</label>
              <input
                type="text"
                value={localSettings.geminiModel}
                onChange={(e) => setLocalSettings({ ...localSettings, geminiModel: e.target.value })}
                placeholder="gemini-3-flash-preview"
                className="w-full px-5 py-3 border border-gray-100 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all font-mono"
              />
            </div>
          </div>

          {/* DeepSeek Config */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
              <Cpu className="w-4 h-4" /> DeepSeek 配置
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase tracking-wider font-bold ml-1">API Key</label>
              <div className="relative">
                <Key className="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={localSettings.deepseekKey}
                  onChange={(e) => setLocalSettings({ ...localSettings, deepseekKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full pl-11 pr-4 py-3 border border-gray-100 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase tracking-wider font-bold ml-1">Model Name</label>
              <input
                type="text"
                value={localSettings.deepseekModel}
                onChange={(e) => setLocalSettings({ ...localSettings, deepseekModel: e.target.value })}
                placeholder="deepseek-chat"
                className="w-full px-5 py-3 border border-gray-100 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all font-mono"
              />
            </div>
          </div>

          {/* Qwen Config */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-orange-600 font-bold text-sm">
              <Cpu className="w-4 h-4" /> Qwen (通义千问) 配置
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase tracking-wider font-bold ml-1">DashScope API Key</label>
              <div className="relative">
                <Key className="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={localSettings.qwenKey}
                  onChange={(e) => setLocalSettings({ ...localSettings, qwenKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full pl-11 pr-4 py-3 border border-gray-100 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 uppercase tracking-wider font-bold ml-1">Model Name</label>
              <input
                type="text"
                value={localSettings.qwenTtsModel}
                onChange={(e) => setLocalSettings({ ...localSettings, qwenTtsModel: e.target.value })}
                placeholder="qwen-tts-flash"
                className="w-full px-5 py-3 border border-gray-100 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm transition-all font-mono"
              />
            </div>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-2xl text-xs text-slate-500 leading-relaxed border border-slate-100">
            <strong>提示：</strong> 您可以分别设置用于生成文字内容（题目、文章）的模型和用于语音朗读（TTS）的模型。
          </div>
        </div>

        <div className="p-5 md:p-6 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
          <button 
            onClick={onClose}
            className="px-6 py-3 text-slate-600 hover:bg-slate-200 rounded-2xl font-bold transition-all"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all"
          >
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;