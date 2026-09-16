import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { ClipboardList, CheckCircle2, Circle, Link2, QrCode, Tablet, Eye, RotateCcw, X, Copy } from "lucide-react";
import api from "../../utils/api";
import SurveyResultModal from "./SurveyResultModal";

const surveyUrl = (token, tablet = false) => `${window.location.origin}/ankieta/${token}${tablet ? "?mode=tablet" : ""}`;

const QRModal = ({ assignment, onClose }) => {
  const url = surveyUrl(assignment.token);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success("Link skopiowany – wklej w WhatsApp lub e-mail"); }
    catch { toast.error("Nie udało się skopiować"); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" data-testid="survey-qr-modal">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-6 text-center">
        <div className="flex justify-between items-start mb-2">
          <div className="text-left">
            <p className="text-xs uppercase text-slate-400">{assignment.timepoint_label}</p>
            <h3 className="font-semibold text-slate-900">{assignment.template_code || assignment.template_name}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="survey-qr-close"><X className="w-5 h-5" /></button>
        </div>
        <div className="bg-white p-3 inline-block rounded-xl border border-slate-200 my-3">
          <QRCodeSVG value={url} size={220} level="M" />
        </div>
        <p className="text-xs text-slate-500 break-all mb-4" data-testid="survey-link-text">{url}</p>
        <div className="flex gap-2">
          <button onClick={copy} className="flex-1 flex items-center justify-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-3 py-2.5 rounded-lg text-sm font-medium" data-testid="survey-copy-link"><Copy className="w-4 h-4" /> Kopiuj link</button>
          <a href={surveyUrl(assignment.token, true)} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700"><Tablet className="w-4 h-4" /> Otwórz na tablecie</a>
        </div>
      </div>
    </div>
  );
};

export const PatientSurveysCard = ({ patientId }) => {
  const [assignments, setAssignments] = useState([]);
  const [qrFor, setQrFor] = useState(null);
  const [viewId, setViewId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/surveys/patients/${patientId}`);
      setAssignments(res.data);
    } catch (err) { /* non-critical */ }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const copyLink = async (a) => {
    try { await navigator.clipboard.writeText(surveyUrl(a.token)); toast.success("Link skopiowany"); }
    catch { toast.error("Nie udało się skopiować"); }
  };

  const reset = async (a) => {
    if (!window.confirm("Umożliwić ponowne wypełnienie? Poprzednie odpowiedzi zostaną zachowane w historii.")) return;
    try { await api.post(`/surveys/assignments/${a.id}/reset`); toast.success("Ankieta gotowa do ponownego wypełnienia"); load(); }
    catch { toast.error("Nie udało się zresetować"); }
  };

  if (assignments.length === 0) return null;

  const groups = {};
  assignments.forEach(a => { (groups[a.template_id] = groups[a.template_id] || { name: a.template_name, code: a.template_code, items: [] }).items.push(a); });
  const done = assignments.filter(a => a.status === "completed").length;

  return (
    <div className="border-t border-slate-100 mt-6 pt-6" data-testid="patient-surveys-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-500 uppercase flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Ankiety</h3>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${done === assignments.length ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`} data-testid="surveys-progress">{done}/{assignments.length}</span>
      </div>
      <div className="space-y-3">
        {Object.entries(groups).map(([tid, g]) => (
          <div key={tid} className="bg-slate-50 rounded-lg p-3">
            <p className="text-sm font-semibold text-slate-800 mb-2">{g.code ? <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 text-[11px] font-bold mr-2">{g.code}</span> : null}{g.name}</p>
            <div className="space-y-1.5">
              {g.items.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-sm" data-testid={`survey-assignment-${a.id}`}>
                  {a.status === "completed" ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <Circle className="w-4 h-4 text-slate-300 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`truncate ${a.status === "completed" ? "text-slate-700" : "text-slate-500"}`}>{a.timepoint_label}</p>
                    {a.status === "completed" && (
                      <p className="text-[11px] text-slate-400">{(a.completed_at || "").slice(0, 10)} · wynik <strong className="text-teal-700">{a.score?.total?.value ?? "-"}</strong>{a.score?.total?.max ? `/${a.score.total.max}` : ""}</p>
                    )}
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    {a.status === "completed" ? (
                      <>
                        <button onClick={() => setViewId(a.id)} className="p-1.5 hover:bg-white rounded" title="Podgląd odpowiedzi" data-testid={`survey-view-${a.id}`}><Eye className="w-4 h-4 text-slate-600" /></button>
                        <button onClick={() => reset(a)} className="p-1.5 hover:bg-white rounded" title="Wypełnij ponownie" data-testid={`survey-reset-${a.id}`}><RotateCcw className="w-4 h-4 text-slate-400" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => copyLink(a)} className="p-1.5 hover:bg-white rounded" title="Kopiuj link (WhatsApp / e-mail)" data-testid={`survey-copy-${a.id}`}><Link2 className="w-4 h-4 text-slate-600" /></button>
                        <button onClick={() => setQrFor(a)} className="p-1.5 hover:bg-white rounded" title="Kod QR" data-testid={`survey-qr-${a.id}`}><QrCode className="w-4 h-4 text-slate-600" /></button>
                        <a href={surveyUrl(a.token, true)} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-white rounded" title="Otwórz na tablecie" data-testid={`survey-tablet-${a.id}`}><Tablet className="w-4 h-4 text-teal-600" /></a>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {qrFor && <QRModal assignment={qrFor} onClose={() => setQrFor(null)} />}
      {viewId && <SurveyResultModal assignmentId={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
};

export default PatientSurveysCard;
