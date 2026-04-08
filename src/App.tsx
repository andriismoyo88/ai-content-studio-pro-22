import { useState, useEffect, useRef } from "react";
import { 
  LayoutDashboard, 
  FileText, 
  Image as ImageIcon, 
  Mic, 
  Music, 
  Upload, 
  Settings as SettingsIcon,
  Activity,
  Cpu,
  Database,
  Calendar,
  FileSearch,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import axios from "axios";
import { SystemStats, GeneratedAsset, VoiceOverResult, Asset, GlobalConfig, StoryboardScene } from "./types";

// Components (to be created)
import Dashboard from "./components/Dashboard";
import AssetGenerator from "./components/AssetGenerator";
import VoiceOver from "./components/VoiceOver";
import YouTubeScheduler from "./components/YouTubeScheduler";
import SummaryKeyword from "./components/SummaryKeyword";
import MediaGallery from "./components/MediaGallery";
import StoryBoardPro from "./components/StoryBoardPro";
import Settings from "./components/Settings";
import Configuration from "./components/Configuration";
import ErrorBoundary from "./components/ErrorBoundary";

type Tab = "dashboard" | "configuration" | "storyboard" | "asset" | "voice" | "summary" | "upload" | "media" | "settings";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(() => {
    const saved = localStorage.getItem("SIDEBAR_MINIMIZED");
    return saved === "true";
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [storyboardInput, setStoryboardInput] = useState(() => localStorage.getItem("STORYBOARD_INPUT") || "");
  const [generatedStoryboard, setGeneratedStoryboard] = useState<StoryboardScene[]>(() => {
    const saved = localStorage.getItem("GENERATED_STORYBOARD");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing storyboard:", e);
      }
    }
    return [];
  });

  // Results state lifted to App to persist across tab switches
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>([]);
  const [voiceOverResults, setVoiceOverResults] = useState<VoiceOverResult[]>([]);
  const [recentImports, setRecentImports] = useState<Asset[]>([]);

  // YouTube Scheduler state
  const [ytChannel, setYtChannel] = useState("Main Channel");
  const [ytTitle, setYtTitle] = useState("");
  const [ytDescription, setYtDescription] = useState("");
  const [ytTags, setYtTags] = useState("");
  const [ytScheduleDate, setYtScheduleDate] = useState("");
  const [ytScheduleTime, setYtScheduleTime] = useState("");
  const [ytVideoFile, setYtVideoFile] = useState<Asset | null>(null);
  const [ytThumbnailFile, setYtThumbnailFile] = useState<Asset | null>(null);

  // Global Configuration State
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>(() => {
    const saved = localStorage.getItem("GLOBAL_CONFIG");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing global config:", e);
      }
    }
    return {
      defaultProvider: "Gemini",
      defaultStyle: "Cinematic Realistic",
      defaultAspectRatio: "16:9",
      defaultDensity: "8 Scenes"
    };
  });

  useEffect(() => {
    localStorage.setItem("GLOBAL_CONFIG", JSON.stringify(globalConfig));
  }, [globalConfig]);

  useEffect(() => {
    localStorage.setItem("STORYBOARD_INPUT", storyboardInput);
  }, [storyboardInput]);

  useEffect(() => {
    localStorage.setItem("GENERATED_STORYBOARD", JSON.stringify(generatedStoryboard));
  }, [generatedStoryboard]);

  useEffect(() => {
    localStorage.setItem("SIDEBAR_MINIMIZED", String(isSidebarMinimized));
  }, [isSidebarMinimized]);

  const [stats, setStats] = useState<SystemStats>({
    cpuLoad: 0,
    cpuCount: 0,
    ramUsage: 0,
    totalRam: 0,
    storage: 0,
    totalStorage: 0,
    videoSchedule: 0,
    activeChannels: 0,
    queueSize: 0
  });

  const statsRef = useRef<SystemStats>(stats);
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const res = await axios.get("/api/stats");
        if (isMounted) {
          setStats(prev => {
            // Only update if data has actually changed to minimize re-renders
            if (JSON.stringify(prev) === JSON.stringify(res.data)) return prev;
            return res.data;
          });
          setIsInitialLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch stats", err);
        if (isMounted) setIsInitialLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "configuration", label: "Configuration", icon: SettingsIcon },
    { id: "summary", label: "Summary & Keyword", icon: FileSearch },
    { id: "storyboard", label: "StoryBoard Pro", icon: FileText },
    { id: "asset", label: "Asset Generator", icon: ImageIcon },
    { id: "voice", label: "Voice Over", icon: Mic },
    { id: "media", label: "Galeri Media", icon: Database },
    { id: "upload", label: "Upload & Schedule", icon: Upload },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-4 bg-blue-500/10 rounded-full flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-blue-500 animate-pulse" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Initializing Studio</h2>
        <p className="text-slate-500 text-sm animate-pulse">Loading system engine...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans overflow-hidden">
        {/* Mobile Backdrop */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside 
          className={`fixed inset-y-0 left-0 z-50 bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            ${isSidebarMinimized ? 'w-20' : 'w-72'}
          `}
        >
          <div className={`p-6 border-b border-slate-800 flex items-center justify-between h-16 shrink-0`}>
            {!isSidebarMinimized && (
              <motion.h1 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent truncate"
              >
                Content Studio Pro
              </motion.h1>
            )}
            {isSidebarMinimized && (
               <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                  <LayoutDashboard className="w-5 h-5 text-white" />
               </div>
            )}
            
            {/* Desktop Toggle Button */}
            <button 
              onClick={() => setIsSidebarMinimized(!isSidebarMinimized)}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
            >
              {isSidebarMinimized ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>

            {/* Mobile Close Button */}
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as Tab);
                  setIsMobileMenuOpen(false);
                }}
                title={isSidebarMinimized ? item.label : ""}
                className={`w-full flex items-center rounded-xl transition-all duration-200 group relative
                  ${isSidebarMinimized ? 'justify-center p-3' : 'space-x-3 px-4 py-3'}
                  ${activeTab === item.id 
                    ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"
                }`}
              >
                <item.icon className={`shrink-0 ${isSidebarMinimized ? 'w-6 h-6' : 'w-5 h-5'}`} />
                {!isSidebarMinimized && (
                  <span className="font-medium truncate">{item.label}</span>
                )}
                
                {/* Tooltip for minimized state */}
                {isSidebarMinimized && (
                  <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </button>
            ))}
          </nav>

          {/* System Quick Stats */}
          <div className={`p-4 border-t border-slate-800 space-y-4 ${isSidebarMinimized ? 'items-center' : ''}`}>
            <div className="space-y-2">
              <div className={`flex justify-between text-[10px] text-slate-500 ${isSidebarMinimized ? 'hidden' : ''}`}>
                <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</span>
                <span>{stats.cpuLoad}%</span>
              </div>
              <div className={`h-1 bg-slate-800 rounded-full overflow-hidden ${isSidebarMinimized ? 'w-8 mx-auto' : 'w-full'}`}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.cpuLoad}%` }}
                  className="h-full bg-blue-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className={`flex justify-between text-[10px] text-slate-500 ${isSidebarMinimized ? 'hidden' : ''}`}>
                <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> RAM</span>
                <span>{stats.ramUsage}%</span>
              </div>
              <div className={`h-1 bg-slate-800 rounded-full overflow-hidden ${isSidebarMinimized ? 'w-8 mx-auto' : 'w-full'}`}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.ramUsage}%` }}
                  className="h-full bg-indigo-500"
                />
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-950 h-screen overflow-hidden">
          <header className="h-16 border-b border-slate-800 flex items-center justify-between px-4 lg:px-8 bg-slate-950/50 backdrop-blur-md shrink-0 z-30">
            <div className="flex items-center space-x-4">
              {/* Mobile Toggle Button */}
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h2 className="text-lg font-semibold text-slate-200 capitalize truncate">
                {activeTab.replace("-", " ")}
              </h2>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-medium text-slate-400">System Online</span>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <ErrorBoundary>
                    {activeTab === "dashboard" && (
                      <Dashboard 
                        stats={stats} 
                        recentImports={recentImports}
                      />
                    )}
                    {activeTab === "configuration" && (
                      <Configuration 
                        globalConfig={globalConfig} 
                        setGlobalConfig={setGlobalConfig} 
                      />
                    )}
                    {activeTab === "storyboard" && (
                      <StoryBoardPro 
                        globalConfig={globalConfig} 
                        story={storyboardInput}
                        setStory={setStoryboardInput}
                        generatedStoryboard={generatedStoryboard}
                        setGeneratedStoryboard={setGeneratedStoryboard}
                      />
                    )}
                    {activeTab === "asset" && (
                      <AssetGenerator 
                        globalConfig={globalConfig}
                        generatedStoryboard={generatedStoryboard}
                        generatedItems={generatedAssets} 
                        setGeneratedItems={setGeneratedAssets} 
                      />
                    )}
                    {activeTab === "voice" && (
                      <VoiceOver 
                        audioResults={voiceOverResults} 
                        setAudioResults={setVoiceOverResults} 
                        generatedStoryboard={generatedStoryboard}
                      />
                    )}
                    {activeTab === "media" && <MediaGallery />}
                    {activeTab === "summary" && <SummaryKeyword />}
                    {activeTab === "upload" && (
                      <YouTubeScheduler 
                        videoFile={ytVideoFile}
                        thumbnailFile={ytThumbnailFile}
                        onVideoImport={() => setActiveTab("asset")}
                        onThumbnailImport={() => setActiveTab("asset")}
                        onRemoveVideo={() => setYtVideoFile(null)}
                        onRemoveThumbnail={() => setYtThumbnailFile(null)}
                      />
                    )}
                    {activeTab === "settings" && <Settings />}
                  </ErrorBoundary>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
