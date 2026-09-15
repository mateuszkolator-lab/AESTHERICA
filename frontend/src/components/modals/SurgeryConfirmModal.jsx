import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Stethoscope, Check, X, MapPin, Clock, CalendarX } from "lucide-react";
import api from "../../utils/api";
import { formatDateLocal } from "../../utils/constants";

const dismissKey = () => `surgery_confirm_dismissed_${formatDateLocal(new Date())}`;

const SurgeryConfirmModal = () => {
  const navigate = useNavigate();
  const [pending, setPending] = useState([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (sessionStorage.getItem(dismissKey())) return;
    try {
      const res = await api.get("/patients/pending-surgery-confirmations");
      if (res.data.length > 0) {
        sessionStorage.setItem(dismissKey(), "1");
        setPending(res.data);
        setOpen(true);
      }
    } catch (err) {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleOutcome = async (patient, performed) => {
    setBusyId(patient.id);
    try {
      await api.post(`/patients/${patient.id}/surgery-outcome`, { performed });
      toast.success(
        performed
          ? `${patient.last_name} ${patient.first_name}: status Zoperowany`
          : `${patient.last_name} ${patient.first_name}: termin usunięty, pacjent oczekuje`
      );
      const rest = pending.filter(p => p.id !== patient.id);
      setPending(rest);
      if (rest.length === 0) setOpen(false);
    } catch (err) {
      toast.error("Nie udało się zapisać wyniku zabiegu");
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = () => {
    sessionStorage.setItem(dismissKey(), "1");
    setOpen(false);
  };

  if (!open) return null;

  const todayStr = formatDateLocal(new Date());

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" data-testid="surgery-confirm-modal">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Czy zabiegi się odbyły?
              </h2>
              <p className="text-sm text-slate-500">Potwierdź wynik zaplanowanych operacji ({pending.length})</p>
            </div>
          </div>
          <button onClick={dismiss} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="surgery-confirm-dismiss">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-4 space-y-2 overflow-y-auto">
          {pending.map((p) => {
            const isPast = p.surgery_date < todayStr;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-xl border ${isPast ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}
                data-testid={`surgery-confirm-row-${p.id}`}
              >
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => { dismiss(); navigate(`/patients/${p.id}`); }}
                    className="font-medium text-slate-900 hover:text-teal-700 truncate text-left"
                  >
                    {p.last_name} {p.first_name}
                  </button>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                    <span>{p.procedure_type || "Zabieg"}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {p.surgery_date}{isPast && <span className="text-amber-700 font-medium"> (zaległy)</span>}
                    </span>
                    {p.location_name && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.location_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOutcome(p, true)}
                    disabled={busyId === p.id}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                    data-testid={`surgery-performed-${p.id}`}
                  >
                    <Check className="w-4 h-4" />
                    Odbył się
                  </button>
                  <button
                    onClick={() => handleOutcome(p, false)}
                    disabled={busyId === p.id}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-700 text-slate-600 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                    data-testid={`surgery-not-performed-${p.id}`}
                  >
                    <CalendarX className="w-4 h-4" />
                    Nie odbył się
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
          <span>„Nie odbył się” usuwa termin i przenosi pacjenta do oczekujących.</span>
          <button onClick={dismiss} className="text-teal-600 hover:text-teal-700 font-medium" data-testid="surgery-confirm-later">
            Przypomnij później
          </button>
        </div>
      </div>
    </div>
  );
};

export default SurgeryConfirmModal;
