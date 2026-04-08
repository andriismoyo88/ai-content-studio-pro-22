import { useState, useRef, ChangeEvent, useEffect } from "react";
import axios from "axios";
import { 
  Youtube, 
  Calendar, 
  Clock, 
  Upload, 
  Video, 
  Image as ImageIcon, 
  Tag, 
  Type, 
  AlignLeft, 
  Globe, 
  CheckCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Loader2,
  ListOrdered,
  Activity,
  XCircle,
  Clock4,
  LayoutList,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Settings as SettingsIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { VideoJob, YouTubeChannel, Asset } from "../types";
import HistoryTable from "./HistoryTable";

interface YouTubeSchedulerProps {
  videoFile: Asset | null;
  thumbnailFile: Asset | null;
  onVideoImport: () => void;
  onThumbnailImport: () => void;
  onRemoveVideo: () => void;
  onRemoveThumbnail: () => void;
}

export default function YouTubeScheduler({ 
  videoFile: importedVideo, 
  thumbnailFile: importedThumbnail,
  onVideoImport,
  onThumbnailImport,
  onRemoveVideo,
  onRemoveThumbnail
}: YouTubeSchedulerProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [privacy, setPrivacy] = useState<'public' | 'private' | 'unlisted'>('private');
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [categoryId, setCategoryId] = useState("22"); // Default: People & Blogs
  const [madeForKids, setMadeForKids] = useState(false);
  const [aiLabel, setAiLabel] = useState(false);
  const [monetization, setMonetization] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    // Set default date/time to Jakarta time if empty
    const now = new Date();
    const jakartaDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
    
    const jakartaTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);

    if (!scheduledDate) setScheduledDate(jakartaDate);
    if (!scheduledTime) setScheduledTime(jakartaTime);
  }, []);

  const formatToJakarta = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(new Date(dateStr));
    } catch (e) {
      return dateStr;
    }
  };
  const [playlistId, setPlaylistId] = useState("");
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  
  // File states
  const [videoFile, setVideoFile] = useState<File | Asset | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | Asset | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadErrorMessage, setUploadErrorMessage] = useState("");
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [thumbnailPath, setThumbnailPath] = useState<string | null>(null);
  const [apiConfigs, setApiConfigs] = useState<any[]>([]);
  const [isUploadingConfig, setIsUploadingConfig] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [deviceCodeData, setDeviceCodeData] = useState<any>(null);
  const [pollInterval, setPollInterval] = useState<any>(null);
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(true);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const configInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (importedVideo) {
      setVideoFile(importedVideo);
      // If it's an asset from our library, it already has a path on the server
      // The asset ID is usually the filename without extension or a UUID
      setVideoPath(importedVideo.id.includes('/') ? importedVideo.id : importedVideo.url); 
    }
    if (importedThumbnail) {
      setThumbnailFile(importedThumbnail);
      setThumbnailPath(importedThumbnail.id.includes('/') ? importedThumbnail.id : importedThumbnail.url);
    }
  }, [importedVideo, importedThumbnail]);

  useEffect(() => {
    fetchConfigs();
    fetchChannels();
  }, []);

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/config/api-keys');
      if (res.ok) {
        const data = await res.json();
        setApiConfigs(data);
      }
    } catch (e) { console.error(e); }
  };

  const fetchChannels = async () => {
    try {
      const res = await fetch('/api/youtube/channels');
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
        if (data.length > 0 && !selectedChannelId) {
          setSelectedChannelId(data[0].id);
        }
      }
    } catch (e) { console.error(e); }
  };

  const handleConfigUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingConfig(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = JSON.parse(event.target?.result as string);
          const clientConfig = content.web || content.installed;
          
          if (!clientConfig) throw new Error("Invalid format");

          const res = await fetch('/api/config/api-keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: clientConfig.client_id,
              clientSecret: clientConfig.client_secret,
              name: file.name
            })
          });

          if (res.ok) {
            await fetchConfigs();
            showNotification("API Config added successfully!", "success");
          }
        } catch (err) {
          showNotification("Invalid client_secret.json file.", "error");
        } finally {
          setIsUploadingConfig(false);
        }
      };
      reader.readAsText(file);
    }
  };

  const startDeviceFlow = async () => {
    if (apiConfigs.length === 0) {
      showNotification("Please upload a client_secret.json first!", "error");
      return;
    }

    const configId = apiConfigs[0].id; // Use the first one by default
    setIsConnecting(true);
    try {
      const res = await fetch('/api/auth/google/device/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId })
      });
      const data = await res.json();
      setDeviceCodeData(data);
      setShowDeviceModal(true);
      
      const interval = setInterval(async () => {
        try {
          const pollRes = await fetch('/api/auth/google/device/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_code: data.device_code })
          });
          const pollData = await pollRes.json();
          
          if (pollData.id) {
            clearInterval(interval);
            setShowDeviceModal(false);
            setIsConnecting(false);
            const updatedChannels = [...channels, pollData];
            setChannels(updatedChannels);
            localStorage.setItem("YOUTUBE_CHANNELS", JSON.stringify(updatedChannels));
            setSelectedChannelId(pollData.id);
            showNotification(`Channel ${pollData.name} connected!`, "success");
          }
        } catch (e) { }
      }, 5000);
      setPollInterval(interval);
    } catch (e) {
      setIsConnecting(false);
      showNotification("Failed to start device flow", "error");
    }
  };

  const stopPolling = () => {
    if (pollInterval) clearInterval(pollInterval);
    setShowDeviceModal(false);
    setIsConnecting(false);
  };

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreview(null);
      return;
    }

    if ('url' in thumbnailFile) {
      setThumbnailPreview((thumbnailFile as Asset).url);
      return;
    }

    const objectUrl = URL.createObjectURL(thumbnailFile as File);
    setThumbnailPreview(objectUrl);

    // Free memory when component unmounts or file changes
    return () => URL.revokeObjectURL(objectUrl);
  }, [thumbnailFile]);

  useEffect(() => {
    const syncChannels = async () => {
      try {
        const res = await fetch('/api/youtube/channels');
        if (res.ok) {
          const serverChannels = await res.json();
          if (serverChannels.length > 0) {
            setChannels(serverChannels);
            localStorage.setItem("YOUTUBE_CHANNELS", JSON.stringify(serverChannels));
            if (!selectedChannelId) setSelectedChannelId(serverChannels[0].id);
          } else {
            // If server is empty, clear local storage
            setChannels([]);
            localStorage.removeItem("YOUTUBE_CHANNELS");
            setSelectedChannelId("");
          }
        }
      } catch (e) {
        console.error("Failed to sync channels with server:", e);
      }
    };

    syncChannels();
    fetchJobs();
    const interval = setInterval(() => {
      fetchJobs();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedChannelId) {
      fetchPlaylists(selectedChannelId);
    } else {
      setPlaylists([]);
    }
  }, [selectedChannelId]);

  const fetchPlaylists = async (channelId: string) => {
    setIsLoadingPlaylists(true);
    try {
      const res = await fetch(`/api/youtube/playlists/${channelId}`);
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data);
      } else {
        const errorData = await res.json();
        if (errorData.error === "Channel not found") {
          console.warn("Channel not found on server. Clearing local channel data.");
          setChannels([]);
          localStorage.removeItem("YOUTUBE_CHANNELS");
          setSelectedChannelId("");
        }
        setPlaylists([]);
      }
    } catch (e) {
      console.error("Failed to fetch playlists:", e);
      setPlaylists([]);
    } finally {
      setIsLoadingPlaylists(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/youtube/jobs');
      const data = await res.json();
      setJobs(data);
    } catch (e) { console.error(e); }
  };

  const uploadFile = async (file: File | Asset, type: 'video' | 'thumbnail') => {
    if (type === 'video') {
      const allowedExtensions = ['mp4', 'mov', 'avi'];
      const fileName = 'name' in file ? file.name : (file as Asset).name;
      const extension = fileName.split('.').pop()?.toLowerCase();
      if (!extension || !allowedExtensions.includes(extension)) {
        setUploadStatus('error');
        setUploadErrorMessage("Format video tidak didukung (Gunakan mp4, mov, avi)");
        return;
      }
      setUploadStatus('uploading');
    }

    setUploadProgress(0);
    setUploadErrorMessage("");
    
    const formData = new FormData();
    if ('name' in file && !(file as any).url) {
      formData.append(type, file as File);
    } else {
      // If it's an asset, we might not need to upload it again if it's already on the server
      const asset = file as Asset;
      if (asset.blob) {
        formData.append(type, asset.blob, asset.name);
      } else {
        // If no blob, we assume it's already on the server and use its path directly
        if (type === 'video') {
          setVideoPath(asset.url);
          setUploadStatus('success');
        } else {
          setThumbnailPath(asset.url);
        }
        return;
      }
    }

    try {
      const response = await axios.post('/api/upload', formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            setUploadProgress(percent);
          }
        }
      });

      if (type === 'video') {
        setVideoPath(response.data.videoPath);
        setUploadStatus('success');
      } else {
        setThumbnailPath(response.data.thumbnailPath);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      if (type === 'video') {
        setUploadStatus('error');
        setUploadErrorMessage(error.response?.data?.error || "Gagal mengupload file.");
      }
    }
  };

  const handleDeleteJob = async (id: string) => {
    try {
      const res = await fetch(`/api/youtube/jobs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification("Antrean berhasil dihapus", "success");
        fetchJobs();
      } else {
        showNotification("Gagal menghapus antrean", "error");
      }
    } catch (e) { 
      console.error(e); 
      showNotification("Terjadi kesalahan saat menghapus", "error");
    }
  };

  const handleClearHistory = async () => {
    try {
      const res = await fetch('/api/youtube/jobs-history/clear', { method: 'DELETE' });
      if (res.ok) {
        showNotification("Riwayat berhasil dibersihkan", "success");
        fetchJobs();
      } else {
        showNotification("Gagal membersihkan riwayat", "error");
      }
    } catch (e) { 
      console.error(e); 
      showNotification("Terjadi kesalahan saat membersihkan riwayat", "error");
    }
  };

  const handleSchedule = async () => {
    if (!videoFile || !title || !selectedChannelId) {
      showNotification("Please fill in all required fields (Video, Title, and Channel)", "error");
      return;
    }

    if (uploadStatus === 'uploading') {
      showNotification("Harap tunggu hingga upload video selesai.", "info");
      return;
    }

    if (uploadStatus === 'error' || !videoPath) {
      showNotification("Gagal mengupload video. Silakan coba lagi.", "error");
      return;
    }

    setIsScheduling(true);

    // Convert tags input to array
    const tagsArray = tagsInput.split(',').map(t => t.trim()).filter(t => t !== "");

    try {
      // 2. Add to Queue
      const queueRes = await fetch('/api/youtube/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          tags: tagsArray,
          videoPath: videoPath,
          thumbnailPath: thumbnailPath,
          privacy,
          playlistId,
          scheduledAt: scheduledDate && scheduledTime ? `${scheduledDate}T${scheduledTime}:00+07:00` : null,
          channelId: selectedChannelId,
          categoryId,
          madeForKids,
          aiLabel,
          monetization
        })
      });

      if (queueRes.ok) {
        showNotification("Video added to queue successfully!", "success");
        // Reset form
        setTitle("");
        setDescription("");
        setTagsInput("");
        setVideoFile(null);
        setThumbnailFile(null);
        setPlaylistId("");
        setVideoPath(null);
        setThumbnailPath(null);
        setUploadStatus('idle');
      } else {
        throw new Error("Failed to add to queue");
      }
    } catch (e: any) {
      showNotification(e.message || "An error occurred", "error");
    } finally {
      setIsScheduling(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'queued': return <Clock4 className="w-4 h-4 text-slate-500" />;
      case 'uploading': return <Upload className="w-4 h-4 text-blue-500 animate-bounce" />;
      case 'processing': return <Activity className="w-4 h-4 text-purple-500 animate-pulse" />;
      case 'publishing': return <Globe className="w-4 h-4 text-amber-500 animate-spin" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] p-4 md:p-8 font-sans relative selection:bg-red-500/30">
      {/* Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 20, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={`fixed top-4 left-1/2 z-50 px-6 py-3 rounded-xl border shadow-2xl flex items-center gap-3 min-w-[300px] ${
              notification.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
              notification.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
              'bg-blue-500/10 border-blue-500/20 text-blue-400'
            }`}
          >
            {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {notification.type === 'error' && <AlertCircle className="w-5 h-5" />}
            {notification.type === 'info' && <Loader2 className="w-5 h-5 animate-spin" />}
            <span className="font-medium">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-8">
        
        {/* Left Column: Form */}
        <div className="col-span-12 lg:col-span-7 space-y-8">
          <div className="glass-card rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600" />
            
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 glow-red">
                  <Youtube className="w-7 h-7 text-red-500" />
                </div>
                <div>
                  <h2 className="text-3xl font-display font-extrabold text-white tracking-tight">YouTube <span className="text-red-500">Automation</span></h2>
                  <p className="text-sm text-slate-400 font-medium">Configure your video metadata and schedule</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-4">
                <div className="px-3 py-1.5 bg-red-500/10 rounded-lg border border-red-500/20 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Realtime Sync Active</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-slate-800 rounded-2xl backdrop-blur-md">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Engine Active</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* Channel Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Youtube className="w-3 h-3" /> Target Channel
                    </label>
                    {apiConfigs.length > 0 && (
                      <div className="flex flex-col">
                        <span className="text-[9px] text-green-500 font-bold mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-2 h-2" /> API Config: {apiConfigs[0].name}
                        </span>
                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">API Key Terintegrasi</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      ref={configInputRef} 
                      onChange={handleConfigUpload} 
                      className="hidden" 
                      accept=".json"
                    />
                  </div>
                </div>
                <div className="relative group/select">
                  <select 
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-red-500/50 transition-all appearance-none text-slate-200 font-medium cursor-pointer hover:bg-white/10"
                  >
                    {channels.length === 0 ? (
                      <option value="" className="bg-[#0a0a0a]">Belum ada channel terhubung. Silakan hubungkan terlebih dahulu.</option>
                    ) : (
                      channels.map(c => (
                        <option key={c.id} value={c.id} className="bg-[#0a0a0a]">
                          {c.name} {c.email && c.email !== "user@example.com" ? `(${c.email})` : ""}
                        </option>
                      ))
                    )}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-focus-within/select:text-red-500 transition-colors">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Video & Thumbnail Upload */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  onClick={() => videoInputRef.current?.click()}
                  className={`p-8 border-2 border-dashed rounded-3xl transition-all cursor-pointer flex flex-col items-center justify-center gap-4 relative overflow-hidden group ${
                    videoFile ? "bg-blue-500/5 border-blue-500/30 glow-blue" : "bg-slate-950/50 border-slate-800 hover:border-blue-500/40 hover:bg-blue-500/5"
                  }`}
                >
                  <div className="absolute top-3 right-3 px-2 py-0.5 bg-blue-500/10 rounded-lg border border-blue-500/20 flex items-center gap-1.5 z-20">
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-[7px] font-bold text-blue-400 uppercase tracking-widest">Realtime Upload</span>
                  </div>
                  <input 
                    type="file" 
                    ref={videoInputRef} 
                    className="hidden" 
                    accept="video/mp4,video/quicktime,video/x-msvideo"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setVideoFile(file);
                        uploadFile(file, 'video');
                      }
                    }}
                  />
                  {videoFile ? (
                    <>
                      {uploadStatus === 'uploading' && (
                        <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-4 z-10">
                          <div className="w-full space-y-2">
                            <div className="flex justify-between text-[10px] font-bold text-blue-400 uppercase">
                              <span>Uploading...</span>
                              <span>{uploadProgress}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${uploadProgress}%` }}
                                className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      {uploadStatus === 'success' && (
                        <div className="absolute inset-0 bg-green-500/10 flex flex-col items-center justify-center p-4 z-10">
                          <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                          <span className="text-[10px] font-bold text-green-500 uppercase">Upload Selesai</span>
                        </div>
                      )}
                      {uploadStatus === 'error' && (
                        <div className="absolute inset-0 bg-red-500/10 flex flex-col items-center justify-center p-4 z-10">
                          <XCircle className="w-8 h-8 text-red-500 mb-2" />
                          <span className="text-[10px] font-bold text-red-400 uppercase text-center px-2">{uploadErrorMessage}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setVideoFile(null); setUploadStatus('idle'); }}
                            className="text-[10px] text-slate-400 underline mt-2"
                          >
                            Coba Lagi
                          </button>
                        </div>
                      )}
                      <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                        <Video className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-200 truncate max-w-[150px]">{videoFile.name}</p>
                        <button onClick={(e) => { e.stopPropagation(); setVideoFile(null); setVideoPath(null); setUploadStatus('idle'); }} className="text-[10px] text-red-400 hover:underline mt-1">Remove</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-700" />
                      <p className="text-xs font-bold text-slate-500 text-center">Upload Video<br/><span className="text-[10px] opacity-50">(mp4, mov, avi)</span></p>
                    </>
                  )}
                </div>

                <div 
                  onClick={() => thumbnailInputRef.current?.click()}
                  className={`p-8 border-2 border-dashed rounded-3xl transition-all cursor-pointer flex flex-col items-center justify-center gap-4 relative overflow-hidden group ${
                    thumbnailFile ? "bg-purple-500/5 border-purple-500/30 glow-blue" : "bg-slate-950/50 border-slate-800 hover:border-purple-500/40 hover:bg-purple-500/5"
                  }`}
                >
                  <div className="absolute top-3 right-3 px-2 py-0.5 bg-purple-500/10 rounded-lg border border-purple-500/20 flex items-center gap-1.5 z-20">
                    <div className="w-1 h-1 bg-purple-500 rounded-full animate-pulse" />
                    <span className="text-[7px] font-bold text-purple-400 uppercase tracking-widest">Realtime Sync</span>
                  </div>
                  <input 
                    type="file" 
                    ref={thumbnailInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setThumbnailFile(file);
                        uploadFile(file, 'thumbnail');
                      }
                    }}
                  />
                  {thumbnailFile ? (
                    <>
                      {thumbnailPreview ? (
                        <div className="absolute inset-0 z-0">
                          <img src={thumbnailPreview} alt="Preview" className="w-full h-full object-cover opacity-40" />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center z-10">
                          <ImageIcon className="w-6 h-6 text-purple-400" />
                        </div>
                      )}
                      <div className="text-center z-10">
                        <p className="text-xs font-bold text-slate-200 truncate max-w-[150px]">{thumbnailFile.name}</p>
                        <button onClick={(e) => { e.stopPropagation(); setThumbnailFile(null); }} className="text-[10px] text-red-400 hover:underline mt-1">Remove</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8 text-slate-700" />
                      <p className="text-xs font-bold text-slate-500">Custom Thumbnail</p>
                    </>
                  )}
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Type className="w-3 h-3" /> Video Title
                  </label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter a catchy title..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500/50 transition-colors text-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <AlignLeft className="w-3 h-3" /> Description
                  </label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell viewers about your video..."
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500/50 transition-colors resize-none text-slate-200"
                  />
                </div>
              </div>

              {/* Tags & Playlist */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Tag className="w-3 h-3" /> Tags (Koma Separator)
                  </label>
                  <input 
                    type="text" 
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="game, live, viral, indonesia..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500/50 transition-colors text-slate-200"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <LayoutList className="w-3 h-3" /> Target Playlist (Optional)
                  </label>
                  <div className="relative">
                    <select 
                      value={playlistId}
                      onChange={(e) => setPlaylistId(e.target.value)}
                      disabled={isLoadingPlaylists || !selectedChannelId}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500/50 transition-colors appearance-none text-slate-300 disabled:opacity-50"
                    >
                      <option value="">No Playlist (Upload to Channel only)</option>
                      {playlists.map((pl: any) => (
                        <option key={pl.id} value={pl.id}>{pl.snippet.title}</option>
                      ))}
                    </select>
                    {isLoadingPlaylists && (
                      <div className="absolute right-10 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                      </div>
                    ) }
                  </div>
                  <p className="text-[10px] text-slate-600">The video will be added to this playlist after upload.</p>
                </div>
              </div>

              {/* Advanced Broadcast Settings */}
              <div className="pt-8 border-t border-slate-800/50 space-y-6">
                <div 
                  className="flex items-center justify-between cursor-pointer group"
                  onClick={() => setIsAdvancedSettingsOpen(!isAdvancedSettingsOpen)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 glow-blue">
                      <SettingsIcon className="w-5 h-5 text-blue-500" />
                    </div>
                    <h3 className="text-base font-display font-bold text-white uppercase tracking-widest">Advanced Settings</h3>
                  </div>
                  <button className="p-2.5 bg-slate-900/50 hover:bg-slate-800 text-slate-400 rounded-xl transition-all border border-slate-800 group-hover:border-blue-500/30">
                    {isAdvancedSettingsOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>

                <AnimatePresence>
                  {isAdvancedSettingsOpen && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        {/* Left Column */}
                        <div className="space-y-6">
                    {/* Category */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Tag className="w-3 h-3" /> # Kategori
                      </label>
                      <select 
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500/50 transition-colors appearance-none text-slate-300"
                      >
                        <option value="1">Film & Animation</option>
                        <option value="2">Autos & Vehicles</option>
                        <option value="10">Music</option>
                        <option value="15">Pets & Animals</option>
                        <option value="17">Sports</option>
                        <option value="19">Travel & Events</option>
                        <option value="20">Gaming</option>
                        <option value="22">People & Blogs</option>
                        <option value="23">Comedy</option>
                        <option value="24">Entertainment</option>
                        <option value="25">News & Politics</option>
                        <option value="26">Howto & Style</option>
                        <option value="27">Education</option>
                        <option value="28">Science & Technology</option>
                        <option value="29">Nonprofits & Activism</option>
                      </select>
                    </div>

                    {/* Privacy Saat Live */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Globe className="w-3 h-3" /> PRIVASI
                        </label>
                        {apiConfigs.length > 0 && (
                          <span className="text-[8px] text-green-500 font-bold uppercase tracking-tighter flex items-center gap-1">
                            <CheckCircle2 className="w-2 h-2" /> Terintegrasi
                          </span>
                        )}
                      </div>
                      <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1">
                        {(['public', 'private'] as const).map((p) => (
                          <button
                            key={p}
                            onClick={() => setPrivacy(p)}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                              privacy === p 
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                                : "text-slate-500 hover:text-slate-300"
                            }`}
                          >
                            {p === 'public' && <Globe className="w-3 h-3" />}
                            {p === 'private' && <XCircle className="w-3 h-3" />}
                            {p === 'public' ? 'PUBLIK' : 'PRIBADI'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* AI Label */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Activity className="w-3 h-3" /> KONTEN MODIFIKASI
                        </label>
                        {apiConfigs.length > 0 && (
                          <span className="text-[8px] text-green-500 font-bold uppercase tracking-tighter flex items-center gap-1">
                            <CheckCircle2 className="w-2 h-2" /> Terintegrasi
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setAiLabel(true)}
                          className={`py-3 rounded-xl border text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                            aiLabel 
                              ? "bg-blue-600/10 border-blue-600 text-blue-400" 
                              : "bg-slate-950 border-slate-800 text-slate-500"
                          }`}
                        >
                          <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${aiLabel ? "border-blue-400" : "border-slate-700"}`}>
                            {aiLabel && <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />}
                          </div>
                          Ya
                        </button>
                        <button
                          onClick={() => setAiLabel(false)}
                          className={`py-3 rounded-xl border text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                            !aiLabel 
                              ? "bg-blue-600/10 border-blue-600 text-blue-400" 
                              : "bg-slate-950 border-slate-800 text-slate-500"
                          }`}
                        >
                          <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${!aiLabel ? "border-blue-400" : "border-slate-700"}`}>
                            {!aiLabel && <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />}
                          </div>
                          Tidak
                        </button>
                      </div>
                    </div>
                  </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                    {/* Made for Kids */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Activity className="w-3 h-3" /> Pembatasan & Kepatuhan (Kids)
                      </label>
                      <div className="space-y-2">
                        <button
                          onClick={() => setMadeForKids(false)}
                          className={`w-full py-4 px-4 rounded-xl border text-[10px] font-bold uppercase transition-all flex items-center gap-3 ${
                            !madeForKids 
                              ? "bg-blue-600/10 border-blue-600 text-blue-400" 
                              : "bg-slate-950 border-slate-800 text-slate-500"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${!madeForKids ? "border-blue-400" : "border-slate-700"}`}>
                            {!madeForKids && <div className="w-2 h-2 bg-blue-400 rounded-full" />}
                          </div>
                          Tidak, video ini tidak dibuat untuk anak-anak
                        </button>
                        <button
                          onClick={() => setMadeForKids(true)}
                          className={`w-full py-4 px-4 rounded-xl border text-[10px] font-bold uppercase transition-all flex items-center gap-3 ${
                            madeForKids 
                              ? "bg-blue-600/10 border-blue-600 text-blue-400" 
                              : "bg-slate-950 border-slate-800 text-slate-500"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${madeForKids ? "border-blue-400" : "border-slate-700"}`}>
                            {madeForKids && <div className="w-2 h-2 bg-blue-400 rounded-full" />}
                          </div>
                          Ya, video ini dibuat untuk anak-anak
                        </button>
                      </div>
                    </div>

                    {/* Monetization */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Activity className="w-3 h-3" /> Monetisasi & Iklan
                      </label>
                      <div className="p-6 bg-slate-950 border border-emerald-500/20 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold text-emerald-500 uppercase">Aktifkan Monetisasi</p>
                            <p className="text-[8px] text-slate-600 font-bold uppercase">YPP Required</p>
                          </div>
                          <button 
                            onClick={() => setMonetization(!monetization)}
                            className={`w-12 h-6 rounded-full p-1 transition-all ${monetization ? "bg-emerald-500" : "bg-slate-800"}`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full transition-all ${monetization ? "translate-x-6" : "translate-x-0"}`} />
                          </button>
                        </div>
                        <div className="pt-4 border-t border-slate-800">
                          <label className="text-[9px] font-bold text-slate-500 uppercase block mb-2">Distribusi Iklan</label>
                          <select className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-bold text-slate-300 focus:outline-none">
                            <option>Otomatis (Default)</option>
                            <option>Manual Placement</option>
                          </select>
                        </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

              {/* Scheduling */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Publish Date
                  </label>
                  <input 
                    type="date" 
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500/50 transition-colors text-slate-300"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-3 h-3" /> Publish Time
                  </label>
                  <input 
                    type="time" 
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-red-500/50 transition-colors text-slate-300"
                  />
                </div>
              </div>

              <button 
                onClick={handleSchedule}
                disabled={isScheduling || !videoFile || !title}
                className="w-full py-5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-display font-extrabold text-lg rounded-2xl transition-all shadow-xl shadow-red-600/25 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01] active:scale-[0.99]"
              >
                {isScheduling ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
                {isScheduling ? "PROCESSING..." : "TAMBAHKAN KE ANTREAN"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Queue Status */}
        <div className="col-span-12 lg:col-span-5 space-y-8">
          <div className="glass-card rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[calc(100vh-10rem)] relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600" />
            
            <div className="p-6 border-b border-slate-800/50 bg-slate-900/30 flex items-center justify-between">
              <h3 className="text-xs font-display font-bold uppercase tracking-widest text-slate-300 flex items-center gap-3">
                <ListOrdered className="w-5 h-5 text-blue-500" />
                Live Video Queue
              </h3>
              <div className="px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20 glow-blue">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tighter">{jobs.filter(j => !['completed', 'failed'].includes(j.status.toLowerCase())).length} Active Tasks</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Layer 1: Queue (waiting_schedule) */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Clock4 className="w-3 h-3 text-slate-500" /> Queue (Waiting Schedule)
                </h4>
                {jobs.filter(j => j.status.toLowerCase() === 'queued').length === 0 ? (
                  <div className="p-4 border border-dashed border-slate-800 rounded-2xl text-center">
                    <p className="text-[10px] text-slate-600 uppercase font-bold">No items waiting</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {jobs.filter(j => j.status.toLowerCase() === 'queued').map((job) => (
                      <motion.div 
                        key={job.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-800">
                              <Video className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-200 truncate max-w-[150px]">{job.data?.title || "Untitled"}</h4>
                              <p className="text-[10px] text-slate-500 uppercase tracking-widest">{job.status}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(job.status)}
                            <button 
                              onClick={() => handleDeleteJob(job.id)}
                              className="p-1.5 bg-slate-900 hover:bg-red-500/10 text-slate-600 hover:text-red-500 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {job.data?.scheduledAt && (
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            <Clock className="w-3 h-3" />
                            {formatToJakarta(job.data.scheduledAt)}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>

              {/* Layer 2: Live Video Queue (processing) */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-3 h-3 text-blue-500" /> Live Video Queue (Processing)
                </h4>
                {jobs.filter(j => !['queued', 'completed', 'failed'].includes(j.status.toLowerCase())).length === 0 ? (
                  <div className="p-4 border border-dashed border-slate-800 rounded-2xl text-center">
                    <p className="text-[10px] text-slate-600 uppercase font-bold">No active tasks</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {jobs.filter(j => !['queued', 'completed', 'failed'].includes(j.status.toLowerCase())).map((job) => (
                      <motion.div 
                        key={job.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-800">
                              <Video className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-200 truncate max-w-[150px]">{job.data?.title || "Untitled"}</h4>
                              <p className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                {job.status}
                                {job.status.toLowerCase() === 'completed' && job.videoUrl && (
                                  <a 
                                    href={job.videoUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-blue-400 hover:underline flex items-center gap-1 normal-case"
                                  >
                                    View <ExternalLink className="w-2 h-2" />
                                  </a>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(job.status)}
                          </div>
                        </div>

                        {job.status.toLowerCase() === 'failed' && job.error && (
                          <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-[10px] text-red-400 font-medium">Error: {job.error}</p>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                            <span>Progress</span>
                            <span>{job.progress}%</span>
                          </div>
                          <div className="h-1 bg-slate-950 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${job.progress}%` }}
                              className="h-full bg-blue-500"
                            />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-500/80 leading-relaxed font-medium">
              Sistem antrean menggunakan Redis + BullMQ (Simulasi). Video akan diupload secara berurutan untuk menghindari limitasi API Google.
            </p>
          </div>
        </div>

      </div>

      {/* History Table Section */}
      <div className="max-w-7xl mx-auto mt-12 pb-20">
        <HistoryTable />
      </div>

      {/* OAuth Device Flow Modal */}
      <AnimatePresence>
        {showDeviceModal && deviceCodeData && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#111] border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/20">
                  <Globe className="w-8 h-8 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Connect YouTube Channel</h3>
                  <p className="text-sm text-slate-500 mt-2">Please follow the steps below on your phone or computer</p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left">
                    <p className="text-[10px] font-bold text-slate-600 uppercase mb-2">Step 1: Visit URL</p>
                    <a 
                      href={deviceCodeData.verification_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-blue-400 hover:underline flex items-center justify-between text-sm break-all"
                    >
                      {deviceCodeData.verification_url}
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    </a>
                  </div>

                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left">
                    <p className="text-[10px] font-bold text-slate-600 uppercase mb-2">Step 2: Enter Code</p>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-mono font-bold tracking-widest text-white">{deviceCodeData.user_code}</span>
                      <button 
                        onClick={() => navigator.clipboard.writeText(deviceCodeData.user_code)}
                        className="p-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-blue-400 transition-all"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 py-4">
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  <span className="text-xs text-slate-400">Waiting for authorization...</span>
                </div>

                <button 
                  onClick={stopPolling}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 text-sm font-bold rounded-2xl transition-all border border-slate-800"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
