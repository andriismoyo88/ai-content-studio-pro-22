import { useState, useRef, ChangeEvent, useEffect } from "react";
import { 
  Settings as SettingsIcon, 
  Key, 
  Plus, 
  Trash2, 
  FileJson, 
  Upload, 
  Youtube, 
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Activity,
  RefreshCw,
  Copy,
  Loader2,
  Cpu,
  Database,
  Server,
  Shield,
  Globe,
  Zap,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { APIConfig, YouTubeChannel, SystemStats } from "../types";

export default function Settings() {
  const [isUploading, setIsUploading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [deviceCodeData, setDeviceCodeData] = useState<any>(null);
  const [pollInterval, setPollInterval] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [apiConfigs, setApiConfigs] = useState<APIConfig[]>([]);
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [isChannelManagementOpen, setIsChannelManagementOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Fetch initial data
  useEffect(() => {
    fetchConfigs();
    fetchChannels();
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/config/api-keys');
      const data = await res.json();
      setApiConfigs(data);
      if (data.length > 0 && !selectedConfigId) setSelectedConfigId(data[0].id);
    } catch (e) { console.error(e); }
  };

  const fetchChannels = async () => {
    try {
      const res = await fetch('/api/youtube/channels');
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
        localStorage.setItem("YOUTUBE_CHANNELS", JSON.stringify(data));
      } else {
        const saved = localStorage.getItem("YOUTUBE_CHANNELS");
        if (saved && saved !== "undefined") {
          try {
            setChannels(JSON.parse(saved));
          } catch (e) {
            console.error("Error parsing saved channels:", e);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch channels:", e);
      const saved = localStorage.getItem("YOUTUBE_CHANNELS");
      if (saved && saved !== "undefined") {
        try {
          setChannels(JSON.parse(saved));
        } catch (e) {
          console.error("Error parsing saved channels:", e);
        }
      }
    }
  };

  const handleDeleteConfig = async (id: string) => {
    try {
      const res = await fetch(`/api/config/api-keys/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchConfigs();
        // Also remove channels from local state that were associated with this config
        const updatedChannels = channels.filter(c => c.configId !== id);
        setChannels(updatedChannels);
        localStorage.setItem("YOUTUBE_CHANNELS", JSON.stringify(updatedChannels));
        showNotification("API Config deleted successfully!", "success");
      }
    } catch (e) { 
      console.error(e); 
      showNotification("Failed to delete API Config", "error");
    }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!id) return;

    try {
      const res = await fetch(`/api/youtube/channels/${encodeURIComponent(id)}`, { 
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        const updatedChannels = channels.filter(c => c.id !== id);
        setChannels(updatedChannels);
        localStorage.setItem("YOUTUBE_CHANNELS", JSON.stringify(updatedChannels));
        showNotification("Channel disconnected successfully!", "success");
        // Force refresh from server to ensure sync
        fetchChannels();
      } else {
        const errorData = await res.json();
        showNotification(`Failed to delete channel: ${errorData.error || 'Unknown error'}`, "error");
      }
    } catch (e) { 
      console.error("Error deleting channel:", e);
      showNotification("An error occurred while deleting the channel.", "error");
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (e) { console.error(e); }
  };

  const handleTestConfig = async (id: string) => {
    try {
      const res = await fetch(`/api/config/api-keys/test/${id}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showNotification(data.message || "Connection successful!", "success");
      } else {
        showNotification(`Connection failed: ${data.error || 'Unknown error'}`, "error");
      }
    } catch (e) {
      console.error(e);
      showNotification("An error occurred while testing the connection.", "error");
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
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
          setIsUploading(false);
        }
      };
      reader.readAsText(file);
    }
  };

  const startDeviceFlow = async () => {
    if (!selectedConfigId) {
      showNotification("Please select an API Config first!", "error");
      return;
    }

    setIsConnecting(true);
    try {
      const res = await fetch('/api/auth/google/device/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId: selectedConfigId })
      });
      const data = await res.json();
      setDeviceCodeData(data);
      setShowDeviceModal(true);
      
      // Start polling
      const interval = setInterval(async () => {
        try {
          const pollRes = await fetch('/api/auth/google/device/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_code: data.device_code })
          });
          const pollData = await pollRes.json();
          
          if (pollData.id) { // Success
            clearInterval(interval);
            setShowDeviceModal(false);
            setIsConnecting(false);
            const updatedChannels = [...channels, pollData];
            setChannels(updatedChannels);
            localStorage.setItem("YOUTUBE_CHANNELS", JSON.stringify(updatedChannels));
            showNotification(`Channel ${pollData.name} connected!`, "success");
          }
        } catch (e) {
          // Ignore polling errors (like pending)
        }
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 p-8 font-sans relative">
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
            {notification.type === 'success' && <ShieldCheck className="w-5 h-5" />}
            {notification.type === 'error' && <AlertTriangle className="w-5 h-5" />}
            {notification.type === 'info' && <Loader2 className="w-5 h-5 animate-spin" />}
            <span className="font-medium">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Server className="w-8 h-8 text-blue-500" />
              System Architecture & Settings
            </h1>
            <p className="text-slate-500 mt-1 font-mono text-[10px] uppercase tracking-widest">Mission Control / Automation Engine v2.0</p>
          </div>
          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-3 ${channels.length > 0 ? "border-green-500/30" : "border-red-500/30"}`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${channels.length > 0 ? "bg-green-500" : "bg-red-500"}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${channels.length > 0 ? "text-green-500" : "text-red-500"}`}>
                {channels.length > 0 ? "YouTube Connected" : "YouTube Disconnected"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
          
          {/* Left Column: Monitoring & Stats */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
            
            {/* Server Monitoring Panel */}
            <div className="bg-[#111] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  Server Monitoring
                </h3>
                <RefreshCw className="w-3 h-3 text-slate-600 animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <div className="p-6 space-y-6">
                {/* CPU Usage */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-slate-500 flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU Load</span>
                    <span className={stats?.cpuLoad && stats.cpuLoad > 80 ? "text-red-500" : "text-blue-400"}>{stats?.cpuLoad || 0}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${stats?.cpuLoad || 0}%` }}
                      className={`h-full transition-all duration-1000 ${stats?.cpuLoad && stats.cpuLoad > 80 ? "bg-red-500" : "bg-blue-500"}`}
                    />
                  </div>
                </div>

                {/* RAM Usage */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-slate-500 flex items-center gap-1"><Database className="w-3 h-3" /> RAM Usage</span>
                    <span className="text-purple-400">{stats?.ramUsage || 0}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${stats?.ramUsage || 0}%` }}
                      className="h-full bg-purple-500 transition-all duration-1000"
                    />
                  </div>
                </div>

                {/* Queue Status */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/50">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Queue Size</p>
                    <p className="text-xl font-mono font-bold text-white">{stats?.queueSize || 0}</p>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Scheduled</p>
                    <p className="text-xl font-mono font-bold text-white">{stats?.videoSchedule || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* System Status Indicators */}
            <div className="bg-[#111] border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">System Health</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/50">
                  <span className="text-xs text-slate-400">API Rotation Engine</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-green-500 uppercase">Active</span>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/50">
                  <span className="text-xs text-slate-400">Worker Queue (Redis)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-green-500 uppercase">Connected</span>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/50">
                  <span className="text-xs text-slate-400">YouTube API Quota</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-400 uppercase">Healthy</span>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Config & Management */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            
            {/* API Configuration & Rotation */}
            <div className="bg-[#111] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-500" />
                    Google API Configuration
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Manage multiple OAuth 2.0 credentials for quota rotation</p>
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20"
                >
                  <Upload className="w-4 h-4" />
                  Upload client_secret.json
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept=".json"
                />
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {apiConfigs.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl">
                      <FileJson className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                      <p className="text-sm text-slate-500">No API configurations found. Upload a client_secret.json to get started.</p>
                    </div>
                  ) : (
                    apiConfigs.map((config) => (
                      <div 
                        key={config.id} 
                        onClick={() => setSelectedConfigId(config.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                          selectedConfigId === config.id 
                            ? "bg-blue-500/5 border-blue-500/30 ring-1 ring-blue-500/20" 
                            : "bg-slate-950 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                              selectedConfigId === config.id ? "bg-blue-500/20 border-blue-500/30" : "bg-slate-900 border-slate-800"
                            }`}>
                              <Key className={`w-5 h-5 ${selectedConfigId === config.id ? "text-blue-400" : "text-slate-600"}`} />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-200">{config.name}</h4>
                              <p className="text-[10px] font-mono text-slate-500 mt-0.5">ID: {config.clientId.substring(0, 20)}...</p>
                            </div>
                          </div>
                          <div className="flex flex-col md:flex-row md:items-center gap-6">
                            <div className="text-left md:text-right">
                              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Quota Used</p>
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-1 bg-slate-900 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 w-[15%]" />
                                </div>
                                <span className="text-[10px] font-mono text-slate-400">1,500 / 10,000</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleTestConfig(config.id); }}
                                className="p-2 bg-slate-900 hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 rounded-lg transition-all"
                                title="Test Connection"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              <div className="flex items-center gap-2 px-2 py-1 bg-green-500/10 rounded-lg border border-green-500/20 w-fit">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                <span className="text-[10px] font-bold text-green-500 uppercase">Active</span>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteConfig(config.id); }}
                                className="p-2 bg-slate-900 hover:bg-red-500/10 text-slate-500 hover:text-red-500 rounded-lg transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Multi-Channel Management */}
            <div className="bg-[#111] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div 
                  className="flex items-center gap-4 cursor-pointer group"
                  onClick={() => setIsChannelManagementOpen(!isChannelManagementOpen)}
                >
                  <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20 glow-red">
                    <Youtube className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      Channel Management (TV System)
                      {isChannelManagementOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Connect and manage multiple YouTube channels via Device Flow</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setViewMode('grid'); }}
                      className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                      title="Grid View"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setViewMode('list'); }}
                      className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                      title="List View"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button 
                    onClick={startDeviceFlow}
                    disabled={isConnecting || apiConfigs.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all border border-slate-700 disabled:opacity-50"
                  >
                    {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add New Channel
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {isChannelManagementOpen && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="p-6">
                      <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "flex flex-col gap-3"}>
                        {channels.length === 0 ? (
                          <div className="col-span-2 text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl">
                            <Youtube className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                            <p className="text-sm text-slate-500">No channels connected yet. Use the Device Flow to connect your first channel.</p>
                          </div>
                        ) : (
                          channels.map((channel) => (
                            <div 
                              key={channel.id} 
                              className={`glass-card rounded-[1.5rem] group hover:border-white/10 transition-all relative overflow-hidden flex ${
                                viewMode === 'grid' 
                                  ? "p-4 flex-col justify-between min-h-[160px]" 
                                  : "p-3 flex-row items-center justify-between"
                              }`}
                            >
                              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
                              
                              <div className={`flex items-center gap-3.5 min-w-0 ${viewMode === 'list' ? "flex-1" : ""}`}>
                                <div className={`${viewMode === 'grid' ? "w-11 h-11" : "w-9 h-9"} rounded-xl overflow-hidden border border-white/10 shadow-xl group-hover:scale-105 transition-transform duration-500 flex-shrink-0`}>
                                  {channel.avatar ? (
                                    <img src={channel.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-600">
                                      <Youtube className="w-5 h-5" />
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-0.5 min-w-0">
                                  <h4 className="text-sm font-display font-bold text-white group-hover:text-emerald-400 transition-colors truncate">{channel.name}</h4>
                                  {channel.email && channel.email !== "user@example.com" && (
                                    <p className="text-[10px] text-slate-500 font-medium truncate opacity-80">{channel.email}</p>
                                  )}
                                </div>
                              </div>

                              {viewMode === 'list' && (
                                <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 glow-emerald backdrop-blur-md mx-4">
                                  <div className="w-1 h-1 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Connected</span>
                                </div>
                              )}

                              {viewMode === 'grid' && (
                                <div className="absolute top-4 right-4 flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 glow-emerald backdrop-blur-md">
                                  <div className="w-1 h-1 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Connected</span>
                                </div>
                              )}

                              <div className={`flex items-center justify-between ${viewMode === 'grid' ? "pt-4 mt-4 border-t border-white/5" : "gap-4"}`}>
                                <div className="flex gap-2">
                                  <button className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-blue-400 transition-all border border-white/5 group/btn">
                                    <RefreshCw className="w-3.5 h-3.5 group-hover/btn:rotate-180 transition-transform duration-500" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteChannel(channel.id)}
                                    className="p-2 bg-white/5 hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-500 transition-all border border-white/5"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                
                                <button className={`text-[9px] font-black text-slate-400 hover:text-white uppercase tracking-[0.25em] flex items-center gap-2 transition-all group/link bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 ${viewMode === 'grid' ? "px-4 py-2" : "px-3 py-1.5"}`}>
                                  {viewMode === 'grid' ? "View Details" : ""} 
                                  <ExternalLink className="w-3 h-3 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* OAuth Device Flow Modal */}
      <AnimatePresence>
        {showDeviceModal && deviceCodeData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
                        <Copy className="w-4 h-4" />
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
