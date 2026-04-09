import { useState, useEffect, useRef, Dispatch, SetStateAction } from "react";
import { Mic, Play, Download, Trash2, Globe, User, Sparkles, Loader2, AlertCircle, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceOverResult, StoryboardScene } from "../types";

const addWavHeader = (pcmData: Uint8Array, sampleRate: number = 24000) => {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  // file length
  view.setUint32(4, 36 + pcmData.length, true);
  // RIFF type
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // format chunk identifier
  view.setUint32(12, 0x666d7420, false); // "fmt "
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  view.setUint32(36, 0x64617461, false); // "data"
  // data chunk length
  view.setUint32(40, pcmData.length, true);

  const wav = new Uint8Array(header.byteLength + pcmData.length);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcmData, 44);

  return wav;
};

const VOICE_PROFILES = [
  { id: "1", label: "WANITA – HOST RAMAH", voice: "Kore", description: "Ceria, hangat, ramah", instruction: "Gunakan identitas WANITA – HOST RAMAH. Nada: Ceria, hangat, ramah. Gaya: Santai seperti pembawa acara. Kunci: Tetap ceria dan stabil." },
  { id: "2", label: "WANITA – NARATOR TENANG", voice: "Zephyr", description: "Lembut, tenang", instruction: "Gunakan identitas WANITA – NARATOR TENANG. Nada: Lembut, tenang. Gaya: Storytelling santai. Kunci: Energi stabil, tidak naik turun." },
  { id: "3", label: "WANITA – PROFESIONAL", voice: "Kore", description: "Percaya diri, formal", instruction: "Gunakan identitas WANITA – PROFESIONAL. Nada: Percaya diri, formal. Gaya: Presentasi bisnis / corporate. Kunci: Tetap profesional, tidak santai." },
  { id: "4", label: "WANITA – IKLAN ENERJIK", voice: "Kore", description: "Semangat, persuasif", instruction: "Gunakan identitas WANITA – IKLAN ENERJIK. Nada: Semangat, persuasif. Gaya: Iklan / promosi. Kunci: Energi tinggi dan konsisten." },
  { id: "5", label: "WANITA – ELEGAN", voice: "Zephyr", description: "Halus, premium, mewah", instruction: "Gunakan identitas WANITA – ELEGAN. Nada: Halus, premium, mewah. Gaya: Narasi brand luxury. Kunci: Tetap elegan, tidak kasual." },
  { id: "6", label: "PRIA – RAMAH", voice: "Puck", description: "Hangat, santai", instruction: "Gunakan identitas PRIA – RAMAH. Nada: Hangat, santai. Gaya: Percakapan santai. Kunci: Tetap santai dan natural." },
  { id: "7", label: "PRIA – DOKUMENTER DALAM", voice: "Charon", description: "Dalam, tegas", instruction: "Gunakan identitas PRIA – DOKUMENTER DALAM. Nada: Dalam, tegas. Gaya: Narasi dokumenter. Kunci: Stabil dan berwibawa." },
  { id: "8", label: "PRIA – PENJELAS TEKNOLOGI", voice: "Fenrir", description: "Jelas, informatif", instruction: "Gunakan identitas PRIA – PENJELAS TEKNOLOGI. Nada: Jelas, informatif. Gaya: Edukasi / teknologi. Kunci: Netral dan konsisten." },
  { id: "9", label: "PRIA – PROMO ENERJIK", voice: "Fenrir", description: "Semangat, cepat", instruction: "Gunakan identitas PRIA – PROMO ENERJIK. Nada: Semangat, cepat. Gaya: Iklan / promo. Kunci: Energi tinggi dari awal sampai akhir." },
  { id: "10", label: "PRIA – PENCERITA", voice: "Charon", description: "Hangat, dalam", instruction: "Gunakan identitas PRIA – PENCERITA. Nada: Hangat, dalam. Gaya: Storytelling. Kunci: Tempo tenang dan stabil." },
];

interface VoiceOverProps {
  audioResults: VoiceOverResult[];
  setAudioResults: Dispatch<SetStateAction<VoiceOverResult[]>>;
  generatedStoryboard: StoryboardScene[];
}

export default function VoiceOver({ audioResults, setAudioResults, generatedStoryboard }: VoiceOverProps) {
  const [voiceProfileId, setVoiceProfileId] = useState<string>("1");
  const [language, setLanguage] = useState<"Indonesia" | "English" | "Japan" | "Belanda" | "Germany">("Indonesia");
  const [text, setText] = useState("");
  const [modelProvider, setModelProvider] = useState<"Gemini" | "OpenRouter" | "MaiaRouter" | "OpenAI">("Gemini");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");
  const [apiKeys, setApiKeys] = useState<Record<string, any>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch keys from server
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

  useEffect(() => {
    fetchKeys();
  }, []); // Fetch on mount

  // Persist text
  useEffect(() => {
    const savedText = localStorage.getItem("VOICE_OVER_TEXT");
    if (savedText) setText(savedText);
  }, []);

  const handleTextChange = (val: string) => {
    setText(val);
    localStorage.setItem("VOICE_OVER_TEXT", val);
  };

  const clearText = () => {
    setText("");
    localStorage.removeItem("VOICE_OVER_TEXT");
  };

  const importFromStoryboard = () => {
    if (generatedStoryboard.length === 0) return;
    const narrations = generatedStoryboard.map(s => 
      language === "Indonesia" ? s.narration : s.narrationEn
    ).join("\n\n");
    handleTextChange(narrations);
  };

  const getApiKey = (provider: "Gemini" | "OpenRouter" | "MaiaRouter" | "OpenAI") => {
    const providerKeys = apiKeys[provider];
    if (providerKeys && Array.isArray(providerKeys) && providerKeys.length > 0) {
      return providerKeys[0].key;
    }
    return null;
  };

  const generateVoice = async () => {
    if (!text.trim()) return;
    
    // Refresh keys before generation to ensure we have the latest
    await fetchKeys();
    
    const apiKey = getApiKey(modelProvider);
    if (!apiKey) {
      setError(`No ${modelProvider} API Key found. Please add one in Configuration.`);
      return;
    }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    setIsGenerating(true);
    setProgress({ current: 0, total: lines.length });
    setError("");

    try {
      const geminiKey = getApiKey("Gemini");
      if (!geminiKey) throw new Error("Gemini API key is required for the final Voice Over generation.");
      const ai = new GoogleGenAI({ apiKey: geminiKey });

      const selectedProfile = VOICE_PROFILES.find(p => p.id === voiceProfileId) || VOICE_PROFILES[0];
      const voiceName = selectedProfile.voice;

      // Process each line individually
      for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i];
        setProgress(prev => ({ ...prev, current: i + 1 }));
        let textToSpeak = currentLine;

        // If not Gemini, use the provider to "refine" the text for better speech
        if (modelProvider !== "Gemini") {
          const baseUrl = 
            modelProvider === "OpenRouter" ? "https://openrouter.ai/api/v1" :
            modelProvider === "OpenAI" ? "https://api.openai.com/v1" :
            "https://api.maiarouter.ai/v1";
          
          const modelName = 
            modelProvider === "OpenRouter" ? "google/gemini-2.0-flash-001" :
            modelProvider === "OpenAI" ? "gpt-4o" :
            "maia/gemini-2.5-flash";

          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
              ...(modelProvider === "OpenRouter" && {
                "HTTP-Referer": window.location.origin,
                "X-Title": "AI Video Studio"
              })
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                { role: "system", content: `ANDA ADALAH GENERATOR VOICE OVER PROFESIONAL.
=== ATURAN KUNCI SUARA (WAJIB) ===
- Gunakan HANYA SATU identitas suara.
- JANGAN pernah mengubah nada suara, pitch, aksen, kecepatan bicara, atau gaya berbicara.
- JANGAN berpindah karakter suara.
- Pertahankan karakter suara yang sama dari awal sampai akhir.
- Jangan menambahkan emosi baru di luar karakter yang dipilih.
- Pengucapan harus stabil dan konsisten.
- Jangan improvisasi gaya bicara.

=== KARAKTER SUARA YANG DIPILIH ===
${selectedProfile.instruction}

=== ATURAN OUTPUT ===
- Refine the text to make it sound natural for this specific character.
- Keep the meaning identical.
- Return ONLY the refined text.` },
                { role: "user", content: currentLine }
              ]
            })
          });

          if (response.ok) {
            const data = await response.json();
            textToSpeak = data.choices[0].message.content;
          }
        }

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: `Speak in ${language} with this specific tone: ${selectedProfile.instruction}. Text: ${textToSpeak}` }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName as any },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          const binary = atob(base64Audio);
          const bytes = new Uint8Array(binary.length);
          for (let j = 0; j < binary.length; j++) {
            bytes[j] = binary.charCodeAt(j);
          }
          
          const wavBytes = addWavHeader(bytes, 24000);
          const blob = new Blob([wavBytes], { type: "audio/wav" });
          const url = URL.createObjectURL(blob);
          
          setAudioResults(prev => [...prev, {
            id: crypto.randomUUID(),
            url,
            language,
            gender: selectedProfile.label,
            text: `${i + 1}. ` + currentLine.substring(0, 50) + (currentLine.length > 50 ? "..." : "")
          }]);

          setText(prev => {
            const linesArr = prev.split('\n');
            const index = linesArr.findIndex(l => l.trim() === currentLine.trim());
            if (index !== -1) {
              linesArr.splice(index, 1);
            }
            const newText = linesArr.join('\n');
            localStorage.setItem("VOICE_OVER_TEXT", newText);
            return newText;
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during voice generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteAudio = (id: string) => {
    const item = audioResults.find(a => a.id === id);
    if (item) {
      URL.revokeObjectURL(item.url);
      setAudioResults(prev => prev.filter(a => a.id !== id));
    }
  };

  const clearAllResults = () => {
    audioResults.forEach(item => URL.revokeObjectURL(item.url));
    setAudioResults([]);
  };

  const downloadAll = () => {
    audioResults.forEach((item, index) => {
      setTimeout(() => {
        const link = document.createElement("a");
        link.href = item.url;
        link.download = `voiceover-${item.language}-${item.gender}-${index + 1}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 500); // Stagger downloads to avoid browser blocking
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Mic className="w-5 h-5 text-blue-400" />
            Voice Configuration
          </h3>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-400">AI Model Provider</label>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <button
              onClick={() => setModelProvider("Gemini")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                modelProvider === "Gemini" 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${modelProvider === "Gemini" ? "bg-white" : "bg-blue-500"}`} />
              Gemini
            </button>
            <button
              onClick={() => setModelProvider("OpenRouter")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                modelProvider === "OpenRouter" 
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" 
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${modelProvider === "OpenRouter" ? "bg-white" : "bg-emerald-500"}`} />
              OpenRouter
            </button>
            <button
              onClick={() => setModelProvider("MaiaRouter")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                modelProvider === "MaiaRouter" 
                  ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" 
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${modelProvider === "MaiaRouter" ? "bg-white" : "bg-amber-500"}`} />
              MaiaRouter
            </button>
            <button
              onClick={() => setModelProvider("OpenAI")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                modelProvider === "OpenAI" 
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" 
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${modelProvider === "OpenAI" ? "bg-white" : "bg-blue-400"}`} />
              OpenAI
            </button>
          </div>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <User className="w-4 h-4" /> Voice Profile
            </label>
            <select 
              value={voiceProfileId}
              onChange={(e) => setVoiceProfileId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              {VOICE_PROFILES.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Language
            </label>
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              <option value="Indonesia">Indonesia</option>
              <option value="English">English</option>
              <option value="Japan">Japan</option>
              <option value="Belanda">Belanda (Dutch)</option>
              <option value="Germany">Germany (German)</option>
            </select>
          </div>
        </div>

        {voiceProfileId && (
          <div className="bg-blue-500/5 border border-blue-500/10 p-3 rounded-xl">
            <p className="text-[10px] text-blue-400 uppercase font-bold tracking-wider mb-1">Karakter Terpilih</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              {VOICE_PROFILES.find(p => p.id === voiceProfileId)?.instruction}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-slate-400">Narration Text</label>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-500">Unlimited characters</span>
              {generatedStoryboard.length > 0 && (
                <button 
                  onClick={importFromStoryboard}
                  className="text-[10px] text-blue-400 hover:text-blue-300 bg-blue-400/10 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Import from Storyboard
                </button>
              )}
              {text && (
                <button 
                  onClick={clearText}
                  className="text-[10px] text-red-400 hover:text-red-300 bg-red-400/10 px-1.5 py-0.5 rounded transition-colors"
                >
                  Hapus
                </button>
              )}
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Enter the text you want to convert to speech..."
            className="w-full h-64 bg-slate-800 border border-slate-700 rounded-xl p-4 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
          />
        </div>

        <button
          onClick={generateVoice}
          disabled={!text || isGenerating}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-xl shadow-blue-600/20 flex items-center justify-center space-x-2 disabled:opacity-50 transition-all"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>
                {progress.total > 1 
                  ? `Generating ${progress.current}/${progress.total}...` 
                  : modelProvider !== "Gemini" ? `Refining with ${modelProvider}...` : "Generating Voice..."}
              </span>
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              <span>Generate Voice Over</span>
            </>
          )}
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Play className="w-5 h-5 text-indigo-400" />
            Hasil Voice
          </h3>
          {audioResults.length > 0 && (
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-lg">
              {audioResults.length} Results
            </span>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-[400px]">
          {audioResults.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {audioResults.map((item) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 group hover:border-indigo-500/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 bg-indigo-600 text-white text-[10px] font-bold rounded-full shrink-0 shadow-lg shadow-indigo-600/20">
                        {item.text.split('.')[0]}
                      </div>
                      <div className="p-1.5 bg-indigo-500/10 rounded-lg">
                        <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                          {item.language} • {item.gender}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a 
                        href={item.url} 
                        download={`voiceover-${item.language}-${item.gender}-${item.text.split('.')[0]}.mp3`}
                        className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button 
                        onClick={() => deleteAudio(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-400 line-clamp-1 italic">"{item.text}"</p>
                  
                  <audio src={item.url} controls className="w-full h-8 opacity-80" />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center space-y-6 bg-slate-950/50 border border-dashed border-slate-800 rounded-xl p-8">
              <div className="w-20 h-20 bg-indigo-600/10 rounded-full flex items-center justify-center border border-indigo-500/20">
                <Mic className="w-10 h-10 text-indigo-400" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-slate-300 font-medium">No voice generated yet</p>
                <p className="text-sm text-slate-500">Generate a voice to see results here</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <button 
            onClick={downloadAll}
            disabled={audioResults.length === 0}
            className="flex items-center justify-center space-x-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Download All</span>
          </button>
          <button 
            onClick={clearAllResults}
            disabled={audioResults.length === 0}
            className="flex items-center justify-center space-x-2 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm font-medium">Clear All</span>
          </button>
        </div>
      </div>
    </div>
  );
}
