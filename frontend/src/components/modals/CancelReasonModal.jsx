import { useState } from "react";
import { X, UserX } from "lucide-react";
import { CANCELLATION_REASONS } from "../../utils/constants";

export const CancelReasonModal = ({ patientName, onConfirm, onClose }) => {
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");
  const finalReason = reason === "__custom" ? custom.trim() : reason;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4" data-testid="cancel-reason-modal">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <UserX className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Rezygnacja pacjenta</h2>
              {patientName && <p className="text-xs text-slate-500">{patientName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="cancel-reason-close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Data zabiegu zostanie usunięta, a pacjent zniknie z kalendarza i Google Calendar.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Powód rezygnacji</label>
            <div className="grid grid-cols-2 gap-2">
              {CANCELLATION_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`px-3 py-2 rounded-lg text-sm border text-left transition-colors ${
                    reason === r ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                  data-testid={`cancel-reason-${r}`}
                >
                  {r}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setReason("__custom")}
                className={`px-3 py-2 rounded-lg text-sm border text-left transition-colors ${
                  reason === "__custom" ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
                data-testid="cancel-reason-custom"
              >
                Inny powód…
              </button>
            </div>
            {reason === "__custom" && (
              <input
                type="text"
                autoFocus
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Wpisz powód"
                className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                data-testid="cancel-reason-custom-input"
              />
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium">
            Anuluj
          </button>
          <button
            type="button"
            onClick={() => onConfirm(finalReason || null)}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
            data-testid="cancel-reason-confirm"
          >
            {finalReason ? "Potwierdź rezygnację" : "Rezygnacja bez powodu"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelReasonModal;
