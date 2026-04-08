import { useState, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import { 
  Sparkles, 
  Copy, 
  Save, 
  Trash2, 
  Loader2, 
  AlertCircle,
  Film,
  Camera,
  Layout,
  Type as TypeIcon,
  Maximize2,
  Layers,
  Download,
  DownloadCloud,
  Languages,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StoryboardScene, GlobalConfig } from "../types";

const visualStyles = [
  "Cinematic Realistic",
  "Dark Fantasy",
  "Historical",
  "Modern Drama",
  "Epic",
  "Soft Illustration",
  "Stylized Concept Art",
  "Minimalist Storyboard Sketch"
];

const aspectRatios = ["16:9", "9:16", "1:1", "4:3", "21:9"];
const densities = Array.from({ length: 12 }, (_, i) => `${i + 4} Scenes`);

interface StoryBoardProProps {
  globalConfig: GlobalConfig;
  story: string;
  setStory: (story: string) => void;
  generatedStoryboard: StoryboardScene[];
  setGeneratedStoryboard: (scenes: StoryboardScene[]) => void;
}

export default function StoryBoardPro({ 
  globalConfig, 
  story, 
  setStory, 
  generatedStoryboard, 
  setGeneratedStoryboard 
}: StoryBoardProProps) {
  const [selectedStyle, setSelectedStyle] = useState(globalConfig.defaultStyle);
  const [aspectRatio, setAspectRatio] = useState(globalConfig.defaultAspectRatio);
  const [sceneDensity, setSceneDensity] = useState(globalConfig.defaultDensity);
  const [modelType, setModelType] = useState<"Gemini" | "OpenRouter" | "MaiaRouter" | "OpenAI">(globalConfig.defaultProvider);
  const [outputLanguage, setOutputLanguage] = useState<"Indonesian" | "English">("Indonesian");
  const [expandedScenes, setExpandedScenes] = useState<Set<number>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  // Sync with global config in real-time
  useEffect(() => {
    setSelectedStyle(globalConfig.defaultStyle);
    setAspectRatio(globalConfig.defaultAspectRatio);
    setSceneDensity(globalConfig.defaultDensity);
    setModelType(globalConfig.defaultProvider);
  }, [globalConfig]);

  const getApiKey = (type: "Gemini" | "OpenRouter" | "MaiaRouter" | "OpenAI") => {
    const storageKey = 
      type === "Gemini" ? "GEMINI_API_KEYS" : 
      type === "OpenRouter" ? "OPENROUTER_API_KEYS" :
      type === "MaiaRouter" ? "MAIAROUTER_API_KEYS" :
      "OPENAI_API_KEYS";
    const savedKeys = localStorage.getItem(storageKey);
    if (savedKeys && savedKeys !== "undefined") {
      try {
        const keys = JSON.parse(savedKeys);
        if (keys.length > 0) return keys[0].key;
      } catch (e) {
        console.error("Error parsing keys:", e);
      }
    }
    return type === "Gemini" ? process.env.GEMINI_API_KEY : null;
  };

  const generateStoryboard = async () => {
    if (!story) {
      setError("Please enter a story first.");
      return;
    }

    const apiKey = getApiKey(modelType);
    if (!apiKey) {
      setError(`No ${modelType} API Key found. Please add one in Configuration.`);
      return;
    }

    setIsGenerating(true);
    setError("");
    setGeneratedStoryboard([]); // Clear previous results to ensure a fresh start
    setExpandedScenes(new Set());

    try {
      const sceneCount = sceneDensity.split(" ")[0];
      const prompt = `
        Anda adalah AI profesional yang berperan sebagai:
        Sutradara Film + Sinematografer + Storyboard Artist.

        Tugas Anda adalah mengubah input cerita sederhana menjadi storyboard sinematik yang TERSTRUKTUR, KONSISTEN, dan REALISTIS seperti produksi film.

        IKUTI SEMUA LANGKAH DI BAWAH INI SECARA KETAT. JANGAN MELEWATKAN BAGIAN APAPUN.

        ---
        ## LANGKAH 1 — EKSPANSI CERITA
        * Kembangkan input pengguna menjadi alur cerita lengkap.
        * Struktur harus mencakup: Awal (setup), Konflik, Klimaks, Resolusi.
        * Jangan keluar dari konteks cerita asli.

        ---
        ## LANGKAH 2 — PEMBAGIAN SCENE
        Bagi cerita menjadi TEPAT ${sceneCount} scene berurutan. TIDAK BOLEH LEBIH, TIDAK BOLEH KURANG.
        SETIAP scene WAJIB memiliki: Nomor scene, Judul scene, Lokasi spesifik, Waktu (pagi/siang/sore/malam).

        ---
        ## LANGKAH 3 — DESKRIPSI NARATIF
        * Tulis deskripsi adegan dengan bahasa visual (seolah-olah terlihat di kamera).
        * Fokus pada aksi, suasana, dan kondisi karakter.

        ---
        ## LANGKAH 4 — EMOTION / MOOD
        Tentukan 1–2 mood utama yang relevan dengan adegan.

        ---
        ## LANGKAH 5 — PERENCANAAN SHOT (WAJIB SPESIFIK)
        Tentukan: Jenis shot (wide / medium / close-up), Sudut kamera (eye-level / low angle / high angle), Gerakan kamera (static / pan / dolly).

        ---
        ## LANGKAH 6 — SINEMATOGRAFI
        Tentukan: Pencahayaan (low-key / soft light / natural light / dramatic), Atmosfer (berdebu, berkabut, hangat, dingin, dll), Kedalaman (depth of field jika relevan).

        ---
        ## LANGKAH 7 — STYLE VISUAL
        Gunakan style: ${selectedStyle}. WAJIB konsisten di semua scene.

        ---
        ## LANGKAH 8 — KARAKTER
        * Gunakan karakter utama secara konsisten.

        ---
        ## LANGKAH 9 — KOMPOSISI PROMPT VISUAL
        Buat prompt gambar AI yang DETAIL dan SPESIFIK untuk aspect ratio ${aspectRatio}.

        ---
        ## FORMAT OUTPUT (WAJIB IKUTI)
        Gunakan format ini untuk SETIAP scene, pisahkan antar scene dengan "---":

        SCENE [nomor] — [jenis shot]
        JUDUL_ID: [teks indonesia]
        JUDUL_EN: [english text]
        LOKASI_ID: [teks indonesia]
        LOKASI_EN: [english text]
        WAKTU_ID: [teks indonesia]
        WAKTU_EN: [english text]
        NARASI_ID: [deskripsi visual adegan indonesia]
        NARASI_EN: [visual scene description english]
        MOOD_ID: [tag emosi indonesia]
        MOOD_EN: [emotion tag english]
        KARAKTER_ID: [nama karakter indonesia]
        KARAKTER_EN: [character name english]
        KAMERA_ID: [jenis shot, sudut, gerakan indonesia]
        KAMERA_EN: [shot type, angle, movement english]
        PROMPT VISUAL: [prompt detail untuk AI image generator]

        ---
        INPUT PENGGUNA:
        CERITA: ${story}
        STYLE: ${selectedStyle}
        ASPECT RATIO: ${aspectRatio}
        SCENE DENSITY: ${sceneDensity}
      `;

      let text = "";
      if (modelType === "Gemini") {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });
        text = response.text || "";
      } else {
        const baseUrl = 
          modelType === "OpenRouter" ? "https://openrouter.ai/api/v1" :
          modelType === "OpenAI" ? "https://api.openai.com/v1" :
          "https://api.maiarouter.ai/v1";
        
        const modelName = 
          modelType === "OpenRouter" ? "google/gemini-2.0-flash-001" :
          modelType === "OpenAI" ? "gpt-4o" :
          "maia/gemini-2.5-flash";
          
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            ...(modelType === "OpenRouter" && {
              "HTTP-Referer": window.location.origin,
              "X-Title": "AI Video Studio"
            })
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: "You are a professional film director and storyboard artist. Always provide bilingual output (Indonesian and English) as requested." },
              { role: "user", content: prompt }
            ],
            stream: false
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || `${modelType} API request failed`);
        }

        const data = await response.json();
        text = data.choices[0].message.content || "";
      }

      const sceneBlocks = text.split("---").filter(block => {
        const b = block.trim();
        return b.includes("JUDUL_ID:") || b.includes("JUDUL_EN:");
      });
      
      const parsedScenes: StoryboardScene[] = sceneBlocks.map((block, index) => {
        const lines = block.trim().split("\n");
        const scene: Partial<StoryboardScene> = { sceneNumber: index + 1 };
        
        lines.forEach(line => {
          if (line.startsWith("SCENE")) {
            const parts = line.split("—");
            scene.shotType = parts[1]?.trim() || "";
          } else if (line.startsWith("JUDUL_ID:")) scene.title = line.replace("JUDUL_ID:", "").trim();
          else if (line.startsWith("JUDUL_EN:")) scene.titleEn = line.replace("JUDUL_EN:", "").trim();
          else if (line.startsWith("LOKASI_ID:")) scene.location = line.replace("LOKASI_ID:", "").trim();
          else if (line.startsWith("LOKASI_EN:")) scene.locationEn = line.replace("LOKASI_EN:", "").trim();
          else if (line.startsWith("WAKTU_ID:")) scene.time = line.replace("WAKTU_ID:", "").trim();
          else if (line.startsWith("WAKTU_EN:")) scene.timeEn = line.replace("WAKTU_EN:", "").trim();
          else if (line.startsWith("NARASI_ID:")) scene.narration = line.replace("NARASI_ID:", "").trim();
          else if (line.startsWith("NARASI_EN:")) scene.narrationEn = line.replace("NARASI_EN:", "").trim();
          else if (line.startsWith("MOOD_ID:")) scene.mood = line.replace("MOOD_ID:", "").trim();
          else if (line.startsWith("MOOD_EN:")) scene.moodEn = line.replace("MOOD_EN:", "").trim();
          else if (line.startsWith("KARAKTER_ID:")) scene.character = line.replace("KARAKTER_ID:", "").trim();
          else if (line.startsWith("KARAKTER_EN:")) scene.characterEn = line.replace("KARAKTER_EN:", "").trim();
          else if (line.startsWith("KAMERA_ID:")) scene.camera = line.replace("KAMERA_ID:", "").trim();
          else if (line.startsWith("KAMERA_EN:")) scene.cameraEn = line.replace("KAMERA_EN:", "").trim();
          else if (line.startsWith("PROMPT VISUAL:")) scene.visualPrompt = line.replace("PROMPT VISUAL:", "").trim();
        });

        return scene as StoryboardScene;
      }).filter(s => s.title || s.titleEn);

      setGeneratedStoryboard(parsedScenes);
    } catch (err: any) {
      console.error("Storyboard generation failed", err);
      setError(`Failed to generate storyboard with ${modelType}. ` + (err.message || "Please try again."));
    } finally {
      setIsGenerating(false);
    }
  };

  const copyAllPrompts = () => {
    const prompts = generatedStoryboard.map(s => `Scene ${s.sceneNumber}: ${s.visualPrompt}`).join("\n\n");
    navigator.clipboard.writeText(prompts);
  };

  const downloadScene = (scene: StoryboardScene) => {
    const content = `
SCENE ${scene.sceneNumber} — ${scene.shotType}
--------------------------------------------------
${outputLanguage === "Indonesian" ? `JUDUL: ${scene.title}` : `TITLE: ${scene.titleEn}`}
${outputLanguage === "Indonesian" ? `LOKASI: ${scene.location}` : `LOCATION: ${scene.locationEn}`}
${outputLanguage === "Indonesian" ? `WAKTU: ${scene.time}` : `TIME: ${scene.timeEn}`}
${outputLanguage === "Indonesian" ? `NARASI: ${scene.narration}` : `NARRATION: ${scene.narrationEn}`}
${outputLanguage === "Indonesian" ? `MOOD: ${scene.mood}` : `MOOD: ${scene.moodEn}`}
${outputLanguage === "Indonesian" ? `KARAKTER: ${scene.character}` : `CHARACTER: ${scene.characterEn}`}
${outputLanguage === "Indonesian" ? `KAMERA: ${scene.camera}` : `CAMERA: ${scene.cameraEn}`}
PROMPT VISUAL: ${scene.visualPrompt}
    `.trim();
    
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Scene_${scene.sceneNumber}_${scene.title.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAllScenes = () => {
    const content = generatedStoryboard.map(scene => `
SCENE ${scene.sceneNumber} — ${scene.shotType}
--------------------------------------------------
${outputLanguage === "Indonesian" ? `JUDUL: ${scene.title}` : `TITLE: ${scene.titleEn}`}
${outputLanguage === "Indonesian" ? `LOKASI: ${scene.location}` : `LOCATION: ${scene.locationEn}`}
${outputLanguage === "Indonesian" ? `WAKTU: ${scene.time}` : `TIME: ${scene.timeEn}`}
${outputLanguage === "Indonesian" ? `NARASI: ${scene.narration}` : `NARRATION: ${scene.narrationEn}`}
${outputLanguage === "Indonesian" ? `MOOD: ${scene.mood}` : `MOOD: ${scene.moodEn}`}
${outputLanguage === "Indonesian" ? `KARAKTER: ${scene.character}` : `CHARACTER: ${scene.characterEn}`}
${outputLanguage === "Indonesian" ? `KAMERA: ${scene.camera}` : `CAMERA: ${scene.cameraEn}`}
PROMPT VISUAL: ${scene.visualPrompt}
--------------------------------------------------
    `.trim()).join("\n\n");
    
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Storyboard_Full_${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    setGeneratedStoryboard([]);
    setStory("");
    setExpandedScenes(new Set());
  };

  const toggleScene = (idx: number) => {
    const newExpanded = new Set(expandedScenes);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedScenes(newExpanded);
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Film className="w-5 h-5 text-blue-400" />
              Storyboard Settings
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">AI Model Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setModelType("Gemini")}
                    className={`py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                      modelType === "Gemini" 
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${modelType === "Gemini" ? "bg-white" : "bg-blue-500"}`} />
                    Gemini
                  </button>
                  <button
                    onClick={() => setModelType("OpenRouter")}
                    className={`py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                      modelType === "OpenRouter" 
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" 
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${modelType === "OpenRouter" ? "bg-white" : "bg-emerald-500"}`} />
                    OpenRouter
                  </button>
                  <button
                    onClick={() => setModelType("MaiaRouter")}
                    className={`py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                      modelType === "MaiaRouter" 
                        ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" 
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${modelType === "MaiaRouter" ? "bg-white" : "bg-amber-500"}`} />
                    MaiaRouter
                  </button>
                  <button
                    onClick={() => setModelType("OpenAI")}
                    className={`py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                      modelType === "OpenAI" 
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" 
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${modelType === "OpenAI" ? "bg-white" : "bg-blue-400"}`} />
                    OpenAI
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <TypeIcon className="w-4 h-4" /> Story / Concept
                </label>
                <textarea 
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  placeholder="Enter your story idea..."
                  className="w-full min-h-[150px] bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Languages className="w-4 h-4" /> Output Language
                </label>
                <select 
                  value={outputLanguage}
                  onChange={(e) => setOutputLanguage(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="Indonesian">Bahasa Indonesia</option>
                  <option value="English">English</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Visual Style
                </label>
                <select 
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  {visualStyles.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Maximize2 className="w-4 h-4" /> Aspect Ratio
                  </label>
                  <select 
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    {aspectRatios.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Layout className="w-4 h-4" /> Density
                  </label>
                  <select 
                    value={sceneDensity}
                    onChange={(e) => setSceneDensity(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    {densities.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <button
                onClick={generateStoryboard}
                disabled={isGenerating}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-xl shadow-blue-600/20 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Directing Scenes...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Generate Storyboard</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center space-x-3 text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Output Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col h-full min-h-[600px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-400" />
                Cinematic Storyboard
              </h3>
              {generatedStoryboard.length > 0 && (
                <div className="flex gap-2">
                  <button 
                    onClick={downloadAllScenes}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
                    title="Download All Scenes"
                  >
                    <DownloadCloud className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={copyAllPrompts}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"
                    title="Copy All Prompts"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={clearAll}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                    title="Clear All"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {generatedStoryboard.length > 0 ? (
                  generatedStoryboard.map((scene, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden group"
                    >
                      <div className="bg-slate-900/50 px-4 py-2 border-b border-slate-800 flex justify-between items-center cursor-pointer hover:bg-slate-900 transition-colors" onClick={() => toggleScene(idx)}>
                        <div className="flex items-center gap-2">
                          {expandedScenes.has(idx) ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                          <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                            Scene {scene.sceneNumber} — {scene.shotType}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-500 font-mono">
                            {scene.time} | {scene.location}
                          </span>
                          <button 
                            onClick={() => downloadScene(scene)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-blue-400 transition-colors"
                            title="Download Scene"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <AnimatePresence>
                        {expandedScenes.has(idx) && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 space-y-6">
                              {/* Bilingual Table */}
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-slate-800">
                                      <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase w-1/3">Field</th>
                                      <th className="py-2 px-3 text-[10px] font-bold text-blue-400 uppercase w-2/3">
                                        {outputLanguage === "Indonesian" ? "Bahasa Indonesia" : "English"}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="text-[11px]">
                                    <tr className="border-b border-slate-800/50">
                                      <td className="py-2 px-3 font-bold text-slate-400">
                                        {outputLanguage === "Indonesian" ? "Judul" : "Title"}
                                      </td>
                                      <td className="py-2 px-3 text-slate-200">
                                        {outputLanguage === "Indonesian" ? scene.title : scene.titleEn}
                                      </td>
                                    </tr>
                                    <tr className="border-b border-slate-800/50">
                                      <td className="py-2 px-3 font-bold text-slate-400">
                                        {outputLanguage === "Indonesian" ? "Lokasi" : "Location"}
                                      </td>
                                      <td className="py-2 px-3 text-slate-200">
                                        {outputLanguage === "Indonesian" ? scene.location : scene.locationEn}
                                      </td>
                                    </tr>
                                    <tr className="border-b border-slate-800/50">
                                      <td className="py-2 px-3 font-bold text-slate-400">
                                        {outputLanguage === "Indonesian" ? "Waktu" : "Time"}
                                      </td>
                                      <td className="py-2 px-3 text-slate-200">
                                        {outputLanguage === "Indonesian" ? scene.time : scene.timeEn}
                                      </td>
                                    </tr>
                                    <tr className="border-b border-slate-800/50">
                                      <td className="py-2 px-3 font-bold text-slate-400">
                                        {outputLanguage === "Indonesian" ? "Narasi" : "Narration"}
                                      </td>
                                      <td className="py-2 px-3 text-slate-200 italic leading-relaxed">
                                        "{outputLanguage === "Indonesian" ? scene.narration : scene.narrationEn}"
                                      </td>
                                    </tr>
                                    <tr className="border-b border-slate-800/50">
                                      <td className="py-2 px-3 font-bold text-slate-400">Mood</td>
                                      <td className="py-2 px-3 text-slate-200">
                                        {outputLanguage === "Indonesian" ? scene.mood : scene.moodEn}
                                      </td>
                                    </tr>
                                    <tr className="border-b border-slate-800/50">
                                      <td className="py-2 px-3 font-bold text-slate-400">
                                        {outputLanguage === "Indonesian" ? "Karakter" : "Character"}
                                      </td>
                                      <td className="py-2 px-3 text-slate-200">
                                        {outputLanguage === "Indonesian" ? scene.character : scene.characterEn}
                                      </td>
                                    </tr>
                                    <tr className="border-b border-slate-800/50">
                                      <td className="py-2 px-3 font-bold text-slate-400">
                                        {outputLanguage === "Indonesian" ? "Kamera" : "Camera"}
                                      </td>
                                      <td className="py-2 px-3 text-slate-200">
                                        {outputLanguage === "Indonesian" ? scene.camera : scene.cameraEn}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>

                              <div className="bg-slate-900 rounded-lg p-3 border border-slate-800/50 group-hover:border-blue-500/30 transition-colors">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase">Visual Prompt</span>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(scene.visualPrompt);
                                    }}
                                    className="text-[10px] text-blue-400 hover:underline"
                                  >
                                    Copy Prompt
                                  </button>
                                </div>
                                <p className="text-[11px] text-slate-400 font-mono line-clamp-3 group-hover:line-clamp-none transition-all">
                                  {scene.visualPrompt}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 py-20">
                    <Film className="w-16 h-16 mb-4 opacity-10" />
                    <p className="text-sm font-medium">No storyboard generated yet</p>
                    <p className="text-xs opacity-50">Enter a story and click generate to start your production</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
