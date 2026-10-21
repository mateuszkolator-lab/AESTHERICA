import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { History, ChevronDown, ArrowRight, UserMinus, UserPlus, UserX, CalendarClock, CloudDownload } from "lucide-react";
import api from "../utils/api";

export const KIND_META = {
  assigned: { label: "Dopisano do terminu", icon: UserPlus, cls: "text-emerald-700 bg-emerald-50 border-emerald-100" },
  moved: { label: "Przeniesiono", icon: ArrowRight, cls: "text-blue-700 bg-blue-50 border-blue-100" },
  removed: { label: "Usunięto z terminu", icon: UserMinus, cls: "text-amber-700 bg-amber-50 border-amber-100" },
  cancelled: { label: "Rezygnacja", icon: UserX, cls: "text-red-700 bg-red-50 border-red-100" },
  not_performed: { label: "Zabieg się nie odbył", icon: CalendarClock, cls: "text-orange-700 bg-orange-50 border-orange-100" },
  google: { label: "Zmiana w Google Calendar", icon: CloudDownload, cls: "text-violet-700 bg-violet-50 border-violet-100" },
};

const fmt = (iso) => new Date(iso).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const DateHistoryEntry = ({ e, onOpen, showDates = true }) => {
  const meta = KIND_META[e.kind] || KIND_META.removed;
  const Icon = meta.icon;
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${meta.cls}`} data-testid={`date-history-entry-${e.id}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-medium">
          <button onClick={() => onOpen?.(e.patient_id)} className="hover:underline text-left">{e.patient_name}</button>
          {e.procedure_type && <span className="font-normal opacity-70"> · {e.procedure_type}</span>}
        </p>
        <p className="text-xs opacity-90">
          {meta.label}
          {e.kind === "moved" && (showDates || !e.contextDate ? ` ${e.old_date} → ${e.new_date}` : (e.new_date === e.contextDate ? ` na ten termin (z ${e.old_date})` : ` z tego terminu (na ${e.new_date})`))}
          {showDates && e.kind !== "moved" && (e.new_date || e.old_date) && ` (${e.new_date || e.old_date})`}
          {e.cancellation_reason && e.kind === "cancelled" && ` – powód: ${e.cancellation_reason}`}
        </p>
        {e.details && e.kind !== "cancelled" && <p className="text-[11px] opacity-70 truncate">{e.details}</p>}
        <p className="text-[11px] opacity-70 mt-0.5">{e.user_name} · {fmt(e.timestamp)}</p>
      </div>
    </div>
  );
};

export const DateHistory = ({ date, defaultOpen = false }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(defaultOpen);
  const [entries, setEntries] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/audit/date/${date}`);
      setEntries(res.data);
    } catch { setEntries([]); }
  }, [date]);

  useEffect(() => { if (open && entries === null) load(); }, [open, entries, load]);
  useEffect(() => { setEntries(null); }, [date]);

  return (
    <div className="border-t border-slate-100 mt-4 pt-3" data-testid="date-history">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-sm font-medium text-slate-600 hover:text-slate-900" data-testid="date-history-toggle">
        <span className="flex items-center gap-2"><History className="w-4 h-4" /> Historia tego terminu{entries ? ` (${entries.length})` : ""}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {entries === null ? <p className="text-xs text-slate-400">Ładowanie...</p>
            : entries.length === 0 ? <p className="text-xs text-slate-400">Brak zapisanych zmian dla tego terminu</p>
            : entries.map(e => <DateHistoryEntry key={e.id} e={{ ...e, contextDate: date }} onOpen={(pid) => navigate(`/patients/${pid}`)} showDates={false} />)}
        </div>
      )}
    </div>
  );
};

export default DateHistory;
