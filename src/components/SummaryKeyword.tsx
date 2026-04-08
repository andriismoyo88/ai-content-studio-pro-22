import { useState } from "react";
import { 
  FileSearch, 
  Sparkles, 
  Loader2, 
  Copy, 
  Save, 
  Trash2, 
  AlertCircle,
  Youtube,
  Hash,
  Tag,
  Lightbulb,
  ListChecks,
  AlignLeft
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";

type ModelProvider = "Gemini" | "OpenRouter" | "MaiaRouter" | "OpenAI";

export default function SummaryKeyword() {
  const [videoUrl, setVideoUrl] = useState("");
  const [modelProvider, setModelProvider] = useState<ModelProvider>("Gemini");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const getApiKey = (provider: ModelProvider) => {
    const storageKey = 
      provider === "Gemini" ? "GEMINI_API_KEYS" : 
      provider === "OpenRouter" ? "OPENROUTER_API_KEYS" :
      provider === "MaiaRouter" ? "MAIAROUTER_API_KEYS" :
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
    // Fallback for Gemini if no key in localStorage
    if (provider === "Gemini") return process.env.GEMINI_API_KEY;
    return null;
  };

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const videoId = getYouTubeId(videoUrl);

  const handleGenerate = async () => {
    if (!videoUrl.trim()) {
      setError("Silakan masukkan link YouTube terlebih dahulu.");
      return;
    }

    const apiKey = getApiKey(modelProvider);
    if (!apiKey) {
      setError(`API Key ${modelProvider} tidak ditemukan. Silakan tambahkan di menu Configuration.`);
      return;
    }

    setIsGenerating(true);
    setError("");
    setResult("");

    try {
      const prompt = `
        TUGAS UTAMA: Lakukan riset mendalam HANYA pada video YouTube dengan URL spesifik ini: ${videoUrl}
        
        INSTRUKSI KETAT:
        1. Anda WAJIB menganalisis konten dari link tersebut (${videoUrl}).
        2. JANGAN memberikan informasi tentang video lain meskipun judulnya mirip.
        3. Gunakan fitur pencarian web/Google Search untuk mendapatkan transkrip, deskripsi, komentar, atau ringkasan dari URL spesifik ini jika Anda tidak dapat memutar videonya secara langsung.
        4. Jika video tidak dapat ditemukan atau link rusak, berikan pesan error yang jelas dan JANGAN mengarang informasi.
        5. Pastikan hasil riset sinkron 100% dengan video yang ada di link tersebut.

        BERIKAN HASIL DALAM FORMAT BERIKUT (Bahasa Indonesia):
        
        1. Ringkasan: (Ringkasan mendalam tentang isi video)
        2. Poin Penting: (Daftar poin-poin utama yang dibahas secara detail)
        3. Wawasan dan Tips: (Insight berharga atau tips praktis yang bisa diambil)
        4. Kesimpulan: (Kesimpulan akhir dan pesan utama video)
        5. Tags: (Daftar tag relevan, pisahkan dengan koma)
        6. Keyword: (Daftar kata kunci utama, pisahkan dengan tanda #)

        Pastikan output sangat akurat sesuai dengan link yang diberikan.
      `;

      if (modelProvider === "Gemini") {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            tools: [
              { urlContext: {} },
              { googleSearch: {} }
            ]
          }
        });
        setResult(response.text || "");
      } else {
        const baseUrl = 
          modelProvider === "OpenRouter" ? "https://openrouter.ai/api/v1" :
          modelProvider === "OpenAI" ? "https://api.openai.com/v1" :
          "https://api.maiarouter.ai/v1"; // Adobe Firefly fallback or specific endpoint
        
        const modelName = 
          modelProvider === "OpenRouter" ? "google/gemini-2.0-flash-001" :
          modelProvider === "OpenAI" ? "gpt-4o" :
          "maia/gemini-2.5-flash";

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            ...(modelProvider === "OpenRouter" ? { "HTTP-Referer": window.location.origin, "X-Title": "AI Video Studio" } : {})
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { 
                role: "system", 
                content: `Anda adalah pakar riset konten video YouTube dengan kemampuan penalaran (reasoning) tingkat tinggi dan akses pencarian web real-time. 
                
                LOGIKA RISET & PENALARAN:
                1. ANALISIS URL: Fokus sepenuhnya pada link ${videoUrl}. Identifikasi ID video dan konteksnya.
                2. PENGUMPULAN DATA: Gunakan fitur browsing/search untuk mengambil transkrip, metadata, deskripsi, dan komentar video.
                3. VERIFIKASI SILANG: Bandingkan data yang ditemukan dengan permintaan pengguna untuk memastikan akurasi 100%. Jangan pernah mengarang informasi.
                4. SINTESIS MENDALAM: Susun laporan yang mendalam, terstruktur, dan objektif sesuai format yang diminta.
                
                Tugas Anda adalah memberikan hasil riset yang identik kualitasnya dengan sistem Gemini Pro/Flash dengan tool urlContext dan googleSearch.` 
              },
              { role: "user", content: prompt }
            ],
            temperature: 0.2
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || `${modelProvider} API request failed`);
        }

        const data = await response.json();
        setResult(data.choices[0].message.content || "");
      }
    } catch (err: any) {
      console.error(err);
      setError("Gagal melakukan riset. " + (err.message || "Pastikan link valid dan API Key benar."));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClear = () => {
    setVideoUrl("");
    setResult("");
    setError("");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result);
  };

  const extractSection = (sectionName: string) => {
    if (!result) return "";
    // Matches "X. SectionName: content" until the next "Y. " or end of string
    const regex = new RegExp(`\\d+\\.\\s*${sectionName}:\\s*([\\s\\S]*?)(?=\\n\\d+\\.|$)`, "i");
    const match = result.match(regex);
    return match ? match[1].trim() : "";
  };

  const saveSectionAsTxt = (sectionName: string, fileName: string) => {
    const content = extractSection(sectionName);
    if (!content) return;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}_${new Date().getTime()}.txt`;
    a.click();
  };

  const saveAsTxt = () => {
    const blob = new Blob([result], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `summary_${new Date().getTime()}.txt`;
    a.click();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Input Section */}
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-blue-400" />
            YouTube Research
          </h3>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400">AI Model Provider</label>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {(["Gemini", "OpenRouter", "MaiaRouter", "OpenAI"] as ModelProvider[]).map((p) => (
              <button
                key={p}
                onClick={() => setModelProvider(p)}
                className={`py-2 px-3 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                  modelProvider === p 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${modelProvider === p ? "bg-white" : "bg-blue-500"}`} />
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Youtube className="w-4 h-4 text-red-500" /> YouTube Video Link
            </label>
            <span className="text-[10px] text-slate-500 font-mono">{videoUrl.length}/3000</span>
          </div>
          
          <div className="relative group">
            <textarea
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value.substring(0, 3000))}
              placeholder="Tempel link video YouTube di sini untuk diriset..."
              className="w-full h-24 bg-slate-800 border border-slate-700 rounded-xl p-4 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
            />
            {videoUrl && (
              <button 
                onClick={() => setVideoUrl("")}
                className="absolute top-2 right-2 p-1.5 bg-slate-700/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <AnimatePresence>
            {videoId && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50"
              >
                <div className="aspect-video w-full relative">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="YouTube Video Preview"
                  />
                </div>
                <div className="p-3 flex items-center justify-between bg-slate-900/50">
                  <span className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]">ID: {videoId}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preview Ready</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-500">
          <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 group">
            <div className="flex items-center gap-2">
              <AlignLeft className="w-3 h-3 text-blue-400" /> Ringkasan & Poin
            </div>
            {result && (
              <button 
                onClick={() => saveSectionAsTxt("Ringkasan", "ringkasan")}
                className="p-1 hover:bg-slate-700 rounded transition-all text-slate-500 hover:text-slate-200"
                title="Simpan Ringkasan"
              >
                <Save className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 group">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-3 h-3 text-amber-400" /> Wawasan & Tips
            </div>
            {result && (
              <button 
                onClick={() => saveSectionAsTxt("Wawasan dan Tips", "wawasan")}
                className="p-1 hover:bg-slate-700 rounded transition-all text-slate-500 hover:text-slate-200"
                title="Simpan Wawasan"
              >
                <Save className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 group">
            <div className="flex items-center gap-2">
              <Tag className="w-3 h-3 text-emerald-400" /> Tags (Koma)
            </div>
            {result && (
              <button 
                onClick={() => saveSectionAsTxt("Tags", "tags")}
                className="p-1 hover:bg-slate-700 rounded transition-all text-slate-500 hover:text-slate-200"
                title="Simpan Tags"
              >
                <Save className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 group">
            <div className="flex items-center gap-2">
              <Hash className="w-3 h-3 text-indigo-400" /> Keyword (#)
            </div>
            {result && (
              <button 
                onClick={() => saveSectionAsTxt("Keyword", "keywords")}
                className="p-1 hover:bg-slate-700 rounded transition-all text-slate-500 hover:text-slate-200"
                title="Simpan Keyword"
              >
                <Save className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleGenerate}
            disabled={!videoUrl || isGenerating}
            className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-xl shadow-blue-600/20 flex items-center justify-center space-x-2 disabled:opacity-50 transition-all"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Researching Video...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>SUMMARY</span>
              </>
            )}
          </button>
          <button
            onClick={handleClear}
            disabled={isGenerating || (!videoUrl && !result)}
            className="px-6 py-4 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center disabled:opacity-50"
            title="Hapus Semua"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Result Section */}
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-indigo-400" />
            Hasil Riset
          </h3>
        </div>

        <div className="flex-1 min-h-[400px] relative">
          <textarea
            readOnly
            value={result}
            placeholder="Hasil riset video akan muncul di sini..."
            className="w-full h-full bg-slate-950 border border-slate-800 rounded-xl p-6 text-slate-300 font-mono text-sm resize-none focus:outline-none focus:border-indigo-500/50 transition-all leading-relaxed custom-scrollbar"
          />
          {!result && !isGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 pointer-events-none">
              <Youtube className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm">Masukkan link dan klik SUMMARY</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <button
            disabled={!result}
            onClick={copyToClipboard}
            className="flex items-center justify-center space-x-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all disabled:opacity-50"
          >
            <Copy className="w-4 h-4" />
            <span className="text-sm font-medium">Salin Hasil</span>
          </button>
          <button
            disabled={!result}
            onClick={saveAsTxt}
            className="flex items-center justify-center space-x-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span className="text-sm font-medium">Simpan .txt</span>
          </button>
        </div>
      </div>
    </div>
  );
}
