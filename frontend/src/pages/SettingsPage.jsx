import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Edit, Trash2, CheckCircle2, AlertCircle, Calendar, Link2, Unlink, ChevronDown } from "lucide-react";
import api from "../utils/api";
import { LocationModal, ProcedureTypeModal } from "../components/modals/SettingsModals";

const SettingsPage = () => {
  const [searchParams] = useSearchParams();
  const [locations, setLocations] = useState([]);
  const [procedureTypes, setProcedureTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [editLocation, setEditLocation] = useState(null);
  const [showAddProcedure, setShowAddProcedure] = useState(false);
  const [editProcedure, setEditProcedure] = useState(null);
  const [calendarStatus, setCalendarStatus] = useState(null);
  const [googleCalendars, setGoogleCalendars] = useState([]);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [loadingCalendars, setLoadingCalendars] = useState(false);

  const loadGoogleCalendars = useCallback(async () => {
    setLoadingCalendars(true);
    try {
      const res = await api.get("/calendar/calendars");
      setGoogleCalendars(res.data);
    } catch (err) {
      // Calendar loading is non-critical
    } finally {
      setLoadingCalendars(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [locRes, ptRes, calRes] = await Promise.all([
        api.get("/locations"),
        api.get("/procedure-types"),
        api.get("/calendar/status")
      ]);
      setLocations(locRes.data);
      setProcedureTypes(ptRes.data);
      setCalendarStatus(calRes.data);
      
      // If connected, load available calendars
      if (calRes.data.connected) {
        loadGoogleCalendars();
      }
    } catch (err) {
      toast.error("Nie udało się załadować ustawień");
    } finally {
      setLoading(false);
    }
  }, [loadGoogleCalendars]);

  useEffect(() => {
    loadData();
    
    // Check URL params for calendar connection status
    const calendarConnected = searchParams.get('calendar_connected');
    const calendarError = searchParams.get('calendar_error');
    
    if (calendarConnected === 'true') {
      toast.success("Połączono z Kalendarzem Google!");
      // Clean URL
      window.history.replaceState({}, '', '/ustawienia');
    }
    if (calendarError) {
      toast.error(`Błąd połączenia: ${calendarError}`);
      window.history.replaceState({}, '', '/ustawienia');
    }
  }, [loadData, searchParams]);

  const handleConnectGoogle = async () => {
    setConnectingCalendar(true);
    try {
      const res = await api.get("/calendar/authorize");
      window.location.href = res.data.authorization_url;
    } catch (err) {
      toast.error("Nie udało się uzyskać linku autoryzacji");
      setConnectingCalendar(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm("Czy na pewno chcesz odłączyć Kalendarz Google? Przypisania kalendarzy do lokalizacji zostaną usunięte.")) return;
    try {
      await api.post("/calendar/disconnect");
      toast.success("Rozłączono z Kalendarzem Google");
      setCalendarStatus({ connected: false, configured: true });
      setGoogleCalendars([]);
      loadData();
    } catch (err) {
      toast.error("Nie udało się rozłączyć");
    }
  };

  const handleAssignCalendar = async (locationId, calendarId) => {
    try {
      if (calendarId) {
        await api.post(`/calendar/locations/${locationId}/calendar?calendar_id=${calendarId}`);
        toast.success("Kalendarz przypisany do lokalizacji");
      } else {
        await api.delete(`/calendar/locations/${locationId}/calendar`);
        toast.success("Kalendarz usunięty z lokalizacji");
      }
      loadData();
    } catch (err) {
      toast.error("Nie udało się przypisać kalendarza");
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
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-slate-900">Integracja z Kalendarzem Google</h2>
          </div>
          {calendarStatus?.connected && (
            <button
              onClick={handleDisconnectGoogle}
              className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium transition-colors"
              data-testid="disconnect-google-button"
            >
              <Unlink className="w-4 h-4" />
              Rozłącz
            </button>
          )}
        </div>
        <div className="p-6">
          {/* Connection Status */}
          <div className={`p-4 rounded-lg mb-6 ${calendarStatus?.connected ? "bg-emerald-50 border border-emerald-200" : calendarStatus?.configured ? "bg-amber-50 border border-amber-200" : "bg-slate-50 border border-slate-200"}`}>
            <div className="flex items-start gap-3">
              {calendarStatus?.connected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${calendarStatus?.connected ? "text-emerald-800" : "text-amber-800"}`}>
                  {calendarStatus?.connected ? "Połączono z Google" : calendarStatus?.configured ? "Nie połączono" : "Nie skonfigurowano"}
                </p>
                <p className={`text-sm mt-1 ${calendarStatus?.connected ? "text-emerald-700" : "text-amber-700"}`}>
                  {calendarStatus?.connected 
                    ? "Integracja z Kalendarzem Google jest aktywna. Przypisz kalendarze do lokalizacji poniżej."
                    : calendarStatus?.configured 
                      ? "Kliknij przycisk poniżej, aby połączyć z kontem Google."
                      : "Kalendarz Google nie jest skonfigurowany. Skontaktuj się z administratorem."
                  }
                </p>
                
                {!calendarStatus?.connected && calendarStatus?.configured && (
                  <button
                    onClick={handleConnectGoogle}
                    disabled={connectingCalendar}
                    className="mt-4 flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                    data-testid="connect-google-button"
                  >
                    <Link2 className="w-4 h-4" />
                    {connectingCalendar ? "Przekierowywanie..." : "Połącz z Google"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Calendar Assignment - only show when connected */}
          {calendarStatus?.connected && (
            <div>
              <h3 className="text-base font-semibold text-slate-800 mb-4">Przypisz kalendarze do lokalizacji</h3>
              <p className="text-sm text-slate-500 mb-4">
                Każda lokalizacja może mieć przypisany osobny kalendarz Google. Operacje zaplanowane w danej lokalizacji będą automatycznie dodawane do odpowiedniego kalendarza.
              </p>
              
              {loadingCalendars ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-700" />
                </div>
              ) : locations.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>Najpierw dodaj lokalizacje w sekcji powyżej.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {locations.map((loc) => (
                    <div key={loc.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg" data-testid={`calendar-location-${loc.id}`}>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{loc.name}</p>
                        {loc.address && <p className="text-sm text-slate-500">{loc.address}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <select
                            value={loc.google_calendar_id || ""}
                            onChange={(e) => handleAssignCalendar(loc.id, e.target.value)}
                            className="appearance-none bg-white border border-slate-200 rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[220px]"
                            data-testid={`calendar-select-${loc.id}`}
                          >
                            <option value="">-- Wybierz kalendarz --</option>
                            {googleCalendars.map((cal) => (
                              <option key={cal.id} value={cal.id}>
                                {cal.name} {cal.primary ? "(Główny)" : ""}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        {loc.google_calendar_id && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
