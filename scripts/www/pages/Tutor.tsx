
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppSettings, Difficulty, TutorCourse, ChatSession, ChatMessage } from '../types';
import { generateText, generateSpeech } from '../services/ai';
import { playPCMData } from '../utils/audioUtils';
import { MessageCircleHeart, Send, Mic, Volume2, Sparkles, ChevronLeft, Award, BookOpen, Coffee, Briefcase, Plane, MessageSquare, Loader2, Play, Trash2, User, ShoppingBag, Sun, Bus, Users, Scissors, Stethoscope, Wallet, PenTool, Home, Heart, TrendingUp, Leaf, Landmark, Cpu, Lightbulb } from 'lucide-react';

interface Props {
  settings: AppSettings;
}

const STORAGE_KEY = 'hanyu_tutor_sessions';

// --- Predefined Courses Content ---
const COURSES: TutorCourse[] = [
  // --- BEGINNER (8 Courses) ---
  {
    id: 'intro_hangul',
    title: '韩语初印象',
    description: '从零开始，了解韩语的发音特点和基本问候。',
    difficulty: Difficulty.BEGINNER,
    icon: 'BookOpen',
    systemPrompt: "You are a patient Korean teacher for beginners. Focus on teaching basic Hangul (Alphabet) concepts and very simple greetings (Annyeonghaseyo). Explain things clearly in Chinese. Use Romanization if needed. Correct the user's mistakes gently.",
    initialMessage: "你好！我是你的韩语启蒙导师。今天我们来聊聊韩语最基础的“问候”和发音。你知道“你好”用韩语怎么说吗？"
  },
  {
    id: 'self_intro',
    title: '自我介绍',
    description: '学会用简单的句子介绍自己的名字、国籍和职业。',
    difficulty: Difficulty.BEGINNER,
    icon: 'User',
    systemPrompt: "You are a friendly Korean tutor. Help the user create a basic self-introduction (Name, Nationality, Job). Use pattern '저는 ...입니다'. Keep it simple.",
    initialMessage: "初次见面！在韩语中，自我介绍是结交朋友的第一步。试着用韩语告诉我你的名字吧？(提示：我是... = 저는 ...입니다)"
  },
  {
    id: 'basic_dining',
    title: '餐厅点餐',
    description: '模拟真实的餐厅场景，学会如何点菜和结账。',
    difficulty: Difficulty.BEGINNER,
    icon: 'Coffee',
    systemPrompt: "You are a waiter at a Korean restaurant in Seoul. The user is a customer. Help them order food. Use simple polite Korean (Jondaemal). Key vocab: Menu (Menyu), Water (Mul), Delicious (Mashisseoyo).",
    initialMessage: "어서 오세요! (欢迎光临！) 这里是首尔餐厅。请问几位用餐？"
  },
  {
    id: 'shopping_basic',
    title: '超市购物',
    description: '询问价格、寻找商品，掌握基础的购物对话。',
    difficulty: Difficulty.BEGINNER,
    icon: 'ShoppingBag',
    systemPrompt: "You are a clerk at a Korean convenience store or supermarket. Help the user find items and tell them the price. Teach numbers (Sino-Korean for money).",
    initialMessage: "欢迎光临！今天想买点什么？牛奶、面包还是零食？"
  },
  {
    id: 'daily_routine',
    title: '日常生活',
    description: '聊聊起床、吃饭、睡觉的时间，学习时间表达。',
    difficulty: Difficulty.BEGINNER,
    icon: 'Sun',
    systemPrompt: "You are a Korean friend asking about the user's daily routine. Ask about time (Native Korean numbers for hours). e.g., 'When do you wake up?'",
    initialMessage: "你一般早上几点起床呢？我们来练习一下韩语的时间表达吧。"
  },
  {
    id: 'transportation',
    title: '交通出行',
    description: '乘坐地铁、公交车，询问简单的方向。',
    difficulty: Difficulty.BEGINNER,
    icon: 'Bus',
    systemPrompt: "You are a helpful stranger at a station. Help the user buy a ticket or find the subway line. Key vocab: Subway (Jihacheol), Bus (Beoseu), Station (Yeok).",
    initialMessage: "请问你要去哪里？是坐地铁还是坐公交车呢？"
  },
  {
    id: 'weather_basic',
    title: '天气季节',
    description: '谈论今天的天气，喜欢什么季节。',
    difficulty: Difficulty.BEGINNER,
    icon: 'Sun',
    systemPrompt: "You are a chatty neighbor. Talk about the weather. 'It's raining', 'It's cold'. Ask what season the user likes.",
    initialMessage: "今天天气真好啊！你喜欢什么样的天气？是晴天还是下雨天？"
  },
  {
    id: 'family_friends',
    title: '家庭朋友',
    description: '简单介绍家庭成员和朋友。',
    difficulty: Difficulty.BEGINNER,
    icon: 'Users',
    systemPrompt: "You are a curious friend. Ask about the user's family. 'Do you have siblings?', 'What does your father do?'. Teach family titles.",
    initialMessage: "我们可以聊聊你的家人吗？你有兄弟姐妹吗？"
  },

  // --- INTERMEDIATE (8 Courses) ---
  {
    id: 'travel_talk',
    title: '首尔自由行',
    description: '问路、买票、酒店入住，搞定旅游必备口语。',
    difficulty: Difficulty.INTERMEDIATE,
    icon: 'Plane',
    systemPrompt: "You are a helpful Korean local guide. The user is a tourist asking for directions or travel advice. Use natural daily conversation level Korean. Explain cultural nuances.",
    initialMessage: "你好！听说你要去首尔旅游？关于交通、景点或者住宿，有什么想问我的吗？"
  },
  {
    id: 'kdrama_chat',
    title: '韩剧闲聊',
    description: '讨论热门韩剧剧情，学习地道的流行语和情感表达。',
    difficulty: Difficulty.INTERMEDIATE,
    icon: 'MessageSquare',
    systemPrompt: "You are a K-Drama fan friend. Chat with the user about popular Korean dramas. Use some slang and emotive language (Banmal/Casual speech allowed if user agrees).",
    initialMessage: "最近有什么好看的韩剧推荐吗？我刚看完《黑暗荣耀》，太精彩了！你喜欢什么类型的剧？"
  },
  {
    id: 'hair_salon',
    title: '美容美发',
    description: '在理发店沟通发型需求，染发烫发相关用语。',
    difficulty: Difficulty.INTERMEDIATE,
    icon: 'Scissors',
    systemPrompt: "You are a hair stylist in Gangnam. Ask the user how they want their hair done. Cut, perm, or dye? Use polite service language.",
    initialMessage: "欢迎光临！今天想做什么发型？是想剪短一点，还是想换个颜色？"
  },
  {
    id: 'hospital_visit',
    title: '看病买药',
    description: '描述身体不适症状，在药店购买常备药。',
    difficulty: Difficulty.INTERMEDIATE,
    icon: 'Stethoscope',
    systemPrompt: "You are a pharmacist or doctor. Ask the user about their symptoms. 'Where does it hurt?', 'Do you have a fever?'.",
    initialMessage: "哪里不舒服吗？是头疼、肚子疼，还是感冒了？请详细告诉我症状。"
  },
  {
    id: 'bank_service',
    title: '银行办事',
    description: '开户、换钱、挂失，处理银行业务。',
    difficulty: Difficulty.INTERMEDIATE,
    icon: 'Wallet',
    systemPrompt: "You are a bank teller. Help the user open an account or exchange currency. Use formal business Korean.",
    initialMessage: "您好，请问需要办理什么业务？是换钱还是开通存折？"
  },
  {
    id: 'topik_writing',
    title: 'TOPIK写作',
    description: '针对 TOPIK II 中高级写作题型进行逻辑训练。',
    difficulty: Difficulty.INTERMEDIATE,
    icon: 'PenTool',
    systemPrompt: "You are a strict TOPIK writing tutor. Give the user a prompt (like 'Advantages of Technology'). Correct their logical flow and grammar suitable for written Korean (Haera-che).",
    initialMessage: "为了备考 TOPIK，我们来练习短文写作吧。请用韩语简单谈谈你对“网络实名制”的看法。"
  },
  {
    id: 'rent_house',
    title: '租房咨询',
    description: '咨询房租、保证金、看房预约。',
    difficulty: Difficulty.INTERMEDIATE,
    icon: 'Home',
    systemPrompt: "You are a real estate agent. Discuss room availability, deposit (Bojeung-geum), and monthly rent (Wol-se).",
    initialMessage: "您想找什么样的房子？是单间（One-room）还是公寓？预算大概是多少？"
  },
  {
    id: 'feeling_talk',
    title: '情感表达',
    description: '深入表达喜怒哀乐，倾诉烦恼与压力。',
    difficulty: Difficulty.INTERMEDIATE,
    icon: 'Heart',
    systemPrompt: "You are a close friend listening to the user's worries. Show empathy. Use expressive adjectives and reaction phrases.",
    initialMessage: "最近过得怎么样？有没有什么开心或者烦恼的事情想跟我说？"
  },

  // --- ADVANCED (8 Courses) ---
  {
    id: 'business_email',
    title: '商务职场',
    description: '学习正式的敬语体系，模拟商务邮件和会议场景。',
    difficulty: Difficulty.ADVANCED,
    icon: 'Briefcase',
    systemPrompt: "You are a senior manager. Roleplay a business scenario. Be strict about Honorifics (Keuk-jon-dae). Correct any informality immediately.",
    initialMessage: "金代理，关于明天的会议资料准备得怎么样了？在公司里，向客户汇报时要注意哪些敬语细节？"
  },
  {
    id: 'news_debate',
    title: '时事讨论',
    description: '针对社会热点进行深度对话，提升逻辑表达能力。',
    difficulty: Difficulty.ADVANCED,
    icon: 'Award',
    systemPrompt: "You are a debate moderator. Discuss current events. Use complex grammar. Challenge the user's arguments logically.",
    initialMessage: "今天我们来讨论一下‘人工智能的发展’。你认为 AI 会完全取代外语学习吗？请用韩语谈谈你的看法。"
  },
  {
    id: 'job_interview',
    title: '求职面试',
    description: '模拟高强度的企业面试，回答棘手问题。',
    difficulty: Difficulty.ADVANCED,
    icon: 'Users',
    systemPrompt: "You are an interviewer at a top Korean conglomerate (Chaebol). Ask tough questions. 'Why should we hire you?', 'What is your weakness?'. Expect formal speech.",
    initialMessage: "请先做一下自我介绍，并谈谈你为什么想加入我们就职。"
  },
  {
    id: 'economy_talk',
    title: '经济金融',
    description: '讨论股市、房价、物价等经济话题。',
    difficulty: Difficulty.ADVANCED,
    icon: 'TrendingUp',
    systemPrompt: "You are an economic analyst. Discuss inflation, stock markets, or housing prices. Use specialized vocabulary.",
    initialMessage: "最近全球物价上涨很厉害。你觉得这对年轻人的消费观念有什么影响？"
  },
  {
    id: 'env_protection',
    title: '环境保护',
    description: '探讨全球变暖、垃圾分类等环保议题。',
    difficulty: Difficulty.ADVANCED,
    icon: 'Leaf',
    systemPrompt: "You are an environmental activist. Discuss climate change, recycling, and policy. Use persuasive language.",
    initialMessage: "你平时会严格进行垃圾分类吗？对于解决全球变暖问题，你认为个人能做些什么？"
  },
  {
    id: 'history_culture',
    title: '历史文化',
    description: '深入了解韩国历史朝代与传统文化深层含义。',
    difficulty: Difficulty.ADVANCED,
    icon: 'Landmark',
    systemPrompt: "You are a historian. Discuss the Joseon Dynasty, King Sejong, or Confucianism influences on modern society.",
    initialMessage: "你知道世宗大王为什么要创造韩文吗？这对韩国历史产生了怎样的深远影响？"
  },
  {
    id: 'tech_ai',
    title: '科技前沿',
    description: '畅聊 AI、元宇宙、区块链等前沿科技。',
    difficulty: Difficulty.ADVANCED,
    icon: 'Cpu',
    systemPrompt: "You are a tech expert. Discuss the future of technology, ethics of AI, etc.",
    initialMessage: "现在的科技发展日新月异。你认为未来10年，哪项技术会最彻底地改变我们的生活？"
  },
  {
    id: 'philosophy',
    title: '哲学思辨',
    description: '探讨幸福、成功、人生的意义。',
    difficulty: Difficulty.ADVANCED,
    icon: 'Lightbulb',
    systemPrompt: "You are a philosopher. Ask deep questions about life values, happiness, and success. Encourage abstract thinking.",
    initialMessage: "对于你来说，什么是真正的‘幸福’？是物质的富足，还是精神的自由？"
  }
];

// Icon Mapping
const IconMap: Record<string, any> = {
  BookOpen, Coffee, Plane, MessageSquare, Briefcase, Award,
  User, ShoppingBag, Sun, Bus, Users, Scissors, Stethoscope, 
  Wallet, PenTool, Home, Heart, TrendingUp, Leaf, Landmark, 
  Cpu, Lightbulb
};

// --- Utils ---

const cleanMarkdownForTTS = (text: string): string => {
  let clean = text
    .replace(/\*\*(.*?)\*\*/g, '$1') 
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length > 290) {
    const truncated = clean.substring(0, 290);
    const lastPunctuation = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('?'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('？'),
      truncated.lastIndexOf('！')
    );
    
    if (lastPunctuation > 200) {
        clean = truncated.substring(0, lastPunctuation + 1);
    } else {
        clean = truncated; 
    }
  }
  
  return clean;
};

const RenderMessage = ({ content }: { content: string }) => {
  const lines = content.split('\n');
  
  return (
    <div className="space-y-1.5 break-words">
      {lines.map((line, idx) => {
        if (!line.trim()) return <div key={idx} className="h-2" />;
        const parts = line.split(/(\*\*.*?\*\*)/g);
        
        return (
          <p key={idx} className="leading-relaxed">
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
                return <span key={pIdx} className="font-bold text-indigo-700 bg-indigo-50/50 px-1 rounded mx-0.5">{part.slice(2, -2)}</span>;
              }
              return <span key={pIdx}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
};

const Tutor: React.FC<Props> = ({ settings }) => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const activeCourseId = courseId || null;

  const [sessions, setSessions] = useState<Record<string, ChatSession>>({});
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Sessions
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setSessions(JSON.parse(saved));
    }
    setSessionsLoaded(true);
  }, []);

  // Initialize Session
  useEffect(() => {
    if (sessionsLoaded && activeCourseId && !sessions[activeCourseId]) {
      const course = COURSES.find(c => c.id === activeCourseId);
      if (course) {
        setSessions(prev => ({
          ...prev,
          [activeCourseId]: {
            courseId: activeCourseId,
            messages: [{
              id: crypto.randomUUID(),
              role: 'ai',
              content: course.initialMessage,
              timestamp: Date.now()
            }],
            lastUpdated: Date.now()
          }
        }));
      }
    }
  }, [sessionsLoaded, activeCourseId, sessions]);

  // Save Sessions
  useEffect(() => {
    if (sessionsLoaded && Object.keys(sessions).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [sessions, sessionsLoaded]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, activeCourseId, loading]);

  const activeSession = activeCourseId ? sessions[activeCourseId] : null;
  const activeCourse = COURSES.find(c => c.id === activeCourseId);

  // --- Recommendation Logic ---
  const recommendedCourse = useMemo(() => {
    const sessionCounts = Object.values(sessions).reduce((acc, session: ChatSession) => {
        const course = COURSES.find(c => c.id === session.courseId);
        if (course) {
             acc[course.difficulty] = (acc[course.difficulty] || 0) + session.messages.length;
        }
        return acc;
    }, {} as Record<Difficulty, number>);

    if ((sessionCounts[Difficulty.BEGINNER] || 0) > 30) {
        if ((sessionCounts[Difficulty.INTERMEDIATE] || 0) > 40) {
            return COURSES.find(c => c.difficulty === Difficulty.ADVANCED);
        }
        return COURSES.find(c => c.difficulty === Difficulty.INTERMEDIATE);
    }
    return COURSES.find(c => c.difficulty === Difficulty.BEGINNER);
  }, [sessions]);


  const startCourse = (id: string) => {
    navigate(`/tutor/${id}`);
  };

  const handleDeleteMessage = (msgId: string) => {
      if (!activeCourseId) return;
      
      const confirmDelete = window.confirm("确定要删除这条消息吗？");
      if (!confirmDelete) return;

      setSessions(prev => {
          const currentSession = prev[activeCourseId];
          if (!currentSession) return prev;
          
          const updatedMessages = currentSession.messages.filter(m => m.id !== msgId);
          
          return {
              ...prev,
              [activeCourseId]: {
                  ...currentSession,
                  messages: updatedMessages,
                  lastUpdated: Date.now()
              }
          };
      });
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeCourseId || !activeCourse) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputText,
      timestamp: Date.now()
    };

    setSessions(prev => ({
      ...prev,
      [activeCourseId]: {
        ...prev[activeCourseId],
        messages: [...prev[activeCourseId].messages, userMsg],
        lastUpdated: Date.now()
      }
    }));
    setInputText('');
    setLoading(true);

    try {
      const history = sessions[activeCourseId].messages.slice(-10);
      const historyText = history.map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n');
      
      const systemPrompt = `${activeCourse.systemPrompt}

STRICT INSTRUCTIONS:
1. Maintain the persona.
2. If the user speaks Chinese, explain in Chinese but encourage Korean.
3. Use **bold** for key vocabulary or corrections.
4. IMPORTANT: Keep your response CONCISE (under 350 characters). Do not write extremely long paragraphs.
`;
      
      const userPromptWrapper = `
      [Conversation History]
      ${historyText}
      
      [Current Student Input]
      ${userMsg.content}
      
      Please reply as the Tutor.
      `;

      const aiResponseText = await generateText(settings, systemPrompt, userPromptWrapper, false);

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'ai',
        content: aiResponseText,
        timestamp: Date.now()
      };

      setSessions(prev => ({
        ...prev,
        [activeCourseId]: {
          ...prev[activeCourseId],
          messages: [...prev[activeCourseId].messages, aiMsg],
          lastUpdated: Date.now()
        }
      }));

    } catch (error) {
      console.error(error);
      alert("AI 响应失败，请检查网络或配置");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAudio = async (message: ChatMessage) => {
    if (audioLoadingId || playingAudioId) return;

    if (message.audio_cache) {
      setPlayingAudioId(message.id);
      try {
        await playPCMData(message.audio_cache);
      } catch (e) {
        console.error(e);
      } finally {
        setPlayingAudioId(null);
      }
      return;
    }

    if (!settings.geminiKey && !settings.qwenKey) {
        alert("请先配置 TTS API Key");
        return;
    }

    setAudioLoadingId(message.id);
    try {
      const cleanText = cleanMarkdownForTTS(message.content);
      if (!cleanText) throw new Error("Text is empty after cleaning");

      const base64 = await generateSpeech(settings, cleanText);
      
      if (activeCourseId) {
          setSessions(prev => {
              const session = prev[activeCourseId];
              const msgIndex = session.messages.findIndex(m => m.id === message.id);
              if (msgIndex === -1) return prev;
              
              const newMessages = [...session.messages];
              newMessages[msgIndex] = { ...newMessages[msgIndex], audio_cache: base64 };
              
              return {
                  ...prev,
                  [activeCourseId]: { ...session, messages: newMessages }
              };
          });
      }

      setPlayingAudioId(message.id);
      setAudioLoadingId(null);
      await playPCMData(base64);

    } catch (e) {
      console.error(e);
      alert("语音生成失败: 内容可能过长或网络错误");
    } finally {
      setAudioLoadingId(null);
      setPlayingAudioId(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!activeCourseId) {
    return (
      <div className="max-w-5xl mx-auto pb-20 animate-in fade-in duration-500">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2 flex items-center gap-2">
            <MessageCircleHeart className="w-8 h-8 text-rose-500" />
            AI 韩语导师
          </h1>
          <p className="text-slate-500">24小时待命的私教，从零基础到高阶会话，全程陪伴。</p>
        </header>

        {recommendedCourse && (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-6 md:p-8 text-white shadow-lg mb-10 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
             <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
                    <span className="font-bold text-indigo-100 uppercase tracking-wider text-xs">AI 智能推荐</span>
                </div>
                <h2 className="text-2xl font-bold mb-2">准备好挑战 "{recommendedCourse.title}" 了吗？</h2>
                <p className="text-indigo-100 text-sm max-w-lg">
                    根据您目前的学习进度，建议您尝试此课程来提升 {recommendedCourse.difficulty} 水平的对话能力。
                </p>
             </div>
             <button 
                onClick={() => startCourse(recommendedCourse.id)}
                className="relative z-10 px-6 py-3 bg-white text-indigo-600 rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform whitespace-nowrap"
             >
                立即开始
             </button>
          </div>
        )}

        <div className="space-y-10">
          {Object.values(Difficulty).map(level => {
            const levelCourses = COURSES.filter(c => c.difficulty === level);
            if (levelCourses.length === 0) return null;

            return (
              <section key={level}>
                <div className="flex items-center gap-3 mb-6">
                   <span className={`w-3 h-8 rounded-r-full ${level === Difficulty.BEGINNER ? 'bg-green-400' : level === Difficulty.INTERMEDIATE ? 'bg-amber-400' : 'bg-rose-400'}`}></span>
                   <h2 className="text-xl font-bold text-slate-800">{level} 课程 ({levelCourses.length})</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                   {levelCourses.map(course => {
                     const Icon = IconMap[course.icon] || BookOpen;
                     const session = sessions[course.id];
                     const msgCount = session?.messages.length || 0;

                     return (
                       <button
                         key={course.id}
                         onClick={() => startCourse(course.id)}
                         className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left group h-full flex flex-col"
                       >
                         <div className="flex justify-between items-start mb-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${level === Difficulty.BEGINNER ? 'bg-green-50 text-green-600' : level === Difficulty.INTERMEDIATE ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'} group-hover:scale-110 transition-transform`}>
                                <Icon className="w-6 h-6" />
                            </div>
                            {msgCount > 1 && (
                                <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full">
                                    {msgCount} 条
                                </span>
                            )}
                         </div>
                         <h3 className="text-lg font-bold text-slate-800 mb-2 truncate">{course.title}</h3>
                         <p className="text-slate-500 text-sm leading-relaxed mb-4 flex-1 line-clamp-3">{course.description}</p>
                         <div className="text-indigo-600 font-bold text-sm flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                            进入教室 <ChevronLeft className="w-4 h-4 rotate-180" />
                         </div>
                       </button>
                     );
                   })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  const Icon = activeCourse ? IconMap[activeCourse.icon] : BookOpen;

  return (
    <div className={`max-w-4xl mx-auto flex flex-col bg-white md:rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-300 ${activeCourseId ? 'h-[calc(100dvh-2rem)] md:h-[calc(100vh-80px)]' : ''}`}>
      <div className="p-4 md:p-6 border-b border-gray-100 flex items-center justify-between bg-white z-10 shrink-0">
        <div className="flex items-center gap-3">
            <button 
                onClick={() => navigate('/tutor')}
                className="p-2 -ml-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
                <ChevronLeft className="w-6 h-6" />
            </button>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeCourse?.difficulty === Difficulty.BEGINNER ? 'bg-green-50 text-green-600' : activeCourse?.difficulty === Difficulty.INTERMEDIATE ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <h2 className="font-bold text-slate-800">{activeCourse?.title}</h2>
                <span className="text-xs text-slate-400 font-medium">{activeCourse?.difficulty} • 正在对话</span>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/50 scroll-smooth">
         {activeSession?.messages.map((msg, idx) => (
            <div key={msg.id} className={`flex gap-3 group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-1">
                        <MessageCircleHeart className="w-5 h-5 text-indigo-600" />
                    </div>
                )}
                
                <div className={`max-w-[85%] md:max-w-[75%] space-y-1`}>
                    <div className={`p-4 rounded-2xl text-sm md:text-base shadow-sm relative ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-gray-100 rounded-tl-none'}`}>
                       <RenderMessage content={msg.content} />
                    </div>
                    
                    <div className={`flex items-center gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'ai' && (
                            <button
                              onClick={() => handlePlayAudio(msg)}
                              disabled={audioLoadingId === msg.id || playingAudioId === msg.id}
                              className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50 w-fit"
                            >
                               {audioLoadingId === msg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : playingAudioId === msg.id ? <Volume2 className="w-3 h-3 animate-pulse text-indigo-600" /> : <Play className="w-3 h-3 fill-current" />}
                               {msg.audio_cache ? "重听" : "朗读"}
                            </button>
                        )}
                        
                        {idx !== 0 && (
                            <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-300 hover:text-red-400 transition-all p-1"
                                title="删除此消息"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-xs font-bold text-slate-500">ME</span>
                    </div>
                )}
            </div>
         ))}
         
         {loading && (
             <div className="flex gap-3 justify-start">
                 <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <MessageCircleHeart className="w-5 h-5 text-indigo-600" />
                 </div>
                 <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-2">
                     <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                     <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
                     <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
                 </div>
             </div>
         )}
         <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-100 shrink-0">
         <div className="relative flex items-center gap-2">
            <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="输入韩语或中文开始练习..."
                className="w-full pl-5 pr-14 py-4 bg-slate-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none max-h-32 min-h-[56px] shadow-inner text-sm md:text-base"
                rows={1}
            />
            <button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
            >
                <Send className="w-4 h-4" />
            </button>
         </div>
         <p className="text-center text-xs text-slate-300 mt-2">AI 可能会产生错误，请以教材为准</p>
      </div>
    </div>
  );
};

export default Tutor;