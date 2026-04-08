import { useState, useEffect } from "react";
import { 
  Key, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  AlertCircle, 
  Settings as SettingsIcon,
  Cpu,
  Zap,
  Globe,
  Database,
  Youtube,
  TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GlobalConfig } from "../types";

interface ApiKeyEntry {
  id: string;
  key: string;
  addedAt: string;
}

type Provider = "Gemini" | "OpenRouter" | "MaiaRouter" | "OpenAI" | "YouTube";

const PROVIDERS: { id: Provider; name: string; icon: any; color: string; storageKey: string }[] = [
  { id: "Gemini", name: "Gemini AI", icon: Zap, color: "text-blue-400", storageKey: "GEMINI_API_KEYS" },
  { id: "OpenRouter", name: "OpenRouter AI", icon: Globe, color: "text-emerald-400", storageKey: "OPENROUTER_API_KEYS" },
  { id: "MaiaRouter", name: "MaiaRouter", icon: Cpu, color: "text-amber-400", storageKey: "MAIAROUTER_API_KEYS" },
  { id: "OpenAI", name: "OpenAI", icon: Database, color: "text-blue-500", storageKey: "OPENAI_API_KEYS" },
  { id: "YouTube", name: "YouTube Data API", icon: Youtube, color: "text-red-500", storageKey: "YOUTUBE_API_KEYS" },
];

interface ConfigurationProps {
  globalConfig: GlobalConfig;
  setGlobalConfig: (config: GlobalConfig) => void;
}

export default function Configuration({ globalConfig, setGlobalConfig }: ConfigurationProps) {
  const [keysMap, setKeysMap] = useState<Record<Provider, ApiKeyEntry[]>>({
    Gemini: [],
    OpenRouter: [],
    MaiaRouter: [],
    OpenAI: [],
    YouTube: [],
  });
  const [inputs, setInputs] = useState<Record<Provider, string>>({
    Gemini: "",
    OpenRouter: "",
    MaiaRouter: "",
    OpenAI: "",
    YouTube: "",
  });
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const newMap = { ...keysMap };
    PROVIDERS.forEach(p => {
      const saved = localStorage.getItem(p.storageKey);
      if (saved) {
        try {
          newMap[p.id] = JSON.parse(saved);
        } catch (e) {
          console.error(`Error loading ${p.id} keys:`, e);
        }
      }
    });
    setKeysMap(newMap);
  }, []);

  const saveKeys = (provider: Provider, keys: ApiKeyEntry[]) => {
    const p = PROVIDERS.find(pr => pr.id === provider);
    if (p) {
      localStorage.setItem(p.storageKey, JSON.stringify(keys));
    }
  };

  const addKey = (provider: Provider) => {
    const val = inputs[provider].trim();
    if (!val) return;
    if (val.length > 3000) {
      setErrorMsg("Key too long (max 3000 characters)");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    if (keysMap[provider].length >= 30) {
      setErrorMsg("Maximum 30 keys allowed per provider");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }

    const newEntry: ApiKeyEntry = {
      id: crypto.randomUUID(),
      key: val,
      addedAt: new Date().toISOString(),
    };

    const updatedKeys = [newEntry, ...keysMap[provider]];
    setKeysMap(prev => ({ ...prev, [provider]: updatedKeys }));
    setInputs(prev => ({ ...prev, [provider]: "" }));
    saveKeys(provider, updatedKeys);
    
    setSuccessMsg(`Added key to ${provider}`);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const removeKey = (provider: Provider, id: string) => {
    const updatedKeys = keysMap[provider].filter(k => k.id !== id);
    setKeysMap(prev => ({ ...prev, [provider]: updatedKeys }));
    saveKeys(provider, updatedKeys);
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/50 backdrop-blur-sm p-6 rounded-3xl border border-slate-800/50 shadow-xl">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <SettingsIcon className="w-7 h-7 text-blue-500" />
            Configuration
          </h2>
          <p className="text-slate-500 mt-1 text-sm">Manage global settings and API keys for all providers</p>
        </div>
        
        <AnimatePresence>
          {(successMsg || errorMsg) && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={`px-4 py-2.5 rounded-2xl flex items-center gap-3 text-sm font-medium border ${
                successMsg 
                  ? "bg-green-500/10 border-green-500/20 text-green-400" 
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              {successMsg ? <ShieldCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {successMsg || errorMsg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {PROVIDERS.map((p) => (
          <div key={p.id} className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-3xl flex flex-col h-[520px] overflow-hidden group hover:border-slate-700 transition-all shadow-lg">
            <div className="p-6 border-b border-slate-800/50 bg-slate-900/30 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl bg-slate-800/50 ${p.color} border border-slate-700/50`}>
                  <p.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-200">{p.name}</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">
                    {keysMap[p.id].length} / 30 Keys
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="relative group">
                <input 
                  type="password"
                  value={inputs[p.id]}
                  onChange={(e) => setInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && addKey(p.id)}
                  placeholder="Paste API Key..."
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl pl-5 pr-14 py-3.5 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-700"
                />
                <button 
                  onClick={() => addKey(p.id)}
                  disabled={!inputs[p.id].trim()}
                  className="absolute right-2 top-2 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all disabled:opacity-30 shadow-lg shadow-blue-900/20"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-0 space-y-3">
              {keysMap[p.id].length > 0 ? (
                keysMap[p.id].map((entry, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={entry.id}
                    className="bg-slate-950/30 border border-slate-800/50 rounded-2xl p-4 flex items-center justify-between group/item hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                        {keysMap[p.id].length - idx}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-mono text-slate-400 truncate tracking-wider">
                          ••••••••{entry.key.slice(-6)}
                        </p>
                        <p className="text-[9px] text-slate-600 mt-1 font-bold uppercase tracking-tighter">
                          Added {new Date(entry.addedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeKey(p.id, entry.id)}
                      className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all opacity-0 group-hover/item:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                  <div className="p-4 bg-slate-800/50 rounded-2xl">
                    <Key className="w-10 h-10 text-slate-400" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">No keys added</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
