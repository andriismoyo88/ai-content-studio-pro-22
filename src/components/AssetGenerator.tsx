import { useState, useEffect, Dispatch, SetStateAction, useCallback } from "react";
import JSZip from "jszip";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import { AssetType, Duration, GeneratedAsset, GlobalConfig, StoryboardScene, RoleModelAI } from "../types";
import { 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Sparkles, 
  Loader2, 
  Download, 
  Trash2,
  Clock,
  LayoutGrid,
  FileText,
  Cpu,
  AlertCircle,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const roleModelAIs: RoleModelAI[] = ["Gemini", "OpenRouter", "MaiaRouter", "OpenAI"];
const DEFAULT_VIDEO_DURATION = 8;

interface AssetGeneratorProps {
  globalConfig: GlobalConfig;
  generatedStoryboard: StoryboardScene[];
  generatedItems: GeneratedAsset[];
  setGeneratedItems: Dispatch<SetStateAction<GeneratedAsset[]>>;
}

export default function AssetGenerator({ globalConfig, generatedStoryboard, generatedItems, setGeneratedItems }: AssetGeneratorProps) {
  const [type, setType] = useState<AssetType>("Image");
  const [modelProvider, setModelProvider] = useState<"Gemini" | "OpenRouter" | "MaiaRouter" | "OpenAI">(globalConfig.defaultProvider);
  const [ratio, setRatio] = useState<"16:9" | "9:16" | "1:1" | "4:3">(globalConfig.defaultAspectRatio as any || "16:9");
  const [roleModelAI, setRoleModelAI] = useState<RoleModelAI>(globalConfig.defaultProvider as any || "Gemini");
  const [prompt, setPrompt] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isRealTime, setIsRealTime] = useState(() => localStorage.getItem("ASSET_REALTIME") === "true");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem("ASSET_REALTIME", String(isRealTime));
  }, [isRealTime]);

  // Sync with global config in real-time
  useEffect(() => {
    setModelProvider(globalConfig.defaultProvider);
    setRoleModelAI(globalConfig.defaultProvider as any || "Gemini");
    if (["16:9", "9:16", "1:1", "4:3"].includes(globalConfig.defaultAspectRatio)) {
      setRatio(globalConfig.defaultAspectRatio as any);
    }
  }, [globalConfig]);

  const updateProvider = (p: "Gemini" | "OpenRouter" | "MaiaRouter" | "OpenAI") => {
    setModelProvider(p);
    setRoleModelAI(p);
  };

  // Persist prompt
  useEffect(() => {
    const savedPrompt = localStorage.getItem("ASSET_GENERATOR_PROMPT");
    if (savedPrompt) setPrompt(savedPrompt);
  }, []);

  const handlePromptChange = (val: string) => {
    setPrompt(val);
    localStorage.setItem("ASSET_GENERATOR_PROMPT", val);
  };

  const clearPrompt = () => {
    setPrompt("");
    localStorage.removeItem("ASSET_GENERATOR_PROMPT");
  };

  const importFromStoryboard = () => {
    if (generatedStoryboard.length === 0) return;
    const prompts = generatedStoryboard.map(s => s.visualPrompt).join("\n\n");
    handlePromptChange(prompts);
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");

  const generatePreview = useCallback(async (text: string) => {
    if (!isRealTime || !text.trim() || isGenerating) return;
    
    const apiKey = getApiKey(modelProvider);
    if (!apiKey) return;

    setIsPreviewLoading(true);
    try {
      const firstLine = text.split('\n')[0].trim();
      if (!firstLine) return;

      if (modelProvider === "Gemini") {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-image-preview",
          contents: { parts: [{ text: firstLine }] },
          config: {
            imageConfig: {
              aspectRatio: ratio,
              imageSize: "1K"
            }
          }
        });
        const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (imagePart?.inlineData) {
          setPreviewUrl(`data:image/png;base64,${imagePart.inlineData.data}`);
        }
      } else {
        try {
          const res = await axios.post("/api/generate-image", {
            prompt: firstLine,
            provider: modelProvider,
            apiKey,
            ratio
          });
          setPreviewUrl(res.data.url);
        } catch (apiError) {
          console.warn(`${modelProvider} preview failed, falling back to Gemini`, apiError);
          const geminiKey = getApiKey("Gemini");
          if (geminiKey) {
            const ai = new GoogleGenAI({ apiKey: geminiKey });
            const response = await ai.models.generateContent({
              model: "gemini-3.1-flash-image-preview",
              contents: { parts: [{ text: firstLine }] },
              config: { imageConfig: { aspectRatio: ratio, imageSize: "1K" } }
            });
            const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
            if (imagePart?.inlineData) {
              setPreviewUrl(`data:image/png;base64,${imagePart.inlineData.data}`);
            }
          }
        }
      }
    } catch (e) {
      console.error("Preview generation failed", e);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [isRealTime, modelProvider, ratio, isGenerating]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (prompt.trim()) {
        generatePreview(prompt);
      } else {
        setPreviewUrl(null);
      }
    }, 2000); // 2s debounce for real-time
    return () => clearTimeout(timer);
  }, [prompt, generatePreview]);

  const [apiKeys, setApiKeys] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const fetchKeys = async () => {
      try {
        const res = await fetch("/api/config/keys");
        if (res.ok) {
          const data = await res.json();
          setApiKeys(data);
        }
      } catch (e) {
        console.error("Error loading keys from server:", e);
      }
    };
    fetchKeys();
    const interval = setInterval(fetchKeys, 10000); // Sync every 10s
    return () => clearInterval(interval);
  }, []);

  const getApiKey = (provider: "Gemini" | "OpenRouter" | "MaiaRouter" | "OpenAI") => {
    const keys = apiKeys[provider];
    if (keys && Array.isArray(keys) && keys.length > 0) return keys[0].key;
    return null;
  };

  const ensureApiKey = async () => {
    if (modelProvider === "Gemini") {
      const win = window as any;
      if (win.aistudio && typeof win.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await win.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await win.aistudio.openSelectKey();
          return true;
        }
      }
    }
    return true;
  };

  const enhancePrompt = async (userPrompt: string, provider: string, apiKey: string): Promise<string> => {
    const style = globalConfig.defaultStyle;
    const systemPrompt = `
      Anda adalah Sutradara Film dan Ahli Prompt Visual.
      Tugas Anda adalah mengubah ide sederhana menjadi prompt visual yang sangat detail untuk generator ${type === "Image" ? "Gambar" : "Video"} AI.

      DETAIL TEKNIS:
      - Gaya Visual: ${style}
      - Aspect Ratio: ${ratio}
      ${type === "Video" ? `- Durasi: ${DEFAULT_VIDEO_DURATION} detik` : ""}
      ${type === "Video" ? `- Role Model AI: ${roleModelAI}` : ""}

      INSTRUKSI:
      1. Tambahkan detail tentang pencahayaan (lighting), atmosfer, tekstur, dan komposisi kamera.
      2. Pastikan prompt tetap setia pada ide asli: "${userPrompt}".
      3. Berikan output HANYA berupa prompt akhir dalam bahasa Inggris yang siap digunakan.
      4. Jangan berikan penjelasan atau teks tambahan.
    `;

    try {
      if (provider === "Gemini") {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite-preview",
          contents: { parts: [{ text: systemPrompt }] }
        });
        return response.text || userPrompt;
      } else {
        const baseUrl = provider === "Chatgpt" ? "https://api.openai.com/v1" : 
                        provider === "Flow" ? "https://openrouter.ai/api/v1" : 
                        "https://api.maiarouter.ai/v1";
        const model = provider === "Chatgpt" ? "gpt-4o-mini" : 
                      provider === "Flow" ? "google/gemini-2.0-flash-001" : 
                      "maia/gemini-2.5-flash";
        
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: systemPrompt }]
          })
        });
        const data = await response.json();
        return data.choices?.[0]?.message?.content || userPrompt;
      }
    } catch (e) {
      console.error("Enhancement failed", e);
      return userPrompt;
    }
  };

  const generateAsset = async () => {
    const promptLines = prompt.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    if (promptLines.length === 0) {
      setError("Please enter at least one prompt.");
      return;
    }

    // Refresh keys before generation
    try {
      const res = await fetch("/api/config/keys");
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data);
      }
    } catch (e) {
      console.error("Error refreshing keys:", e);
    }

    // Ensure API Key for Gemini Preview models
    if (modelProvider === "Gemini") {
      await ensureApiKey();
    }

    const apiKey = getApiKey(modelProvider);
    if (!apiKey) {
      setError(`No ${modelProvider} API Key found. Please add one in Configuration.`);
      return;
    }

    setIsGenerating(true);
    setError("");
    setProgress({ current: 0, total: promptLines.length });

    try {
      for (let i = 0; i < promptLines.length; i++) {
        const userPrompt = promptLines[i];
        setProgress(prev => ({ ...prev, current: i + 1 }));

        // AI Flow: Enhance prompt first
        setIsEnhancing(true);
        const currentPrompt = await enhancePrompt(userPrompt, modelProvider, apiKey);
        setIsEnhancing(false);

        if (modelProvider === "Gemini") {
          const ai = new GoogleGenAI({ apiKey });
          
          if (type === "Image") {
            const response = await ai.models.generateContent({
              model: "gemini-3.1-flash-image-preview",
              contents: { parts: [{ text: currentPrompt }] },
              config: {
                imageConfig: {
                  aspectRatio: ratio,
                  imageSize: "1K"
                }
              }
            });
            const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
            if (imagePart?.inlineData) {
              const imageUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
              setGeneratedItems(prev => [{ url: imageUrl, type: "Image", prompt: userPrompt, ratio }, ...prev]);
            }
          } else {
            // Real Video Generation (Gemini Enterprise / Veo)
            let operation = await ai.models.generateVideos({
              model: 'veo-3.1-lite-generate-preview',
              prompt: currentPrompt,
              config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: ratio
              }
            });

            // Poll for completion
            while (!operation.done) {
              await new Promise(resolve => setTimeout(resolve, 10000));
              operation = await ai.operations.getVideosOperation({ operation: operation });
            }

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
              const response = await fetch(downloadLink, {
                method: 'GET',
                headers: {
                  'x-goog-api-key': apiKey,
                },
              });
              
              if (!response.ok) throw new Error("Failed to download video. Status: " + response.status);
              
              const blob = await response.blob();
              const videoUrl = URL.createObjectURL(blob);
              setGeneratedItems(prev => [{ url: videoUrl, type: "Video", prompt: userPrompt, ratio }, ...prev]);
            }
          }
        } else if (modelProvider === "OpenAI" || modelProvider === "OpenRouter" || modelProvider === "MaiaRouter") {
          if (type === "Image") {
            try {
              const res = await axios.post("/api/generate-image", {
                prompt: currentPrompt,
                provider: modelProvider,
                apiKey,
                ratio
              });
              setGeneratedItems(prev => [{ url: res.data.url, type: "Image", prompt: userPrompt, ratio }, ...prev]);
            } catch (apiError) {
              console.warn(`${modelProvider} generation failed, falling back to Gemini`, apiError);
              const geminiKey = getApiKey("Gemini");
              if (!geminiKey) throw apiError;

              const ai = new GoogleGenAI({ apiKey: geminiKey });
              const response = await ai.models.generateContent({
                model: "gemini-3.1-flash-image-preview",
                contents: { parts: [{ text: currentPrompt }] },
                config: { imageConfig: { aspectRatio: ratio, imageSize: "1K" } }
              });
              const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
              if (imagePart?.inlineData) {
                const imageUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
                setGeneratedItems(prev => [{ url: imageUrl, type: "Image", prompt: userPrompt, ratio }, ...prev]);
              } else {
                throw apiError;
              }
            }
          } else {
            // Chatgpt Video Fallback (using Gemini Veo with LLM-enhanced prompt)
            const geminiKey = getApiKey("Gemini");
            if (!geminiKey) throw new Error("Chatgpt does not have a public video API. Gemini API key is required as a fallback rendering engine.");
            
            // 2. Generate with Gemini Veo
            const ai = new GoogleGenAI({ apiKey: geminiKey });
            let operation = await ai.models.generateVideos({
              model: 'veo-3.1-lite-generate-preview',
              prompt: currentPrompt,
              config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: ratio
              }
            });

            while (!operation.done) {
              await new Promise(resolve => setTimeout(resolve, 10000));
              operation = await ai.operations.getVideosOperation({ operation: operation });
            }

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
              const response = await fetch(downloadLink, {
                method: 'GET',
                headers: { 'x-goog-api-key': geminiKey },
              });
              const blob = await response.blob();
              const videoUrl = URL.createObjectURL(blob);
              setGeneratedItems(prev => [{ url: videoUrl, type: "Video", prompt: userPrompt, ratio }, ...prev]);
            }
          }
        } else {
          // Video Fallback for Router providers
          const geminiKey = getApiKey("Gemini");
            if (!geminiKey) throw new Error(`${modelProvider} does not support video. Gemini API key is required as a fallback.`);
            
            const ai = new GoogleGenAI({ apiKey: geminiKey });
            let operation = await ai.models.generateVideos({
              model: 'veo-3.1-lite-generate-preview',
              prompt: currentPrompt,
              config: { numberOfVideos: 1, resolution: '720p', aspectRatio: ratio }
            });

            while (!operation.done) {
              await new Promise(resolve => setTimeout(resolve, 10000));
              operation = await ai.operations.getVideosOperation({ operation: operation });
            }

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
              const response = await fetch(downloadLink, {
                method: 'GET',
                headers: { 'x-goog-api-key': geminiKey },
              });
              const blob = await response.blob();
              const videoUrl = URL.createObjectURL(blob);
              setGeneratedItems(prev => [{ url: videoUrl, type: "Video", prompt: userPrompt, ratio }, ...prev]);
            }
        }
        clearPrompt();
      }
    } catch (err: any) {
      console.error("Generation failed", err);
      const errorMessage = err.message || "";
      
      if (errorMessage.includes("PERMISSION_DENIED") || errorMessage.includes("caller does not have permission")) {
        setError("Permission Denied. Please ensure you have selected a valid API Key from a paid Google Cloud project with billing enabled.");
        const win = window as any;
        if (win.aistudio && typeof win.aistudio.openSelectKey === 'function') {
          win.aistudio.openSelectKey();
        }
      } else if (errorMessage.includes("Requested entity was not found")) {
        setError("Model not found or API Key issue. Re-selecting your API Key might help.");
        const win = window as any;
        if (win.aistudio && typeof win.aistudio.openSelectKey === 'function') {
          win.aistudio.openSelectKey();
        }
      } else if (errorMessage.includes("API key not valid")) {
        setError("API Key issue. Please check your keys in Settings.");
      } else if (errorMessage.includes("Quota exceeded")) {
        setError("Quota exceeded for this API Key. Try adding another key in Settings.");
      } else {
        setError("Failed to generate asset. " + (errorMessage || "Please try again."));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const clearItems = () => setGeneratedItems([]);
  
  const downloadItem = (url: string, type: AssetType, index: number) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `AI_Studio_${type}_${index + 1}_${new Date().getTime()}.${type === "Image" ? "png" : "mp4"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = async () => {
    if (generatedItems.length === 0) return;
    
    const zip = new JSZip();
    const folder = zip.folder("AI_Studio_Assets");
    
    for (let i = 0; i < generatedItems.length; i++) {
      const item = generatedItems[i];
      const fileName = `Asset_${i + 1}_${item.type}.${item.type === "Image" ? "png" : "mp4"}`;
      
      if (item.url.startsWith("data:")) {
        // Base64 image
        const base64Data = item.url.split(",")[1];
        folder?.file(fileName, base64Data, { base64: true });
      } else {
        // Blob URL for video
        try {
          const response = await fetch(item.url);
          const blob = await response.blob();
          folder?.file(fileName, blob);
        } catch (err) {
          console.error("Failed to add video to zip", err);
        }
      }
    }
    
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = `AI_Studio_Assets_All_${new Date().getTime()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Configuration Card */}
      <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Model & Ratio */}
          <div className="lg:col-span-3 space-y-8">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                AI Model Provider
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["Gemini", "OpenRouter", "MaiaRouter", "OpenAI"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => updateProvider(p)}
                    className={`py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border ${
                      modelProvider === p 
                        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20" 
                        : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${modelProvider === p ? "bg-white animate-pulse" : "bg-slate-600"}`} />
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-indigo-400" />
                Aspect Ratio
              </label>
              <div className="relative group">
                <select
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value as any)}
                  className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer font-medium text-sm"
                >
                  <option value="16:9">Landscape (16:9)</option>
                  <option value="9:16">Portrait (9:16)</option>
                  <option value="1:1">Square (1:1)</option>
                  <option value="4:3">Standard (4:3)</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-slate-300 transition-colors">
                  <LayoutGrid className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 font-mono text-center bg-slate-950/50 py-1 rounded-lg border border-slate-800/50">
                {ratio === "16:9" && "1280 × 720 px"}
                {ratio === "9:16" && "1080 × 1920 px"}
                {ratio === "1:1" && "1024 × 1024 px"}
                {ratio === "4:3" && "1024 × 768 px"}
              </p>
            </div>
          </div>

          {/* Middle Column: Type & Duration */}
          <div className="lg:col-span-3 space-y-8">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-indigo-400" />
                Asset Type
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setType("Image")}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                    type === "Image" 
                      ? "bg-blue-600/10 border-blue-500 text-blue-400 shadow-inner" 
                      : "bg-slate-800/50 border-slate-700/50 text-slate-500 hover:bg-slate-800"
                  }`}
                >
                  <ImageIcon className={`w-6 h-6 ${type === "Image" ? "animate-bounce" : ""}`} />
                  <span className="text-xs font-bold uppercase tracking-wider">Image</span>
                </button>
                <button
                  onClick={() => setType("Video")}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                    type === "Video" 
                      ? "bg-indigo-600/10 border-indigo-500 text-indigo-400 shadow-inner" 
                      : "bg-slate-800/50 border-slate-700/50 text-slate-500 hover:bg-slate-800"
                  }`}
                >
                  <VideoIcon className={`w-6 h-6 ${type === "Video" ? "animate-pulse" : ""}`} />
                  <span className="text-xs font-bold uppercase tracking-wider">Video</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                Role Model AI
              </label>
              <div className="grid grid-cols-2 gap-2">
                {roleModelAIs.map(d => (
                  <button
                    key={d}
                    onClick={() => updateProvider(d)}
                    className={`py-2.5 rounded-xl font-bold text-xs transition-all border ${
                      roleModelAI === d
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20" 
                        : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Prompt Area */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/50 p-3 rounded-2xl border border-slate-800/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Prompt</h3>
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Real-time</span>
                  <button 
                    onClick={() => setIsRealTime(!isRealTime)}
                    className={`w-8 h-4 rounded-full relative transition-all ${isRealTime ? 'bg-blue-600' : 'bg-slate-800'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isRealTime ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
                <span className="text-[9px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">BATCH MODE</span>
              </div>
              <div className="flex items-center gap-2">
                {generatedStoryboard.length > 0 && (
                  <button 
                    onClick={importFromStoryboard}
                    className="text-[10px] font-bold text-blue-400 hover:text-blue-300 bg-blue-400/10 hover:bg-blue-400/20 px-2 py-1 rounded-lg transition-all flex items-center gap-1.5 border border-blue-500/20"
                  >
                    <FileText className="w-3 h-3" />
                    Import Storyboard
                  </button>
                )}
                {prompt && (
                  <button 
                    onClick={clearPrompt}
                    className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/20 px-2 py-1 rounded-lg transition-all border border-red-500/20"
                  >
                    Hapus
                  </button>
                )}
              </div>
            </div>
            <div className="relative group">
              <textarea
                value={prompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                placeholder="Enter multiple prompts (one per line)..."
                className="w-full min-h-[14rem] bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none shadow-inner text-sm leading-relaxed placeholder:text-slate-600"
              />
              <AnimatePresence>
                {previewUrl && isRealTime && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute bottom-4 right-4 w-32 aspect-square rounded-xl overflow-hidden border border-white/20 shadow-2xl z-10 group/preview"
                  >
                    <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={() => setGeneratedItems(prev => [{ url: previewUrl, type: "Image", prompt: prompt.split('\n')[0], ratio }, ...prev])}
                        className="p-1.5 bg-white/20 backdrop-blur-md rounded-lg text-white hover:bg-white/40 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {isPreviewLoading && (
                <div className="absolute bottom-4 right-4 w-32 aspect-square rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 flex items-center justify-center z-10">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              )}
              <div className="absolute bottom-4 right-4 pointer-events-none opacity-20 group-focus-within:opacity-40 transition-opacity">
                {!previewUrl && <Sparkles className="w-8 h-8 text-blue-400" />}
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="mt-8 pt-8 border-t border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium text-slate-500 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              {type === "Video" ? "Video generation may take several minutes." : `Images are generated in ${ratio} aspect ratio.`}
            </div>
            {isGenerating && (
              <p className="text-[10px] font-bold text-blue-400 animate-pulse uppercase tracking-widest">
                {isEnhancing ? "AI Flow: Enhancing Prompt..." : `Processing Batch ${progress.current}/${progress.total}`}
              </p>
            )}
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-3 w-full md:w-auto">
            {generatedItems.length > 0 && (
              <button
                onClick={downloadAll}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-2xl transition-all flex items-center gap-2 border border-slate-700/50"
              >
                <Download className="w-4 h-4" />
                All ({generatedItems.length})
              </button>
            )}
            <button
              onClick={clearItems}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-2xl transition-all flex items-center gap-2 border border-slate-700/50"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
            <button
              onClick={generateAsset}
              disabled={isGenerating}
              className="px-10 py-3 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-sm rounded-2xl shadow-xl shadow-blue-900/20 flex items-center justify-center gap-3 disabled:opacity-50 transition-all min-w-[200px]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Asset</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-medium flex items-center gap-3"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </motion.div>
        )}
      </div>

      {/* Grid Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout">
          {generatedItems.map((item, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-3xl overflow-hidden group relative hover:border-slate-700 transition-all shadow-xl"
            >
              <div className={`bg-slate-950 relative overflow-hidden ${item.ratio === "9:16" ? "aspect-[9/16]" : item.ratio === "1:1" ? "aspect-square" : item.ratio === "4:3" ? "aspect-[4/3]" : "aspect-video"}`}>
                {item.type === "Image" ? (
                  <img src={item.url} alt="Generated" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                ) : (
                  <video src={item.url} controls className="w-full h-full object-cover" />
                )}
                
                {/* Overlay Controls */}
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                  <button 
                    onClick={() => downloadItem(item.url, item.type, i)}
                    className="p-2.5 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-xl transition-all border border-white/10"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setGeneratedItems(prev => prev.filter((_, idx) => idx !== i))}
                    className="p-2.5 bg-red-500/10 backdrop-blur-md hover:bg-red-500/20 text-red-400 rounded-xl transition-all border border-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${item.type === "Image" ? "bg-blue-500/10 text-blue-400" : "bg-indigo-500/10 text-indigo-400"}`}>
                      {item.type === "Image" ? <ImageIcon className="w-3.5 h-3.5" /> : <VideoIcon className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.type} • {item.ratio}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 italic leading-relaxed">"{item.prompt}"</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {generatedItems.length === 0 && !isGenerating && (
          <div className="md:col-span-2 xl:col-span-3 h-80 border-2 border-dashed border-slate-800/50 rounded-3xl flex flex-col items-center justify-center text-slate-600 bg-slate-900/20">
            <div className="p-4 bg-slate-800/50 rounded-2xl mb-4">
              <LayoutGrid className="w-10 h-10 opacity-20" />
            </div>
            <p className="font-bold text-sm uppercase tracking-widest opacity-40">No assets generated yet</p>
            <p className="text-xs opacity-30 mt-2">Enter a prompt above to start creating</p>
          </div>
        )}
      </div>
    </div>
  );
}
