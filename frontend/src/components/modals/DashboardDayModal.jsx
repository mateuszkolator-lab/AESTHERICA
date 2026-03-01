import { useState, useEffect } from "react";
import { X, MapPin, User, Phone, Calendar, ChevronRight, Edit2 } from "lucide-react";
import { toast } from "sonner";
import api from "../../utils/api";
import { STATUS_LABELS, getStatusColorBg } from "../../utils/constants";

const DashboardDayModal = ({ day, surgeries, slot, locations, onClose, onRefresh, navigate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    is_full: slot?.is_full || false,
    location_id: slot?.location_id || "",
    notes: slot?.notes || ""
  });
  const [saving, setSaving] = useState(false);

  const handleSaveSlot = async () => {
    if (!slot) return;
    setSaving(true);
    try {
      await api.put(`/surgery-slots/${slot.id}`, editData);
      toast.success("Termin zaktualizowany");
      setIsEditing(false);
      onRefresh();
    } catch (err) {
      toast.error("Nie udało się zaktualizować terminu");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (!slot || !window.confirm("Czy na pewno chcesz usunąć ten termin?")) return;
    try {
      await api.delete(`/surgery-slots/${slot.id}`);
      toast.success("Termin usunięty");
      onClose();
      onRefresh();
    } catch (err) {
      toast.error("Nie udało się usunąć terminu");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {day.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {slot?.is_full && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">Pełny</span>
              )}
              {slot?.location_name && (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {slot.location_name}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          {surgeries.length > 0 ? (
            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Umówieni pacjenci ({surgeries.length})
              </h3>
              {surgeries.map((patient) => (
                <div 
                  key={patient.id}
                  className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                  onClick={() => navigate(`/patients/${patient.id}`)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${getStatusColorBg(patient.status)}`}>
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{patient.first_name} {patient.last_name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        {patient.procedure_type || "Zabieg nieokreślony"}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        patient.status === 'planned' ? 'bg-blue-100 text-blue-800' :
                        patient.status === 'operated' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {STATUS_LABELS[patient.status] || patient.status}
                      </span>
                    </div>
                    {patient.phone && (
                      <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {patient.phone}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                </div>
              ))}
            </div>
          ) : slot ? (
            <div className="text-center py-6 mb-6 bg-slate-50 rounded-lg">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500">Brak umówionych pacjentów</p>
              <p className="text-sm text-slate-400">Ten termin jest dostępny</p>
            </div>
          ) : null}

          {slot && (
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                  Ustawienia terminu
                </h3>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edytuj
                  </button>
                )}
              </div>
              
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Lokalizacja</label>
                    <select
                      value={editData.location_id}
                      onChange={(e) => setEditData({ ...editData, location_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                    >
                      <option value="">Wybierz lokalizację</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notatki</label>
                    <input
                      type="text"
                      value={editData.notes}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      placeholder="np. Rano, sala 2"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="edit_is_full"
                      checked={editData.is_full}
                      onChange={(e) => setEditData({ ...editData, is_full: e.target.checked })}
                      className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                    />
                    <label htmlFor="edit_is_full" className="text-sm text-slate-700">Oznacz jako pełny (niedostępny)</label>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium"
                    >
                      Anuluj
                    </button>
                    <button
                      onClick={handleSaveSlot}
                      disabled={saving}
                      className="flex-1 px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {saving ? "Zapisywanie..." : "Zapisz"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lokalizacja:</span>
                    <span className="text-slate-700">{slot.location_name || "Nie określono"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Notatki:</span>
                    <span className="text-slate-700">{slot.notes || "Brak"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className={slot.is_full ? "text-red-600 font-medium" : "text-emerald-600 font-medium"}>
                      {slot.is_full ? "Pełny" : "Dostępny"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
          {slot && (
            <button
              onClick={handleDeleteSlot}
              className="px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-lg font-medium text-sm"
            >
              Usuń termin
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium text-sm"
          >
            Zamknij
          </button>
          <button
            onClick={() => navigate('/calendar')}
            className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-medium text-sm"
          >
            Pełny kalendarz
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardDayModal;
