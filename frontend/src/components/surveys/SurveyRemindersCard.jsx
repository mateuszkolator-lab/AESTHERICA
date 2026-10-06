import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ClipboardList, Link2, AlertTriangle, Clock } from "lucide-react";
import api from "../../utils/api";

export const SurveyRemindersCard = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/surveys/due");
      setItems(res.data);
    } catch (err) { /* non-critical */ }
    finally { setLoaded(true); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const copyLink = async (it) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/ankieta/${it.token}`);
      toast.success(`Link skopiowany – ${it.last_name} ${it.first_name}`);
    } catch { toast.error("Nie udało się skopiować"); }
  };

  const overdue = items.filter(i => i.days_overdue > 0).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm" data-testid="survey-reminders-card">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Ankiety do wypełnienia</h2>
        </div>
        <div className="flex items-center gap-2">
          {overdue > 0 && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold" data-testid="survey-overdue-count">{overdue} zaległych</span>}
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold" data-testid="survey-due-count">{items.length}</span>
        </div>
      </div>
      <div className="p-3 max-h-80 overflow-y-auto">
        {!loaded ? null : items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Brak ankiet z mijającym terminem</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((it) => (
              <div key={it.assignment_id} className={`flex items-center gap-3 p-2.5 rounded-xl border ${it.days_overdue > 0 ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"}`} data-testid={`survey-due-${it.assignment_id}`}>
                <div className="flex-1 min-w-0">
                  <button onClick={() => navigate(`/patients/${it.patient_id}`)} className="font-medium text-slate-900 text-sm hover:text-teal-700 truncate block text-left">
                    {it.last_name} {it.first_name}
                  </button>
                  <p className="text-[11px] text-slate-500 truncate">
                    <span className="font-semibold text-teal-700">{it.template_code || it.template_name}</span> · {it.timepoint_label}
                  </p>
                  <p className={`text-[11px] flex items-center gap-1 ${it.days_overdue > 0 ? "text-red-600" : "text-slate-400"}`}>
                    {it.days_overdue > 0 ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {it.days_overdue > 0 ? `${it.days_overdue} dni po terminie` : it.days_overdue === 0 ? "termin dziś" : `termin za ${-it.days_overdue} dni`} ({it.due_date})
                  </p>
                </div>
                <button onClick={() => copyLink(it)} className="p-2 hover:bg-white rounded-lg shrink-0" title="Kopiuj link do ankiety" data-testid={`survey-due-copy-${it.assignment_id}`}>
                  <Link2 className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyRemindersCard;
