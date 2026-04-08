import { SystemStats, Asset } from "../types";
import { Cpu, Activity, Database, Calendar, TrendingUp, Clock, Upload, FileAudio, FileVideo, FileImage, Globe, Youtube, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useRef, useState, useEffect } from "react";

const data = [
  { name: "Mon", videos: 4 },
  { name: "Tue", videos: 7 },
  { name: "Wed", videos: 5 },
  { name: "Thu", videos: 12 },
  { name: "Fri", videos: 9 },
  { name: "Sat", videos: 15 },
  { name: "Sun", videos: 10 },
];

export default function Dashboard({ 
  stats, 
  recentImports 
}: { 
  stats: SystemStats, 
  recentImports: Asset[]
}) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatJakartaTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  };

  const formatJakartaDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const cards = [
    { 
      label: "CPU Load", 
      value: `${stats.cpuLoad}%`, 
      subValue: `${stats.cpuCount} vCPU`,
      icon: Cpu, 
      color: "text-blue-400", 
      bg: "bg-blue-400/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]"
    },
    { 
      label: "RAM Usage", 
      value: `${stats.ramUsage}%`, 
      subValue: `${stats.totalRam} GB Total`,
      icon: Activity, 
      color: "text-indigo-400", 
      bg: "bg-indigo-400/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(129,140,248,0.3)]"
    },
    { 
      label: "Storage", 
      value: `${stats.storage}%`, 
      subValue: `${stats.totalStorage} GB Total`,
      icon: Database, 
      color: "text-emerald-400", 
      bg: "bg-emerald-400/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(52,211,153,0.3)]"
    },
    { 
      label: "Video Schedule", 
      value: stats.videoSchedule, 
      subValue: stats.videoSchedule > 0 ? `${stats.videoSchedule} Active` : "No Pending",
      icon: Calendar, 
      color: stats.videoSchedule > 0 ? "text-red-400" : "text-amber-400", 
      bg: stats.videoSchedule > 0 ? "bg-red-400/10" : "bg-amber-400/10",
      glow: stats.videoSchedule > 0 ? "group-hover:shadow-[0_0_20px_rgba(248,113,113,0.3)]" : "group-hover:shadow-[0_0_20px_rgba(251,191,36,0.3)]"
    },
    { 
      label: "Jakarta Time", 
      value: formatJakartaTime(currentTime), 
      subValue: formatJakartaDate(currentTime),
      icon: Globe, 
      color: "text-rose-400", 
      bg: "bg-rose-400/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(251,113,133,0.3)]"
    },
  ];

  const [jobs, setJobs] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [historyFilter, setHistoryFilter] = useState<'all' | 'success' | 'failed'>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobsRes, historyRes, channelsRes] = await Promise.all([
          fetch('/api/youtube/jobs'),
          fetch('/api/youtube/history'),
          fetch('/api/youtube/channels')
        ]);
        
        if (jobsRes.ok) setJobs(await jobsRes.json());
        if (historyRes.ok) {
          const res = await historyRes.json();
          setHistory(res.data || []);
        }
        if (channelsRes.ok) setChannels(await channelsRes.json());
      } catch (e) {
        console.error("Failed to fetch dashboard data:", e);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const getChannelName = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    return channel ? channel.name : "Unknown Channel";
  };

  const formatToJakarta = (dateStr: string | null) => {
    if (!dateStr) return "-";
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

  const getCountdown = (dateStr: string | null) => {
    if (!dateStr) return null;
    const target = new Date(dateStr).getTime();
    const now = currentTime.getTime();
    const diff = target - now;

    if (diff <= 0) return "Starting...";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const filteredQueue = jobs
    .filter(j => j.status.toLowerCase() === 'queued' || j.status.toLowerCase() === 'processing' || j.status.toLowerCase() === 'uploading')
    .filter(j => 
      j.data?.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      getChannelName(j.data?.channelId).toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = a.data?.scheduledAt ? new Date(a.data.scheduledAt).getTime() : 0;
      const dateB = b.data?.scheduledAt ? new Date(b.data.scheduledAt).getTime() : 0;
      return dateA - dateB;
    });

  const filteredHistory = history
    .filter(h => historyFilter === 'all' || h.status === historyFilter)
    .filter(h => 
      h.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      getChannelName(h.channelId).toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-slate-700 transition-all group relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className={`p-3 rounded-xl ${card.bg} transition-all duration-300 group-hover:scale-110 ${card.glow}`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <div className="flex items-center text-[10px] font-mono font-bold text-slate-500 bg-slate-800/50 px-2 py-1 rounded-full border border-slate-700/50">
                {card.subValue}
              </div>
            </div>
            <div className="relative z-10">
              <h3 className="text-slate-400 text-[10px] uppercase tracking-widest font-bold">{card.label}</h3>
              <p className="text-3xl font-mono font-bold text-slate-100 mt-1 tracking-tighter">{card.value}</p>
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all duration-500" />
            
            {/* Hardware feel: Subtle dashed border on hover */}
            <div className="absolute inset-0 border border-dashed border-slate-700/0 group-hover:border-slate-700/50 rounded-2xl transition-all pointer-events-none" />
          </motion.div>
        ))}
      </div>

      {/* PROCESS MANAGER HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-red-500" />
            PROCESS MANAGER – Real-Time Engine Monitor
          </h2>
          <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">System Management & Queue Monitor (Debian VPS Optimized)</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search channel or video..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-red-500/50 w-64"
            />
          </div>
          <div className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">Live Sync Active</span>
          </div>
        </div>
      </div>

      {/* BAGAN 1: SISTEM ANTRIAN */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            SISTEM ANTRIAN (QUEUE - WAITING SCHEDULE)
          </h3>
          <div className="px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <span className="text-[10px] font-bold text-amber-500 uppercase">{filteredQueue.length} Pending</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-slate-800">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Channel Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Source File</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Engine Mode</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Time Schedule</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredQueue.length > 0 ? (
                filteredQueue.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-red-500/10 rounded-md flex items-center justify-center border border-red-500/20">
                          <Youtube className="w-3 h-3 text-red-500" />
                        </div>
                        <span className="text-xs font-medium text-slate-300">{getChannelName(job.data?.channelId)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-100">{job.data?.title || "Untitled"}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px] font-bold text-blue-400 uppercase">VCPU (mode processing)</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-300">{formatToJakarta(job.data?.scheduledAt)}</div>
                        <div className="text-[10px] font-bold text-amber-500/80 uppercase flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {getCountdown(job.data?.scheduledAt)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10px] font-bold text-amber-500 uppercase">
                        Pending
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-600 text-xs italic">
                    No active queue items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BAGAN 2: HISTORY */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              HISTORY (SELESAI / GAGAL)
            </h3>
            <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800">
              {(['all', 'success', 'failed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setHistoryFilter(f)}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                    historyFilter === f ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="px-2 py-1 bg-green-500/10 rounded-lg border border-green-500/20">
            <span className="text-[10px] font-bold text-green-500 uppercase">{filteredHistory.length} Total</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-slate-800">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Channel Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Source File</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Engine Mode</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Time Schedule</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-red-500/10 rounded-md flex items-center justify-center border border-red-500/20">
                          <Youtube className="w-3 h-3 text-red-500" />
                        </div>
                        <span className="text-xs font-medium text-slate-300">{getChannelName(h.channelId)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-100">{h.title || "Untitled"}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {h.status === 'success' ? (
                          <>
                            <Globe className="w-3 h-3 text-emerald-400" />
                            <span className="text-[10px] font-bold text-emerald-400 uppercase">{h.id.replace('#', '')}</span>
                          </>
                        ) : (
                          <>
                            <Cpu className="w-3 h-3 text-slate-500" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase">VCPU</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-300">{formatToJakarta(h.scheduledAt || h.created_at)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${
                        h.status === 'success' 
                          ? 'bg-green-500/10 border-green-500/20 text-green-500' 
                          : 'bg-red-500/10 border-red-500/20 text-red-500'
                      }`}>
                        {h.status === 'success' ? 'Tayang' : 'Gagal'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-600 text-xs italic">
                    No history records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
