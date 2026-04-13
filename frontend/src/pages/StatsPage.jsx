import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Download, ChevronUp, ChevronDown, Users, MapPin, TrendingUp, Filter } from "lucide-react";
import api, { API_BASE } from "../utils/api";
import { MONTH_NAMES, STATUS_LABELS, getStatusColor } from "../utils/constants";

const StatsPage = () => {
  const [stats, setStats] = useState(null);
  const [waitingSummary, setWaitingSummary] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [locationFilter, setLocationFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'count', direction: 'desc' });

  const loadStats = useCallback(async () => {
    try {
      let url = `/stats?year=${year}`;
      if (locationFilter) url += `&location_id=${locationFilter}`;
      const [statsRes, waitingRes] = await Promise.all([
        api.get(url),
        api.get("/stats/waiting-summary")
      ]);
      setStats(statsRes.data);
      setWaitingSummary(waitingRes.data);
    } catch (err) {
      toast.error("Nie udalo sie zaladowac statystyk");
    } finally {
      setLoading(false);
    }
  }, [year, locationFilter]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

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
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
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
      toast.error("Nie udalo sie wyeksportowac");
    }
  };

  const formatCurrency = (val) => {
    if (!val) return "0 zl";
    return val.toLocaleString("pl-PL") + " zl";
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;

  const procedureData = MONTH_NAMES.map((month, i) => {
    const monthNum = String(i + 1).padStart(2, "0");
    const found = stats?.procedures_by_month?.find((p) => p.month === monthNum);
    return { month, count: found?.count || 0 };
  });

  // Revenue data: planned + operated per month
  const revenueTableData = MONTH_NAMES.map((month, i) => {
    const monthNum = String(i + 1).padStart(2, "0");
    const operated = stats?.revenue_by_month_operated?.find((p) => p.month === monthNum);
    const planned = stats?.revenue_by_month_planned?.find((p) => p.month === monthNum);
    return {
      month,
      monthNum,
      operatedRevenue: operated?.revenue || 0,
      operatedCount: operated?.count || 0,
      plannedRevenue: planned?.revenue || 0,
      plannedCount: planned?.count || 0,
      totalRevenue: (operated?.revenue || 0) + (planned?.revenue || 0),
    };
  });

  const totalOperated = revenueTableData.reduce((s, r) => s + r.operatedRevenue, 0);
  const totalPlanned = revenueTableData.reduce((s, r) => s + r.plannedRevenue, 0);
  const totalAll = totalOperated + totalPlanned;
  const totalOperatedCount = revenueTableData.reduce((s, r) => s + r.operatedCount, 0);
  const totalPlannedCount = revenueTableData.reduce((s, r) => s + r.plannedCount, 0);

  const locations = stats?.locations || [];

  // Revenue by location grouped
  const revLocMap = {};
  (stats?.revenue_by_location || []).forEach(item => {
    if (!revLocMap[item.location]) revLocMap[item.location] = { planned: 0, operated: 0, plannedCount: 0, operatedCount: 0 };
    if (item.status === "planned") {
      revLocMap[item.location].planned += item.revenue;
      revLocMap[item.location].plannedCount += item.count;
    } else {
      revLocMap[item.location].operated += item.revenue;
      revLocMap[item.location].operatedCount += item.count;
    }
  });
  const revLocData = Object.entries(revLocMap).map(([loc, data]) => ({
    location: loc, ...data, total: data.planned + data.operated
  })).sort((a, b) => b.total - a.total);

  return (
    <div className="p-8" data-testid="statistics-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Statystyki</h1>
          <p className="text-slate-500 mt-1">Przegląd wyników praktyki</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            data-testid="year-select"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            data-testid="location-filter"
          >
            <option value="">Wszystkie lokalizacje</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
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

      {/* Active filter indicator */}
      {locationFilter && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800">
          <Filter className="w-4 h-4" />
          <span>Filtr lokalizacji: <strong>{locations.find(l => l.id === locationFilter)?.name}</strong></span>
          <button onClick={() => setLocationFilter("")} className="ml-auto text-teal-600 hover:text-teal-800 font-medium">Wyczyść</button>
        </div>
      )}

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

      {/* Revenue Chart - Stacked (Planned + Operated) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Zabiegi wg miesiąca</h3>
          <p className="text-xs text-slate-400 mb-4">Wykonane operacje</p>
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
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-slate-900">Przychód wg miesiąca</h3>
          </div>
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span>Wykonane</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <div className="w-3 h-3 rounded bg-blue-400" />
              <span>Zaplanowane</span>
            </div>
          </div>
          <div className="h-64 flex items-end gap-2">
            {revenueTableData.map((item, i) => {
              const maxRev = Math.max(...revenueTableData.map(d => d.totalRevenue), 1);
              const opHeight = (item.operatedRevenue / maxRev) * 100;
              const plHeight = (item.plannedRevenue / maxRev) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center" title={`Wykonane: ${formatCurrency(item.operatedRevenue)}\nZaplanowane: ${formatCurrency(item.plannedRevenue)}`}>
                  <div className="w-full flex flex-col justify-end" style={{ height: '100%' }}>
                    {item.plannedRevenue > 0 && (
                      <div className="w-full bg-blue-400 rounded-t" style={{ height: `${plHeight}%`, minHeight: "4px" }} />
                    )}
                    {item.operatedRevenue > 0 && (
                      <div className={`w-full bg-emerald-500 ${item.plannedRevenue === 0 ? 'rounded-t' : ''}`} style={{ height: `${opHeight}%`, minHeight: "4px" }} />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{item.month}</p>
                  <p className="text-xs font-medium text-slate-700">{item.totalRevenue > 0 ? `${(item.totalRevenue / 1000).toFixed(0)}k` : '0'}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Monthly Revenue Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-teal-600" />
          <h3 className="text-lg font-semibold text-slate-900">Przychód miesięczny - szczegóły</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="revenue-table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Miesiąc</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-emerald-700">Wykonane (przychód)</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-emerald-700">Wykonane (liczba)</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-blue-700">Zaplanowane (przychód)</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-blue-700">Zaplanowane (liczba)</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Razem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {revenueTableData.map((row, i) => (
                <tr key={i} className={`hover:bg-slate-50 ${row.totalRevenue > 0 ? '' : 'opacity-50'}`}>
                  <td className="px-4 py-3 font-medium text-slate-700">{row.month}</td>
                  <td className="px-4 py-3 text-right text-emerald-700 font-medium">{formatCurrency(row.operatedRevenue)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{row.operatedCount}</td>
                  <td className="px-4 py-3 text-right text-blue-700 font-medium">{formatCurrency(row.plannedRevenue)}</td>
                  <td className="px-4 py-3 text-right text-blue-600">{row.plannedCount}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(row.totalRevenue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300">
              <tr>
                <td className="px-4 py-3 font-bold text-slate-900">RAZEM {year}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatCurrency(totalOperated)}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600">{totalOperatedCount}</td>
                <td className="px-4 py-3 text-right font-bold text-blue-700">{formatCurrency(totalPlanned)}</td>
                <td className="px-4 py-3 text-right font-bold text-blue-600">{totalPlannedCount}</td>
                <td className="px-4 py-3 text-right font-bold text-teal-700 text-lg">{formatCurrency(totalAll)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Revenue by Location */}
      {revLocData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="w-6 h-6 text-teal-600" />
            <h3 className="text-lg font-semibold text-slate-900">Przychód wg lokalizacji</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="revenue-location-table">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Lokalizacja</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-emerald-700">Wykonane</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-emerald-700">Liczba</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-blue-700">Zaplanowane</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-blue-700">Liczba</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Razem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {revLocData.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{row.location}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">{formatCurrency(row.operated)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{row.operatedCount}</td>
                    <td className="px-4 py-3 text-right text-blue-700 font-medium">{formatCurrency(row.planned)}</td>
                    <td className="px-4 py-3 text-right text-blue-600">{row.plannedCount}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Procedures by Location */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
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
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-6 h-6 text-teal-600" />
          <h3 className="text-lg font-semibold text-slate-900">Podsumowanie oczekujących pacjentów</h3>
        </div>
        {sortedWaitingSummary.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="waiting-summary-table">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                    Status <SortIcon columnKey="status" />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('procedure_type')}>
                    Typ zabiegu <SortIcon columnKey="procedure_type" />
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('count')}>
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
                    <td className="px-4 py-3 text-slate-700">{item.procedure_type}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-slate-900">{item.count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan="2" className="px-4 py-3 text-sm font-semibold text-slate-700">Łącznie oczekujących</td>
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
