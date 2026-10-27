import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import api from "../../utils/api";
import { getDaysInMonth, formatDateLocal, getLocationColor } from "../../utils/constants";

const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

const slotTone = (slot, count) => {
  if (!slot) return null;
  if (slot.is_full) return "full";
  if (count > 0) return "taken";
  return "free";
};

const toneClasses = {
  free: "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200",
  taken: "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200",
  full: "bg-red-100 text-red-700 border-red-300 hover:bg-red-200",
};

export const SurgeryDatePicker = ({ value, onChange, excludePatientId }) => {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState([]);
  const [counts, setCounts] = useState({});
  const [month, setMonth] = useState(() => (value ? new Date(value + "T00:00:00") : new Date()));

  useEffect(() => {
    if (!open) return;
    Promise.all([api.get("/surgery-slots"), api.get("/patients")])
      .then(([slotRes, patRes]) => {
        setSlots(slotRes.data);
        const c = {};
        patRes.data.forEach((p) => {
          if (p.id !== excludePatientId && p.surgery_date && p.status !== "cancelled") {
            c[p.surgery_date] = (c[p.surgery_date] || 0) + 1;
          }
        });
        setCounts(c);
      })
      .catch(() => {});
  }, [open, excludePatientId]);

  const slotByDate = useMemo(() => Object.fromEntries(slots.map((s) => [s.date, s])), [slots]);
  const todayStr = formatDateLocal(new Date());
  const upcomingFree = slots.filter((s) => s.date >= todayStr && !s.is_full && !counts[s.date]).slice(0, 6);
  const days = getDaysInMonth(month);
  const monthLabel = month.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });

  const pick = (dateStr) => {
    onChange(dateStr);
    setOpen(false);
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          data-testid="surgery-date-input"
        />
        <button
          type="button"
          onClick={() => { setOpen(!open); if (value) setMonth(new Date(value + "T00:00:00")); }}
          className={`px-3 py-2.5 border rounded-lg transition-colors ${open ? "bg-teal-50 border-teal-400 text-teal-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          title="Pokaż terminy z Planowania"
          data-testid="surgery-slot-picker-toggle"
        >
          <CalendarDays className="w-5 h-5" />
        </button>
      </div>

      {open && (
        <div className="mt-2 p-3 border border-slate-200 rounded-xl bg-white shadow-sm" data-testid="surgery-slot-picker">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg" data-testid="slot-picker-prev">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-slate-800 capitalize" data-testid="slot-picker-month">{monthLabel}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg" data-testid="slot-picker-next">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg" data-testid="slot-picker-close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const ds = formatDateLocal(day);
              const slot = slotByDate[ds];
              const count = counts[ds] || 0;
              const tone = slotTone(slot, count);
              const isPast = ds < todayStr;
              const isSelected = ds === value;
              return (
                <button
                  type="button"
                  key={ds}
                  onClick={() => pick(ds)}
                  title={slot ? `${slot.location_name || ""}${slot.is_full ? " – pełny" : count ? ` – ${count} pac.` : " – wolny"}`.trim() : undefined}
                  className={`relative h-9 text-xs rounded-lg border transition-colors ${
                    tone ? toneClasses[tone] : "border-transparent text-slate-700 hover:bg-slate-100"
                  } ${isPast && !isSelected ? "opacity-40" : ""} ${isSelected ? "ring-2 ring-teal-600 ring-offset-1 font-bold" : ""}`}
                  data-testid={`slot-day-${ds}`}
                  data-tone={tone || "none"}
                >
                  {day.getDate()}
                  {slot?.location_name && (
                    <span
                      className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: getLocationColor(slot.location_name)?.hex || "#94a3b8" }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-300" /> wolny termin</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200 border border-amber-300" /> zajęty (są pacjenci)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 border border-red-300" /> pełny</span>
          </div>

          {upcomingFree.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Najbliższe wolne terminy</p>
              <div className="flex flex-wrap gap-1.5">
                {upcomingFree.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => pick(s.date)}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg hover:bg-emerald-100"
                    data-testid={`free-slot-chip-${s.date}`}
                  >
                    {new Date(s.date + "T00:00:00").toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
                    {s.location_name && (
                      <span className="px-1 rounded text-[9px] font-bold text-white" style={{ backgroundColor: getLocationColor(s.location_name)?.hex || "#94a3b8" }}>
                        {s.location_name.trim().substring(0, 3).toUpperCase()}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
