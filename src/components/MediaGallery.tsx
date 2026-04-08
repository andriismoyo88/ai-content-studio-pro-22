import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  Filter, 
  Grid, 
  List, 
  MoreVertical, 
  Play, 
  Download, 
  Edit2, 
  Trash2, 
  Link as LinkIcon,
  Plus,
  X,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  Youtube,
  HardDrive,
  Globe,
  FileVideo
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import axios from "axios";
import { MediaAsset } from "../types";
import { format } from "date-fns";

export default function MediaGallery() {
  const [videos, setVideos] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<MediaAsset | null>(null);
  
  // Link processing state
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState("");

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isClearingFailed, setIsClearingFailed] = useState(false);
  const [showClearFailedConfirm, setShowClearFailedConfirm] = useState(false);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/media", {
        params: { search, source: filterSource !== "all" ? filterSource : undefined }
      });
      if (Array.isArray(res.data)) {
        setVideos(res.data);
      } else {
        console.error("API returned non-array data for media:", res.data);
        setVideos([]);
      }
    } catch (err) {
      console.error("Failed to fetch videos", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [search, filterSource]);

  useEffect(() => {
    const hasActiveJobs = videos.some(v => v.status === 'processing' || v.status === 'uploading');
    if (hasActiveJobs) {
      const interval = setInterval(fetchVideos, 3000);
      return () => clearInterval(interval);
    }
  }, [videos]);

  const handleProcessLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl) return;

    try {
      setIsProcessing(true);
      setProcessError("");
      await axios.post("/api/media/process", {
        url: linkUrl,
        filename: linkName
      });
      setIsLinkModalOpen(false);
      setLinkUrl("");
      setLinkName("");
      fetchVideos();
    } catch (err: any) {
      setProcessError(err.response?.data?.error || "Failed to process link");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;

    try {
      setIsUploading(true);
      
      // 1. Initialize upload on server
      const initRes = await axios.post("/api/media/upload-init", {
        filename: uploadFile.name,
        size: uploadFile.size
      });
      const mediaId = initRes.data.id;
      
      // Add to local state immediately for real-time feedback
      const placeholder: MediaAsset = {
        ...initRes.data,
        status: 'uploading',
        progress: 0
      };
      setVideos(prev => [placeholder, ...prev]);

      // 2. Perform actual upload
      const formData = new FormData();
      formData.append("id", mediaId);
      formData.append("video", uploadFile);
      
      await axios.post("/api/media/upload", formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(percentCompleted);
          
          // Update local state progress (0-80% for upload, 80-100% for processing)
          const totalProgress = Math.round(percentCompleted * 0.8);
          setVideos(prev => prev.map(v => v.id === mediaId ? { ...v, progress: totalProgress } : v));
        }
      });

      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadProgress(0);
      fetchVideos();
    } catch (err) {
      console.error("Upload failed", err);
      fetchVideos(); // Refresh to show failed state if any
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`/api/media/${id}`);
      fetchVideos();
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleClearFailed = async () => {
    setIsClearingFailed(true);
    try {
      const failedVideos = videos.filter(v => v.status === 'failed');
      for (const v of failedVideos) {
        await axios.delete(`/api/media/${v.id}`);
      }
      fetchVideos();
      setShowClearFailedConfirm(false);
    } catch (err) {
      console.error("Clear failed failed", err);
    } finally {
      setIsClearingFailed(false);
    }
  };

  const handleRename = async (id: string, oldName: string) => {
    const newName = prompt("Enter new filename:", oldName);
    if (!newName || newName === oldName) return;

    try {
      await axios.patch(`/api/media/${id}`, { filename: newName });
      fetchVideos();
    } catch (err) {
      console.error("Rename failed", err);
    }
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/api/media/stream/${id}`;
    navigator.clipboard.writeText(url);
    alert("Public link copied to clipboard!");
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "youtube": return <Youtube className="w-4 h-4 text-red-500" />;
      case "drive": return <HardDrive className="w-4 h-4 text-blue-500" />;
      case "direct": return <Globe className="w-4 h-4 text-green-500" />;
      default: return <FileVideo className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map(v => v.toString().padStart(2, "0")).filter((v, i) => v !== "00" || i > 0).join(":");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Galeri Media</h1>
          <p className="text-slate-400 text-sm">Manajemen aset video dari berbagai sumber</p>
        </div>
        <div className="flex items-center gap-3">
          {videos.some(v => v.status === 'failed') && (
            <button 
              onClick={() => setShowClearFailedConfirm(true)}
              disabled={isClearingFailed}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all border border-red-500/20 text-sm font-medium disabled:opacity-50"
            >
              {isClearingFailed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>{isClearingFailed ? 'Membersihkan...' : 'Bersihkan Gagal'}</span>
            </button>
          )}
          <button 
            onClick={() => setIsLinkModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all border border-slate-700"
          >
            <LinkIcon className="w-4 h-4" />
            <span>Proses Link</span>
          </button>
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Video</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text"
            placeholder="Cari berdasarkan nama file..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-200"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <select 
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-200 appearance-none"
          >
            <option value="all">Semua Sumber</option>
            <option value="drive">Google Drive</option>
            <option value="youtube">YouTube</option>
            <option value="local">Upload Lokal</option>
            <option value="direct">Direct URL</option>
          </select>
        </div>
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button 
            onClick={() => setViewMode("grid")}
            className={`flex-1 flex justify-center py-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-slate-800 text-blue-400" : "text-slate-500 hover:text-slate-300"}`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode("list")}
            className={`flex-1 flex justify-center py-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-slate-800 text-blue-400" : "text-slate-500 hover:text-slate-300"}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Gallery Grid */}
      {loading && videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-slate-400">Memuat galeri media...</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-slate-900/30 rounded-3xl border-2 border-dashed border-slate-800">
          <FileVideo className="w-16 h-16 text-slate-700" />
          <div className="text-center">
            <h3 className="text-lg font-medium text-slate-300">Belum ada video</h3>
            <p className="text-slate-500 text-sm">Mulai dengan mengupload video atau memproses link</p>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {(videos || []).map((video) => (
            <motion.div 
              key={video.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group relative bg-slate-900 rounded-2xl border border-slate-800 hover:border-blue-500/50 transition-all hover:shadow-2xl hover:shadow-blue-500/10 hover:z-30"
            >
              {/* Thumbnail Area */}
              <div className="aspect-video relative bg-slate-950 overflow-hidden rounded-t-2xl">
                {video.status === "ready" ? (
                  <img 
                    src={video.thumbnail || "https://picsum.photos/seed/video/400/225"} 
                    alt={video.filename}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center space-y-2 bg-slate-900">
                    {video.status === "processing" || video.status === "uploading" ? (
                      <div className="w-full px-6 space-y-3">
                        <div className="flex items-center justify-center">
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                            <span className="text-blue-400">{video.status}</span>
                            <span className="text-slate-400">{video.progress || 0}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${video.progress || 0}%` }}
                              className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-red-400 font-medium uppercase tracking-wider">Failed</span>
                          {video.error && (
                            <p className="text-[9px] text-red-500/70 max-w-[150px] text-center line-clamp-1 mb-1" title={video.error}>
                              {video.error}
                            </p>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(video.id);
                            }}
                            className="mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-bold rounded-lg border border-red-500/30 transition-all"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Duration Badge */}
                {video.status === "ready" && (
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 backdrop-blur-md rounded text-[10px] font-bold text-white">
                    {formatDuration(video.duration)}
                  </div>
                )}

                {/* Source Badge */}
                <div className="absolute top-2 left-2 px-2 py-1 bg-slate-900/80 backdrop-blur-md rounded-lg flex items-center gap-1.5 border border-slate-700/50">
                  {getSourceIcon(video.source)}
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">{video.source}</span>
                </div>

                {/* Hover Overlay */}
                {video.status === "ready" && (
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button 
                      onClick={() => setSelectedVideo(video)}
                      className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-all transform hover:scale-110 shadow-xl"
                    >
                      <Play className="w-5 h-5 fill-current" />
                    </button>
                  </div>
                )}
              </div>

              {/* Info Area */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-200 line-clamp-1 flex-1" title={video.filename}>
                    {video.filename}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setDeleteConfirmId(video.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="relative group/menu">
                      <button className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      <div className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-50 overflow-hidden">
                      <button 
                        onClick={() => handleRename(video.id, video.filename)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Rename
                      </button>
                      <button 
                        onClick={() => copyLink(video.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
                      >
                        <LinkIcon className="w-3.5 h-3.5" /> Copy Link
                      </button>
                      <a 
                        href={`/api/media/download/${video.id}`}
                        download={video.filename}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                      <div className="h-px bg-slate-700 my-1" />
                      <button 
                        onClick={() => setDeleteConfirmId(video.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
                
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <div className="flex items-center gap-3">
                    <span>{formatSize(video.size)}</span>
                    <span className="w-1 h-1 bg-slate-700 rounded-full" />
                    <span>{format(new Date(video.createdAt), "dd MMM yyyy")}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {(videos || []).map((video) => (
            <motion.div 
              key={video.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="group flex items-center gap-4 bg-slate-900 p-3 rounded-2xl border border-slate-800 hover:border-blue-500/50 transition-all hover:shadow-lg"
            >
              <div className="w-32 aspect-video relative bg-slate-950 overflow-hidden rounded-xl shrink-0">
                {video.status === "ready" ? (
                  <img 
                    src={video.thumbnail || "https://picsum.photos/seed/video/400/225"} 
                    alt={video.filename}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-900">
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  </div>
                )}
                {video.status === "ready" && (
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      onClick={() => setSelectedVideo(video)}
                      className="p-2 bg-blue-600 text-white rounded-full"
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getSourceIcon(video.source)}
                  <h3 className="text-sm font-semibold text-slate-200 truncate" title={video.filename}>
                    {video.filename}
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span>{formatSize(video.size)}</span>
                  <span className="w-1 h-1 bg-slate-700 rounded-full" />
                  <span>{video.status === "ready" ? formatDuration(video.duration) : video.status}</span>
                  <span className="w-1 h-1 bg-slate-700 rounded-full" />
                  <span>{format(new Date(video.createdAt), "dd MMM yyyy")}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pr-2">
                <button 
                  onClick={() => copyLink(video.id)}
                  className="p-2 text-slate-500 hover:text-blue-400 rounded-lg hover:bg-blue-500/10 transition-colors"
                  title="Copy Link"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>
                <div className="relative group/menu">
                  <button className="p-2 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-50 overflow-hidden">
                    <button 
                      onClick={() => handleRename(video.id, video.filename)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Rename
                    </button>
                    <button 
                      onClick={() => copyLink(video.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      <LinkIcon className="w-3.5 h-3.5" /> Copy Link
                    </button>
                    <a 
                      href={`/api/media/download/${video.id}`}
                      download={video.filename}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                    <div className="h-px bg-slate-700 my-1" />
                    <button 
                      onClick={() => setDeleteConfirmId(video.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Link Process Modal */}
      <AnimatePresence>
        {isLinkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isProcessing && setIsLinkModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-xl">
                    <LinkIcon className="w-5 h-5 text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-100">Proses Link Video</h2>
                </div>
                <button onClick={() => setIsLinkModalOpen(false)} className="p-2 text-slate-500 hover:text-slate-300 rounded-full hover:bg-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleProcessLink} className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">URL Video (Gdrive/YouTube/Direct)</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="url"
                      required
                      placeholder="https://..."
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Simpan Dengan Nama (Opsional)</label>
                  <div className="relative">
                    <Edit2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      type="text"
                      placeholder="video_saya"
                      value={linkName}
                      onChange={(e) => setLinkName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-200"
                    />
                  </div>
                </div>

                {processError && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{processError}</span>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      <span>Mulai Proses Unduh</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isUploading && setIsUploadModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-xl">
                    <Plus className="w-5 h-5 text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-100">Upload Video Baru</h2>
                </div>
                <button onClick={() => setIsUploadModalOpen(false)} className="p-2 text-slate-500 hover:text-slate-300 rounded-full hover:bg-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div 
                  className={`relative border-2 border-dashed rounded-3xl p-10 transition-all flex flex-col items-center justify-center space-y-4 ${
                    uploadFile ? "border-blue-500 bg-blue-500/5" : "border-slate-800 hover:border-slate-700 bg-slate-950/50"
                  }`}
                >
                  <input 
                    type="file"
                    accept="video/*"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={isUploading}
                  />
                  <div className={`p-4 rounded-full ${uploadFile ? "bg-blue-500 text-white" : "bg-slate-900 text-slate-500"}`}>
                    <FileVideo className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <p className="text-slate-200 font-medium">{uploadFile ? uploadFile.name : "Pilih file video"}</p>
                    <p className="text-slate-500 text-xs mt-1">MP4, MKV, MOV, dll (Maksimal 100GB)</p>
                  </div>
                </div>

                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-400">Mengupload...</span>
                      <span className="text-blue-400">{uploadProgress}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        className="h-full bg-blue-500"
                      />
                    </div>
                  </div>
                )}

                <button 
                  onClick={handleUpload}
                  disabled={!uploadFile || isUploading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Mengupload...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      <span>Mulai Upload</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Video Preview Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVideo(null)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-6xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10"
            >
              <video 
                src={`/api/media/stream/${selectedVideo.id}`}
                controls
                autoPlay
                className="w-full h-full"
              />
              <button 
                onClick={() => setSelectedVideo(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                <h2 className="text-xl font-bold text-white">{selectedVideo.filename}</h2>
                <div className="flex items-center gap-4 mt-2 text-white/60 text-sm">
                  <span className="flex items-center gap-1.5">
                    {getSourceIcon(selectedVideo.source)}
                    {selectedVideo.source.toUpperCase()}
                  </span>
                  <span>{formatSize(selectedVideo.size)}</span>
                  <span>{formatDuration(selectedVideo.duration)}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full shadow-2xl"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-red-500/10 rounded-full">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-100">Hapus Video?</h3>
                  <p className="text-slate-400 text-sm">Tindakan ini tidak dapat dibatalkan. Video akan dihapus secara permanen.</p>
                </div>
                <div className="flex gap-3 w-full pt-2">
                  <button 
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={() => handleDelete(deleteConfirmId)}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/20"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear Failed Confirmation Modal */}
      <AnimatePresence>
        {showClearFailedConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 border border-slate-800 p-6 rounded-3xl max-w-sm w-full shadow-2xl"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-red-500/10 rounded-full">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-100">Bersihkan Gagal?</h3>
                  <p className="text-slate-400 text-sm">Semua video dengan status gagal akan dihapus dari galeri.</p>
                </div>
                <div className="flex gap-3 w-full pt-2">
                  <button 
                    onClick={() => setShowClearFailedConfirm(false)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleClearFailed}
                    disabled={isClearingFailed}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
                  >
                    {isClearingFailed ? 'Membersihkan...' : 'Bersihkan'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
