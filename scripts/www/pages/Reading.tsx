import React, { useState, useEffect, useMemo } from 'react';
import { AppSettings, Difficulty, ArticleData, LearningStatus, SavedItem, VocabularyItem } from '../types';
import { generateText, generateSpeech } from '../services/ai';
import { playPCMData } from '../utils/audioUtils';
import ConfirmModal from '../components/ConfirmModal';
import { FileText, Loader2, Sparkles, Globe, Trash2, CheckCircle2, History, BookOpen, RefreshCw, Languages, ChevronDown, ChevronUp, Volume2, StopCircle, Highlighter } from 'lucide-react';

interface Props {
  settings: AppSettings;
}

const STORAGE_KEY = 'hanyu_reading_items';

const PRESET_TOPICS = [
  "韩国文化", "日常饮食", "流行音乐(K-POP)", "韩国旅游", 
  "节日庆典", "职场礼仪", "校园生活", "家庭关系", 
  "电影电视剧", "健康养生", "科技发展", "环境保护"
];

const Reading: React.FC<Props> = ({ settings }) => {
  const [topic, setTopic] = useState('Daily Life');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.INTERMEDIATE);
  const [savedItems, setSavedItems] = useState<SavedItem<ArticleData>[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'generate' | 'learning' | 'learned'>('generate');
  const [currentItem, setCurrentItem] = useState<SavedItem<ArticleData> | null>(null);
  
  // Highlighting State
  const [showHighlights, setShowHighlights] = useState(true);

  // Track which paragraphs have their translation expanded
  const [expandedParagraphs, setExpandedParagraphs] = useState<Record<number, boolean>>({});

  // Audio State
  const [playingPara, setPlayingPara] = useState<{index: number, type: 'local' | 'ai'} | null>(null);
  const [loadingPara, setLoadingPara] = useState<number | null>(null);

  // Modal State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setSavedItems(JSON.parse(saved));
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedItems));
    } catch (e: any) {
      console.error("Storage save failed:", e);
      if (e.name === 'QuotaExceededError') {
        console.warn("Local storage full. New audio might not persist.");
      }
    }
  }, [savedItems]);

  // Reset expanded paragraphs when switching articles
  useEffect(() => {
    setExpandedParagraphs({});
    setPlayingPara(null);
    setLoadingPara(null);
    window.speechSynthesis.cancel();
  }, [currentItem?.id]);

  const handleGenerate = async () => {
    setLoading(true);
    setExpandedParagraphs({});

    const systemPrompt = `You are a Korean content creator for language learners.
    Create a short article.
    Return JSON: {
      "title_kr": "Korean Title",
      "title_cn": "Chinese Title",
      "content_kr": "Korean paragraphs (use \\n for breaks)",
      "content_cn": "Chinese translation paragraphs (ensure paragraph count matches Korean)",
      "key_words": [{ "word": "kr", "meaning": "cn" }]
    }`;

    const userPrompt = `Write an article about "${topic}" for ${difficulty} level learners. Length: approx 150-200 words.`;

    try {
      const result = await generateText(settings, systemPrompt, userPrompt, true);
      const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const data: ArticleData = JSON.parse(cleanJson);
      
      const newItem: SavedItem<ArticleData> = {
        id: crypto.randomUUID(),
        data,
        difficulty,
        status: LearningStatus.LEARNING,
        timestamp: Date.now()
      };

      setSavedItems(prev => [newItem, ...prev]);
      setCurrentItem(newItem);
      setActiveTab('generate');
    } catch (error) {
      console.error(error);
      alert('Failed to generate article.');
    } finally {
      setLoading(false);
    }
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

  const toggleStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedItems(prev => prev.map(i => i.id === id ? { ...i, status: i.status === LearningStatus.LEARNING ? LearningStatus.LEARNED : LearningStatus.LEARNING } : i));
  };

  const handleLocalRead = (text: string, index: number) => {
    window.speechSynthesis.cancel();
    
    if (playingPara?.index === index && playingPara.type === 'local') {
      setPlayingPara(null);
      return;
    }

    setPlayingPara({ index, type: 'local' });
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.8;
    utterance.onend = () => setPlayingPara(null);
    utterance.onerror = () => setPlayingPara(null);
    window.speechSynthesis.speak(utterance);
  };

  const handleAIRead = async (text: string, index: number) => {
    if (!settings.geminiKey && !settings.qwenKey) {
        alert("请在设置中配置 AI API Key");
        return;
    }
    
    window.speechSynthesis.cancel();
    if (loadingPara !== null || playingPara !== null) return; 

    if (currentItem?.data.audio_cache && currentItem.data.audio_cache[index]) {
        setLoadingPara(index);
        try {
            setPlayingPara({ index, type: 'ai' });
            await playPCMData(currentItem.data.audio_cache[index]);
        } catch (e) {
            console.error("Play cached audio failed", e);
            alert("播放缓存音频失败");
        } finally {
            setLoadingPara(null);
            setPlayingPara(null);
        }
        return;
    }

    setLoadingPara(index);
    try {
        const audioData = await generateSpeech(settings, text);
        
        if (currentItem) {
            const updatedItem = { ...currentItem };
            if (!updatedItem.data.audio_cache) {
                updatedItem.data.audio_cache = {};
            }
            updatedItem.data.audio_cache[index] = audioData;
            
            setCurrentItem(updatedItem);
            setSavedItems(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
        }

        setLoadingPara(null);
        setPlayingPara({ index, type: 'ai' });
        await playPCMData(audioData);
    } catch (e) {
        console.error(e);
        alert("AI 语音生成失败，请检查配置和网络");
    } finally {
        setLoadingPara(null);
        setPlayingPara(null);
    }
  };

  const renderHighlightedText = (text: string, keywords: VocabularyItem[]) => {
    if (!showHighlights || !keywords || keywords.length === 0) return text;

    // Create a regex to match all keywords. Sort by length descending to match longest possible keywords first.
    const sortedKeywords = [...keywords].sort((a, b) => b.word.length - a.word.length);
    const pattern = sortedKeywords.map(kw => kw.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    
    if (!pattern) return text;

    const regex = new RegExp(`(${pattern})`, 'g');
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, i) => {
          const isMatch = keywords.some(kw => kw.word === part);
          return isMatch ? (
            <span key={i} className="bg-teal-50 text-teal-700 px-1 rounded-md font-bold border-b-2 border-teal-200/50 transition-colors hover:bg-teal-100">
              {part}
            </span>
          ) : (
            part
          );
        })}
      </>
    );
  };

  const learningList = useMemo(() => savedItems.filter(i => i.status === LearningStatus.LEARNING), [savedItems]);
  const learnedList = useMemo(() => savedItems.filter(i => i.status === LearningStatus.LEARNED), [savedItems]);

  const krParagraphs = useMemo(() => currentItem?.data.content_kr.split('\n').filter(p => p.trim()) || [], [currentItem]);
  const cnParagraphs = useMemo(() => currentItem?.data.content_cn.split('\n').filter(p => p.trim()) || [], [currentItem]);

  const toggleParagraph = (index: number) => {
    setExpandedParagraphs(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        title="删除文章"
        message="您确定要删除这篇文章吗？删除后将无法恢复。"
        isDangerous={true}
      />

      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">阅读工坊</h1>
          <p className="text-slate-500">沉浸式双语阅读，记录您的点滴进步。</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 self-start">
          <button 
            onClick={() => { setActiveTab('generate'); setCurrentItem(savedItems[0] || null); }}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'generate' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            阅读当前
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
            已学完 ({learnedList.length})
          </button>
        </div>
      </header>

      {activeTab === 'generate' && !currentItem && !loading && (
        <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center max-w-2xl mx-auto">
          <Sparkles className="w-16 h-16 text-teal-100 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-slate-800 mb-6">尚未生成文章</h2>
          <div className="space-y-4 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-slate-500 block mb-2">主题</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-5 py-3 border border-gray-100 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none mb-2"
                />
                <div className="flex flex-wrap gap-2">
                  {PRESET_TOPICS.map(t => (
                    <button
                      key={t}
                      onClick={() => setTopic(t)}
                      className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${topic === t ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-slate-500 block mb-2">难度</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  className="w-full px-5 py-3 border border-gray-100 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  {Object.values(Difficulty).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              className="w-full py-4 bg-teal-600 text-white rounded-2xl font-bold shadow-xl hover:bg-teal-700 transition-all mt-4"
            >
              生成定制阅读材料
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-teal-500 animate-spin mb-4" />
          <p className="text-slate-400 font-medium">AI 正在撰写您的韩语文章...</p>
        </div>
      )}

      {activeTab === 'generate' && currentItem && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-1 block">{currentItem.difficulty} 等级</span>
                <h2 className="text-3xl font-bold text-slate-900 leading-tight">{currentItem.data.title_kr}</h2>
                <h3 className="text-sm text-slate-400 mt-1">{currentItem.data.title_cn}</h3>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                    onClick={() => setShowHighlights(!showHighlights)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${showHighlights ? 'bg-teal-50 text-teal-600 ring-1 ring-teal-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                    title={showHighlights ? "隐藏关键词高亮" : "显示关键词高亮"}
                >
                    <Highlighter className="w-4 h-4" />
                    高亮
                </button>

                <button 
                    onClick={(e) => toggleStatus(currentItem.id, e)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${currentItem.status === LearningStatus.LEARNED ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'}`}
                >
                    <CheckCircle2 className="w-5 h-5" />
                    {currentItem.status === LearningStatus.LEARNED ? '完成' : '已学'}
                </button>
              </div>
            </div>
            
            <div className="p-8 space-y-8">
              {krParagraphs.map((para, idx) => (
                <div key={idx} className="relative group/para">
                  <p className="text-xl leading-relaxed text-slate-700 font-[400] tracking-wide whitespace-pre-line">
                    {renderHighlightedText(para, currentItem.data.key_words)}
                  </p>
                  
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        onClick={() => toggleParagraph(idx)}
                        className="flex items-center gap-1.5 text-xs font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 px-3 py-2 rounded-lg transition-all"
                      >
                        <Languages className="w-3.5 h-3.5" />
                        {expandedParagraphs[idx] ? '收起译文' : '译文'}
                        {expandedParagraphs[idx] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      <div className="w-px h-4 bg-slate-200 mx-1"></div>

                      <button
                        onClick={() => handleLocalRead(para, idx)}
                        disabled={loadingPara !== null || (playingPara !== null && (playingPara.index !== idx || playingPara.type !== 'local'))}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all ${
                            playingPara?.index === idx && playingPara.type === 'local' 
                            ? 'bg-indigo-100 text-indigo-700' 
                            : 'text-slate-500 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600'
                        }`}
                        title="本地朗读"
                      >
                        {playingPara?.index === idx && playingPara.type === 'local' ? <StopCircle className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        本地
                      </button>

                      <button
                        onClick={() => handleAIRead(para, idx)}
                        disabled={loadingPara !== null || playingPara !== null}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all ${
                            (playingPara?.index === idx && playingPara.type === 'ai') || loadingPara === idx
                            ? 'bg-rose-100 text-rose-700' 
                            : 'text-slate-500 bg-slate-50 hover:bg-rose-50 hover:text-rose-600'
                        }`}
                        title={currentItem.data.audio_cache?.[idx] ? "播放缓存语音" : "生成并播放 AI 语音"}
                      >
                        {loadingPara === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 
                         playingPara?.index === idx && playingPara.type === 'ai' ? <Sparkles className="w-3.5 h-3.5 animate-pulse" /> : 
                         <Sparkles className="w-3.5 h-3.5" />}
                        {currentItem.data.audio_cache?.[idx] ? '播放 AI' : '生成 AI'}
                      </button>
                    </div>
                    
                    {expandedParagraphs[idx] && cnParagraphs[idx] && (
                      <div className="mt-3 p-4 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 leading-relaxed text-base animate-in fade-in slide-in-from-top-1 duration-200">
                        {cnParagraphs[idx]}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-teal-500" />
                词汇速记
              </h3>
              <div className="space-y-3">
                {currentItem.data.key_words.map((kw, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-teal-50 transition-colors group">
                    <span className="font-bold text-teal-700">{kw.word}</span>
                    <span className="text-sm text-slate-500">{kw.meaning}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <button 
              onClick={() => { setCurrentItem(null); setActiveTab('generate'); }}
              className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-3xl text-slate-400 font-bold hover:border-teal-300 hover:text-teal-500 transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              换一篇读读
            </button>
          </div>
        </div>
      )}

      {(activeTab === 'learning' || activeTab === 'learned') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(activeTab === 'learning' ? learningList : learnedList).map((item) => (
            <div 
              key={item.id} 
              onClick={() => { setCurrentItem(item); setActiveTab('generate'); }}
              className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${item.difficulty === Difficulty.BEGINNER ? 'bg-green-100 text-green-700' : item.difficulty === Difficulty.INTERMEDIATE ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
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
              <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-2 leading-snug">{item.data.title_kr}</h3>
              <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed mb-4">{item.data.content_kr}</p>
              <div className="flex items-center justify-between pt-4 border-t border-gray-50 text-xs text-slate-300 font-medium">
                <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                <span>{item.data.key_words.length} 个重点词</span>
              </div>
            </div>
          ))}
          {(activeTab === 'learning' ? learningList : learnedList).length === 0 && (
            <div className="col-span-full py-20 text-center">
              <History className="w-16 h-16 text-slate-100 mx-auto mb-4" />
              <p className="text-slate-400">目前没有相关的历史记录。</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reading;