import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ClipboardList, Plus, Edit, Copy, Trash2, FileSpreadsheet, Eye, BarChart3, Layers } from "lucide-react";
import api from "../utils/api";
import SurveyResultModal from "../components/surveys/SurveyResultModal";

const saveBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  window.URL.revokeObjectURL(url);
};

const TemplatesTab = ({ templates, summary, reload }) => {
  const navigate = useNavigate();
  const handleDelete = async (t) => {
    if (!window.confirm(`Usunąć ankietę „${t.name}”? Jeśli ma wypełnione odpowiedzi, zostanie tylko dezaktywowana.`)) return;
    try {
      const res = await api.delete(`/surveys/templates/${t.id}`);
      toast.success(res.data.message === "deactivated" ? "Ankieta dezaktywowana (ma zapisane odpowiedzi)" : "Ankieta usunięta");
      reload();
    } catch (err) { toast.error("Nie udało się usunąć"); }
  };
  const handleDuplicate = async (t) => {
    try {
      const res = await api.post(`/surveys/templates/${t.id}/duplicate`);
      toast.success("Utworzono kopię");
      navigate(`/surveys/builder/${res.data.id}`);
    } catch (err) { toast.error("Nie udało się skopiować"); }
  };
  return (
    <div className="space-y-3">
      {templates.map((t) => {
        const s = summary[t.id] || { pending: 0, completed: 0 };
        return (
          <div key={t.id} className={`bg-white rounded-xl border p-5 flex items-start justify-between gap-4 ${t.active === false ? "border-slate-200 opacity-60" : "border-slate-200"}`} data-testid={`survey-template-${t.id}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {t.code && <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-xs font-bold">{t.code}</span>}
                <h3 className="font-semibold text-slate-900">{t.name}</h3>
                {t.active === false && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs">nieaktywna</span>}
              </div>
              {t.description && <p className="text-sm text-slate-500 mt-1">{t.description}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
                <span>{t.questions?.length || 0} pytań</span>
                <span>Momenty: {(t.timepoints || []).map(tp => tp.label).join(", ")}</span>
                <span className="text-emerald-700 font-medium">{s.completed} wypełnionych</span>
                <span className="text-amber-700">{s.pending} oczekujących</span>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => navigate(`/surveys/builder/${t.id}`)} className="p-2 hover:bg-slate-100 rounded-lg" title="Edytuj" data-testid={`edit-survey-${t.id}`}><Edit className="w-4 h-4 text-slate-600" /></button>
              <button onClick={() => handleDuplicate(t)} className="p-2 hover:bg-slate-100 rounded-lg" title="Duplikuj" data-testid={`duplicate-survey-${t.id}`}><Copy className="w-4 h-4 text-slate-600" /></button>
              <button onClick={() => handleDelete(t)} className="p-2 hover:bg-red-50 rounded-lg" title="Usuń" data-testid={`delete-survey-${t.id}`}><Trash2 className="w-4 h-4 text-red-500" /></button>
            </div>
          </div>
        );
      })}
      {templates.length === 0 && <p className="text-center text-slate-500 py-12">Brak ankiet – dodaj pierwszą.</p>}
    </div>
  );
};

const ResultsTab = ({ templates }) => {
  const [templateId, setTemplateId] = useState(templates[0]?.id || "");
  const [timepoint, setTimepoint] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewId, setViewId] = useState(null);
  const navigate = useNavigate();
  const template = templates.find(t => t.id === templateId);

  const load = useCallback(async () => {
    if (!templateId) return;
    setLoading(true);
    try {
      const res = await api.get(`/surveys/results?template_id=${templateId}${timepoint ? `&timepoint=${timepoint}` : ""}`);
      setRows(res.data);
    } catch (err) { toast.error("Nie udało się załadować wyników"); }
    finally { setLoading(false); }
  }, [templateId, timepoint]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    try {
      const res = await api.get(`/surveys/export?template_id=${templateId}`, { responseType: "blob" });
      const m = (res.headers["content-disposition"] || "").match(/filename="?([^";]+)"?/);
      saveBlob(res.data, m?.[1] || "ankieta.xlsx");
      toast.success("Eksport pobrany");
    } catch (err) { toast.error("Nie udało się wyeksportować"); }
  };

  // Group by patient for pre/post comparison
  const byPatient = {};
  rows.forEach(r => {
    const k = r.patient.id;
    byPatient[k] = byPatient[k] || { patient: r.patient, tps: {} };
    byPatient[k].tps[r.timepoint_key] = r;
  });
  const tps = template?.timepoints || [];
  const subKeys = (template?.scoring?.subscales || []).map(s => s.key || s.label);

  return (
    <div>
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
        <select value={templateId} onChange={(e) => { setTemplateId(e.target.value); setTimepoint(""); }} className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" data-testid="results-template-select">
          {templates.map(t => <option key={t.id} value={t.id}>{t.code ? `${t.code} – ` : ""}{t.name}</option>)}
        </select>
        <select value={timepoint} onChange={(e) => setTimepoint(e.target.value)} className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" data-testid="results-timepoint-select">
          <option value="">Wszystkie momenty</option>
          {tps.map(tp => <option key={tp.key} value={tp.key}>{tp.label}</option>)}
        </select>
        <span className="text-sm text-slate-500">{rows.length} odpowiedzi</span>
        <button onClick={handleExport} disabled={!templateId} className="ml-auto flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-medium disabled:opacity-50" data-testid="export-results-button">
          <FileSpreadsheet className="w-4 h-4" /> Eksport do Excela
        </button>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div> : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Pacjent</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Zabieg</th>
                {tps.filter(tp => !timepoint || tp.key === timepoint).map(tp => (
                  <th key={tp.key} className="px-4 py-3 text-left font-semibold text-slate-600">{tp.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.values(byPatient).map(({ patient, tps: ptps }) => (
                <tr key={patient.id} className="hover:bg-slate-50" data-testid={`result-row-${patient.id}`}>
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/patients/${patient.id}`)} className="font-medium text-slate-900 hover:text-teal-700">{patient.last_name} {patient.first_name}</button>
                    {patient.surgery_date && <p className="text-xs text-slate-400">Zabieg: {patient.surgery_date}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{patient.procedure_type || "-"}</td>
                  {tps.filter(tp => !timepoint || tp.key === timepoint).map(tp => {
                    const r = ptps[tp.key];
                    return (
                      <td key={tp.key} className="px-4 py-3">
                        {r ? (
                          <button onClick={() => setViewId(r.id)} className="text-left group" data-testid={`view-result-${r.id}`}>
                            <span className="text-lg font-semibold text-teal-700 group-hover:underline">{r.score?.total?.value ?? "-"}</span>
                            <span className="text-xs text-slate-400"> / {r.score?.total?.max ?? "-"}</span>
                            {subKeys.length > 0 && (
                              <p className="text-[11px] text-slate-500">{subKeys.map(k => `${r.score?.subscales?.[k]?.label || k}: ${r.score?.subscales?.[k]?.value ?? "-"}`).join(" · ")}</p>
                            )}
                            <p className="text-[11px] text-slate-400 flex items-center gap-1"><Eye className="w-3 h-3" />{(r.completed_at || "").slice(0, 10)}</p>
                          </button>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="text-center text-slate-500 py-12">Brak wypełnionych ankiet</p>}
        </div>
      )}
      {viewId && <SurveyResultModal assignmentId={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
};

export default function SurveysPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("templates");
  const [templates, setTemplates] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [tRes, sRes] = await Promise.all([api.get("/surveys/templates?include_inactive=true"), api.get("/surveys/results/summary")]);
      setTemplates(tRes.data);
      setSummary(sRes.data);
    } catch (err) { toast.error("Nie udało się załadować ankiet"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;

  return (
    <div className="p-8" data-testid="surveys-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 flex items-center gap-3" style={{ fontFamily: 'Manrope, sans-serif' }}><ClipboardList className="w-8 h-8 text-teal-600" /> Ankiety (PROMs)</h1>
          <p className="text-slate-500 mt-1">Kwestionariusze wypełniane przez pacjentów przed i po zabiegu</p>
        </div>
        <button onClick={() => navigate("/surveys/builder")} className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 rounded-lg font-medium" data-testid="add-survey-button">
          <Plus className="w-5 h-5" /> Nowa ankieta
        </button>
      </div>
      <div className="flex gap-2 mb-6">
        {[{ k: "templates", label: "Szablony", icon: Layers }, { k: "results", label: "Wyniki", icon: BarChart3 }].map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${tab === k ? "bg-teal-700 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`} data-testid={`surveys-tab-${k}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>
      {tab === "templates" ? <TemplatesTab templates={templates} summary={summary} reload={load} /> : <ResultsTab templates={templates.filter(t => t.active !== false)} />}
    </div>
  );
}
