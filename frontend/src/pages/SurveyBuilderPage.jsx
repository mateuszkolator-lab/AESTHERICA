import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2, GripVertical, Copy, Calculator, Save, ArrowUp, ArrowDown } from "lucide-react";
import api from "../utils/api";

const QUESTION_TYPES = [
  { value: "scale", label: "Skala z etykietami (punktowana)" },
  { value: "single", label: "Jednokrotny wybór (punktowany)" },
  { value: "yesno", label: "Tak / Nie" },
  { value: "multi", label: "Wielokrotny wybór" },
  { value: "number", label: "Liczba" },
  { value: "text", label: "Tekst otwarty (bez punktów)" },
];

const newId = () => Math.random().toString(36).slice(2, 10);
const scaleOptions = (n, start = 0) => Array.from({ length: n }, (_, i) => ({ value: start + i, label: "", score: start + i }));

const emptyTemplate = {
  name: "", code: "", description: "", instructions: "", active: true,
  timepoints: [{ key: "pre", label: "Przed zabiegiem" }, { key: "12m", label: "12 miesięcy po zabiegu" }],
  sections: [], questions: [],
  scoring: { mode: "sum", multiplier: "", scale_to_100: true, formula: "", subscales: [], note: "" },
};

const Input = (props) => <input {...props} className={`px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${props.className || ""}`} />;

const QuestionEditor = ({ q, index, sections, onChange, onRemove, onMove, onDuplicate }) => {
  const set = (patch) => onChange({ ...q, ...patch });
  const hasOptions = ["scale", "single", "yesno", "multi"].includes(q.type);
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4" data-testid={`builder-question-${index}`}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 pt-1 text-slate-300">
          <GripVertical className="w-4 h-4" />
          <span className="text-xs font-bold text-slate-500">{index + 1}</span>
        </div>
        <div className="flex-1 space-y-3">
          <textarea value={q.text} onChange={(e) => set({ text: e.target.value })} rows={2} placeholder="Treść pytania"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" data-testid={`question-text-${index}`} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select value={q.type} onChange={(e) => {
              const type = e.target.value;
              const patch = { type };
              if (type === "yesno") patch.options = [{ value: 1, label: "Tak", score: 1 }, { value: 0, label: "Nie", score: 0 }];
              else if (["scale", "single", "multi"].includes(type) && !q.options?.length) patch.options = scaleOptions(5);
              set(patch);
            }} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid={`question-type-${index}`}>
              {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {sections.length > 0 && (
              <select value={q.section || ""} onChange={(e) => set({ section: e.target.value || undefined })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid={`question-section-${index}`}>
                <option value="">Bez sekcji</option>
                {sections.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-600 px-2"><input type="checkbox" checked={q.required !== false} onChange={(e) => set({ required: e.target.checked })} /> Wymagane</label>
            {q.type !== "text" && q.type !== "multi" && (
              <label className="flex items-center gap-2 text-sm text-slate-600 px-2" title="Odwrócona punktacja (min+max − wynik)"><input type="checkbox" checked={!!q.reverse} onChange={(e) => set({ reverse: e.target.checked })} data-testid={`question-reverse-${index}`} /> Odwróć punkty</label>
            )}
          </div>
          {q.type === "number" && (
            <div className="flex gap-2 items-center text-sm text-slate-600">
              Min <Input type="number" value={q.min ?? ""} onChange={(e) => set({ min: e.target.value === "" ? undefined : Number(e.target.value) })} className="w-24" />
              Max <Input type="number" value={q.max ?? ""} onChange={(e) => set({ max: e.target.value === "" ? undefined : Number(e.target.value) })} className="w-24" />
            </div>
          )}
          {hasOptions && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase">Odpowiedzi (wartość · etykieta · punkty)</p>
                <div className="flex gap-1">
                  {[3, 4, 5, 6, 11].map(n => <button key={n} type="button" onClick={() => set({ options: scaleOptions(n) })} className="px-2 py-0.5 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-600">{n === 11 ? "0–10" : `0–${n - 1}`}</button>)}
                </div>
              </div>
              {(q.options || []).map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <Input type="number" value={o.value} onChange={(e) => { const opts = [...q.options]; opts[oi] = { ...o, value: Number(e.target.value) }; set({ options: opts }); }} className="w-16" data-testid={`option-value-${index}-${oi}`} />
                  <Input value={o.label || ""} placeholder="Etykieta (np. Wcale)" onChange={(e) => { const opts = [...q.options]; opts[oi] = { ...o, label: e.target.value }; set({ options: opts }); }} className="flex-1" data-testid={`option-label-${index}-${oi}`} />
                  <Input type="number" step="0.5" value={o.score ?? ""} placeholder="pkt" onChange={(e) => { const opts = [...q.options]; opts[oi] = { ...o, score: e.target.value === "" ? 0 : Number(e.target.value) }; set({ options: opts }); }} className="w-20" data-testid={`option-score-${index}-${oi}`} />
                  <button type="button" onClick={() => set({ options: q.options.filter((_, i) => i !== oi) })} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => set({ options: [...(q.options || []), { value: (q.options?.length || 0), label: "", score: (q.options?.length || 0) }] })} className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Dodaj odpowiedź</button>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => onMove(-1)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500"><ArrowUp className="w-4 h-4" /></button>
          <button type="button" onClick={() => onMove(1)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500"><ArrowDown className="w-4 h-4" /></button>
          <button type="button" onClick={onDuplicate} className="p-1.5 hover:bg-slate-100 rounded text-slate-500" title="Duplikuj"><Copy className="w-4 h-4" /></button>
          <button type="button" onClick={onRemove} className="p-1.5 hover:bg-red-50 rounded text-red-500" data-testid={`remove-question-${index}`}><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
};

export default function SurveyBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [t, setT] = useState(emptyTemplate);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get(`/surveys/templates/${id}`);
      setT({ ...emptyTemplate, ...res.data, scoring: { ...emptyTemplate.scoring, ...(res.data.scoring || {}) } });
    } catch (err) { toast.error("Nie udało się załadować ankiety"); navigate("/surveys"); }
    finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const set = (patch) => setT(prev => ({ ...prev, ...patch }));
  const setScoring = (patch) => setT(prev => ({ ...prev, scoring: { ...prev.scoring, ...patch } }));
  const updateQ = (i, q) => set({ questions: t.questions.map((x, idx) => idx === i ? q : x) });
  const moveQ = (i, dir) => {
    const j = i + dir; if (j < 0 || j >= t.questions.length) return;
    const qs = [...t.questions]; [qs[i], qs[j]] = [qs[j], qs[i]]; set({ questions: qs });
  };

  const handleSave = async () => {
    if (!t.name.trim()) { toast.error("Podaj nazwę ankiety"); return; }
    if (!t.questions.length) { toast.error("Dodaj przynajmniej jedno pytanie"); return; }
    if (!t.timepoints.length) { toast.error("Dodaj przynajmniej jeden moment wypełnienia"); return; }
    setSaving(true);
    try {
      const payload = { ...t, scoring: { ...t.scoring, multiplier: t.scoring.multiplier === "" ? null : Number(t.scoring.multiplier) } };
      delete payload.id; delete payload.created_at; delete payload.updated_at; delete payload.preset;
      if (id) { await api.put(`/surveys/templates/${id}`, payload); toast.success("Ankieta zapisana"); }
      else { const res = await api.post("/surveys/templates", payload); toast.success("Ankieta utworzona"); navigate(`/surveys/builder/${res.data.id}`, { replace: true }); }
    } catch (err) { toast.error(err.response?.data?.detail || "Nie udało się zapisać"); }
    finally { setSaving(false); }
  };

  const handlePreviewScore = async () => {
    // Simulate: every question answered with its max option
    const answers = {};
    t.questions.forEach(q => {
      if (q.options?.length) answers[q.id] = q.options.reduce((a, b) => (b.score ?? b.value) > (a.score ?? a.value) ? b : a).value;
      else if (q.type === "number" || q.type === "scale") answers[q.id] = q.max ?? 10;
    });
    try {
      const res = await api.post("/surveys/templates/preview-score", { template: t, answers });
      setPreview(res.data);
    } catch (err) { toast.error("Nie udało się przeliczyć"); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;

  return (
    <div className="p-8 max-w-5xl" data-testid="survey-builder-page">
      <button onClick={() => navigate("/surveys")} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"><ChevronLeft className="w-4 h-4" /> Ankiety</button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>{id ? "Edytuj ankietę" : "Nowa ankieta"}</h1>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-5 py-2.5 rounded-lg font-medium disabled:opacity-50" data-testid="save-survey-button">
          <Save className="w-4 h-4" /> {saving ? "Zapisywanie..." : "Zapisz ankietę"}
        </button>
      </div>

      {/* Basic info */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa *</label>
          <Input value={t.name} onChange={(e) => set({ name: e.target.value })} className="w-full" data-testid="survey-name-input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Skrót (np. NOSE)</label>
          <Input value={t.code || ""} onChange={(e) => set({ code: e.target.value })} className="w-full" data-testid="survey-code-input" />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-slate-700 mb-1">Opis (dla personelu)</label>
          <Input value={t.description || ""} onChange={(e) => set({ description: e.target.value })} className="w-full" />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-slate-700 mb-1">Instrukcja dla pacjenta (widoczna na górze ankiety)</label>
          <Input value={t.instructions || ""} onChange={(e) => set({ instructions: e.target.value })} className="w-full" data-testid="survey-instructions-input" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={t.active !== false} onChange={(e) => set({ active: e.target.checked })} /> Aktywna (dostępna przy dodawaniu pacjenta)</label>
      </div>

      {/* Timepoints & sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Momenty wypełnienia</h3>
          <p className="text-xs text-slate-500 mb-3">Każdy moment = osobny link/QR dla pacjenta (np. przed zabiegiem i 12 mies. po).</p>
          <div className="space-y-2">
            {t.timepoints.map((tp, i) => (
              <div key={i} className="flex gap-2">
                <Input value={tp.key} placeholder="klucz" onChange={(e) => { const tps = [...t.timepoints]; tps[i] = { ...tp, key: e.target.value.replace(/\s/g, "_") }; set({ timepoints: tps }); }} className="w-24" data-testid={`timepoint-key-${i}`} />
                <Input value={tp.label} placeholder="Etykieta (np. 3 miesiące po)" onChange={(e) => { const tps = [...t.timepoints]; tps[i] = { ...tp, label: e.target.value }; set({ timepoints: tps }); }} className="flex-1" data-testid={`timepoint-label-${i}`} />
                <button type="button" onClick={() => set({ timepoints: t.timepoints.filter((_, j) => j !== i) })} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[["pre", "Przed zabiegiem"], ["1m", "1 miesiąc po zabiegu"], ["3m", "3 miesiące po zabiegu"], ["6m", "6 miesięcy po zabiegu"], ["12m", "12 miesięcy po zabiegu"]].map(([k, l]) => (
                <button key={k} type="button" disabled={t.timepoints.some(tp => tp.key === k)} onClick={() => set({ timepoints: [...t.timepoints, { key: k, label: l }] })} className="px-2 py-1 text-xs rounded-full border border-slate-200 hover:bg-slate-50 disabled:opacity-40" data-testid={`add-timepoint-${k}`}>+ {l}</button>
              ))}
              <button type="button" onClick={() => set({ timepoints: [...t.timepoints, { key: `tp${t.timepoints.length + 1}`, label: "" }] })} className="px-2 py-1 text-xs rounded-full bg-teal-50 text-teal-700 hover:bg-teal-100" data-testid="add-timepoint-custom">+ własny</button>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 mb-1">Sekcje / podskale</h3>
          <p className="text-xs text-slate-500 mb-3">Opcjonalnie: grupuj pytania (np. SCHNOS-O i SCHNOS-C) – każda sekcja może mieć własny wynik.</p>
          <div className="space-y-2">
            {t.sections.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input value={s.key} placeholder="klucz" onChange={(e) => { const ss = [...t.sections]; ss[i] = { ...s, key: e.target.value.replace(/\s/g, "_") }; set({ sections: ss }); }} className="w-24" />
                <Input value={s.label} placeholder="Nazwa sekcji" onChange={(e) => { const ss = [...t.sections]; ss[i] = { ...s, label: e.target.value }; set({ sections: ss }); }} className="flex-1" />
                <button type="button" onClick={() => set({ sections: t.sections.filter((_, j) => j !== i) })} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button type="button" onClick={() => set({ sections: [...t.sections, { key: `S${t.sections.length + 1}`, label: "" }] })} className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1" data-testid="add-section"><Plus className="w-3 h-3" /> Dodaj sekcję</button>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Pytania ({t.questions.length})</h3>
          <button type="button" onClick={() => set({ questions: [...t.questions, { id: newId(), type: "scale", text: "", required: true, options: scaleOptions(5) }] })} className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm font-medium" data-testid="add-question-button">
            <Plus className="w-4 h-4" /> Dodaj pytanie
          </button>
        </div>
        <div className="space-y-3">
          {t.questions.map((q, i) => (
            <QuestionEditor key={q.id} q={q} index={i} sections={t.sections}
              onChange={(nq) => updateQ(i, nq)}
              onRemove={() => set({ questions: t.questions.filter((_, j) => j !== i) })}
              onMove={(d) => moveQ(i, d)}
              onDuplicate={() => { const qs = [...t.questions]; qs.splice(i + 1, 0, { ...q, id: newId() }); set({ questions: qs }); }} />
          ))}
          {t.questions.length === 0 && <p className="text-center text-slate-400 py-8 bg-white border border-dashed border-slate-200 rounded-xl">Brak pytań – kliknij „Dodaj pytanie”</p>}
        </div>
      </div>

      {/* Scoring */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6" data-testid="scoring-section">
        <div className="flex items-center gap-2 mb-1"><Calculator className="w-5 h-5 text-teal-600" /><h3 className="font-semibold text-slate-900">Przeliczanie wyniku</h3></div>
        <p className="text-xs text-slate-500 mb-4">Wynik liczony z punktów przypisanych do odpowiedzi. Pytania „Odwróć punkty” liczone jako (min + max − punkty).</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Metoda</label>
            <select value={t.scoring.mode || "sum"} onChange={(e) => setScoring({ mode: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" data-testid="scoring-mode">
              <option value="sum">Suma punktów</option>
              <option value="mean">Średnia punktów</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mnożnik (np. NOSE ×5)</label>
            <Input type="number" step="0.01" value={t.scoring.multiplier ?? ""} placeholder="brak" onChange={(e) => setScoring({ multiplier: e.target.value })} className="w-full" data-testid="scoring-multiplier" />
          </div>
          <label className="flex items-end gap-2 text-sm text-slate-700 pb-2"><input type="checkbox" checked={!!t.scoring.scale_to_100} onChange={(e) => setScoring({ scale_to_100: e.target.checked })} data-testid="scoring-scale100" /> Przeskaluj do 0–100</label>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notatka o interpretacji</label>
            <Input value={t.scoring.note || ""} placeholder="np. wyższy = gorzej" onChange={(e) => setScoring({ note: e.target.value })} className="w-full" />
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">Podskale (osobne wyniki)</p>
            <button type="button" onClick={() => setScoring({ subscales: [...(t.scoring.subscales || []), { key: `SUB${(t.scoring.subscales?.length || 0) + 1}`, label: "", section: t.sections[0]?.key || "", mode: "sum", scale_to_100: true }] })} className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1" data-testid="add-subscale"><Plus className="w-3 h-3" /> Dodaj podskalę</button>
          </div>
          {(t.scoring.subscales || []).map((s, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-center mb-2 p-2 bg-slate-50 rounded-lg">
              <Input value={s.key} placeholder="klucz" onChange={(e) => { const ss = [...t.scoring.subscales]; ss[i] = { ...s, key: e.target.value.replace(/\s/g, "_") }; setScoring({ subscales: ss }); }} className="w-28" />
              <Input value={s.label || ""} placeholder="Nazwa" onChange={(e) => { const ss = [...t.scoring.subscales]; ss[i] = { ...s, label: e.target.value }; setScoring({ subscales: ss }); }} className="w-40" />
              <select value={s.section || ""} onChange={(e) => { const ss = [...t.scoring.subscales]; ss[i] = { ...s, section: e.target.value }; setScoring({ subscales: ss }); }} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="">— sekcja —</option>
                {t.sections.map(sec => <option key={sec.key} value={sec.key}>{sec.label || sec.key}</option>)}
              </select>
              <select value={s.mode || "sum"} onChange={(e) => { const ss = [...t.scoring.subscales]; ss[i] = { ...s, mode: e.target.value }; setScoring({ subscales: ss }); }} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="sum">Suma</option><option value="mean">Średnia</option>
              </select>
              <Input type="number" step="0.01" value={s.multiplier ?? ""} placeholder="×" onChange={(e) => { const ss = [...t.scoring.subscales]; ss[i] = { ...s, multiplier: e.target.value === "" ? null : Number(e.target.value) }; setScoring({ subscales: ss }); }} className="w-20" />
              <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={!!s.scale_to_100} onChange={(e) => { const ss = [...t.scoring.subscales]; ss[i] = { ...s, scale_to_100: e.target.checked }; setScoring({ subscales: ss }); }} /> 0–100</label>
              <button type="button" onClick={() => setScoring({ subscales: t.scoring.subscales.filter((_, j) => j !== i) })} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Własna formuła (opcjonalnie – nadpisuje wynik główny)</label>
          <Input value={t.scoring.formula || ""} onChange={(e) => setScoring({ formula: e.target.value })} placeholder="np. (q1 + q2 + q3) / 3 * 20  albo  total - SCHNOS_O" className="w-full font-mono" data-testid="scoring-formula" />
          <p className="text-xs text-slate-400 mt-1">Zmienne: <code>q1…qN</code> (punkty pytań), <code>total</code>, klucze podskal, funkcje <code>sum, mean, min, max, abs, round</code>.</p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={handlePreviewScore} className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm font-medium" data-testid="preview-score-button"><Calculator className="w-4 h-4" /> Testuj (wszystkie odpowiedzi = maks.)</button>
          {preview && (
            <div className="text-sm text-slate-700" data-testid="preview-score-result">
              Wynik: <strong>{preview.total?.value ?? "-"}</strong> / {preview.total?.max ?? "-"}
              {Object.entries(preview.subscales || {}).map(([k, v]) => <span key={k} className="ml-3">{v.label || k}: <strong>{v.value}</strong></span>)}
              {preview.formula_error && <span className="ml-3 text-red-600">Błąd formuły: {preview.formula_error}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
