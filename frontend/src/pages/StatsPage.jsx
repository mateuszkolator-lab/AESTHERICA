import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Download, ChevronUp, ChevronDown, Users } from "lucide-react";
import api, { API_BASE } from "../utils/api";
import { MONTH_NAMES, STATUS_LABELS, getStatusColor } from "../utils/constants";

const StatsPage = () => {
  const [stats, setStats] = useState(null);
  const [waitingSummary, setWaitingSummary] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'count', direction: 'desc' });

  useEffect(() => {
    loadStats();
  }, [year]);

  const loadStats = async () => {
    try {
      const [statsRes, waitingRes] = await Promise.all([
        api.get(`/stats?year=${year}`),
        api.get("/stats/waiting-summary")
      ]);
      setStats(statsRes.data);
      setWaitingSummary(waitingRes.data);
    } catch (err) {
      toast.error("Nie udało się załadować statystyk");
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const sortedWaitingSummary = useMemo(() => {
    const sorted = [...waitingSummary];
    sorted.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (sortConfig.key === 'status') {
        const order = { consultation: 1, planned: 2, awaiting: 3 };
        aVal = order[aVal] || 99;
        bVal = order[bVal] || 99;
      }
      
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [waitingSummary, sortConfig]);

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'desc' 
      ? <ChevronDown className="w-4 h-4 inline ml-1" /> 
      : <ChevronUp className="w-4 h-4 inline ml-1" />;
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/export/patients?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pacjenci_${year}.xlsx`;
      a.click();
      toast.success("Eksport pobrany");
    } catch (err) {
      toast.error("Nie udało się wyeksportować");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;

  const procedureData = MONTH_NAMES.map((month, i) => {
    const monthNum = String(i + 1).padStart(2, "0");
    const found = stats?.procedures_by_month?.find((p) => p.month === monthNum);
    return { month, count: found?.count || 0 };
  });

  const revenueData = MONTH_NAMES.map((month, i) => {
    const monthNum = String(i + 1).padStart(2, "0");
    const found = stats?.revenue_by_month?.find((p) => p.month === monthNum);
    return { month, revenue: found?.revenue || 0 };
  });

  return (
    <div className="p-8" data-testid="statistics-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Statystyki</h1>
          <p className="text-slate-500 mt-1">Przegląd wyników praktyki</p>
        </div>
        <div className="flex gap-3">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            data-testid="year-select"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium transition-colors"
            data-testid="export-button"
          >
            <Download className="w-4 h-4" />
            Eksport Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Wszyscy pacjenci</p>
          <p className="text-3xl font-semibold text-slate-900 mt-2">{stats?.total_patients || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Zoperowani</p>
          <p className="text-3xl font-semibold text-emerald-600 mt-2">{stats?.by_status?.operated || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Zaplanowani</p>
          <p className="text-3xl font-semibold text-blue-600 mt-2">{stats?.by_status?.planned || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Oczekujący</p>
          <p className="text-3xl font-semibold text-amber-600 mt-2">{stats?.by_status?.awaiting || 0}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Zabiegi wg miesiąca</h3>
          <div className="h-64 flex items-end gap-2">
            {procedureData.map((item, i) => {
              const maxCount = Math.max(...procedureData.map(d => d.count), 1);
              const height = (item.count / maxCount) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-teal-500 rounded-t"
                    style={{ height: `${height}%`, minHeight: item.count > 0 ? "8px" : "0" }}
                  />
                  <p className="text-xs text-slate-500 mt-2">{item.month}</p>
                  <p className="text-xs font-medium text-slate-700">{item.count}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Przychód wg miesiąca</h3>
          <div className="h-64 flex items-end gap-2">
            {revenueData.map((item, i) => {
              const maxRevenue = Math.max(...revenueData.map(d => d.revenue), 1);
              const height = (item.revenue / maxRevenue) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-emerald-500 rounded-t"
                    style={{ height: `${height}%`, minHeight: item.revenue > 0 ? "8px" : "0" }}
                  />
                  <p className="text-xs text-slate-500 mt-2">{item.month}</p>
                  <p className="text-xs font-medium text-slate-700">{(item.revenue / 1000).toFixed(0)}k</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Procedures by Location */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Zabiegi wg lokalizacji</h3>
        {stats?.procedures_by_location?.length > 0 ? (
          <div className="space-y-4">
            {stats.procedures_by_location.map((item, i) => {
              const maxCount = Math.max(...stats.procedures_by_location.map(l => l.count), 1);
              const width = (item.count / maxCount) * 100;
              return (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-700">{item.location}</span>
                    <span className="font-medium text-slate-900">{item.count} zabiegów</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div className="bg-teal-500 h-3 rounded-full" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">Brak danych. Dodaj lokalizacje i wykonaj zabiegi, aby zobaczyć statystyki.</p>
        )}
      </div>

      {/* Waiting Summary Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mt-6">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-6 h-6 text-teal-600" />
          <h3 className="text-lg font-semibold text-slate-900">Podsumowanie oczekujących pacjentów</h3>
        </div>
        
        {sortedWaitingSummary.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="waiting-summary-table">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('status')}
                  >
                    Status <SortIcon columnKey="status" />
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('procedure_type')}
                  >
                    Typ zabiegu <SortIcon columnKey="procedure_type" />
                  </th>
                  <th 
                    className="px-4 py-3 text-right text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort('count')}
                  >
                    Liczba pacjentów <SortIcon columnKey="count" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedWaitingSummary.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.procedure_type}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-slate-900">{item.count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan="2" className="px-4 py-3 text-sm font-semibold text-slate-700">
                    Łącznie oczekujących
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-teal-700 text-lg">
                      {sortedWaitingSummary.reduce((sum, item) => sum + item.count, 0)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">Brak pacjentów oczekujących.</p>
        )}
      </div>
    </div>
  );
};

export default StatsPage;
