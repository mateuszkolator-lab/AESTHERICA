import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Edit, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import api from "../utils/api";
import { LocationModal, ProcedureTypeModal } from "../components/modals/SettingsModals";

const SettingsPage = () => {
  const [locations, setLocations] = useState([]);
  const [procedureTypes, setProcedureTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [editLocation, setEditLocation] = useState(null);
  const [showAddProcedure, setShowAddProcedure] = useState(false);
  const [editProcedure, setEditProcedure] = useState(null);
  const [calendarStatus, setCalendarStatus] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [locRes, ptRes, calRes] = await Promise.all([
        api.get("/locations"),
        api.get("/procedure-types"),
        api.get("/calendar/status")
      ]);
      setLocations(locRes.data);
      setProcedureTypes(ptRes.data);
      setCalendarStatus(calRes.data);
    } catch (err) {
      toast.error("Nie udało się załadować ustawień");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocation = async (id) => {
    if (!window.confirm("Usunąć tę lokalizację?")) return;
    try {
      await api.delete(`/locations/${id}`);
      toast.success("Lokalizacja usunięta");
      loadData();
    } catch (err) {
      toast.error("Nie udało się usunąć lokalizacji");
    }
  };

  const handleDeleteProcedure = async (id) => {
    if (!window.confirm("Usunąć ten rodzaj zabiegu?")) return;
    try {
      await api.delete(`/procedure-types/${id}`);
      toast.success("Rodzaj zabiegu usunięty");
      loadData();
    } catch (err) {
      toast.error("Nie udało się usunąć rodzaju zabiegu");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;

  return (
    <div className="p-8" data-testid="settings-page">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Ustawienia</h1>
        <p className="text-slate-500 mt-1">Zarządzaj ustawieniami praktyki</p>
      </div>

      {/* Procedure Types */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900">Rodzaje zabiegów</h2>
          <button
            onClick={() => setShowAddProcedure(true)}
            className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            data-testid="add-procedure-type-button"
          >
            <Plus className="w-4 h-4" />
            Dodaj zabieg
          </button>
        </div>
        <div className="p-6">
          {procedureTypes.length > 0 ? (
            <div className="space-y-3">
              {procedureTypes.map((pt) => (
                <div key={pt.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg" data-testid={`procedure-type-${pt.id}`}>
                  <div>
                    <p className="font-medium text-slate-900">{pt.name}</p>
                    <div className="flex gap-4 text-sm text-slate-500">
                      {pt.description && <span>{pt.description}</span>}
                      {pt.default_price && <span className="text-teal-600 font-medium">{pt.default_price.toLocaleString('pl-PL')} PLN</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditProcedure(pt)}
                      className="p-2 hover:bg-slate-200 rounded-lg"
                      data-testid={`edit-procedure-${pt.id}`}
                    >
                      <Edit className="w-4 h-4 text-slate-600" />
                    </button>
                    <button
                      onClick={() => handleDeleteProcedure(pt.id)}
                      className="p-2 hover:bg-red-100 rounded-lg"
                      data-testid={`delete-procedure-${pt.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">Brak dodanych rodzajów zabiegów</p>
          )}
        </div>
      </div>

      {/* Locations */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900">Lokalizacje / Kliniki</h2>
          <button
            onClick={() => setShowAddLocation(true)}
            className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            data-testid="add-location-button"
          >
            <Plus className="w-4 h-4" />
            Dodaj lokalizację
          </button>
        </div>
        <div className="p-6">
          {locations.length > 0 ? (
            <div className="space-y-3">
              {locations.map((loc) => (
                <div key={loc.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg" data-testid={`location-${loc.id}`}>
                  <div>
                    <p className="font-medium text-slate-900">{loc.name}</p>
                    {loc.address && <p className="text-sm text-slate-500">{loc.address}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditLocation(loc)}
                      className="p-2 hover:bg-slate-200 rounded-lg"
                      data-testid={`edit-location-${loc.id}`}
                    >
                      <Edit className="w-4 h-4 text-slate-600" />
                    </button>
                    <button
                      onClick={() => handleDeleteLocation(loc.id)}
                      className="p-2 hover:bg-red-100 rounded-lg"
                      data-testid={`delete-location-${loc.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">Brak dodanych lokalizacji</p>
          )}
        </div>
      </div>

      {/* Google Calendar */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Integracja z Kalendarzem Google</h2>
        </div>
        <div className="p-6">
          <div className={`p-4 rounded-lg ${calendarStatus?.configured ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
            <div className="flex items-start gap-3">
              {calendarStatus?.configured ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${calendarStatus?.configured ? "text-emerald-800" : "text-amber-800"}`}>
                  {calendarStatus?.configured ? "Połączono" : "Nie skonfigurowano"}
                </p>
                <p className={`text-sm mt-1 ${calendarStatus?.configured ? "text-emerald-700" : "text-amber-700"}`}>
                  {calendarStatus?.configured 
                    ? "Integracja z Kalendarzem Google jest aktywna"
                    : "Kalendarz Google nie jest skonfigurowany. Dodaj GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET, aby włączyć."
                  }
                </p>
                {!calendarStatus?.configured && (
                  <div className="mt-4 p-4 bg-white rounded-lg text-sm text-slate-600">
                    <p className="font-medium text-slate-800 mb-2">Instrukcja konfiguracji:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Przejdź do Google Cloud Console</li>
                      <li>Utwórz nowy projekt i włącz Google Calendar API</li>
                      <li>Skonfiguruj ekran zgody OAuth</li>
                      <li>Utwórz dane uwierzytelniające OAuth (Aplikacja webowa)</li>
                      <li>Dodaj GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET do pliku .env backendu</li>
                      <li>Zrestartuj serwer</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {(showAddLocation || editLocation) && (
        <LocationModal
          location={editLocation}
          onClose={() => { setShowAddLocation(false); setEditLocation(null); }}
          onSuccess={() => { setShowAddLocation(false); setEditLocation(null); loadData(); }}
        />
      )}

      {(showAddProcedure || editProcedure) && (
        <ProcedureTypeModal
          procedureType={editProcedure}
          onClose={() => { setShowAddProcedure(false); setEditProcedure(null); }}
          onSuccess={() => { setShowAddProcedure(false); setEditProcedure(null); loadData(); }}
        />
      )}
    </div>
  );
};

export default SettingsPage;
