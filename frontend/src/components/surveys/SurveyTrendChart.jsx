import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

const PATIENT_COLORS = ["#0f766e", "#d97706", "#7c3aed", "#db2777", "#2563eb"];

export const SurveyTrendChart = ({ template, rows }) => {
  const [selected, setSelected] = useState([]);
  const [metric, setMetric] = useState("total");
  const tps = template?.timepoints || [];
  const subs = (template?.scoring?.subscales || []).map(s => ({ key: s.key || s.label, label: s.label || s.key }));

  const valueOf = (r) => metric === "total" ? r.score?.total?.value : r.score?.subscales?.[metric]?.value;

  // Group rows by patient
  const byPatient = {};
  rows.forEach(r => {
    const k = r.patient.id;
    byPatient[k] = byPatient[k] || { id: k, name: `${r.patient.last_name} ${r.patient.first_name}`, tps: {} };
    byPatient[k].tps[r.timepoint_key] = valueOf(r);
  });
  const patients = Object.values(byPatient).sort((a, b) => a.name.localeCompare(b.name));

  const data = tps.map(tp => {
    const vals = rows.filter(r => r.timepoint_key === tp.key).map(valueOf).filter(v => typeof v === "number");
    const point = { name: tp.label, n: vals.length, mean: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null };
    selected.forEach(pid => { point[pid] = byPatient[pid]?.tps[tp.key] ?? null; });
    return point;
  });

  const toggle = (pid) => setSelected(sel => sel.includes(pid) ? sel.filter(x => x !== pid) : sel.length >= 5 ? sel : [...sel, pid]);
  const maxY = metric === "total" ? (rows[0]?.score?.total?.max || 100) : (rows.find(r => r.score?.subscales?.[metric]?.max)?.score?.subscales?.[metric]?.max || 100);

  if (!template || tps.length < 2) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4" data-testid="survey-trend-chart">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-teal-600" />
          <h3 className="font-semibold text-slate-900">Zmiana wyniku w czasie</h3>
          <span className="text-xs text-slate-400">średnia grupy{selected.length ? ` + ${selected.length} pacjent(ów)` : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          {subs.length > 0 && (
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm" data-testid="chart-metric-select">
              <option value="total">Wynik całkowity</option>
              {subs.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          )}
          <select value="" onChange={(e) => { if (e.target.value) toggle(e.target.value); }} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm max-w-[220px]" data-testid="chart-patient-select">
            <option value="">+ Dodaj pacjenta do wykresu</option>
            {patients.filter(p => !selected.includes(p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selected.map((pid, i) => (
            <button key={pid} onClick={() => toggle(pid)} className="px-2.5 py-1 rounded-full text-xs font-medium text-white flex items-center gap-1" style={{ backgroundColor: PATIENT_COLORS[i % PATIENT_COLORS.length] }} data-testid={`chart-patient-chip-${pid}`}>
              {byPatient[pid]?.name} ×
            </button>
          ))}
        </div>
      )}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
            <YAxis domain={[0, maxY]} tick={{ fontSize: 12, fill: "#64748b" }} />
            <Tooltip formatter={(v, name, item) => [v ?? "—", name === "mean" ? `Średnia grupy (n=${item.payload.n})` : byPatient[name]?.name || name]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
            <Legend formatter={(v) => v === "mean" ? "Średnia grupy" : byPatient[v]?.name || v} wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="mean" stroke="#0f172a" strokeWidth={3} dot={{ r: 5 }} connectNulls name="mean" />
            {selected.map((pid, i) => (
              <Line key={pid} type="monotone" dataKey={pid} stroke={PATIENT_COLORS[i % PATIENT_COLORS.length]} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 4 }} connectNulls name={pid} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500">
        {data.map(d => <span key={d.name}>{d.name}: <strong className="text-slate-700">{d.mean ?? "—"}</strong> (n={d.n})</span>)}
      </div>
      {template?.scoring?.note && <p className="text-[11px] text-slate-400 mt-1 italic">{template.scoring.note}</p>}
    </div>
  );
};

export default SurveyTrendChart;
