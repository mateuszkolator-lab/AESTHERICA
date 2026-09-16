import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { CheckCircle2, AlertCircle, ChevronRight, ClipboardList } from "lucide-react";
import { API_BASE } from "../utils/api";

const OptionButtons = ({ q, value, onChange }) => {
  const hasLabels = q.options.some(o => o.label);
  if (!hasLabels) return <NumericScale q={{ ...q, min: 0, max: q.options.length - 1 }} value={value} onChange={(v) => onChange(q.options[v]?.value ?? v)} />;
  return (
    <div className="space-y-2">
      {q.options.map((o) => {
        const active = String(value) === String(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`w-full min-h-[52px] px-3 py-2.5 rounded-xl border-2 flex items-center gap-3 text-left transition-all active:scale-[0.98] ${
              active ? "bg-teal-600 border-teal-600 text-white shadow-md" : "bg-white border-slate-200 text-slate-700 hover:border-teal-300"
            }`}
            data-testid={`answer-${q.id}-${o.value}`}
          >
            <span className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold shrink-0 ${active ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>{o.value}</span>
            <span className="text-sm font-medium leading-tight">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
};

const NumericScale = ({ q, value, onChange }) => {
  const min = q.min ?? 0, max = q.max ?? 10;
  const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {nums.map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`w-12 h-12 rounded-full border-2 font-semibold transition-all active:scale-95 ${
              String(value) === String(n) ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-slate-200 text-slate-700"
            }`} data-testid={`answer-${q.id}-${n}`}>{n}</button>
        ))}
      </div>
      {(q.min_label || q.max_label) && (
        <div className="flex justify-between text-xs text-slate-500 mt-2"><span>{q.min_label}</span><span>{q.max_label}</span></div>
      )}
    </div>
  );
};

const Question = ({ q, index, value, onChange, error }) => (
  <div className={`bg-white rounded-2xl p-5 shadow-sm border ${error ? "border-red-300" : "border-slate-100"}`} data-testid={`question-${q.id}`}>
    <p className="text-base font-medium text-slate-900 mb-4">
      <span className="text-teal-600 font-semibold mr-2">{index + 1}.</span>{q.text}
      {q.required !== false && <span className="text-red-500 ml-1">*</span>}
    </p>
    {q.type === "text" ? (
      <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3}
        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-teal-500" data-testid={`answer-${q.id}`} />
    ) : q.type === "number" ? (
      <input type="number" inputMode="decimal" value={value ?? ""} min={q.min} max={q.max} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="w-40 px-4 py-3 border border-slate-200 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-teal-500" data-testid={`answer-${q.id}`} />
    ) : q.type === "multi" ? (
      <div className="space-y-2">
        {q.options.map((o) => {
          const arr = Array.isArray(value) ? value : [];
          const on = arr.map(String).includes(String(o.value));
          return (
            <button key={o.value} type="button" onClick={() => onChange(on ? arr.filter(v => String(v) !== String(o.value)) : [...arr, o.value])}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 flex items-center gap-3 ${on ? "bg-teal-50 border-teal-500" : "bg-white border-slate-200"}`} data-testid={`answer-${q.id}-${o.value}`}>
              <span className={`w-5 h-5 rounded border-2 flex items-center justify-center ${on ? "bg-teal-600 border-teal-600" : "border-slate-300"}`}>{on && <CheckCircle2 className="w-4 h-4 text-white" />}</span>
              {o.label}
            </button>
          );
        })}
      </div>
    ) : (q.options?.length ? <OptionButtons q={q} value={value} onChange={onChange} /> : <NumericScale q={q} value={value} onChange={onChange} />)}
    {error && <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> To pytanie jest wymagane</p>}
  </div>
);

export default function SurveyFillPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const isTablet = new URLSearchParams(window.location.search).get("mode") === "tablet";

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/surveys/public/${token}`);
      setData(res.data);
      if (res.data.status === "completed") setDone(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Nie udało się załadować ankiety");
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const questions = data?.template?.questions || [];
  const answered = questions.filter(q => answers[q.id] !== undefined && answers[q.id] !== "" && !(Array.isArray(answers[q.id]) && answers[q.id].length === 0)).length;

  const handleSubmit = async () => {
    const missing = {};
    questions.forEach(q => { if (q.required !== false && (answers[q.id] === undefined || answers[q.id] === "" || (Array.isArray(answers[q.id]) && !answers[q.id].length))) missing[q.id] = true; });
    setErrors(missing);
    if (Object.keys(missing).length) {
      document.querySelector(`[data-testid="question-${Object.keys(missing)[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API_BASE}/surveys/public/${token}`, { answers, filled_via: isTablet ? "tablet" : "link" });
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err.response?.data?.detail?.missing ? "Uzupełnij wszystkie wymagane pytania" : (err.response?.data?.detail || "Nie udało się zapisać odpowiedzi"));
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !data) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-sm" data-testid="survey-error">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-slate-800 font-medium">{String(error)}</p>
      </div>
    </div>
  );
  if (!data) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;

  if (done) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-10 max-w-md text-center shadow-sm" data-testid="survey-thank-you">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-9 h-9 text-emerald-600" /></div>
        <h1 className="text-2xl font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>Dziękujemy{data.patient_first_name ? `, ${data.patient_first_name}` : ""}!</h1>
        <p className="text-slate-600">Odpowiedzi zostały zapisane w Twojej karcie pacjenta.</p>
        {isTablet && <p className="text-sm text-slate-400 mt-6">Możesz oddać tablet personelowi.</p>}
      </div>
    </div>
  );

  const t = data.template;
  return (
    <div className="min-h-screen bg-slate-50" data-testid="survey-fill-page">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <ClipboardList className="w-5 h-5 text-teal-600 shrink-0" />
              <p className="font-semibold text-slate-900 truncate">{t.code || t.name}</p>
            </div>
            <span className="text-xs text-slate-500 shrink-0">{answered}/{questions.length}</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-teal-600 transition-all" style={{ width: `${questions.length ? (answered / questions.length) * 100 : 0}%` }} /></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-teal-700 text-white rounded-2xl p-6">
          <p className="text-xs uppercase tracking-wide text-teal-100">{data.timepoint_label}</p>
          <h1 className="text-xl font-semibold mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>{t.name}</h1>
          {data.patient_first_name && <p className="text-teal-50 mt-2 text-sm">Dzień dobry, {data.patient_first_name}. {t.instructions || "Prosimy o odpowiedź na poniższe pytania."}</p>}
          {!data.patient_first_name && t.instructions && <p className="text-teal-50 mt-2 text-sm">{t.instructions}</p>}
        </div>

        {(t.sections?.length ? t.sections : [null]).map((sec) => {
          const qs = questions.filter(q => !sec || q.section === sec.key);
          if (!qs.length) return null;
          return (
            <div key={sec?.key || "all"} className="space-y-4">
              {sec && <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide pt-2">{sec.label}</h2>}
              {qs.map((q) => (
                <Question key={q.id} q={q} index={questions.indexOf(q)} value={answers[q.id]} error={errors[q.id]}
                  onChange={(v) => { setAnswers(a => ({ ...a, [q.id]: v })); setErrors(e => ({ ...e, [q.id]: false })); }} />
              ))}
            </div>
          );
        })}
        {t.sections?.length > 0 && questions.filter(q => !q.section || !t.sections.some(s => s.key === q.section)).map((q) => (
          <Question key={q.id} q={q} index={questions.indexOf(q)} value={answers[q.id]} error={errors[q.id]}
            onChange={(v) => { setAnswers(a => ({ ...a, [q.id]: v })); setErrors(e => ({ ...e, [q.id]: false })); }} />
        ))}

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{String(error)}</p>}
        <button onClick={handleSubmit} disabled={submitting}
          className="w-full min-h-[56px] bg-teal-700 hover:bg-teal-800 text-white rounded-2xl text-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors" data-testid="survey-submit">
          {submitting ? "Zapisywanie..." : "Wyślij odpowiedzi"} <ChevronRight className="w-5 h-5" />
        </button>
        <p className="text-center text-xs text-slate-400 pb-6">AestheticaMD · Twoje odpowiedzi są poufne</p>
      </div>
    </div>
  );
}
