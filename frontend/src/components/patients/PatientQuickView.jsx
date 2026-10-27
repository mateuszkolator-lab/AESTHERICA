import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, User, Phone, Mail, MapPin, CalendarDays, Sparkles, FileText, Building2, ExternalLink, StickyNote, Clock } from "lucide-react";
import api from "../../utils/api";
import { STATUS_LABELS, getStatusColor, getLocationColor } from "../../utils/constants";

const Row = ({ icon: Icon, label, value, testId, warn }) => (
  <div className="flex items-start gap-3" data-testid={testId}>
    <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-sm break-words ${warn ? "text-amber-600 font-medium" : "text-slate-800"}`}>{value}</p>
    </div>
  </div>
);

const ranges = (p) => {
  if (p.preferred_dates?.length) return p.preferred_dates.filter((r) => r.start || r.end);
  if (p.preferred_date_start || p.preferred_date_end) return [{ start: p.preferred_date_start, end: p.preferred_date_end }];
  return [];
};

export const PatientQuickView = ({ patientId, locations = [], onClose }) => {
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setPatient(null);
    setError(false);
    api.get(`/patients/${patientId}`).then((r) => setPatient(r.data)).catch(() => setError(true));
  }, [patientId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loc = patient && locations.find((l) => l.id === patient.location_id);
  const lastVisit = patient?.visits?.length ? [...patient.visits].sort((a, b) => new Date(b.date) - new Date(a.date))[0] : null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} data-testid="quick-view-overlay" />
      <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200" data-testid="patient-quick-view">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Szybki podgląd</p>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="quick-view-close">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {error && <p className="p-6 text-sm text-red-600">Nie udało się wczytać pacjenta.</p>}
        {!patient && !error && (
          <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-teal-700" /></div>
        )}

        {patient && (
          <>
            <div className="px-5 py-5 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-teal-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 leading-tight" data-testid="quick-view-name">
                    {patient.last_name} {patient.first_name}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(patient.status)}`} data-testid="quick-view-status">
                      {STATUS_LABELS[patient.status] || patient.status}
                    </span>
                    {patient.asap && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">
                        <Sparkles className="w-3 h-3" /> ASAP
                      </span>
                    )}
                    {loc && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: getLocationColor(loc.name)?.hex || "#94a3b8" }}>
                        {loc.name.trim().substring(0, 3).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {patient.date_of_birth && <p className="text-xs text-slate-500 mt-1">Ur.: {patient.date_of_birth}</p>}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              <Row icon={FileText} label="Zabieg" value={patient.procedure_type || "Do ustalenia"} testId="quick-view-procedure" />
              <Row icon={CalendarDays} label="Data operacji" value={patient.surgery_date || "Brak terminu"} warn={!patient.surgery_date} testId="quick-view-surgery-date" />
              <Row
                icon={Clock}
                label="Preferowane terminy"
                value={ranges(patient).length ? ranges(patient).map((r) => `${r.start || "…"} – ${r.end || "…"}`).join(", ") : "—"}
                testId="quick-view-preferred"
              />
              {loc && <Row icon={MapPin} label="Placówka" value={loc.name.trim()} />}
              {patient.phone && <Row icon={Phone} label="Telefon" value={<a href={`tel:${patient.phone}`} className="text-teal-700 hover:underline">{patient.phone}</a>} />}
              {patient.email && <Row icon={Mail} label="E-mail" value={<a href={`mailto:${patient.email}`} className="text-teal-700 hover:underline">{patient.email}</a>} />}
              <Row icon={FileText} label="Dokumenty wysłane" value={patient.documents_sent_date || "nie wysłano"} warn={!patient.documents_sent_date} />
              <Row icon={Building2} label="Zgłoszenie do szpitala" value={patient.hospital_registration_date || "nie zgłoszono"} warn={!patient.hospital_registration_date} />
              {lastVisit && <Row icon={Clock} label="Ostatnia wizyta" value={`${lastVisit.date}${lastVisit.type ? ` · ${lastVisit.type}` : ""}`} />}
              {patient.cancellation_reason && patient.status === "cancelled" && (
                <Row icon={StickyNote} label="Powód rezygnacji" value={patient.cancellation_reason} />
              )}
              {patient.notes && (
                <div className="bg-slate-50 rounded-lg p-3" data-testid="quick-view-notes">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Notatki</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-6">{patient.notes}</p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100">
              <button
                onClick={() => navigate(`/patients/${patient.id}`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-medium"
                data-testid="quick-view-open-full"
              >
                <ExternalLink className="w-4 h-4" />
                Otwórz pełną kartę
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
};
