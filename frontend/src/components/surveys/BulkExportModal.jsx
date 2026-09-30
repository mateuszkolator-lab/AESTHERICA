import { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, FileSpreadsheet, Users } from "lucide-react";
import api from "../../utils/api";
import { STATUS_OPTIONS } from "../../utils/constants";

const saveBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  window.URL.revokeObjectURL(url);
};

export const BulkExportModal = ({ templates, onClose }) => {
  const [templateIds, setTemplateIds] = useState(templates.map(t => t.id));
  const [timepoints, setTimepoints] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [procedureType, setProcedureType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statuses, setStatuses] = useState([]);
  const [patientIds, setPatientIds] = useState([]);
  const [patientQuery, setPatientQuery] = useState("");
  const [locations, setLocations] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [patients, setPatients] = useState([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/locations"), api.get("/settings"), api.get("/patients")]).then(([l, s, p]) => {
      setLocations(l.data); setProcedures(s.data?.procedure_types || []); setPatients(p.data);
    }).catch(() => {});
  }, []);

  const allTimepoints = [];
  templates.filter(t => templateIds.includes(t.id)).forEach(t => (t.timepoints || []).forEach(tp => {
    if (!allTimepoints.some(x => x.key === tp.key)) allTimepoints.push(tp);
  }));

  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const matchingPatients = patients.filter(p =>
    (!locationId || p.location_id === locationId) &&
    (!procedureType || p.procedure_type === procedureType) &&
    (!statuses.length || statuses.includes(p.status)) &&
    (!from || (p.surgery_date && p.surgery_date >= from)) &&
    (!to || (p.surgery_date && p.surgery_date <= to))
  );
  const searchable = matchingPatients.filter(p => !patientQuery || `${p.last_name} ${p.first_name}`.toLowerCase().includes(patientQuery.toLowerCase()));

  const handleExport = async () => {
    if (!templateIds.length) { toast.error("Wybierz przynajmniej jedną ankietę"); return; }
    setExporting(true);
    try {
      const res = await api.post("/surveys/export-bulk", {
        template_ids: templateIds, timepoints, location_id: locationId || null, procedure_type: procedureType || null,
        surgery_from: from || null, surgery_to: to || null, statuses, patient_ids: patientIds
      }, { responseType: "blob" });
      const m = (res.headers["content-disposition"] || "").match(/filename="?([^";]+)"?/);
      saveBlob(res.data, m?.[1] || "ankiety_zbiorczo.xlsx");
      toast.success("Eksport zbiorczy pobrany");
      onClose();
    } catch (err) { toast.error("Nie udało się wyeksportować"); }
    finally { setExporting(false); }
  };

  const sel = "px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" data-testid="bulk-export-modal">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center"><FileSpreadsheet className="w-5 h-5 text-emerald-700" /></div>
            <div><h2 className="text-lg font-semibold text-slate-900">Eksport zbiorczy ankiet</h2><p className="text-xs text-slate-500">Arkusz „Podsumowanie” (pacjent × ankieta × moment) + osobny arkusz z odpowiedziami dla każdej ankiety</p></div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="bulk-export-close"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-5">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Ankiety</p>
            <div className="flex flex-wrap gap-2">
              {templates.map(t => (
                <button key={t.id} type="button" onClick={() => toggle(templateIds, setTemplateIds, t.id)} className={`px-3 py-1.5 rounded-full text-sm border ${templateIds.includes(t.id) ? "bg-teal-700 text-white border-teal-700" : "bg-white text-slate-600 border-slate-200"}`} data-testid={`bulk-template-${t.id}`}>{t.code || t.name}</button>
              ))}
            </div>
          </div>
          {allTimepoints.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Momenty <span className="text-slate-400 font-normal">(brak zaznaczenia = wszystkie)</span></p>
              <div className="flex flex-wrap gap-2">
                {allTimepoints.map(tp => (
                  <button key={tp.key} type="button" onClick={() => toggle(timepoints, setTimepoints, tp.key)} className={`px-3 py-1.5 rounded-full text-sm border ${timepoints.includes(tp.key) ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"}`} data-testid={`bulk-timepoint-${tp.key}`}>{tp.label}</button>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Grupa pacjentów</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={sel} data-testid="bulk-location"><option value="">Wszystkie placówki</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              <select value={procedureType} onChange={(e) => setProcedureType(e.target.value)} className={sel} data-testid="bulk-procedure"><option value="">Wszystkie zabiegi</option>{procedures.map(p => <option key={p} value={p}>{p}</option>)}</select>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={sel} title="Data zabiegu od" data-testid="bulk-from" />
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={sel} title="Data zabiegu do" data-testid="bulk-to" />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {STATUS_OPTIONS.map(s => (
                <button key={s.value} type="button" onClick={() => toggle(statuses, setStatuses, s.value)} className={`px-2.5 py-1 rounded-full text-xs border ${statuses.includes(s.value) ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"}`} data-testid={`bulk-status-${s.value}`}>{s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">Konkretni pacjenci <span className="text-slate-400 font-normal">(opcjonalnie – brak zaznaczenia = cała grupa: {matchingPatients.length})</span></p>
              {patientIds.length > 0 && <button type="button" onClick={() => setPatientIds([])} className="text-xs text-teal-600">Wyczyść ({patientIds.length})</button>}
            </div>
            <input value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder="Szukaj pacjenta..." className={`${sel} w-full mb-2`} data-testid="bulk-patient-search" />
            <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
              {searchable.slice(0, 200).map(p => (
                <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={patientIds.includes(p.id)} onChange={() => toggle(patientIds, setPatientIds, p.id)} data-testid={`bulk-patient-${p.id}`} />
                  <span className="text-slate-800">{p.last_name} {p.first_name}</span>
                  <span className="text-xs text-slate-400 ml-auto">{p.procedure_type || ""} {p.surgery_date || ""}</span>
                </label>
              ))}
              {searchable.length === 0 && <p className="text-xs text-slate-400 px-3 py-2">Brak pacjentów spełniających kryteria</p>}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium">Anuluj</button>
          <button onClick={handleExport} disabled={exporting} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-medium disabled:opacity-50" data-testid="bulk-export-confirm">
            <FileSpreadsheet className="w-4 h-4" /> {exporting ? "Generowanie..." : `Eksportuj (${patientIds.length || matchingPatients.length} pacjentów)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkExportModal;
