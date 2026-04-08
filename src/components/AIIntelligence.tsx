import { useState, useEffect } from "react";
import { 
  Users,
  MessageSquare,
  DollarSign,
  Search, 
  TrendingUp, 
  Target, 
  BarChart3, 
  Download, 
  Trash2, 
  Plus, 
  ChevronRight, 
  Filter,
  Zap,
  Globe,
  Youtube,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Lightbulb,
  FileJson,
  FileText,
  Table as TableIcon,
  RefreshCw,
  X,
  Share2,
  TrendingUp as TrendingIcon,
  Award,
  Hash,
  Zap as HookIcon,
  PlayCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import axios from "axios";
import { 
  GlobalConfig, 
  KeywordForensics, 
  TrendingAnalysis
} from "../types";

import { GoogleGenAI } from "@google/genai";

type SubTab = "keywords" | "trending";
type AIProvider = "Gemini" | "OpenRouter" | "MaiaRouter" | "OpenAI";

export default function AIIntelligence({ globalConfig }: { globalConfig: GlobalConfig }) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("keywords");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(globalConfig.defaultProvider);
  const [syncWithExternal, setSyncWithExternal] = useState(true);
  
  // Data states
  const [keywords, setKeywords] = useState<KeywordForensics[]>([]);
  const [trending, setTrending] = useState<TrendingAnalysis[]>([]);
  
  // Form states
  const [keywordInput, setKeywordInput] = useState("");
  
  // Trending Form states
  const [trendingNiche, setTrendingNiche] = useState("");
  const [trendingPlatform, setTrendingPlatform] = useState<TrendingAnalysis["platform"]>("YouTube");
  const [trendingTime, setTrendingTime] = useState<TrendingAnalysis["timeRange"]>("7 HARI");
  const [trendingRegion, setTrendingRegion] = useState<TrendingAnalysis["region"]>("Indonesia");

  const [selectedKeyword, setSelectedKeyword] = useState<KeywordForensics | null>(null);
  const [selectedTrending, setSelectedTrending] = useState<TrendingAnalysis | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeSubTab !== "keywords") return;
    
    if (!keywordInput.trim()) {
      setSelectedKeyword(null);
      setIsTyping(false);
      return;
    }

    // Real-time synchronization with history
    const existing = keywords.find(k => k.keyword.toLowerCase() === keywordInput.trim().toLowerCase());
    if (existing) {
      if (!isAnalyzing && (!selectedKeyword || selectedKeyword.id !== existing.id)) {
        setSelectedKeyword(existing);
      }
    } else {
      // If no match and not currently analyzing, clear the selection to ensure UI sync
      // This ensures that if the user types something new, the old report doesn't stay visible
      if (!isAnalyzing && selectedKeyword) {
        setSelectedKeyword(null);
      }
    }

    setIsTyping(true);
    const timer = setTimeout(() => {
      setIsTyping(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [keywordInput, activeSubTab, keywords, isAnalyzing, selectedKeyword]);

  const getKeys = (provider: string) => {
    const storageKeyMap: Record<string, string> = {
      Gemini: "GEMINI_API_KEYS",
      OpenRouter: "OPENROUTER_API_KEYS",
      MaiaRouter: "MAIAROUTER_API_KEYS",
      OpenAI: "OPENAI_API_KEYS",
      YouTube: "YOUTUBE_API_KEYS",
    };
    const keyName = storageKeyMap[provider] || Object.entries(storageKeyMap).find(([k]) => k.toLowerCase() === provider.toLowerCase())?.[1];
    const saved = localStorage.getItem(keyName || "");
    if (saved) {
      try {
        const keys = JSON.parse(saved);
        return keys.map((k: any) => k.key).filter((k: string) => k && k.trim() !== "");
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const fetchData = async () => {
    try {
      const [kwRes, trendRes] = await Promise.all([
        axios.get("/api/keywords"),
        axios.get("/api/trending")
      ]);
      setKeywords(kwRes.data);
      setTrending(trendRes.data);
    } catch (err) {
      console.error("Failed to fetch AI Intelligence data", err);
    }
  };

  const parseAIJSON = (text: string) => {
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (e) {
      let cleaned = text;
      if (cleaned.includes("```json")) {
        cleaned = cleaned.split("```json")[1].split("```")[0];
      } else if (cleaned.includes("```")) {
        cleaned = cleaned.split("```")[1].split("```")[0];
      }
      cleaned = cleaned.trim();
      try {
        return JSON.parse(cleaned);
      } catch (e2) {
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
          try {
            return JSON.parse(cleaned.substring(start, end + 1));
          } catch (e3) {
            return {};
          }
        }
        return {};
      }
    }
  };

  const callGemini = async (prompt: string, keys: string[]) => {
    if (!keys || keys.length === 0) return null;
    try {
      const genAI = new GoogleGenAI({ apiKey: keys[0] });
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }]
        }
      });
      return parseAIJSON(response.text || "{}");
    } catch (e) {
      console.error("Gemini API Error:", e);
      return null;
    }
  };

  const handleKeywordAnalyze = async (inputOverride?: string) => {
    const targetKeyword = inputOverride || keywordInput;
    if (!targetKeyword.trim()) return;
    
    setIsAnalyzing(true);
    try {
      const aiKeys = getKeys(selectedProvider);
      const ytKeys = getKeys("YouTube");

      let aiData = null;
      if (selectedProvider === "Gemini" && aiKeys.length > 0) {
        const prompt = `You are a professional AI analyst for keyword and trend research. 
        TASK: Perform deep research for the keyword/niche: "${targetKeyword}".
        
        STRICT RULES:
        1. Focus ONLY on "${targetKeyword}". Do not bring context or bias from previous tasks.
        2. Treat this as a completely new and independent assignment.
        3. Provide accurate, fresh, and relevant insights based strictly on this input.
        
        Return ONLY a valid JSON object (no markdown, no backticks, no extra text) with the following structure: 
        {
          "volume": number,
          "competition": number,
          "cpc": number,
          "intent": "Informational" | "Commercial" | "Transactional",
          "cluster": "short cluster name",
          "opportunityScore": number,
          "highVolumeSearch": [
            { "keyword": "string", "score": number, "tag": "HOT" | "NEW" | "EASY" | "STABLE", "subtext": "string" }
          ],
          "marketLeaders": [
            { "name": "string", "subs": "string", "description": "string" }
          ],
          "ctrLab": { "sentiment": number, "thumbnailTips": ["string"] },
          "viralForecast": { 
            "topics": [{ "title": "string", "viralChance": number }], 
            "marketStatus": "STEADY" | "RISING" | "VOLATILE" 
          }
        }`;
        aiData = await callGemini(prompt, aiKeys);
      }

      const res = await axios.post("/api/keyword-analyze", { 
        keyword: targetKeyword,
        provider: selectedProvider,
        aiKeys,
        ytKeys,
        syncWithExternal,
        aiData // Pass pre-generated Gemini data if available
      });
      
      // Update local state but don't clear input for real-time sync
      setKeywords(prev => {
        const exists = prev.find(k => k.keyword.toLowerCase() === res.data.keyword.toLowerCase());
        if (exists) {
          return prev.map(k => k.id === exists.id ? res.data : k);
        }
        return [res.data, ...prev];
      });
      
      setSelectedKeyword(res.data); 
    } catch (err) {
      console.error("Keyword analysis failed", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const DeepAnalysisView = ({ kw }: { kw: KeywordForensics }) => {
    return (
      <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-8"
    >
      <div className="bg-[#0a0c14] border border-slate-800 rounded-[40px] overflow-hidden shadow-2xl relative">
        <div className="absolute top-8 right-8 flex items-center gap-3 z-10">
          <button 
            onClick={() => handleDownloadKeywordReport(kw)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white transition-all flex items-center gap-2 border border-blue-500/50 shadow-lg shadow-blue-600/20"
          >
            <Download className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Download Report</span>
          </button>
          <button 
            onClick={() => {
              setKeywordInput("");
              setSelectedKeyword(null);
            }}
            className="px-4 py-2 bg-slate-900/50 hover:bg-slate-800 rounded-xl text-slate-400 transition-all flex items-center gap-2 border border-slate-800/50"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span className="text-xs font-bold uppercase tracking-widest">Back to List</span>
          </button>
        </div>

        <div className="p-6 lg:p-10">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tighter uppercase italic">
                {isAnalyzing ? `Analyzing: ${keywordInput}` : `Keyword Forensics: ${kw.keyword}`}
              </h2>
              <div className="flex items-center gap-2">
                <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">
                  {isAnalyzing ? 'Synchronizing Market Intelligence...' : `Deep Intelligence Report • ${new Date(kw.createdAt).toLocaleDateString()}`}
                </p>
                {keywordInput.trim() && kw.keyword.toLowerCase() === keywordInput.trim().toLowerCase() && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">Live Synced</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {keywordInput.trim() && kw.keyword.toLowerCase() !== keywordInput.trim().toLowerCase() && !isAnalyzing && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-3xl mb-8 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest">Input Mismatch Detected</p>
                  <p className="text-[11px] text-slate-400 font-medium">Viewing report for "{kw.keyword}", but input is "{keywordInput}".</p>
                </div>
              </div>
              <button 
                onClick={() => handleKeywordAnalyze()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 rounded-xl text-black text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20"
              >
                Sync Now
              </button>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Column 1: HIGH-VOLUME SEARCH */}
            <div className="bg-[#11141d] rounded-[32px] p-6 lg:p-8 border border-slate-800/50">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <h3 className="text-sm font-black text-white uppercase tracking-widest italic">High-Volume Search</h3>
              </div>
              <div className="space-y-6">
                {kw.highVolumeSearch?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between group cursor-default">
                    <div>
                      <h4 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{item.keyword}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                          item.tag === 'HOT' ? 'bg-red-500/10 text-red-500' :
                          item.tag === 'NEW' ? 'bg-emerald-500/10 text-emerald-500' :
                          'bg-blue-500/10 text-blue-500'
                        }`}>
                          {item.tag}
                        </span>
                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter italic">LSI</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-white tracking-tighter">{item.score}</div>
                      <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{item.subtext}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: MARKET LEADERS */}
            <div className="bg-[#11141d] rounded-[32px] p-6 lg:p-8 border border-slate-800/50">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                <h3 className="text-sm font-black text-white uppercase tracking-widest italic">Market Leaders</h3>
              </div>
              <div className="space-y-6">
                {kw.marketLeaders?.map((leader, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-red-500 uppercase italic tracking-wider">{leader.name}</h4>
                      <span className="text-[10px] font-bold text-slate-500">{leader.subs}</span>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800/50 rounded-2xl p-4">
                      <p className="text-[11px] leading-relaxed text-slate-400 font-medium italic">"{leader.description}"</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 3: CTR LAB & VIRAL FORECAST */}
            <div className="space-y-8">
              {/* CTR LAB */}
              <div className="bg-[#11141d] rounded-[32px] p-6 lg:p-8 border border-slate-800/50">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" />
                  <h3 className="text-sm font-black text-white uppercase tracking-widest italic">CTR Lab</h3>
                </div>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Title Sentiment</div>
                    <div className="text-4xl font-black text-red-500 tracking-tighter italic">{kw.ctrLab?.sentiment}%</div>
                  </div>
                  <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-red-500" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Thumbnail Optimization</div>
                  {kw.ctrLab?.thumbnailTips?.map((tip, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-[10px] font-black text-red-500 italic">#{i+1}</span>
                      <p className="text-[11px] text-slate-400 font-medium leading-relaxed">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* VIRAL FORECAST */}
              <div className="bg-[#11141d] rounded-[32px] p-6 lg:p-8 border border-slate-800/50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center">
                    <Share2 className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest italic">Viral Forecast</h3>
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Recommended Topics</p>
                  </div>
                </div>
                <div className="space-y-3 mb-8">
                  {kw.viralForecast?.topics?.map((topic, i) => (
                    <div key={i} className="bg-slate-950/50 border border-slate-800/50 rounded-2xl p-4 group hover:border-red-500/30 transition-all cursor-default">
                      <h4 className="text-[10px] font-black text-slate-300 uppercase leading-tight mb-3 group-hover:text-white transition-colors">{topic.title}</h4>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-red-500/20 flex items-center justify-center">
                          <div className="w-1 h-1 bg-red-500 rounded-full animate-ping" />
                        </div>
                        <span className="text-[9px] font-black text-red-500 italic uppercase">Viral {topic.viralChance}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mb-1">Market Status</div>
                    <div className="text-lg font-black text-emerald-500 italic tracking-tighter uppercase">{kw.viralForecast?.marketStatus}</div>
                  </div>
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
    );
  };

  const TrendingResultView = ({ tr }: { tr: TrendingAnalysis }) => {
    return (
      <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-8"
    >
      <div className="bg-[#0a0c14] border border-slate-800 rounded-[40px] overflow-hidden shadow-2xl relative">
        <div className="absolute top-8 right-8 flex items-center gap-3 z-10">
          <button 
            onClick={() => handleDeleteTrending(tr.id)}
            className="p-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-500 transition-all flex items-center gap-2"
            title="Delete Analysis"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => {
              setTrendingNiche("");
              setSelectedTrending(null);
            }}
            className="px-4 py-2 bg-slate-900/50 hover:bg-slate-800 rounded-xl text-slate-400 transition-all flex items-center gap-2 border border-slate-800/50"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span className="text-xs font-bold uppercase tracking-widest">Back to List</span>
          </button>
        </div>

        <div className="p-6 lg:p-10">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <TrendingIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tighter uppercase italic">
                Trending Analysis: {tr.niche}
              </h2>
              <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">
                {tr.platform} • {tr.region} • {tr.timeRange} • {new Date(tr.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Market Leaders */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <Award className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-black text-white uppercase tracking-tight italic">🏆 Market Leaders (Top 1-7)</h3>
              </div>
              <div className="bg-[#1a1f2e]/50 rounded-3xl border border-slate-800/50 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/50 border-b border-slate-800/50">
                      <th className="p-4 text-[10px] font-black text-slate-500 uppercase">Rank</th>
                      <th className="p-4 text-[10px] font-black text-slate-500 uppercase">Channel</th>
                      <th className="p-4 text-[10px] font-black text-slate-500 uppercase">Relevance</th>
                      <th className="p-4 text-[10px] font-black text-slate-500 uppercase">Avg Views</th>
                      <th className="p-4 text-[10px] font-black text-slate-500 uppercase">Growth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tr.marketLeaders?.map((leader, i) => (
                      <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors group">
                        <td className="p-4">
                          <span className="text-xs font-black text-slate-500 group-hover:text-white transition-colors">#{leader.ranking}</span>
                        </td>
                        <td className="p-4">
                          <div className="text-xs font-bold text-white">{leader.channelName}</div>
                          <div className="text-[9px] text-slate-500 italic mt-0.5 line-clamp-1">{leader.insight}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-xs font-black text-indigo-400">{leader.nicheRelevance}%</div>
                        </td>
                        <td className="p-4">
                          <div className="text-xs font-bold text-slate-300">{leader.avgViews}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1 text-emerald-400 text-xs font-black">
                            <ArrowUpRight className="w-3 h-3" />
                            {leader.growthRate}%
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Subtopics & Viral Hooks */}
            <div className="space-y-10">
              {/* Subtopics */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Hash className="w-5 h-5 text-cyan-500" />
                  <h3 className="text-lg font-black text-white uppercase tracking-tight italic">🔍 Subtopik Trending</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {tr.subtopics?.map((sub, i) => (
                    <div key={i} className="bg-[#1a1f2e] border border-slate-800/50 rounded-2xl p-4 hover:border-cyan-500/50 transition-all group">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">{sub.title}</h4>
                        <div className="px-2 py-0.5 bg-cyan-500/10 rounded text-[9px] font-black text-cyan-500 uppercase">Score: {sub.opportunityScore}</div>
                      </div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-black">
                          <ArrowUpRight className="w-3 h-3" />
                          {sub.growth}%
                        </div>
                        <div className={`text-[10px] font-black uppercase ${
                          sub.competition === 'Low' ? 'text-emerald-500' : 
                          sub.competition === 'Medium' ? 'text-yellow-500' : 'text-red-500'
                        }`}>
                          {sub.competition} Comp
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed italic line-clamp-2">"{sub.insight}"</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Viral Hooks */}
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <HookIcon className="w-5 h-5 text-orange-500" />
                  <h3 className="text-lg font-black text-white uppercase tracking-tight italic">🚀 Viral Hooks</h3>
                </div>
                <div className="space-y-3">
                  {tr.viralHooks?.map((hook, i) => (
                    <div key={i} className="bg-gradient-to-r from-[#1a1f2e] to-transparent border-l-4 border-orange-500 p-4 rounded-r-2xl">
                      <div className="text-sm font-bold text-white mb-1">"{hook?.hook || 'N/A'}"</div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-500 font-medium italic">{hook?.effectiveness}</span>
                        <span className="px-2 py-0.5 bg-slate-800 rounded text-[8px] font-black text-slate-400 uppercase">{hook?.platform}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Content Strategy */}
          <div className="mt-12">
            <div className="flex items-center gap-3 mb-8">
              <PlayCircle className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-black text-white uppercase tracking-tight italic">🎬 Content Strategy</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-[#1a1f2e] border border-slate-800/50 rounded-3xl p-6">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Video Structure</h4>
                    <div className="space-y-4">
                      {[
                        { label: 'Hook', value: tr.contentStrategy?.structure?.hook || 'N/A', color: 'text-orange-500' },
                        { label: 'Build Up', value: tr.contentStrategy?.structure?.buildUp || 'N/A', color: 'text-yellow-500' },
                        { label: 'Climax', value: tr.contentStrategy?.structure?.climax || 'N/A', color: 'text-red-500' },
                        { label: 'CTA', value: tr.contentStrategy?.structure?.cta || 'N/A', color: 'text-emerald-500' }
                      ].map((step, i) => (
                        <div key={i} className="flex gap-4">
                          <div className={`text-xs font-black uppercase w-16 ${step.color}`}>{step.label}</div>
                          <div className="text-xs text-slate-300 flex-1">{step.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#1a1f2e] border border-slate-800/50 rounded-3xl p-6">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Content Ideas</h4>
                    <div className="space-y-3">
                      {tr.contentStrategy?.ideas?.map((idea, i) => (
                        <div key={i} className="flex gap-3 items-start">
                          <div className="w-5 h-5 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Plus className="w-3 h-3 text-emerald-500" />
                          </div>
                          <div className="text-xs text-slate-300 font-medium">{idea}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="bg-[#1a1f2e] border border-slate-800/50 rounded-3xl p-6">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Optimization Tips</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div>
                      <div className="text-[10px] font-black text-indigo-400 uppercase mb-1">Title</div>
                      <div className="text-xs text-slate-400 leading-relaxed">{tr.contentStrategy?.optimization?.title || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-indigo-400 uppercase mb-1">Thumbnail</div>
                      <div className="text-xs text-slate-400 leading-relaxed">{tr.contentStrategy?.optimization?.thumbnail || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-indigo-400 uppercase mb-1">Retention</div>
                      <div className="text-xs text-slate-400 leading-relaxed">{tr.contentStrategy?.optimization?.retention || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-3xl p-6">
                  <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Format & Duration</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Ideal Format</div>
                      <div className="text-xl font-black text-white italic uppercase tracking-tighter">{tr.contentStrategy?.format || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Ideal Duration</div>
                      <div className="text-xl font-black text-white italic uppercase tracking-tighter">{tr.contentStrategy?.duration || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Upload Frequency</div>
                      <div className="text-xl font-black text-white italic uppercase tracking-tighter">{tr.contentStrategy?.frequency || 'N/A'}</div>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleDownloadReport(tr)}
                  className="w-full py-4 bg-white hover:bg-slate-100 text-black font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-white/5 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Report
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
    );
  };

  const handleTrendingAnalyze = async () => {
    if (!trendingNiche.trim()) return;
    
    setIsAnalyzing(true);
    try {
      const aiKeys = getKeys(selectedProvider);
      const ytKeys = getKeys("YouTube");

      const res = await axios.post("/api/trending-analyze", { 
        niche: trendingNiche,
        platform: trendingPlatform,
        timeRange: trendingTime,
        region: trendingRegion,
        provider: selectedProvider,
        aiKeys,
        ytKeys
      });
      
      setTrending(prev => [res.data, ...prev]);
      setSelectedTrending(res.data);
      setTrendingNiche("");
    } catch (err) {
      console.error("Trending analysis failed", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteTrending = async (id: string) => {
    try {
      await axios.delete(`/api/trending/${id}`);
      setTrending(prev => prev.filter(t => t.id !== id));
      if (selectedTrending?.id === id) setSelectedTrending(null);
    } catch (err) {
      console.error("Failed to delete trending analysis", err);
    }
  };

  const handleDownloadReport = (tr: TrendingAnalysis) => {
    const reportContent = `
YOUTUBE TRENDING REPORT: ${tr.niche.toUpperCase()}
Platform: ${tr.platform}
Region: ${tr.region}
Time Range: ${tr.timeRange}
Date: ${new Date(tr.createdAt).toLocaleString()}

🏆 MARKET LEADERS:
${(tr.marketLeaders || []).map(l => `#${l.ranking} ${l.channelName} (${l.nicheRelevance}% Relevance)
   Views: ${l.avgViews} | Growth: ${l.growthRate}% | Engagement: ${l.engagementRate}%
   Insight: ${l.insight}`).join('\n\n')}

🔍 SUBTOPICS:
${(tr.subtopics || []).map(s => `- ${s.title} (Growth: ${s.growth}%, Score: ${s.opportunityScore})
   Competition: ${s.competition} | Insight: ${s.insight}`).join('\n\n')}

🚀 VIRAL HOOKS:
${(tr.viralHooks || []).map(h => `- "${h.hook}" (Effectiveness: ${h.effectiveness})`).join('\n')}

🎬 CONTENT STRATEGY:
Format: ${tr.contentStrategy?.format || 'N/A'}
Duration: ${tr.contentStrategy?.duration || 'N/A'}
Frequency: ${tr.contentStrategy?.frequency || 'N/A'}

Video Structure:
- Hook: ${tr.contentStrategy?.structure?.hook || 'N/A'}
- Build Up: ${tr.contentStrategy?.structure?.buildUp || 'N/A'}
- Climax: ${tr.contentStrategy?.structure?.climax || 'N/A'}
- CTA: ${tr.contentStrategy?.structure?.cta || 'N/A'}

Optimization:
- Title: ${tr.contentStrategy?.optimization?.title || 'N/A'}
- Thumbnail: ${tr.contentStrategy?.optimization?.thumbnail || 'N/A'}
- Retention: ${tr.contentStrategy?.optimization?.retention || 'N/A'}

Content Ideas:
${(tr.contentStrategy?.ideas || []).map(i => `- ${i}`).join('\n')}
    `.trim();

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `YouTube_Trending_Report_${tr.niche.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadKeywordReport = (kw: KeywordForensics) => {
    const reportContent = `
KEYWORD FORENSICS REPORT: ${kw.keyword.toUpperCase()}
Date: ${new Date(kw.createdAt).toLocaleString()}
Volume: ${kw.volume}
Opportunity Score: ${Math.round(kw.opportunityScore)}
Intent: ${kw.intent}
Cluster: ${kw.cluster}

🔥 HIGH-VOLUME SEARCH (LSI):
${(kw.highVolumeSearch || []).map(item => `- ${item.keyword} (Score: ${item.score}, Tag: ${item.tag})
   ${item.subtext}`).join('\n\n')}

🏆 MARKET LEADERS:
${(kw.marketLeaders || []).map(leader => `- ${leader.name} (${leader.subs})
   Insight: ${leader.description}`).join('\n\n')}

📊 CTR LAB:
Sentiment: ${kw.ctrLab?.sentiment}%
Thumbnail Optimization Tips:
${(kw.ctrLab?.thumbnailTips || []).map((tip, i) => `${i + 1}. ${tip}`).join('\n')}

🚀 VIRAL FORECAST:
Market Status: ${kw.viralForecast?.marketStatus || 'N/A'}
Recommended Topics:
${(kw.viralForecast?.topics || []).map(topic => `- ${topic.title} (Viral Chance: ${topic.viralChance}%)`).join('\n')}
    `.trim();

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Keyword_Forensics_Report_${kw.keyword.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (type: 'keyword', id: string) => {
    try {
      await axios.delete(`/api/data/${type}/${id}`);
      if (type === 'keyword') {
        setKeywords(prev => prev.filter(k => k.id !== id));
        if (selectedKeyword?.id === id) setSelectedKeyword(null);
      }
    } catch (err) {
      console.error(`Failed to delete ${type}:`, err);
    }
  };

  const handleExport = async (format: 'csv' | 'pdf' | 'json') => {
    try {
      const res = await axios.post("/api/export", { format, activeSubTab });
      if (res.data.success) {
        window.open(res.data.downloadUrl, '_blank');
      }
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  const filteredKeywords = keywords.filter(k => 
    k.keyword.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.cluster.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Sticky Search */}
      <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md py-4 border-b border-slate-800 -mx-4 px-4 lg:-mx-8 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2 md:pb-0">
            {(["keywords", "trending"] as SubTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveSubTab(tab);
                  setSelectedKeyword(null);
                  setSelectedTrending(null);
                }}
                className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeSubTab === tab 
                    ? "bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]" 
                    : "bg-slate-900 text-slate-400 hover:bg-slate-800"
                }`}
              >
                {tab === "keywords" && <div className="flex items-center gap-2"><Search className="w-4 h-4" /> Keyword Forensics</div>}
                {tab === "trending" && <div className="flex items-center gap-2"><TrendingIcon className="w-4 h-4" /> Trending</div>}
              </button>
            ))}
          </div>
          
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            <input 
              type="text" 
              placeholder={`Search ${activeSubTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 w-full md:w-64 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* TOOL 1: KEYWORD FORENSICS */}
          {activeSubTab === "keywords" && (
            <div className="space-y-8">
              {/* STICKY INPUT BAR */}
              <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-[32px] shadow-2xl sticky top-24 z-10">
                <div className="flex flex-col lg:flex-row items-end gap-4">
                  <div className="flex-1 w-full space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Live Keyword Forensics</label>
                    <div className="relative group">
                      <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${isAnalyzing ? 'text-blue-500 animate-pulse' : 'text-slate-600 group-focus-within:text-blue-400'}`} />
                      <input 
                        type="text" 
                        placeholder="Type a keyword for real-time deep analysis..."
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/50 transition-all font-bold text-lg"
                      />
                      {isTyping && !isAnalyzing && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                           <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                           <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                           <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="flex-1 lg:w-48 space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Intelligence Engine</label>
                      <select 
                        value={selectedProvider}
                        onChange={(e) => setSelectedProvider(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-xs font-bold text-slate-300 focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                      >
                        <option>Gemini</option>
                        <option>OpenRouter</option>
                        <option>MaiaRouter</option>
                        <option>OpenAI</option>
                      </select>
                    </div>
                    <button 
                      onClick={() => handleKeywordAnalyze(keywordInput)}
                      disabled={isAnalyzing || !keywordInput.trim()}
                      className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] h-[50px]"
                    >
                      {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      Analyze
                    </button>
                  </div>
                </div>
              </div>

              {/* RESULTS AREA */}
              <AnimatePresence mode="wait">
                {selectedKeyword || isAnalyzing ? (
                  <motion.div
                    key={selectedKeyword?.id || 'analyzing'}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="relative"
                  >
                    {/* Real-time Sync Overlay */}
                    {isAnalyzing && selectedKeyword && (
                      <div className="absolute inset-0 z-30 bg-slate-950/40 backdrop-blur-[2px] rounded-[40px] flex items-center justify-center">
                        <div className="bg-slate-900 border border-slate-800 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl">
                          <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">Updating Intelligence...</span>
                        </div>
                      </div>
                    )}

                    {selectedKeyword ? (
                      <DeepAnalysisView kw={selectedKeyword} />
                    ) : (
                      <div className="py-32 flex flex-col items-center justify-center space-y-6 bg-slate-900/50 border border-slate-800 rounded-[40px]">
                        <div className="relative">
                          <div className="w-20 h-20 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
                          <Search className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-blue-500 animate-pulse" />
                        </div>
                        <div className="text-center space-y-2">
                          <p className="text-white font-black uppercase tracking-[0.3em] text-sm">Initializing Forensics</p>
                          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Scanning market data for "{keywordInput}"</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* History Sidebar */}
                    <div className="lg:col-span-12 space-y-6">
                       <div className="flex items-center justify-between">
                         <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Analysis History</h3>
                         <div className="h-px flex-1 bg-slate-800 mx-6" />
                       </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredKeywords.map(kw => (
                            <div 
                              key={kw.id}
                              className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl cursor-pointer hover:border-blue-500/30 transition-all group relative"
                            >
                              <div 
                                className="absolute inset-0 z-0"
                                onClick={() => {
                                  setKeywordInput(kw.keyword);
                                  setSelectedKeyword(kw);
                                }}
                              />
                              <div className="flex justify-between items-start mb-4 relative z-10">
                                <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{kw.keyword}</h4>
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] font-black text-slate-600 uppercase">{new Date(kw.createdAt).toLocaleDateString()}</span>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete('keyword', kw.id);
                                    }}
                                    className="p-1.5 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between relative z-10 pointer-events-none">
                                <div className="flex items-center gap-3">
                                  <div className="text-center">
                                    <div className="text-[8px] font-bold text-slate-600 uppercase">Vol</div>
                                    <div className="text-xs font-black text-slate-300">{kw.volume > 1000 ? (kw.volume/1000).toFixed(1) + 'k' : kw.volume}</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-[8px] font-bold text-slate-600 uppercase">Score</div>
                                    <div className="text-xs font-black text-emerald-500">{Math.round(kw.opportunityScore)}</div>
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-blue-500 transition-colors" />
                              </div>
                            </div>
                          ))}
                        </div>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* TOOL 4: TRENDING */}
          {activeSubTab === "trending" && (
            <div className="space-y-8">
              {/* TRENDING INPUT BAR */}
              <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-6 rounded-[32px] shadow-2xl sticky top-24 z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                  <div className="lg:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Niche / Topic</label>
                    <div className="relative group">
                      <TrendingIcon className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${isAnalyzing ? 'text-indigo-500 animate-pulse' : 'text-slate-600 group-focus-within:text-indigo-400'}`} />
                      <input 
                        type="text" 
                        placeholder="Enter niche (e.g. Gadget, Cooking)..."
                        value={trendingNiche}
                        onChange={(e) => setTrendingNiche(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-white placeholder:text-slate-700 focus:outline-none focus:border-indigo-500/50 transition-all font-bold text-lg"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Platform</label>
                    <select 
                      value={trendingPlatform}
                      onChange={(e) => setTrendingPlatform(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-xs font-bold text-slate-300 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer"
                    >
                      <option>YouTube</option>
                      <option>Shorts</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Time Range</label>
                    <select 
                      value={trendingTime}
                      onChange={(e) => setTrendingTime(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-xs font-bold text-slate-300 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer"
                    >
                      <option>24 JAM</option>
                      <option>7 HARI</option>
                      <option>30 HARI</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Region</label>
                    <select 
                      value={trendingRegion}
                      onChange={(e) => setTrendingRegion(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-xs font-bold text-slate-300 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer"
                    >
                      <option>Indonesia</option>
                      <option>Global</option>
                      <option>Asia</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-slate-800/50">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">AI Engine:</label>
                      <select 
                        value={selectedProvider}
                        onChange={(e) => setSelectedProvider(e.target.value as any)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-[10px] font-black text-slate-300 focus:outline-none focus:border-indigo-500/50"
                      >
                        <option>Gemini</option>
                        <option>OpenRouter</option>
                        <option>MaiaRouter</option>
                        <option>OpenAI</option>
                      </select>
                    </div>
                  </div>
                  <button 
                    onClick={handleTrendingAnalyze}
                    disabled={isAnalyzing || !trendingNiche.trim()}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black px-10 py-4 rounded-2xl transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                  >
                    {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TrendingIcon className="w-4 h-4" />}
                    Analyze Trending
                  </button>
                </div>
              </div>

              {/* TRENDING RESULTS */}
              <AnimatePresence mode="wait">
                {selectedTrending ? (
                  <TrendingResultView tr={selectedTrending} />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {trending.length === 0 && !isAnalyzing && (
                      <div className="col-span-full py-20 text-center">
                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-800">
                          <TrendingIcon className="w-10 h-10 text-slate-700" />
                        </div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">No Trending Analysis Yet</h3>
                        <p className="text-slate-500 text-sm font-medium">Enter a niche above to start real-time trend analysis.</p>
                      </div>
                    )}
                    {trending.map((tr) => (
                      <motion.div
                        key={tr.id}
                        layoutId={tr.id}
                        className="bg-[#1a1f2e] border border-slate-800 rounded-3xl p-6 hover:border-indigo-500/50 transition-all group cursor-pointer relative overflow-hidden"
                        onClick={() => setSelectedTrending(tr)}
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-all" />
                        
                        <div className="flex justify-between items-start mb-6">
                          <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-all">
                            <TrendingIcon className="w-5 h-5 text-indigo-400" />
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTrending(tr.id);
                            }}
                            className="p-2 text-slate-600 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2 group-hover:text-indigo-400 transition-colors line-clamp-1">{tr.niche}</h3>
                        
                        <div className="flex flex-wrap gap-2 mb-6">
                          <span className="px-2 py-1 bg-slate-900 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest">{tr.platform}</span>
                          <span className="px-2 py-1 bg-slate-900 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest">{tr.region}</span>
                          <span className="px-2 py-1 bg-slate-900 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest">{tr.timeRange}</span>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="text-slate-500 uppercase tracking-widest">Market Leaders</span>
                            <span className="text-white">{tr.marketLeaders.length} Channels</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="text-slate-500 uppercase tracking-widest">Subtopics</span>
                            <span className="text-white">{tr.subtopics.length} Detected</span>
                          </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-800/50 flex items-center justify-between">
                          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{new Date(tr.createdAt).toLocaleDateString()}</span>
                          <div className="flex items-center gap-1 text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                            View Report <ChevronRight className="w-3 h-3" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Helper for trend score calculation
