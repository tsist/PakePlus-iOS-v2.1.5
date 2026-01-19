import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppSettings, Difficulty, VocabularyItem, LearningStatus, SavedItem } from '../types';
import { generateText } from '../services/ai';
import ConfirmModal from '../components/ConfirmModal';
import { BookOpen, Volume2, RefreshCw, Loader2, CheckCircle2, Trash2, Trophy, BrainCircuit, ArrowRight, Play, XCircle, CheckCircle, GraduationCap, Sparkles, Coffee, AlertCircle, Signal, Layers, ChevronDown, Check } from 'lucide-react';

interface Props {
  settings: AppSettings;
}

const STORAGE_KEY = 'hanyu_vocab_items';

const PRESET_TOPICS = [
  "日常生活", "校园生活", "职场办公", "经济金融",
  "餐厅点餐", "历史文化", "交通出行", "计算机IT",
  "旅游观光", "法律常识", "看病就医", "环境保护",
  "商场购物", "自我介绍", "人际交往", "兴趣爱好",
  "心理情感", "艺术设计", "新闻媒体", "紧急求助"
];

// --- Quiz Interfaces ---
interface QuizQuestion {
  vocabItem: VocabularyItem;
  id?: string; // Existing ID for review items
  options: string[]; // 4 meaning options
  correctIndex: number;
}

interface QuizState {
  status: 'idle' | 'loading' | 'studying' | 'active' | 'summary';
  mode: 'challenge' | 'review';
  questions: QuizQuestion[];
  currentIndex: number;
  score: number;
  results: { word: string; correct: boolean; markedLearned?: boolean }[];
  selectedOption: number | null; // For UI feedback
  isAnswered: boolean;
  failedWords: string[]; // Track words that have been missed at least once
}

// --- Custom Select Component ---
interface SelectOption {
  label: string;
  value: string | number;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: SelectOption[];
  icon: React.ElementType;
  placeholder?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, icon: Icon, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full pl-11 pr-10 py-3.5 bg-slate-50 border ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-100'} rounded-2xl text-left transition-all shadow-sm hover:bg-white hover:border-indigo-200 flex items-center justify-between group`}
      >
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-600 transition-colors">
          <Icon className="w-4 h-4" />
        </div>
        <span className={`text-sm font-bold ${selectedOption ? 'text-slate-700' : 'text-slate-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className={`absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`}>
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top">
          <div className="max-h-60 overflow-y-auto py-2 custom-scrollbar">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-5 py-3 text-left text-sm font-medium flex items-center justify-between transition-colors ${
                  value === opt.value
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                }`}
              >
                {opt.label}
                {value === opt.value && <Check className="w-4 h-4 text-indigo-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Vocabulary: React.FC<Props> = ({ settings }) => {
  // Tabs: 'quiz' is the new main entry, 'generate' is the old list view
  const [activeTab, setActiveTab] = useState<'quiz' | 'generate' | 'learning' | 'learned'>('quiz');
  
  // Data
  const [savedItems, setSavedItems] = useState<SavedItem<VocabularyItem>[]>([]);
  
  // List Generation State
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.BEGINNER);
  
  // Quiz Configuration State
  const [challengeCount, setChallengeCount] = useState<number>(10);
  const [reviewCount, setReviewCount] = useState<number | 'all'>(10);
  
  const [loading, setLoading] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<string | null>(null);

  // Modal State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Quiz State
  const [quizState, setQuizState] = useState<QuizState>({
    status: 'idle',
    mode: 'challenge',
    questions: [],
    currentIndex: 0,
    score: 0,
    results: [],
    selectedOption: null,
    isAnswered: false,
    failedWords: []
  });

  // Load from storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setSavedItems(JSON.parse(saved));
    return () => window.speechSynthesis.cancel();
  }, []);

  // Save to storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedItems));
  }, [savedItems]);

  // Audio Helper
  const playAudio = (text: string, id: string | null = null) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.8;
    const voices = window.speechSynthesis.getVoices();
    const koreanVoice = voices.find(v => v.lang.includes('ko'));
    if (koreanVoice) utterance.voice = koreanVoice;

    if (id) setPlayingIndex(id);
    utterance.onend = () => setPlayingIndex(null);
    utterance.onerror = () => setPlayingIndex(null);
    window.speechSynthesis.speak(utterance);
  };

  // --- List Mode Functions (Old Generate) ---
  const handleListGenerate = async () => {
    if (!topic) return;
    setLoading(true);

    const systemPrompt = `You are an expert Korean language teacher for Chinese students. 
    Generate a JSON response containing an array of 6 vocabulary words.
    Format: [{ "word": "Korean Word", "pronunciation": "Romanization", "meaning": "Chinese Meaning", "example_kr": "Korean Sentence", "example_cn": "Chinese Sentence Translation" }]`;
    
    // Simple exclusion of very recent words to avoid immediate repeats
    const recentWords = savedItems.slice(0, 30).map(i => i.data.word).join(", ");
    const userPrompt = `Topic: ${topic}. Difficulty: ${difficulty}. Create 6 vocabulary cards. 
    Avoid these words if possible: ${recentWords}.
    Return ONLY valid JSON.`;

    try {
      const result = await generateText(settings, systemPrompt, userPrompt, true);
      const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const data: VocabularyItem[] = JSON.parse(cleanJson);
      
      const newItems: SavedItem<VocabularyItem>[] = data.map(item => ({
        id: crypto.randomUUID(),
        data: item,
        difficulty: difficulty,
        status: LearningStatus.LEARNING,
        timestamp: Date.now()
      }));

      setSavedItems(prev => [...newItems, ...prev]);
      setActiveTab('learning');
      setTopic('');
    } catch (error) {
      console.error(error);
      alert('Generation failed. Please check your API key.');
    } finally {
      setLoading(false);
    }
  };

  // --- Quiz Functions ---

  const startNewChallenge = async () => {
    if (!topic) {
      alert("请输入一个主题开始挑战！");
      return;
    }
    setQuizState(prev => ({ ...prev, status: 'loading', mode: 'challenge' }));

    // Deduplication logic: Send recent words to avoid
    const existingWords = savedItems.map(i => i.data.word).slice(0, 50).join(", ");
    const count = challengeCount;

    const systemPrompt = `You are a Korean quiz generator.
    Create ${count} multiple-choice vocabulary questions.
    Each item must have a Korean word, meaning, examples, AND 3 distinct incorrect Chinese meanings (distractors).
    Return JSON: [
      {
        "word": "Korean",
        "pronunciation": "Rom",
        "meaning": "Correct Chinese",
        "example_kr": "Ex",
        "example_cn": "Ex CN",
        "distractors": ["Wrong1", "Wrong2", "Wrong3"]
      }
    ]`;
    
    const userPrompt = `Topic: ${topic}. Difficulty: ${difficulty}. 
    DO NOT include these words: [${existingWords}].
    Return ONLY valid JSON.`;

    try {
      const result = await generateText(settings, systemPrompt, userPrompt, true);
      const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const rawData: any[] = JSON.parse(cleanJson);

      const questions: QuizQuestion[] = rawData.map((item) => {
        const options = [...item.distractors, item.meaning];
        // Shuffle options
        for (let i = options.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [options[i], options[j]] = [options[j], options[i]];
        }
        return {
          vocabItem: {
            word: item.word,
            pronunciation: item.pronunciation,
            meaning: item.meaning,
            example_kr: item.example_kr,
            example_cn: item.example_cn
          },
          options,
          correctIndex: options.indexOf(item.meaning)
        };
      });

      setQuizState({
        status: 'studying', // Start in studying mode
        mode: 'challenge',
        questions,
        currentIndex: 0,
        score: 0,
        results: [],
        selectedOption: null,
        isAnswered: false,
        failedWords: []
      });
    } catch (e) {
      console.error(e);
      alert("生成挑战失败，请重试（单次生成大量题目可能超时，请尝试减少数量）");
      setQuizState(prev => ({ ...prev, status: 'idle' }));
    }
  };

  const startReview = () => {
    const learningItems = savedItems.filter(i => i.status === LearningStatus.LEARNING);
    
    if (learningItems.length < 1) {
      alert("没有正在学习中的词汇！请先去'新词闯关'或'列表生成'积累一些词汇吧！");
      return;
    }

    // Determine how many to review
    let targetCount = 0;
    if (learningItems.length < 10) {
      targetCount = learningItems.length;
    } else {
      targetCount = reviewCount === 'all' ? learningItems.length : reviewCount;
      // Cap at actual length
      targetCount = Math.min(targetCount, learningItems.length);
    }

    const shuffled = [...learningItems].sort(() => 0.5 - Math.random()).slice(0, targetCount);

    const questions: QuizQuestion[] = shuffled.map(item => {
      // Pick 3 distractors from OTHER items in the full saved list
      const otherItems = savedItems.filter(i => i.id !== item.id);
      let distractors = otherItems
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map(i => i.data.meaning);
      
      // Fallback if we somehow don't have enough distinct items
      while (distractors.length < 3) {
        distractors.push(distractors.length % 2 === 0 ? "其他含义" : "不正确的选项");
      }

      const options = [...distractors, item.data.meaning];
      // Shuffle options
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }

      return {
        vocabItem: item.data,
        id: item.id,
        options,
        correctIndex: options.indexOf(item.data.meaning)
      };
    });

    setQuizState({
      status: 'active', // Review goes directly to active quiz
      mode: 'review',
      questions,
      currentIndex: 0,
      score: 0,
      results: [],
      selectedOption: null,
      isAnswered: false,
      failedWords: []
    });
  };

  const startQuizFromStudying = () => {
    setQuizState(prev => ({ ...prev, status: 'active' }));
  };

  const handleQuizAnswer = (optionIndex: number) => {
    if (quizState.isAnswered) return;

    const currentQ = quizState.questions[quizState.currentIndex];
    const isCorrect = optionIndex === currentQ.correctIndex;
    const wordKey = currentQ.vocabItem.word;
    
    // Play audio on answer automatically
    playAudio(wordKey);

    setQuizState(prev => {
      let newScore = prev.score;
      let newQuestions = [...prev.questions];
      const newFailedWords = [...prev.failedWords];

      if (isCorrect) {
        // Only add score if the word hasn't been missed in this session
        if (!newFailedWords.includes(wordKey)) {
          newScore += 1;
        }
      } else {
        // Wrong Answer Penalty Logic
        
        // 1. Mark as failed if not already
        if (!newFailedWords.includes(wordKey)) {
          newFailedWords.push(wordKey);
        }

        // 2. Re-queue the question to the end
        newQuestions.push({
          ...currentQ,
          // We can optionally shuffle options here if we want, keeping it simple for now
        });
      }

      return {
        ...prev,
        questions: newQuestions,
        score: newScore,
        failedWords: newFailedWords,
        selectedOption: optionIndex,
        isAnswered: true,
        results: [...prev.results, { word: wordKey, correct: isCorrect }]
      };
    });

    // Auto advance
    setTimeout(() => {
      handleNextQuestion();
    }, 2000); // Slightly longer delay to let user see "Re-queued" message
  };

  const markAsLearnedInReview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quizState.mode !== 'review' || quizState.isAnswered) return;

    const currentQ = quizState.questions[quizState.currentIndex];
    if (!currentQ.id) return;

    // Update global saved items
    setSavedItems(prev => prev.map(item => 
      item.id === currentQ.id 
        ? { ...item, status: LearningStatus.LEARNED } 
        : item
    ));

    // Treat as correct in quiz flow
    setQuizState(prev => ({
      ...prev,
      selectedOption: currentQ.correctIndex, // Show correct answer
      isAnswered: true,
      score: prev.score + 1,
      results: [...prev.results, { word: currentQ.vocabItem.word, correct: true, markedLearned: true }]
    }));

    setTimeout(() => {
      handleNextQuestion();
    }, 1200);
  };

  const handleNextQuestion = () => {
    setQuizState(prev => {
      if (prev.currentIndex >= prev.questions.length - 1) {
        return { ...prev, status: 'summary' };
      }
      return {
        ...prev,
        currentIndex: prev.currentIndex + 1,
        selectedOption: null,
        isAnswered: false
      };
    });
  };

  const finishQuiz = () => {
    // If it was a Challenge, save the new words now (only unique ones)
    if (quizState.mode === 'challenge') {
      // Since we re-queue questions, we need to filter unique words based on original generation
      const uniqueQuestions = new Map<string, QuizQuestion>();
      quizState.questions.forEach(q => uniqueQuestions.set(q.vocabItem.word, q));
      
      const newSavedItems: SavedItem<VocabularyItem>[] = Array.from(uniqueQuestions.values()).map(q => ({
        id: crypto.randomUUID(),
        data: q.vocabItem,
        difficulty: difficulty,
        status: LearningStatus.LEARNING,
        timestamp: Date.now()
      }));
      setSavedItems(prev => [...newSavedItems, ...prev]);
    }
    
    // Reset quiz
    setQuizState(prev => ({ ...prev, status: 'idle' }));
    // If challenge, maybe go to learning tab or stay? Let's stay in quiz menu
    setTopic('');
  };

  // --- Common Helpers ---
  const toggleStatus = (id: string) => {
    setSavedItems(prev => prev.map(item => 
      item.id === id 
        ? { ...item, status: item.status === LearningStatus.LEARNING ? LearningStatus.LEARNED : LearningStatus.LEARNING } 
        : item
    ));
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
  };

  const executeDelete = () => {
    if (deleteId) {
      setSavedItems(prev => prev.filter(item => item.id !== deleteId));
      setDeleteId(null);
    }
  };

  const filteredItems = useMemo(() => {
    if (activeTab === 'quiz' || activeTab === 'generate') return [];
    const status = activeTab === 'learning' ? LearningStatus.LEARNING : LearningStatus.LEARNED;
    return savedItems.filter(item => item.status === status);
  }, [savedItems, activeTab]);

  // Derived state for review
  const learningCount = savedItems.filter(i => i.status === LearningStatus.LEARNING).length;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        title="删除词汇"
        message="您确定要删除这个词汇卡片吗？此操作无法撤销。"
        isDangerous={true}
      />

      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">词汇中心</h1>
          <p className="text-slate-500">闯关记忆新词，复习巩固旧词。</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('quiz')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'quiz' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Trophy className="w-4 h-4" />
            闯关/复习
          </button>
          <button 
            onClick={() => setActiveTab('generate')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'generate' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <BookOpen className="w-4 h-4" />
            列表生成
          </button>
          <button 
            onClick={() => setActiveTab('learning')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'learning' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            学习中 ({savedItems.filter(i => i.status === LearningStatus.LEARNING).length})
          </button>
          <button 
            onClick={() => setActiveTab('learned')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'learned' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            已学习 ({savedItems.filter(i => i.status === LearningStatus.LEARNED).length})
          </button>
        </div>
      </header>

      {/* --- QUIZ TAB CONTENT --- */}
      {activeTab === 'quiz' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* 1. IDLE STATE: Selection Menu */}
          {quizState.status === 'idle' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Challenge Card */}
              <div className="bg-white rounded-3xl p-8 border border-indigo-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col h-full z-10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                <BrainCircuit className="w-12 h-12 text-indigo-600 mb-6 relative z-10" />
                <h2 className="text-2xl font-bold text-slate-900 mb-2 relative z-10">新词闯关</h2>
                <p className="text-slate-500 mb-6 relative z-10">输入感兴趣的主题，定制专属词汇挑战。先学后练，高效记忆。</p>
                
                <div className="space-y-4 relative z-20 mt-auto">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="输入主题 (例: 机场, K-pop...)"
                    className="w-full px-5 py-3.5 border border-gray-100 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                  />
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Custom Difficulty Select */}
                    <CustomSelect 
                      value={difficulty}
                      onChange={(val) => setDifficulty(val)}
                      icon={Signal}
                      options={Object.values(Difficulty).map(d => ({ label: d, value: d }))}
                    />

                    {/* Custom Count Select */}
                    <CustomSelect 
                      value={challengeCount}
                      onChange={(val) => setChallengeCount(Number(val))}
                      icon={Layers}
                      options={[10, 20, 30, 50].map(n => ({ label: `${n} 个词汇`, value: n }))}
                    />
                  </div>

                  <button 
                    onClick={startNewChallenge}
                    disabled={!topic}
                    className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-2xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 mt-2"
                  >
                    生成学习卡片 <ArrowRight className="w-4 h-4" />
                  </button>
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    {PRESET_TOPICS.slice(0,12).map(t => (
                      <button key={t} onClick={() => setTopic(t)} className="text-xs px-2.5 py-1.5 bg-slate-100 rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Review Card */}
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-8 text-white shadow-lg hover:shadow-xl transition-all group relative overflow-hidden flex flex-col h-full z-0">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                <RefreshCw className="w-12 h-12 text-white/90 mb-6 relative z-10" />
                <h2 className="text-2xl font-bold mb-2 relative z-10">旧词复习</h2>
                <p className="text-white/80 mb-6 relative z-10">从您的 "学习中" 列表随机抽取词汇进行测验。复习过程中可标记 "已掌握"。</p>
                
                <div className="relative z-10 mt-auto">
                  <div className="flex items-center justify-between mb-6 text-white/90 font-medium bg-white/10 p-4 rounded-xl backdrop-blur-sm">
                    <div className="flex flex-col">
                      <span className="text-3xl font-bold">{learningCount}</span>
                      <span className="text-xs opacity-80">待复习</span>
                    </div>

                    {learningCount >= 10 ? (
                      <div className="flex flex-col items-end">
                         <span className="text-xs opacity-80 mb-1">本次复习:</span>
                         <div className="relative">
                            <select
                              value={reviewCount}
                              onChange={(e) => setReviewCount(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                              className="bg-white/20 text-white font-bold rounded-lg pl-2 pr-6 py-1 outline-none text-sm border border-white/30 appearance-none cursor-pointer"
                            >
                              <option value={10} className="text-slate-800">10 个</option>
                              <option value={20} className="text-slate-800">20 个</option>
                              <option value={30} className="text-slate-800">30 个</option>
                              <option value={50} className="text-slate-800">50 个</option>
                              <option value="all" className="text-slate-800">全部 ({learningCount})</option>
                            </select>
                            <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                         </div>
                      </div>
                    ) : (
                      <div className="text-right">
                        <span className="text-xs opacity-80 block">词汇量不足 10 个</span>
                        <span className="text-sm font-bold">自动复习全部</span>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={startReview}
                    disabled={learningCount === 0}
                    className="w-full bg-white text-orange-600 font-bold py-3.5 rounded-2xl hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
                  >
                    开始复习 <Play className="w-4 h-4 fill-orange-600" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. LOADING STATE */}
          {quizState.status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mb-6" />
              <h3 className="text-xl font-bold text-slate-800">AI 正在为您定制课程...</h3>
              <p className="text-slate-500">正在生成 {challengeCount} 个相关词汇及其用法</p>
            </div>
          )}

          {/* 3. STUDYING STATE (NEW) */}
          {quizState.status === 'studying' && (
            <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="text-center mb-8">
                 <h2 className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2">
                   <Sparkles className="w-6 h-6 text-amber-500" />
                   学习时刻
                 </h2>
                 <p className="text-slate-500">请先学习以下 {quizState.questions.length} 个新词，准备好后开始闯关！</p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                 {quizState.questions.map((q, idx) => (
                   <div key={idx} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col group hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-indigo-50 text-indigo-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                          <h3 className="text-xl font-bold text-slate-900">{q.vocabItem.word}</h3>
                        </div>
                        <button 
                          onClick={() => playAudio(q.vocabItem.word)}
                          className="p-2 rounded-full bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm font-mono text-slate-400 mb-3">{q.vocabItem.pronunciation}</p>
                      <p className="text-lg font-bold text-indigo-600 mb-4">{q.vocabItem.meaning}</p>
                      <div className="mt-auto bg-slate-50 p-3 rounded-xl text-sm space-y-1">
                        <p className="text-slate-700">{q.vocabItem.example_kr}</p>
                        <p className="text-slate-400 text-xs">{q.vocabItem.example_cn}</p>
                      </div>
                   </div>
                 ))}
               </div>

               <div className="flex justify-center">
                 <button 
                  onClick={startQuizFromStudying}
                  className="bg-indigo-600 text-white px-10 py-4 rounded-full font-bold text-lg shadow-xl hover:bg-indigo-700 hover:scale-105 transition-all flex items-center gap-2"
                 >
                   <BrainCircuit className="w-5 h-5" />
                   我记住了，开始闯关！
                 </button>
               </div>
            </div>
          )}

          {/* 4. ACTIVE QUIZ STATE */}
          {quizState.status === 'active' && quizState.questions.length > 0 && (
            <div className="max-w-2xl mx-auto">
              <div className="mb-6 flex justify-between items-center text-sm font-medium text-slate-500">
                <span>题目 {quizState.currentIndex + 1} / {quizState.questions.length}</span>
                <span>得分: {quizState.score}</span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full h-2 bg-gray-100 rounded-full mb-8 overflow-hidden relative">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                  style={{ width: `${((quizState.currentIndex) / quizState.questions.length) * 100}%` }}
                ></div>
              </div>

              {/* Question Card */}
              <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 md:p-12 text-center mb-8 relative transition-all duration-300">
                 {/* Mark Learned Button (Only Review Mode) */}
                 {quizState.mode === 'review' && !quizState.isAnswered && (
                  <button
                    onClick={markAsLearnedInReview}
                    className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-colors"
                    title="我认识这个词，直接移入已完成"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    我已掌握
                  </button>
                )}

                <h2 className="text-4xl md:text-5xl font-bold text-slate-800 mb-4">
                  {quizState.questions[quizState.currentIndex].vocabItem.word}
                </h2>
                <div className="flex justify-center items-center gap-2 mb-8">
                  <span className="text-lg text-slate-400 font-mono">
                    {quizState.questions[quizState.currentIndex].vocabItem.pronunciation}
                  </span>
                  <button 
                    onClick={() => playAudio(quizState.questions[quizState.currentIndex].vocabItem.word)}
                    className="p-2 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {quizState.questions[quizState.currentIndex].options.map((option, idx) => {
                    let btnClass = "border-2 border-gray-100 bg-white hover:border-indigo-200 hover:bg-indigo-50 text-slate-600";
                    
                    if (quizState.isAnswered) {
                      if (idx === quizState.questions[quizState.currentIndex].correctIndex) {
                        btnClass = "border-2 border-emerald-500 bg-emerald-50 text-emerald-700 font-bold";
                      } else if (idx === quizState.selectedOption) {
                        btnClass = "border-2 border-red-500 bg-red-50 text-red-700";
                      } else {
                        btnClass = "border-gray-100 bg-gray-50 text-gray-300 opacity-50";
                      }
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleQuizAnswer(idx)}
                        disabled={quizState.isAnswered}
                        className={`p-4 rounded-xl text-lg font-medium transition-all duration-200 ${btnClass}`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>

                {/* Incorrect Warning Message */}
                {quizState.isAnswered && quizState.selectedOption !== null && quizState.selectedOption !== quizState.questions[quizState.currentIndex].correctIndex && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-full text-sm font-bold animate-in slide-in-from-top-2">
                    <AlertCircle className="w-4 h-4" />
                    答错了！该题已重新加入队尾，直到答对为止。
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. SUMMARY STATE */}
          {quizState.status === 'summary' && (
            <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-lg border border-gray-100 p-8 text-center">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-10 h-10 text-yellow-600" />
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-2">挑战完成!</h2>
              <p className="text-slate-500 mb-8">
                所有单词均已掌握。最终得分: <span className="text-indigo-600 font-bold text-xl">{quizState.score}</span> (未失误次数)
              </p>

              <div className="bg-slate-50 rounded-2xl p-4 mb-8 max-h-60 overflow-y-auto">
                {quizState.results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border-b border-gray-100 last:border-0">
                    <span className="font-bold text-slate-700">{r.word}</span>
                    <div className="flex items-center gap-2">
                      {r.markedLearned && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">直接掌握</span>}
                      {r.correct ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-red-400" />}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={finishQuiz}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                  {quizState.mode === 'challenge' ? '收入囊中 (保存)' : '返回菜单'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- OLD LIST GENERATE TAB --- */}
      {activeTab === 'generate' && (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 mb-8 max-w-2xl mx-auto text-center animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen className={`w-8 h-8 text-slate-600 ${loading ? 'animate-pulse' : ''}`} />
          </div>
          <h2 className="text-xl font-bold mb-4">批量生成词汇列表</h2>
          <div className="flex flex-col gap-4">
            <div className="space-y-2 text-left">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="输入主题，如：购物、面试、电影..."
                className="w-full px-5 py-3 border border-gray-100 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-slate-500 outline-none text-lg"
              />
              <div className="flex flex-wrap gap-2">
                {PRESET_TOPICS.map(t => (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${topic === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-3 mt-2">
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="flex-1 px-5 py-3 border border-gray-100 bg-slate-50 rounded-2xl focus:ring-2 focus:ring-slate-500 outline-none"
              >
                {Object.values(Difficulty).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <button
                onClick={handleListGenerate}
                disabled={loading || !topic}
                className="px-8 py-3 bg-slate-800 text-white rounded-xl font-bold shadow-lg hover:bg-slate-900 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'AI 正在编写...' : '生成列表'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIST VIEWS (Learning / Learned) --- */}
      {(activeTab === 'learning' || activeTab === 'learned') && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {filteredItems.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-200">
              <GraduationCap className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">暂无词汇记录，去 "闯关/复习" 看看吧！</p>
            </div>
          ) : (
            <>
              {Object.values(Difficulty).map((diff) => {
                 const itemsInDiff = filteredItems.filter(i => i.difficulty === diff);
                 if (itemsInDiff.length === 0) return null;

                 return (
                  <section key={diff}>
                    <div className="flex items-center gap-3 mb-6">
                      <span className={`w-2 h-8 rounded-full ${activeTab === 'learning' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                      <h2 className="text-xl font-bold text-slate-800">{diff}</h2>
                      <span className="text-sm font-medium px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg">{itemsInDiff.length} 个词汇</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {itemsInDiff.map((item) => (
                        <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col hover:shadow-md transition-shadow group">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-2xl font-bold text-slate-900">{item.data.word}</h3>
                                <button
                                  onClick={() => playAudio(item.data.word, item.id)}
                                  className={`p-1.5 rounded-full transition-colors ${playingIndex === item.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50'}`}
                                >
                                  <Volume2 className={`w-4 h-4 ${playingIndex === item.id ? 'animate-pulse' : ''}`} />
                                </button>
                              </div>
                              <span className="text-xs font-mono text-slate-400">{item.data.pronunciation}</span>
                            </div>
                            
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => toggleStatus(item.id)}
                                className={`p-2 rounded-lg transition-colors ${item.status === LearningStatus.LEARNED ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}
                                title={item.status === LearningStatus.LEARNED ? "标记为学习中" : "标记为已学"}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => confirmDelete(item.id)}
                                className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          
                          <p className="text-lg font-medium text-slate-800 mb-4">{item.data.meaning}</p>
                          
                          <div className="mt-auto bg-slate-50 p-3 rounded-xl space-y-1">
                            <p className="text-xs text-slate-600 italic">{item.data.example_kr}</p>
                            <p className="text-xs text-slate-400">{item.data.example_cn}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                 )
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Vocabulary;