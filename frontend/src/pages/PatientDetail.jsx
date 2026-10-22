import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  ChevronLeft, User, Mail, Phone, MapPin, DollarSign, 
  Edit, Plus, ArrowLeftRight, Camera, Sparkles, PenTool, CheckCircle2, CalendarSync, ChevronDown, RotateCcw
} from "lucide-react";
import api from "../utils/api";
import { STATUS_LABELS, getStatusColor, getStatusColorBg, STATUS_OPTIONS } from "../utils/constants";
import AddPatientModal from "../components/modals/AddPatientModal";
import { AddVisitModal, VisitCard } from "../components/patients/VisitComponents";
import PhotoCompareModal from "../components/modals/PhotoCompareModal";
import PatientAuditLog from "../components/PatientAuditLog";
import CancelReasonModal from "../components/modals/CancelReasonModal";
import PatientSurveysCard from "../components/surveys/PatientSurveysCard";

const PatientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddVisit, setShowAddVisit] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const handleStatusChange = async (newStatus) => {
    setShowStatusMenu(false);
    if (newStatus === patient.status) return;
    if (newStatus === "cancelled") {
      setShowCancelModal(true);
      return;
    }
    try {
      await api.put(`/patients/${id}`, { status: newStatus });
      toast.success(`Status zmieniony na: ${STATUS_LABELS[newStatus]}`);
      loadPatient();
    } catch (err) {
      toast.error("Nie udało się zmienić statusu");
    }
  };

  const handleCancelConfirm = async (reason) => {
    setShowCancelModal(false);
    try {
      await api.put(`/patients/${id}`, { status: "cancelled", cancellation_reason: reason });
      toast.success("Pacjent oznaczony jako rezygnacja");
      loadPatient();
    } catch (err) {
      toast.error("Nie udało się zmienić statusu");
    }
  };

  const handleRestore = async () => {
    try {
      await api.post(`/patients/${id}/restore`);
      toast.success("Pacjent przywrócony do oczekujących");
      loadPatient();
    } catch (err) {
      toast.error("Nie udało się przywrócić pacjenta");
    }
  };

  const loadPatient = useCallback(async () => {
    try {
      const res = await api.get(`/patients/${id}`);
      setPatient(res.data);
    } catch (err) {
      toast.error("Nie udało się załadować pacjenta");
      navigate("/patients");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const loadLocations = useCallback(async () => {
    try {
      const res = await api.get("/locations");
      setLocations(res.data);
    } catch (err) {
      // Location loading is non-critical
    }
  }, []);

  useEffect(() => {
    loadPatient();
    loadLocations();
  }, [loadPatient, loadLocations]);

  const getLocationName = (locationId) => {
    const loc = locations.find((l) => l.id === locationId);
    return loc ? loc.name : "-";
  };

  const handleToggleConfirm = async () => {
    try {
      const res = await api.post(`/patients/${id}/confirm`);
      setPatient(prev => ({ ...prev, confirmed: res.data.confirmed }));
      toast.success(res.data.confirmed ? "Potwierdzono termin telefonicznie" : "Cofnięto potwierdzenie");
    } catch (err) {
      toast.error("Nie udało się zmienić statusu potwierdzenia");
    }
  };

  const [syncing, setSyncing] = useState(false);
  const handleSyncGoogle = async () => {
    setSyncing(true);
    try {
      const res = await api.post(`/calendar/sync/${id}`);
      setPatient(prev => ({ ...prev, google_event_id: res.data.event_id }));
      toast.success("Zsynchronizowano z Kalendarzem Google");
    } catch (err) {
      const msg = err.response?.data?.detail || "Nie udało się zsynchronizować";
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;
  if (!patient) return null;

  // Zbierz wszystkie zdjęcia z wizyt
  const allPhotos = patient.visits?.flatMap((v) => v.photos.map((p) => ({ ...p, visitDate: v.date, visitType: v.type }))) || [];
  // Dodaj zdjęcia bezpośrednio przypisane do pacjenta (nie z wizyt)
  const patientDirectPhotos = patient.photos?.map(p => ({ ...p, visitDate: null, visitType: null })) || [];
  const combinedPhotos = [...allPhotos, ...patientDirectPhotos];

  return (
    <div className="flex flex-col md:flex-row min-h-screen" data-testid="patient-detail-page">
      {/* Left Sidebar - Patient Info */}
      <div className="w-full md:w-1/3 bg-white border-r border-slate-200 p-6 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
        <button
          onClick={() => navigate("/patients")}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
          data-testid="back-button"
        >
          <ChevronLeft className="w-4 h-4" />
          Powrót do pacjentów
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center">
            <User className="w-8 h-8 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {patient.first_name} {patient.last_name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="relative">
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full transition-all hover:ring-2 hover:ring-offset-1 hover:ring-slate-300 ${getStatusColor(patient.status)}`}
                  title="Kliknij aby zmienić status"
                  data-testid="detail-status-badge"
                >
                  {STATUS_LABELS[patient.status] || patient.status}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showStatusMenu ? 'rotate-180' : ''}`} />
                </button>
                {showStatusMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)} />
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-20 py-1" data-testid="detail-status-dropdown">
                      {STATUS_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => handleStatusChange(option.value)}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                            patient.status === option.value ? "bg-slate-100 font-semibold" : "hover:bg-slate-50"
                          }`}
                          data-testid={`detail-status-option-${option.value}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${getStatusColorBg(option.value)}`} />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {patient.asap && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700" title="Jak najszybciej">
                  <Sparkles className="w-3 h-3" />
                  ASAP
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowEditModal(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium transition-colors mb-3"
          data-testid="edit-patient-button"
        >
          <Edit className="w-4 h-4" />
          Edytuj pacjenta
        </button>

        <button
          onClick={() => navigate(`/rhinoplanner/${patient.id}`)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors mb-6"
          data-testid="rhinoplanner-button"
        >
          <PenTool className="w-4 h-4" />
          RhinoPlanner
        </button>

        <div className="space-y-4">
          {patient.email && (
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-slate-400" />
              <span className="text-slate-600">{patient.email}</span>
            </div>
          )}
          {patient.phone && (
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-slate-400" />
              <span className="text-slate-600">{patient.phone}</span>
            </div>
          )}
          {patient.location_id && (
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-slate-400" />
              <span className="text-slate-600">{getLocationName(patient.location_id)}</span>
            </div>
          )}
          {patient.price && (
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-slate-400" />
              <span className="text-slate-600">{patient.price.toLocaleString('pl-PL')} PLN</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 mt-6 pt-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Szczegóły zabiegu</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Rodzaj zabiegu</p>
              <p className="font-medium text-slate-900">{patient.procedure_type || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Data operacji</p>
              <p className="font-medium text-slate-900">{patient.surgery_date || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Dokumenty wysłane do pacjenta</p>
              <p className={`font-medium ${patient.documents_sent_date ? "text-slate-900" : "text-amber-600"}`} data-testid="documents-sent-date">{patient.documents_sent_date || "nie wysłano"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Zgłoszenie do szpitala</p>
              <p className={`font-medium ${patient.hospital_registration_date ? "text-slate-900" : "text-amber-600"}`} data-testid="hospital-registration-date">{patient.hospital_registration_date || "nie zgłoszono"}</p>
            </div>
            {patient.status === "cancelled" && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg" data-testid="cancellation-info">
                {patient.cancelled_surgery_date && (
                  <>
                    <p className="text-sm text-red-500">Anulowany termin</p>
                    <p className="font-medium text-red-700 line-through" data-testid="cancelled-surgery-date">{patient.cancelled_surgery_date}</p>
                  </>
                )}
                <p className="text-sm text-red-500 mt-1">Powód rezygnacji</p>
                <p className="font-medium text-red-800" data-testid="cancellation-reason">{patient.cancellation_reason || "Nie podano"}</p>
                <button
                  onClick={handleRestore}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-red-200 text-red-700 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
                  data-testid="restore-patient-button"
                >
                  <RotateCcw className="w-4 h-4" />
                  Przywróć do oczekujących
                </button>
              </div>
            )}
            {patient.cancellation_history?.length > 0 && patient.status !== "cancelled" && (
              <div className="text-xs text-slate-500" data-testid="cancellation-history">
                <p className="font-medium text-slate-600 mb-1">Historia rezygnacji</p>
                {patient.cancellation_history.map((h, i) => (
                  <p key={i}>
                    {h.cancelled_at ? new Date(h.cancelled_at).toLocaleDateString("pl-PL") : "?"} – {h.reason || "bez powodu"}
                    {h.cancelled_surgery_date && ` (termin ${h.cancelled_surgery_date})`}
                  </p>
                ))}
              </div>
            )}
            {patient.status === "planned" && patient.surgery_date && (
              <button
                onClick={handleToggleConfirm}
                className={`w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  patient.confirmed
                    ? "bg-teal-100 text-teal-800 border border-teal-300 hover:bg-teal-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                }`}
                data-testid="confirm-appointment-button"
              >
                <CheckCircle2 className={`w-5 h-5 ${patient.confirmed ? 'text-teal-600' : 'text-slate-400'}`} />
                {patient.confirmed ? "Termin potwierdzony" : "Potwierdź termin telefonicznie"}
              </button>
            )}
            {patient.surgery_date && patient.location_id && (
              <button
                onClick={handleSyncGoogle}
                disabled={syncing}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  patient.google_event_id
                    ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                    : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                } disabled:opacity-50`}
                data-testid="sync-google-calendar-button"
              >
                <CalendarSync className={`w-5 h-5 ${patient.google_event_id ? 'text-blue-500' : 'text-slate-400'}`} />
                {syncing ? "Synchronizacja..." : patient.google_event_id ? "Zaktualizuj w Google Calendar" : "Dodaj do Google Calendar"}
              </button>
            )}
            <div>
              <p className="text-sm text-slate-500">Preferowane zakresy dat</p>
              {(() => {
                const ranges = patient.preferred_dates?.length 
                  ? patient.preferred_dates 
                  : (patient.preferred_date_start || patient.preferred_date_end) 
                    ? [{ start: patient.preferred_date_start, end: patient.preferred_date_end }] 
                    : [];
                return ranges.length > 0 ? (
                  <div className="space-y-0.5">
                    {ranges.map((r, i) => (
                      <p key={i} className="font-medium text-slate-900">
                        {r.start || "?"} do {r.end || "?"}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="font-medium text-slate-900">-</p>
                );
              })()}
            </div>
          </div>
        </div>

        {patient.notes && (
          <div className="border-t border-slate-100 mt-6 pt-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Notatki</h3>
            <p className="text-slate-600 whitespace-pre-wrap">{patient.notes}</p>
          </div>
        )}

        {/* Ankiety PROMs */}
        <PatientSurveysCard patientId={patient.id} />

        {/* Quick Photo Summary */}
        {combinedPhotos.length > 0 && (
          <div className="border-t border-slate-100 mt-6 pt-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Podsumowanie zdjęć</h3>
            <div className="p-3 bg-teal-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-teal-700">{combinedPhotos.length}</p>
              <p className="text-xs text-teal-600">Łącznie zdjęć</p>
            </div>
            {combinedPhotos.length >= 2 && (
              <button
                onClick={() => setShowCompare(true)}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-medium transition-colors"
                data-testid="quick-compare-button"
              >
                <ArrowLeftRight className="w-4 h-4" />
                Porównaj zdjęcia
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right Panel - Visits & Photos */}
      <div className="flex-1 bg-slate-50 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Wizyty i zdjęcia</h2>
          <div className="flex gap-3">
            {combinedPhotos.length >= 2 && (
              <button
                onClick={() => setShowCompare(true)}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-white font-medium transition-colors"
                data-testid="compare-photos-button"
              >
                <ArrowLeftRight className="w-4 h-4" />
                Porównaj
              </button>
            )}
            <button
              onClick={() => setShowAddVisit(true)}
              className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              data-testid="add-visit-button"
            >
              <Plus className="w-4 h-4" />
              Dodaj wizytę
            </button>
          </div>
        </div>

        {patient.visits?.length > 0 ? (
          <div className="space-y-6">
            {patient.visits.sort((a, b) => new Date(b.date) - new Date(a.date)).map((visit) => (
              <VisitCard 
                key={visit.id} 
                visit={visit} 
                patientId={patient.id}
                onUpdate={loadPatient}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Camera className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Brak zarejestrowanych wizyt</p>
            <button
              onClick={() => setShowAddVisit(true)}
              className="mt-4 text-teal-600 hover:text-teal-700 font-medium"
            >
              Dodaj pierwszą wizytę
            </button>
          </div>
        )}
      </div>

      {/* Historia zmian */}
      <div className="mt-8 max-lg:px-4 max-lg:pb-6">
        <PatientAuditLog patientId={id} refreshKey={patient.updated_at} />
      </div>

      {showEditModal && (
        <AddPatientModal 
          initialData={patient}
          onClose={() => setShowEditModal(false)} 
          onSuccess={() => { setShowEditModal(false); loadPatient(); }} 
        />
      )}

      {showCancelModal && (
        <CancelReasonModal
          patientName={`${patient.last_name} ${patient.first_name}`}
          onConfirm={handleCancelConfirm}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {showAddVisit && (
        <AddVisitModal
          patientId={patient.id}
          onClose={() => setShowAddVisit(false)}
          onSuccess={() => { setShowAddVisit(false); loadPatient(); }}
        />
      )}

      {showCompare && (
        <PhotoCompareModal
          photos={combinedPhotos}
          visits={patient.visits || []}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
};

export default PatientDetail;
