import { useMemo, useState } from "react";
import { X, Search, User, Sparkles, MapPin, CalendarDays, AlertTriangle, Check } from "lucide-react";
import { STATUS_LABELS, getStatusColor, getLocationColor } from "../../utils/constants";

const EXCLUDED = ["operated", "cancelled"];

const getRanges = (p) => {
  if (p.preferred_dates?.length) return p.preferred_dates.filter((r) => r.start || r.end);
  if (p.preferred_date_start || p.preferred_date_end) return [{ start: p.preferred_date_start, end: p.preferred_date_end }];
  return [];
};

const matchesDate = (p, date) =>
  getRanges(p).some((r) => (!r.start || r.start <= date) && (!r.end || r.end >= date));

const AssignPatientModal = ({ slot, patients, locations, onClose, onAssign }) => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const slotLocation = locations.find((l) => l.id === slot.location_id);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients
      .filter((p) => !EXCLUDED.includes(p.status) && p.surgery_date !== slot.date)
      .filter((p) => !q || `${p.first_name} ${p.last_name} ${p.last_name} ${p.first_name} ${p.phone || ""} ${p.procedure_type || ""}`.toLowerCase().includes(q))
      .map((p) => ({
        ...p,
        score: (matchesDate(p, slot.date) ? 4 : 0) + (p.asap ? 3 : 0) + (p.location_id === slot.location_id ? 2 : 0) + (!p.surgery_date ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score || a.last_name.localeCompare(b.last_name));
  }, [patients, query, slot]);

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await onAssign(selected.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const locationChanges = selected && slot.location_id && selected.location_id && selected.location_id !== slot.location_id;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="assign-patient-modal">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Przypisz pacjenta do terminu</h2>
            <p className="text-sm text-slate-500 flex items-center gap-2 mt-0.5">
              <CalendarDays className="w-4 h-4" />
              <span className="font-medium text-slate-700" data-testid="assign-modal-date">{slot.date}</span>
              {slotLocation && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: getLocationColor(slotLocation.name)?.hex || "#94a3b8" }}>
                  {slotLocation.name.trim().substring(0, 3).toUpperCase()}
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="assign-modal-close">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
              placeholder="Szukaj: nazwisko, telefon, zabieg…"
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="assign-search-input"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Na górze: pacjenci z preferowanym terminem obejmującym tę datę, „jak najszybciej” i z tej samej placówki.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5" data-testid="assign-candidates">
          {candidates.length === 0 && <p className="text-sm text-slate-500 text-center py-8">Brak pacjentów do przypisania</p>}
          {candidates.slice(0, 60).map((p) => {
            const isSel = selected?.id === p.id;
            const loc = locations.find((l) => l.id === p.location_id);
            const fits = matchesDate(p, slot.date);
            return (
              <button
                key={p.id}
                onClick={() => setSelected(isSel ? null : p)}
                className={`w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isSel ? "border-teal-500 bg-teal-50" : "border-slate-100 hover:bg-slate-50"
                }`}
                data-testid={`assign-candidate-${p.id}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isSel ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {isSel ? <Check className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900">{p.last_name} {p.first_name}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${getStatusColor(p.status)}`}>{STATUS_LABELS[p.status] || p.status}</span>
                    {p.asap && <Sparkles className="w-3.5 h-3.5 text-amber-500" title="Jak najszybciej" />}
                    {fits && <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 text-emerald-700">pasuje do preferencji</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                    <span>{p.procedure_type || "Zabieg do ustalenia"}</span>
                    {loc && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{loc.name.trim()}</span>}
                    {p.surgery_date && <span className="text-amber-700">obecnie: {p.surgery_date}</span>}
                    {getRanges(p).slice(0, 2).map((r, i) => (
                      <span key={i}>{r.start || "…"} – {r.end || "…"}</span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 space-y-3">
          {selected?.surgery_date && (
            <p className="text-xs text-amber-700 flex items-center gap-2" data-testid="assign-move-warning">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Pacjent ma już termin {selected.surgery_date} – zostanie przeniesiony na {slot.date}.
            </p>
          )}
          {locationChanges && (
            <p className="text-xs text-amber-700 flex items-center gap-2" data-testid="assign-location-warning">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Placówka pacjenta zmieni się na {slotLocation?.name?.trim()}.
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg" data-testid="assign-cancel">Anuluj</button>
            <button
              onClick={handleConfirm}
              disabled={!selected || saving}
              className="px-4 py-2 text-sm font-medium bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-50"
              data-testid="assign-confirm"
            >
              {saving ? "Przypisywanie…" : selected ? `Przypisz: ${selected.last_name}` : "Wybierz pacjenta"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignPatientModal;
