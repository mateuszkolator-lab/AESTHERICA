import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import api from "../utils/api";
import { DateHistoryEntry } from "./DateHistory";

const FILTERS = [
  { key: "alerts", label: "Rezygnacje i usunięcia" },
  { key: "all", label: "Wszystkie zmiany" },
];
const ALERT_KINDS = ["cancelled", "removed", "not_performed", "google"];

export const DateChangesFeed = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState("alerts");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/audit/date-changes/recent?days=14&limit=60");
      setEntries(res.data);
    } catch { /* non-critical */ }
    finally { setLoaded(true); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = filter === "alerts" ? entries.filter(e => ALERT_KINDS.includes(e.kind)) : entries;
  const alertCount = entries.filter(e => ALERT_KINDS.includes(e.kind)).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm" data-testid="date-changes-feed">
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Zmiany terminów (14 dni)</h2>
          {alertCount > 0 && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold" data-testid="date-changes-alert-count">{alertCount}</span>}
        </div>
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1 rounded-full text-xs font-medium ${filter === f.key ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`} data-testid={`date-changes-filter-${f.key}`}>{f.label}</button>
          ))}
        </div>
      </div>
      <div className="p-3 max-h-80 overflow-y-auto space-y-2">
        {!loaded ? null : shown.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Brak zmian w ostatnich 14 dniach</p>
        ) : shown.map(e => <DateHistoryEntry key={e.id} e={e} onOpen={(pid) => navigate(`/patients/${pid}`)} />)}
      </div>
    </div>
  );
};

export default DateChangesFeed;
