import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Calendar, CalendarPlus, Plus, Edit, Trash2, MapPin, 
  User, Phone, Sparkles, UserCheck, CheckCircle2, AlertCircle 
} from "lucide-react";
import api from "../utils/api";
import AddSlotModal from "../components/modals/AddSlotModal";

const PlanningPage = () => {
  const [slots, setSlots] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [editSlot, setEditSlot] = useState(null);
  const [activeTab, setActiveTab] = useState("slots");
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [slotsRes, locRes] = await Promise.all([
        api.get("/surgery-slots"),
        api.get("/locations")
      ]);
      setSlots(slotsRes.data);
      setLocations(locRes.data);
    } catch (err) {
      toast.error("Nie udało się załadować danych");
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const res = await api.get("/surgery-slots/suggestions");
      setSuggestions(res.data);
    } catch (err) {
      toast.error("Nie udało się załadować sugestii");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSlot = async (id) => {
    if (!window.confirm("Usunąć ten termin operacji?")) return;
    try {
      await api.delete(`/surgery-slots/${id}`);
      toast.success("Termin usunięty");
      loadData();
    } catch (err) {
      toast.error("Nie udało się usunąć terminu");
    }
  };

  const handleToggleFull = async (id) => {
    try {
      await api.post(`/surgery-slots/${id}/toggle-full`);
      toast.success("Status terminu zmieniony");
      loadData();
    } catch (err) {
      toast.error("Nie udało się zmienić statusu");
    }
  };

  const handleAssignPatient = async (slotId, patientId) => {
    try {
      await api.post(`/surgery-slots/${slotId}/assign/${patientId}`);
      toast.success("Pacjent przypisany do terminu operacji");
      loadSuggestions();
      loadData();
    } catch (err) {
      toast.error("Nie udało się przypisać pacjenta");
    }
  };

  const getLocationName = (locationId) => {
    const loc = locations.find((l) => l.id === locationId);
    return loc ? loc.name : "-";
  };

  useEffect(() => {
    if (activeTab === "suggestions") {
      loadSuggestions();
    }
  }, [activeTab]);

  if (loading && activeTab === "slots") return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;

  return (
    <div className="p-8" data-testid="planning-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Planowanie operacji</h1>
          <p className="text-slate-500 mt-1">Zarządzaj terminami i przypisuj pacjentów</p>
        </div>
        <button
          onClick={() => setShowAddSlot(true)}
          className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
          data-testid="add-slot-button"
        >
          <Plus className="w-5 h-5" />
          Dodaj termin
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("slots")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "slots" 
              ? "bg-teal-700 text-white" 
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
          data-testid="tab-slots"
        >
          <CalendarPlus className="w-4 h-4 inline mr-2" />
          Terminy operacji
        </button>
        <button
          onClick={() => setActiveTab("suggestions")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "suggestions" 
              ? "bg-teal-700 text-white" 
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
          data-testid="tab-suggestions"
        >
          <Sparkles className="w-4 h-4 inline mr-2" />
          Automatyczne dopasowanie
        </button>
      </div>

      {activeTab === "slots" && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900">Dostępne terminy operacji</h2>
          </div>
          <div className="p-6">
            {slots.length > 0 ? (
              <div className="space-y-3">
                {slots.map((slot) => (
                  <div 
                    key={slot.id} 
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      slot.is_full 
                        ? "bg-red-50 border-red-200" 
                        : slot.assigned_patient_id 
                          ? "bg-emerald-50 border-emerald-200" 
                          : "bg-slate-50 border-slate-200"
                    }`}
                    data-testid={`slot-${slot.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        slot.is_full 
                          ? "bg-red-100" 
                          : slot.assigned_patient_id 
                            ? "bg-emerald-100" 
                            : "bg-teal-100"
                      }`}>
                        <Calendar className={`w-6 h-6 ${
                          slot.is_full 
                            ? "text-red-600" 
                            : slot.assigned_patient_id 
                              ? "text-emerald-600" 
                              : "text-teal-600"
                        }`} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-lg">{slot.date}</p>
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          {slot.location_id && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {getLocationName(slot.location_id)}
                            </span>
                          )}
                          {slot.notes && <span>{slot.notes}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {slot.is_full ? (
                        <span className="px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-sm font-medium">Pełny</span>
                      ) : slot.assigned_patient_id ? (
                        <span className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
                          <UserCheck className="w-4 h-4" />
                          Przypisany
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">Wolny</span>
                      )}
                      <button
                        onClick={() => handleToggleFull(slot.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          slot.is_full 
                            ? "bg-slate-100 text-slate-700 hover:bg-slate-200" 
                            : "bg-red-100 text-red-700 hover:bg-red-200"
                        }`}
                        data-testid={`toggle-full-${slot.id}`}
                      >
                        {slot.is_full ? "Odblokuj" : "Oznacz pełny"}
                      </button>
                      <button
                        onClick={() => setEditSlot(slot)}
                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                        data-testid={`edit-slot-${slot.id}`}
                      >
                        <Edit className="w-4 h-4 text-slate-600" />
                      </button>
                      <button
                        onClick={() => handleDeleteSlot(slot.id)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                        data-testid={`delete-slot-${slot.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CalendarPlus className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Brak dodanych terminów operacji</p>
                <button
                  onClick={() => setShowAddSlot(true)}
                  className="mt-4 text-teal-600 hover:text-teal-700 font-medium"
                >
                  Dodaj pierwszy termin
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "suggestions" && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>
          ) : suggestions.length > 0 ? (
            suggestions.map((item) => (
              <div key={item.slot.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-teal-50 to-white border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-teal-100 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-lg">{item.slot.date}</p>
                      <p className="text-sm text-slate-500">
                        {item.slot.location_name || "Lokalizacja nie wybrana"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Pasujących pacjentów</p>
                    <p className="text-2xl font-semibold text-teal-700">{item.suggested_patients.length}</p>
                  </div>
                </div>
                
                <div className="p-6">
                  {item.suggested_patients.length > 0 ? (
                    <div className="space-y-3">
                      {item.suggested_patients.map((patient) => (
                        <div 
                          key={patient.id}
                          className={`flex items-center justify-between p-4 rounded-lg hover:bg-slate-100 transition-colors ${
                            patient.location_match && patient.date_match 
                              ? "bg-emerald-50 border border-emerald-200" 
                              : patient.location_match 
                                ? "bg-blue-50 border border-blue-200"
                                : "bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              patient.location_match ? "bg-emerald-100" : "bg-teal-100"
                            }`}>
                              <User className={`w-5 h-5 ${patient.location_match ? "text-emerald-600" : "text-teal-600"}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-slate-900">{patient.first_name} {patient.last_name}</p>
                                {patient.asap && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">
                                    <Sparkles className="w-3 h-3" />
                                    ASAP
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-slate-500 flex-wrap mt-1">
                                <span>{patient.procedure_type || "Zabieg nieokreślony"}</span>
                                {patient.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {patient.phone}
                                  </span>
                                )}
                                {patient.location_name && (
                                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                    <MapPin className="w-3 h-3" />
                                    {patient.location_name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {patient.location_match && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-emerald-100 text-emerald-700">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Lokalizacja
                                  </span>
                                )}
                                {patient.date_match && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                                    <Calendar className="w-3 h-3" />
                                    Data
                                  </span>
                                )}
                                <span className="text-xs text-slate-400">
                                  Dopasowanie: {patient.match_score}%
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs text-slate-500">Preferowany zakres</p>
                              <p className="text-sm font-medium text-slate-700">
                                {patient.preferred_date_start || "?"} - {patient.preferred_date_end || "?"}
                              </p>
                            </div>
                            <button
                              onClick={() => handleAssignPatient(item.slot.id, patient.id)}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                                patient.location_match 
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                                  : "bg-teal-700 hover:bg-teal-800 text-white"
                              }`}
                              data-testid={`assign-${item.slot.id}-${patient.id}`}
                            >
                              <UserCheck className="w-4 h-4" />
                              Przypisz
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-500">Brak pasujących pacjentów dla tego terminu</p>
                      <p className="text-sm text-slate-400 mt-1">
                        Sprawdź czy pacjenci mają ustawione preferowane daty i lokalizacje
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Brak wolnych terminów do dopasowania</p>
              <p className="text-sm text-slate-400 mt-1">
                Dodaj terminy operacji, aby zobaczyć sugestie pacjentów
              </p>
            </div>
          )}
        </div>
      )}

      {(showAddSlot || editSlot) && (
        <AddSlotModal
          locations={locations}
          slot={editSlot}
          onClose={() => { setShowAddSlot(false); setEditSlot(null); }}
          onSuccess={() => { setShowAddSlot(false); setEditSlot(null); loadData(); }}
        />
      )}
    </div>
  );
};

export default PlanningPage;
