
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, matchPath } from 'react-router-dom';
import { Book, FileText, Headphones, Settings as SettingsIcon, MessageCircleHeart } from 'lucide-react';
import Vocabulary from './pages/Vocabulary';
import Reading from './pages/Reading';
import Listening from './pages/Listening';
import Tutor from './pages/Tutor';
import SettingsModal from './components/SettingsModal';
import { AppSettings, AIProvider, TTSProvider } from './types';

const defaultSettings: AppSettings = {
  geminiKey: '',
  deepseekKey: '',
  qwenKey: '',
  textProvider: AIProvider.GEMINI,
  ttsProvider: TTSProvider.GEMINI,
  geminiModel: 'gemini-3-flash-preview',
  deepseekModel: 'deepseek-chat',
  qwenTtsModel: 'qwen-tts-flash'
};

const NavBar = ({ onOpenSettings }: { onOpenSettings: () => void }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path ? "bg-indigo-50 text-indigo-600 scale-105" : "text-slate-400 hover:text-slate-600 active:scale-95";

  // Helper to check if we are in a sub-route of tutor
  const isTutorActive = location.pathname.startsWith('/tutor');

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200/50 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:static md:w-64 md:h-screen md:border-r md:border-t-0 flex md:flex-col justify-around md:justify-start md:p-6 z-40 transition-all duration-300">
      <div className="hidden md:block mb-10 px-2 pt-[env(safe-area-inset-top)]">
        <h1 className="text-2xl font-bold text-indigo-600 flex items-center gap-2">
          <span className="text-3xl">🇰🇷</span> 韩语智学
        </h1>
      </div>
      
      <Link to="/" className={`flex flex-col md:flex-row items-center md:gap-3 p-2 md:px-4 md:py-3 rounded-2xl transition-all duration-300 ${isActive('/')}`}>
        <Book className="w-6 h-6" strokeWidth={isActive('/') ? 2.5 : 2} />
        <span className="text-[10px] md:text-sm font-bold mt-1 md:mt-0">生词</span>
      </Link>
      
      <Link to="/reading" className={`flex flex-col md:flex-row items-center md:gap-3 p-2 md:px-4 md:py-3 rounded-2xl transition-all duration-300 ${isActive('/reading')}`}>
        <FileText className="w-6 h-6" strokeWidth={isActive('/reading') ? 2.5 : 2} />
        <span className="text-[10px] md:text-sm font-bold mt-1 md:mt-0">阅读</span>
      </Link>
      
      <Link to="/listening" className={`flex flex-col md:flex-row items-center md:gap-3 p-2 md:px-4 md:py-3 rounded-2xl transition-all duration-300 ${isActive('/listening')}`}>
        <Headphones className="w-6 h-6" strokeWidth={isActive('/listening') ? 2.5 : 2} />
        <span className="text-[10px] md:text-sm font-bold mt-1 md:mt-0">听力</span>
      </Link>

      <Link to="/tutor" className={`flex flex-col md:flex-row items-center md:gap-3 p-2 md:px-4 md:py-3 rounded-2xl transition-all duration-300 ${isTutorActive ? "bg-indigo-50 text-indigo-600 scale-105" : "text-slate-400 hover:text-slate-600 active:scale-95"}`}>
        <MessageCircleHeart className="w-6 h-6" strokeWidth={isTutorActive ? 2.5 : 2} />
        <span className="text-[10px] md:text-sm font-bold mt-1 md:mt-0">AI导师</span>
      </Link>

      <div className="md:mt-auto">
        <button 
          onClick={onOpenSettings}
          className="flex flex-col md:flex-row items-center md:gap-3 p-2 md:px-4 md:py-3 rounded-2xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 w-full transition-all duration-300 active:scale-95"
        >
          <SettingsIcon className="w-6 h-6" />
          <span className="text-[10px] md:text-sm font-bold mt-1 md:mt-0">设置</span>
        </button>
      </div>
    </nav>
  );
};

const Layout = ({ children, onOpenSettings }: React.PropsWithChildren<{ onOpenSettings: () => void }>) => {
  const location = useLocation();
  const isTutorChat = !!matchPath("/tutor/:courseId", location.pathname);

  return (
    <div className="flex flex-col md:flex-row h-full bg-slate-50 overflow-hidden">
      {/* Hide NavBar on mobile when in Tutor Chat */}
      <div className={`${isTutorChat ? 'hidden md:flex' : 'flex'} md:contents`}>
        <NavBar onOpenSettings={onOpenSettings} />
      </div>
      
      <main className="flex-1 overflow-y-auto h-full w-full scroll-smooth pt-[env(safe-area-inset-top)] md:pt-0">
        <div className={`p-4 md:p-8 max-w-7xl mx-auto ${isTutorChat ? 'pb-[env(safe-area-inset-bottom)] h-full' : 'pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8'}`}>
          {children}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('hanyu_settings');
    if (saved) {
      setSettings({ ...defaultSettings, ...JSON.parse(saved) });
    } else {
      setIsSettingsOpen(true);
    }
  }, []);

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('hanyu_settings', JSON.stringify(newSettings));
  };

  return (
    <HashRouter>
      <Layout onOpenSettings={() => setIsSettingsOpen(true)}>
        <Routes>
          <Route path="/" element={<Vocabulary settings={settings} />} />
          <Route path="/reading" element={<Reading settings={settings} />} />
          <Route path="/listening" element={<Listening settings={settings} />} />
          <Route path="/tutor" element={<Tutor settings={settings} />} />
          <Route path="/tutor/:courseId" element={<Tutor settings={settings} />} />
        </Routes>
      </Layout>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={saveSettings}
      />
    </HashRouter>
  );
};

export default App;