import { useState, useEffect, useCallback } from "react";
import { X, CheckCircle2 } from "lucide-react";
import api from "../../utils/api";

const SurveyResultModal = ({ assignmentId, onClose }) => {
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/surveys/assignments/${assignmentId}`);
      setData(res.data);
    } catch (err) {
      onClose();
    }
  }, [assignmentId, onClose]);

  useEffect(() => { load(); }, [load]);

  if (!data) return null;
  const t = data.template || {};
  const answers = data.answers || {};
  const score = data.score || {};

  const fmtAnswer = (q) => {
    const v = answers[q.id];
    if (v === undefined || v === null || v === "") return "—";
    if (Array.isArray(v)) return v.map(x => q.options?.find(o => String(o.value) === String(x))?.label || x).join(", ");
    const opt = q.options?.find(o => String(o.value) === String(v));
    return opt ? `${opt.value}${opt.label ? ` – ${opt.label}` : ""}` : String(v);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" data-testid="survey-result-modal">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-start">
          <div>
            <p className="text-xs uppercase text-slate-400">{data.timepoint_label}</p>
            <h2 className="text-lg font-semibold text-slate-900">{t.name}</h2>
            {data.patient && <p className="text-sm text-slate-500">{data.patient.last_name} {data.patient.first_name} · wypełniono {(data.completed_at || "").slice(0, 16).replace("T", " ")}{data.filled_via === "tablet" ? " (tablet)" : ""}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="survey-result-close"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto">
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="bg-teal-50 border border-teal-100 rounded-xl px-5 py-3">
              <p className="text-xs text-teal-700">Wynik</p>
              <p className="text-3xl font-bold text-teal-800" data-testid="survey-result-total">{score.total?.value ?? "—"}<span className="text-base font-normal text-teal-600"> / {score.total?.max ?? "—"}</span></p>
            </div>
            {Object.entries(score.subscales || {}).map(([k, v]) => (
              <div key={k} className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3">
                <p className="text-xs text-slate-500">{v.label || k}</p>
                <p className="text-2xl font-semibold text-slate-800">{v.value ?? "—"}<span className="text-sm font-normal text-slate-400"> / {v.max ?? "—"}</span></p>
              </div>
            ))}
          </div>
          {t.scoring?.note && <p className="text-xs text-slate-500 mb-4 italic">{t.scoring.note}</p>}
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {(t.questions || []).map((q, i) => (
              <div key={q.id} className="px-4 py-3 flex items-start justify-between gap-4">
                <p className="text-sm text-slate-700"><span className="text-slate-400 mr-2">{i + 1}.</span>{q.text}</p>
                <p className="text-sm font-medium text-slate-900 text-right shrink-0 max-w-[45%]">{fmtAnswer(q)}</p>
              </div>
            ))}
          </div>
          {data.history?.length > 0 && (
            <p className="text-xs text-slate-400 mt-4 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Poprzednie wypełnienia: {data.history.map(h => `${(h.completed_at || "").slice(0, 10)} (${h.score?.total?.value ?? "-"})`).join(", ")}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SurveyResultModal;
