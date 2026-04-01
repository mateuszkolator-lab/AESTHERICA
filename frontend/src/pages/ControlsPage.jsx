import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  ClipboardCheck, User, Phone, Calendar, Check, Clock,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2, PhoneOff, PhoneMissed
} from "lucide-react";
import api from "../utils/api";

const CONTROL_COLORS = {
  "1_week": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "1_month": { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  "3_months": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  "6_months": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "1_year": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" }
};

const ControlsPage = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPatient, setExpandedPatient] = useState(null);
  const [filter, setFilter] = useState("all");
  const [noContactNote, setNoContactNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(null);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const res = await api.get("/controls/patients");
      setPatients(res.data);
    } catch (err) {
      toast.error("Nie udalo sie zaladowac listy kontroli");
    } finally {
      setLoading(false);
    }
  };

  const markControlComplete = async (patientId, controlType) => {
    try {
      await api.post(`/controls/patients/${patientId}/complete`, { control_type: controlType });
      toast.success("Kontrola oznaczona jako wykonana");
      loadPatients();
    } catch (err) {
      toast.error("Nie udalo sie oznaczyc kontroli");
    }
  };

  const unmarkControlComplete = async (patientId, controlType) => {
    try {
      await api.delete(`/controls/patients/${patientId}/complete/${controlType}`);
      toast.success("Cofnieto oznaczenie kontroli");
      loadPatients();
    } catch (err) {
      toast.error("Nie udalo sie cofnac oznaczenia");
    }
  };

  const toggleNoContact = async (patientId, currentStatus) => {
    if (!currentStatus) {
      // Show note input before marking
      setShowNoteInput(patientId);
      setNoContactNote("");
      return;
    }
    // Remove no-contact
    try {
      await api.post(`/controls/patients/${patientId}/no-contact`, { no_contact: false });
      toast.success("Przywrócono kontakt z pacjentem");
      loadPatients();
    } catch (err) {
      toast.error("Nie udalo sie zaktualizowac statusu");
    }
  };

  const confirmNoContact = async (patientId) => {
    try {
      await api.post(`/controls/patients/${patientId}/no-contact`, {
        no_contact: true,
        no_contact_note: noContactNote || null
      });
      toast.success("Oznaczono brak kontaktu z pacjentem");
      setShowNoteInput(null);
      setNoContactNote("");
      loadPatients();
    } catch (err) {
      toast.error("Nie udalo sie zaktualizowac statusu");
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return date.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const getDaysUntil = (dateString) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateString);
    date.setHours(0, 0, 0, 0);
    return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
  };

  const getStatusBadge = (control) => {
    if (control.completed) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle2 className="w-3 h-3" />
          Wykonana
        </span>
      );
    }
    const daysUntil = getDaysUntil(control.due_date);
    if (daysUntil < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <AlertCircle className="w-3 h-3" />
          Zalegla ({Math.abs(daysUntil)} dni)
        </span>
      );
    } else if (daysUntil <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
          <Clock className="w-3 h-3" />
          Za {daysUntil} dni
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
        <Calendar className="w-3 h-3" />
        {formatDate(control.due_date)}
      </span>
    );
  };

  const filteredPatients = patients.filter(p => {
    if (filter === "all") return true;
    if (filter === "pending") return p.next_control !== null && !p.no_contact;
    if (filter === "overdue") return p.next_control && getDaysUntil(p.next_control.due_date) < 0;
    if (filter === "no_contact") return p.no_contact;
    return true;
  });

  const overdueCount = patients.filter(p => p.next_control && getDaysUntil(p.next_control.due_date) < 0).length;
  const upcomingCount = patients.filter(p => p.next_control && getDaysUntil(p.next_control.due_date) >= 0 && getDaysUntil(p.next_control.due_date) <= 7).length;
  const noContactCount = patients.filter(p => p.no_contact).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-700" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8" data-testid="controls-page">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Kontrole pooperacyjne
        </h1>
        <p className="text-slate-500 mt-1">Zarządzaj wizytami kontrolnymi pacjentów</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{patients.length}</p>
              <p className="text-sm text-slate-500">Pacjentów po operacji</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-red-600">{overdueCount}</p>
              <p className="text-sm text-slate-500">Zaległych kontroli</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-amber-600">{upcomingCount}</p>
              <p className="text-sm text-slate-500">W tym tygodniu</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-300 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center">
              <PhoneOff className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-700">{noContactCount}</p>
              <p className="text-sm text-slate-500">Brak kontaktu</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "all" ? "bg-teal-700 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
          data-testid="filter-all"
        >
          Wszyscy ({patients.length})
        </button>
        <button
          onClick={() => setFilter("overdue")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "overdue" ? "bg-red-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
          data-testid="filter-overdue"
        >
          Zaległe ({overdueCount})
        </button>
        <button
          onClick={() => setFilter("pending")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "pending" ? "bg-teal-700 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
          data-testid="filter-pending"
        >
          Do wykonania
        </button>
        <button
          onClick={() => setFilter("no_contact")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
            filter === "no_contact" ? "bg-slate-700 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
          data-testid="filter-no-contact"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          Brak kontaktu ({noContactCount})
        </button>
      </div>

      {/* Patients List */}
      <div className="space-y-4">
        {filteredPatients.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">Brak pacjentów do wyświetlenia</p>
          </div>
        ) : (
          filteredPatients.map((patient) => (
            <div 
              key={patient.id} 
              className={`bg-white rounded-xl border overflow-hidden ${patient.no_contact ? 'border-slate-400 bg-slate-50' : 'border-slate-200'}`}
            >
              {/* Patient Header */}
              <div 
                className={`p-4 flex items-center justify-between cursor-pointer ${patient.no_contact ? 'hover:bg-slate-100' : 'hover:bg-slate-50'}`}
                onClick={() => setExpandedPatient(expandedPatient === patient.id ? null : patient.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${patient.no_contact ? 'bg-slate-300' : 'bg-teal-100'}`}>
                    {patient.no_contact ? (
                      <PhoneOff className="w-6 h-6 text-slate-600" />
                    ) : (
                      <User className="w-6 h-6 text-teal-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 
                        className={`font-semibold hover:text-teal-700 cursor-pointer ${patient.no_contact ? 'text-slate-500' : 'text-slate-900'}`}
                        onClick={(e) => { e.stopPropagation(); navigate(`/patients/${patient.id}`); }}
                      >
                        {patient.first_name} {patient.last_name}
                      </h3>
                      <span className="text-sm text-slate-500">{patient.procedure_type}</span>
                      {patient.no_contact && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-white" data-testid={`no-contact-badge-${patient.id}`}>
                          <PhoneMissed className="w-3 h-3" />
                          Brak kontaktu
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Operacja: {formatDate(patient.surgery_date)}
                      </span>
                      {patient.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {patient.phone}
                        </span>
                      )}
                    </div>
                    {patient.no_contact && patient.no_contact_note && (
                      <p className="text-xs text-slate-400 mt-1 italic">
                        Powód: {patient.no_contact_note}
                        {patient.no_contact_date && ` (${formatDate(patient.no_contact_date)})`}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* No Contact Toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleNoContact(patient.id, patient.no_contact); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      patient.no_contact
                        ? "bg-teal-100 text-teal-700 hover:bg-teal-200 border border-teal-200"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                    }`}
                    data-testid={`no-contact-toggle-${patient.id}`}
                    title={patient.no_contact ? "Przywróć kontakt" : "Oznacz brak kontaktu"}
                  >
                    {patient.no_contact ? (
                      <>
                        <Phone className="w-3.5 h-3.5" />
                        Przywróć kontakt
                      </>
                    ) : (
                      <>
                        <PhoneOff className="w-3.5 h-3.5" />
                        Brak kontaktu
                      </>
                    )}
                  </button>

                  {patient.next_control && !patient.no_contact && (
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-slate-500 mb-1">Następna kontrola:</p>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${CONTROL_COLORS[patient.next_control.type]?.bg} ${CONTROL_COLORS[patient.next_control.type]?.text}`}>
                          {patient.next_control.label}
                        </span>
                        {getStatusBadge(patient.next_control)}
                      </div>
                    </div>
                  )}
                  {expandedPatient === patient.id ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>

              {/* No Contact Note Input */}
              {showNoteInput === patient.id && (
                <div className="border-t border-slate-200 p-4 bg-amber-50" onClick={(e) => e.stopPropagation()}>
                  <p className="text-sm font-medium text-slate-700 mb-2">Oznacz brak kontaktu z pacjentem</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={noContactNote}
                      onChange={(e) => setNoContactNote(e.target.value)}
                      placeholder="Powód braku kontaktu (opcjonalnie)..."
                      className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      data-testid={`no-contact-note-input-${patient.id}`}
                    />
                    <button
                      onClick={() => confirmNoContact(patient.id)}
                      className="px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                      data-testid={`no-contact-confirm-${patient.id}`}
                    >
                      Potwierdź
                    </button>
                    <button
                      onClick={() => { setShowNoteInput(null); setNoContactNote(""); }}
                      className="px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Anuluj
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded Controls */}
              {expandedPatient === patient.id && (
                <div className="border-t border-slate-100 p-4 bg-slate-50">
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Harmonogram kontroli</h4>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {patient.controls.map((control) => {
                      const colors = CONTROL_COLORS[control.type] || { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" };
                      const isOverdue = !control.completed && getDaysUntil(control.due_date) < 0;
                      
                      return (
                        <div 
                          key={control.type}
                          className={`rounded-lg border p-3 ${
                            control.completed 
                              ? "bg-green-50 border-green-200" 
                              : isOverdue 
                                ? "bg-red-50 border-red-200"
                                : `${colors.bg} ${colors.border}`
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${
                              control.completed ? "text-green-700" : isOverdue ? "text-red-700" : colors.text
                            }`}>
                              {control.label}
                            </span>
                            {control.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : isOverdue ? (
                              <AlertCircle className="w-4 h-4 text-red-600" />
                            ) : null}
                          </div>
                          <p className="text-xs text-slate-500 mb-2">Termin: {formatDate(control.due_date)}</p>
                          {control.completed ? (
                            <div>
                              <p className="text-xs text-green-600 mb-2">
                                Wykonana: {formatDate(control.completed_date)}
                                {control.completed_by && ` przez ${control.completed_by}`}
                              </p>
                              <button
                                onClick={() => unmarkControlComplete(patient.id, control.type)}
                                className="w-full text-xs py-1.5 px-2 border border-slate-300 text-slate-600 rounded hover:bg-white transition-colors"
                              >
                                Cofnij
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => markControlComplete(patient.id, control.type)}
                              className={`w-full text-xs py-1.5 px-2 rounded font-medium transition-colors ${
                                isOverdue ? "bg-red-600 hover:bg-red-700 text-white" : "bg-teal-600 hover:bg-teal-700 text-white"
                              }`}
                            >
                              <Check className="w-3 h-3 inline mr-1" />
                              Oznacz jako wykonaną
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ControlsPage;
