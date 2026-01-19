import React, { useState, useEffect, useMemo } from 'react';
import { AppSettings, Difficulty, LearningStatus, SavedItem, ListeningData } from '../types';
import { generateText, generateSpeech } from '../services/ai';
import { playPCMData } from '../utils/audioUtils';
import ConfirmModal from '../components/ConfirmModal';
import { Headphones, Play, Loader2, Eye, EyeOff, CheckCircle, Trash2, CheckCircle2, ListMusic, Languages, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  settings: AppSettings;
}

const STORAGE_KEY = 'hanyu_listening_items';

const PRESET_TOPICS = [
  "便利店购物", "乘坐地铁", "机场登机", "酒店入住", 
  "咖啡厅点单", "天气预报", "询问路线", "电话预约", 
  "朋友聚会", "面试自我介绍", "医院挂号", "租房咨询"
];

const Listening: React.FC<Props> = ({ settings }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.BEGINNER);
  const [context, setContext] = useState('');
  const [savedItems, setSavedItems] = useState<SavedItem<ListeningData>[]>([]);
  const [currentItem, setCurrentItem] = useState<SavedItem<ListeningData> | null>(null);
  
  const [loadingText, setLoadingText] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'learning' | 'learned'>('current');

  // Track expanded lines for translation
  const [expandedLines, setExpandedLines] = useState<Record<number, boolean>>({});

  // Modal State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setSavedItems(JSON.parse(saved));
  }, []);

  useEffect(() => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedItems));
    } catch (e: any) {
        if (e.name === 'QuotaExceededError') {
            console.warn("Storage full, audio might not save.");
        }
    }
  }, [savedItems]);

  useEffect(() => {
    // Reset state when item changes
    setShowScript(false);
    setShowAnswer(false);
    setExpandedLines({});
    setLoadingAudio(false);
  }, [currentItem?.id]);

  const handleGenerate = async () => {
    setLoadingText(true);
    setShowScript(false);
    setShowAnswer(false);

    // Prompt updated to request dialogue format and translated script
    const systemPrompt = `You are a Korean language listening test creator.
    Generate a conversation (Dialogue) between Person A and Person B suitable for listening practice.
    
    IMPORTANT FORMATTING:
    1. In 'script_kr', use "A: " and "B: " prefixes for every line.
    2. 'script_cn' must be the line-by-line Chinese translation of 'script_kr', keeping the same line count and order.
    
    Return JSON: { 
        "script_kr": "A: Annyeonghaseyo...\nB: Ne, Annyeonghaseyo...", 
        "script_cn": "A: 你好...\nB: 是的，你好...",
        "question_cn": "A comprehension question in Chinese", 
        "answer_cn": "The answer in Chinese" 
    }`;

    const userPrompt = `Context: ${context || 'General Daily Life'}. Difficulty: ${difficulty}. Length: approx 6-8 turns (about 60-80 words).`;

    try {
      const result = await generateText(settings, systemPrompt, userPrompt, true);
      const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const data: ListeningData = JSON.parse(cleanJson);
      
      const newItem: SavedItem<ListeningData> = {
        id: crypto.randomUUID(),
        data,
        difficulty,
        status: LearningStatus.LEARNING,
        timestamp: Date.now()
      };

      setSavedItems(prev => [newItem, ...prev]);
      setCurrentItem(newItem);
      setActiveTab('current');
    } catch (error) {
      console.error(error);
      alert('Failed to generate listening script.');
    } finally {
      setLoadingText(false);
    }
  };

  const handlePlay = async () => {
    if (!settings.geminiKey && !settings.qwenKey) {
      alert("请在设置中配置 AI API Key (Gemini 或 Qwen)");
      return;
    }
    if (!currentItem) return;

    // 1. Check Cache
    if (currentItem.data.audio_cache) {
        setLoadingAudio(true); // Short flicker to show interaction
        try {
            await playPCMData(currentItem.data.audio_cache);
        } catch (e) {
            console.error("Cached audio failed", e);
            alert("播放缓存音频失败");
        } finally {
            setLoadingAudio(false);
        }
        return;
    }

    // 2. Generate and Cache
    setLoadingAudio(true);
    try {
      // Pass full settings
      const base64 = await generateSpeech(settings, currentItem.data.script_kr);
      
      // Save to state
      const updatedItem = { ...currentItem };
      updatedItem.data.audio_cache = base64;
      setCurrentItem(updatedItem);
      setSavedItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
      
      await playPCMData(base64);
    } catch (error) {
      console.error(error);
      alert('AI 语音生成失败，请检查配置');
    } finally {
      setLoadingAudio(false);
    }
  };

  const toggleStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedItems(prev => prev.map(i => i.id === id ? { ...i, status: i.status === LearningStatus.LEARNING ? LearningStatus.LEARNED : LearningStatus.LEARNING } : i));
  };

  const confirmDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteId(id);
  };

  const executeDelete = () => {
    if (deleteId) {
      setSavedItems(prev => prev.filter(i => i.id !== deleteId));
      if (currentItem?.id === deleteId) setCurrentItem(null);
      setDeleteId(null);
    }
  };

  const toggleLineTranslation = (index: number) => {
    setExpandedLines(prev => ({
        ...prev,
        [index]: !prev[index]
    }));
  };

  const learningList = useMemo(() => savedItems.filter(i => i.status === LearningStatus.LEARNING), [savedItems]);
  const learnedList = useMemo(() => savedItems.filter(i => i.status === LearningStatus.LEARNED), [savedItems]);

  // Split scripts for display
  const scriptLinesKr = useMemo(() => currentItem?.data.script_kr.split('\n').filter(l => l.trim()) || [], [currentItem]);
  const scriptLinesCn = useMemo(() => currentItem?.data.script_cn?.split('\n').filter(l => l.trim()) || [], [currentItem]);

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        title="删除训练"
        message="您确定要删除此听力训练记录吗？"
        isDangerous={true}
      />

      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">听力私教</h1>
          <p className="text-slate-500">模拟真实语境，循序渐进提升听力理解。</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
          <button 
            onClick={() => setActiveTab('current')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'current' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            正在练习
          </button>
          <button 
            onClick={() => setActiveTab('learning')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'learning' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            学习中 ({learningList.length})
          </button>
          <button 
            onClick={() => setActiveTab('learned')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'learned' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            已掌握 ({learnedList.length})
          </button>
        </div>
      </header>

      {activeTab === 'current' && (
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
             <div className="flex flex-col md:flex-row gap-4 mb-4">
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="输入场景（可选）：在书店、打电话、谈论天气..."
                  className="flex-1 px-5 py-3 border border-gray-100 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  className="md:w-32 px-5 py-3 border border-gray-100 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                >
                  {Object.values(Difficulty).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <button
                  onClick={handleGenerate}
                  disabled={loadingText}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loadingText ? <Loader2 className="animate-spin" /> : '开始生成'}
                </button>
             </div>
             <div className="flex flex-wrap gap-2">
                {PRESET_TOPICS.map(t => (
                  <button
                    key={t}
                    onClick={() => setContext(t)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${context === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {t}
                  </button>
                ))}
             </div>
          </div>

          {currentItem && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:rotate-12 transition-transform duration-500">
                      <Headphones className="w-40 h-40" />
                   </div>
                   
                   <div className="relative z-10 flex flex-col items-center">
                     <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mb-8 backdrop-blur-xl border border-white/20">
                        <Headphones className="w-10 h-10 text-white" />
                     </div>
                     <h3 className="text-xl font-bold mb-10 tracking-wide">训练：{currentItem.difficulty}</h3>
                     
                     <button
                       onClick={handlePlay}
                       disabled={loadingAudio}
                       className="bg-white text-indigo-600 w-24 h-24 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-[0_10px_40px_-10px_rgba(255,255,255,0.5)] group"
                       title={currentItem.data.audio_cache ? "播放缓存音频" : "生成并播放 AI 语音"}
                     >
                       {loadingAudio ? <Loader2 className="animate-spin w-10 h-10" /> : <Play className="w-10 h-10 ml-2 group-hover:fill-indigo-600" />}
                     </button>
                     <p className="mt-6 text-sm font-bold tracking-widest uppercase opacity-60">
                        {currentItem.data.audio_cache ? "点击播放 (已缓存)" : "点击生成对话语音"}
                     </p>
                   </div>
                </div>

                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 flex justify-between items-center">
                   <div>
                     <p className="text-sm font-bold text-slate-400 mb-1">完成状态</p>
                     <p className={`font-bold ${currentItem.status === LearningStatus.LEARNED ? 'text-emerald-500' : 'text-amber-500'}`}>
                       {currentItem.status === LearningStatus.LEARNED ? '已掌握此项' : '学习中...'}
                     </p>
                   </div>
                   <button 
                    onClick={(e) => toggleStatus(currentItem.id, e)}
                    className={`px-6 py-3 rounded-2xl font-bold transition-all ${currentItem.status === LearningStatus.LEARNED ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                   >
                     标记为已学
                   </button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-indigo-500" />
                    听力理解题
                  </h3>
                  <p className="text-xl font-medium text-slate-700 mb-8 leading-relaxed">
                    {currentItem.data.question_cn}
                  </p>
                  
                  <div className="p-6 bg-slate-50 rounded-2xl">
                    <button 
                      onClick={() => setShowAnswer(!showAnswer)}
                      className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                    >
                      {showAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showAnswer ? '隐藏参考答案' : '查看参考答案'}
                    </button>
                    {showAnswer && (
                      <p className="mt-4 text-emerald-600 font-bold text-lg animate-in slide-in-from-top-2 duration-300">
                        {currentItem.data.answer_cn}
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
                   <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-slate-900 flex items-center gap-2">
                       <Eye className="w-5 h-5 text-slate-400" />
                       原文对照
                     </h3>
                     <button 
                        onClick={() => setShowScript(!showScript)}
                        className="text-indigo-600 text-sm font-bold"
                      >
                        {showScript ? '收起原文' : '查看全文原文'}
                      </button>
                   </div>
                   
                   {showScript ? (
                     <div className="space-y-4 animate-in fade-in duration-300">
                       {scriptLinesKr.map((line, idx) => {
                         const translation = scriptLinesCn[idx];
                         return (
                           <div key={idx} className="pb-3 border-b border-gray-50 last:border-0">
                             <div className="flex justify-between items-start gap-3">
                                <p className="text-slate-700 font-medium leading-relaxed flex-1">{line}</p>
                                {translation && (
                                    <button
                                        onClick={() => toggleLineTranslation(idx)}
                                        className="flex-shrink-0 flex items-center gap-1 text-xs font-bold text-indigo-500 bg-indigo-50 hover:bg-indigo-100 px-2 py-1.5 rounded-lg transition-colors"
                                    >
                                        <Languages className="w-3 h-3" />
                                        {expandedLines[idx] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </button>
                                )}
                             </div>
                             {expandedLines[idx] && translation && (
                                <div className="mt-2 p-3 bg-slate-50 text-slate-500 rounded-xl text-sm leading-relaxed animate-in slide-in-from-top-1">
                                    {translation}
                                </div>
                             )}
                           </div>
                         );
                       })}
                     </div>
                   ) : (
                     <div className="py-8 border-2 border-dashed border-slate-100 rounded-2xl text-center text-slate-300 text-sm">
                       脚本已折叠，建议听过两遍后再开启。
                     </div>
                   )}
                </div>
              </div>
            </div>
          )}

          {!currentItem && !loadingText && (
            <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-gray-200">
              <ListMusic className="w-16 h-16 text-slate-100 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">输入一个感兴趣的场景，开启今日听力挑战。</p>
            </div>
          )}
        </div>
      )}

      {(activeTab === 'learning' || activeTab === 'learned') && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(activeTab === 'learning' ? learningList : learnedList).map((item) => (
            <div 
              key={item.id} 
              onClick={() => { setCurrentItem(item); setActiveTab('current'); }}
              className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <span className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase ${item.difficulty === Difficulty.BEGINNER ? 'bg-green-100 text-green-700' : item.difficulty === Difficulty.INTERMEDIATE ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {item.difficulty}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => toggleStatus(item.id, e)} className="p-2 bg-slate-100 rounded-xl hover:bg-emerald-100 hover:text-emerald-600 transition-colors">
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => confirmDelete(item.id, e)} className="p-2 bg-slate-100 rounded-xl hover:bg-red-100 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-1 leading-snug">问题：{item.data.question_cn}</h3>
              <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed mb-4 italic">“{item.data.script_kr}”</p>
              <div className="flex items-center justify-between pt-4 border-t border-gray-50 text-xs text-slate-300 font-medium">
                <div className="flex items-center gap-1">
                  <Headphones className="w-3 h-3" />
                  <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                </div>
                {item.data.audio_cache && (
                    <span className="flex items-center gap-1 text-emerald-500">
                        <CheckCircle2 className="w-3 h-3" /> 音频已缓存
                    </span>
                )}
              </div>
            </div>
          ))}
          {(activeTab === 'learning' ? learningList : learnedList).length === 0 && (
            <div className="col-span-full py-20 text-center">
              <Headphones className="w-16 h-16 text-slate-100 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">还没有相关记录，快去开启训练吧！</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Listening;