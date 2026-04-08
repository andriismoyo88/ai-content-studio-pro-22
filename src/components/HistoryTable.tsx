import { useState, useEffect } from "react";
import { 
  Folder, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Tv, 
  CheckCircle2, 
  XCircle,
  Filter,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface HistoryItem {
  id: string;
  type: string;
  title: string;
  status: "success" | "failed";
  created_at: string;
}

interface HistoryResponse {
  data: HistoryItem[];
  total: number;
  page: number;
  totalPages: number;
}

export default function HistoryTable() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        search,
        status: statusFilter
      });
      const res = await fetch(`/api/youtube/history?${query}`);
      if (res.ok) {
        const data: HistoryResponse = await res.json();
        setHistory(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (e) {
      console.error("Failed to fetch history:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page, statusFilter]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) setPage(1);
      else fetchHistory();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const handleClearHistory = async () => {
    try {
      const res = await fetch('/api/youtube/jobs-history/clear', { method: 'DELETE' });
      if (res.ok) {
        fetchHistory();
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/youtube/history/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        fetchHistory();
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="glass-card rounded-3xl shadow-2xl overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />
      
      {/* Header */}
      <div className="p-8 border-b border-slate-800/50 bg-slate-900/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 glow-emerald">
            <Folder className="w-6 h-6 text-amber-500 fill-amber-500/20" />
          </div>
          <div>
            <h3 className="text-xl font-display font-bold text-white tracking-tight">History Log</h3>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-extrabold">Riwayat Pemrosesan Konten VOD</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Cari judul..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950/50 border border-slate-800 rounded-2xl pl-12 pr-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all w-full md:w-72"
            />
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2 bg-slate-950/50 border border-slate-800 rounded-2xl px-4 py-2.5 group focus-within:border-amber-500/50 transition-all">
            <Filter className="w-3.5 h-3.5 text-slate-500 group-focus-within:text-amber-500" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-xs text-slate-400 focus:outline-none appearance-none cursor-pointer pr-6 font-medium"
            >
              <option value="all">Semua Status</option>
              <option value="success">Tayang (Sukses)</option>
              <option value="failed">Gagal</option>
            </select>
          </div>

          <button 
            onClick={handleClearHistory}
            className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl border border-red-500/20 transition-all hover:scale-105 active:scale-95"
            title="Hapus Semua"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/40 border-b border-slate-800/50">
              <th className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">ID</th>
              <th className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Tipe</th>
              <th className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Judul Konten</th>
              <th className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Waktu (Jakarta)</th>
              <th className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Status</th>
              <th className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30">
            <AnimatePresence mode="popLayout">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-40">
                      <Folder className="w-12 h-12 text-slate-600" />
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        {isLoading ? "Memuat data..." : "Tidak ada riwayat ditemukan"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <motion.tr 
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="hover:bg-white/[0.02] transition-all group"
                  >
                    <td className="px-8 py-5">
                      <span className="text-[10px] font-mono font-medium text-slate-500 group-hover:text-slate-300 transition-colors bg-slate-900/50 px-2 py-1 rounded-md border border-slate-800/50">{item.id}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-800 group-hover:border-slate-700 transition-colors">
                          <Tv className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{item.type}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-xs font-bold text-slate-200 line-clamp-1 max-w-md group-hover:text-white transition-colors">
                        {item.title}
                      </p>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400">
                          {new Intl.DateTimeFormat('en-GB', {
                            timeZone: 'Asia/Jakarta',
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          }).format(new Date(item.created_at))}
                        </span>
                        <span className="text-[9px] font-medium text-slate-600">
                          {new Intl.DateTimeFormat('en-GB', {
                            timeZone: 'Asia/Jakarta',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          }).format(new Date(item.created_at))}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                        item.status === 'success' 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-red-500/10 border-red-500/20 text-red-400'
                      }`}>
                        {item.status === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span className="text-[9px] font-black uppercase tracking-widest">
                          {item.status === 'success' ? 'TAYANG' : 'GAGAL'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button 
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 bg-slate-900/50 hover:bg-red-500/10 text-slate-600 hover:text-red-500 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 bg-slate-900/30 border-t border-slate-800 flex items-center justify-between">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Showing {history.length} of {total} results
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-300 px-2">
              Page {page} of {totalPages}
            </span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
