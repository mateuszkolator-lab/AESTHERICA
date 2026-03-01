import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Users, Calendar, ChevronLeft, ChevronRight, User, 
  CheckCircle2, Clock
} from "lucide-react";
import api from "../utils/api";
import { 
  STATUS_LABELS, getStatusColor, getLocationColor, 
  getProcedureAbbrev, getDaysInMonth, DAY_NAMES 
} from "../utils/constants";
import DashboardDayModal from "../components/modals/DashboardDayModal";

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [locations, setLocations] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [dashRes, slotsRes, locsRes] = await Promise.all([
        api.get("/dashboard"),
        api.get("/surgery-slots?include_past=true"),
        api.get("/locations")
      ]);
      setData(dashRes.data);
      setSlots(slotsRes.data);
      setLocations(locsRes.data);
    } catch (err) {
      toast.error("Nie udało się załadować pulpitu");
    } finally {
      setLoading(false);
    }
  };

  const getSlotForDate = (date) => {
    if (!date) return null;
    const dateStr = date.toISOString().split("T")[0];
    return slots.find(s => s.date === dateStr);
  };

  const getSurgeriesForDate = (date) => {
    if (!date || !data?.upcoming_surgeries) return [];
    const dateStr = date.toISOString().split("T")[0];
    return data.upcoming_surgeries.filter(p => p.surgery_date === dateStr);
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleString("pl-PL", { month: "long", year: "numeric" });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;

  return (
    <div className="p-8" data-testid="dashboard-page">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Pulpit</h1>
        <p className="text-slate-500 mt-1">Witaj ponownie! Oto przegląd Twojej praktyki.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Preview */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Kalendarz operacji</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="p-1.5 hover:bg-slate-100 rounded-lg"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-slate-700 capitalize min-w-[120px] text-center">{monthName}</span>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                className="p-1.5 hover:bg-slate-100 rounded-lg"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAY_NAMES.map((day) => (
                <div key={day} className="text-center text-xs font-semibold text-slate-500 py-1">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => {
                const slot = getSlotForDate(day);
                const surgeries = getSurgeriesForDate(day);
                const isToday = day && day.toDateString() === new Date().toDateString();
                const hasSlot = !!slot;
                const isFull = slot?.is_full;
                const hasPatients = surgeries.length > 0;
                
                let bgColor = "";
                let borderColor = "";
                
                if (day) {
                  if (isFull) {
                    bgColor = "bg-red-100";
                    borderColor = "ring-2 ring-red-400";
                  } else if (hasPatients) {
                    bgColor = "bg-emerald-100";
                    borderColor = "ring-2 ring-emerald-400";
                  } else if (hasSlot) {
                    bgColor = "bg-amber-100";
                    borderColor = "ring-2 ring-amber-300";
                  }
                }
                
                return (
                  <div
                    key={i}
                    onClick={() => day && (hasSlot || hasPatients) && setSelectedDay(day)}
                    data-testid={day ? `dashboard-day-${day.getDate()}` : undefined}
                    className={`min-h-[70px] p-1 rounded-lg cursor-pointer transition-all relative overflow-hidden ${
                      !day 
                        ? "cursor-default" 
                        : isToday 
                          ? "ring-2 ring-teal-500 ring-offset-1" 
                          : borderColor || "hover:bg-slate-50"
                    } ${bgColor} ${hasSlot && slot.location_name ? `border-l-4 ${getLocationColor(slot.location_name)?.border}` : ""}`}
                  >
                    {day && (
                      <>
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-medium ${
                            isToday ? "text-teal-700" : hasSlot || hasPatients ? "text-slate-900" : "text-slate-600"
                          }`}>
                            {day.getDate()}
                          </p>
                          {hasSlot && slot.location_name && (
                            <div 
                              className={`w-2 h-2 rounded-full ${getLocationColor(slot.location_name)?.dot}`}
                              title={slot.location_name}
                            />
                          )}
                        </div>
                        <div className="mt-0.5 space-y-0.5 overflow-hidden">
                          {surgeries.slice(0, 2).map((patient, idx) => (
                            <div 
                              key={idx}
                              className="flex items-center gap-0.5 text-[9px] leading-tight"
                              title={`${patient.first_name} ${patient.last_name} - ${patient.procedure_type || 'Zabieg'}`}
                            >
                              <span className="px-1 py-0.5 bg-blue-600 text-white rounded font-bold shrink-0">
                                {getProcedureAbbrev(patient.procedure_type)}
                              </span>
                              <span className="truncate text-slate-700 font-medium">
                                {patient.last_name}
                              </span>
                            </div>
                          ))}
                          {surgeries.length > 2 && (
                            <p className="text-[9px] text-slate-500 font-medium">+{surgeries.length - 2}</p>
                          )}
                          {!hasPatients && hasSlot && !isFull && (
                            <span className="text-[9px] text-amber-700 font-medium">Wolny</span>
                          )}
                          {isFull && (
                            <span className="text-[9px] text-red-700 font-medium">Pełny</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-emerald-100 ring-2 ring-emerald-400" />
                <span>Z pacjentem</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-100 ring-2 ring-amber-300" />
                <span>Wolny termin</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-red-100 ring-2 ring-red-400" />
                <span>Niedostępny</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-1 py-0.5 bg-blue-600 text-white rounded text-[9px] font-bold">RIN</span>
                <span>Typ zabiegu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm border-l-4 border-l-orange-500 bg-slate-100" />
                <span>Lokalizacja</span>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Surgeries */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Nadchodzące operacje</h2>
            <span className="px-2 py-0.5 bg-teal-100 text-teal-800 text-xs font-medium rounded-full">
              {data?.upcoming_surgeries?.length || 0}
            </span>
          </div>
          <div className="p-4 max-h-[400px] overflow-y-auto">
            {data?.upcoming_surgeries?.length > 0 ? (
              <div className="space-y-2">
                {data.upcoming_surgeries.map((patient) => (
                  <div 
                    key={patient.id} 
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                    onClick={() => navigate(`/patients/${patient.id}`)}
                    data-testid={`upcoming-${patient.id}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">{patient.first_name} {patient.last_name}</p>
                      <p className="text-xs text-slate-500 truncate">{patient.procedure_type || "Zabieg do ustalenia"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-teal-700">{patient.surgery_date}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Brak nadchodzących operacji</p>
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t border-slate-100">
            <button 
              onClick={() => navigate("/calendar")} 
              className="w-full text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              Zobacz pełny kalendarz
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Patients */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Ostatni pacjenci</h2>
            <button onClick={() => navigate("/patients")} className="text-sm text-teal-600 hover:text-teal-700 font-medium">Zobacz wszystkich</button>
          </div>
          <div className="p-4">
            {data?.recent_patients?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.recent_patients.map((patient) => (
                  <div 
                    key={patient.id}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                    onClick={() => navigate(`/patients/${patient.id}`)}
                    data-testid={`recent-${patient.id}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">{patient.first_name} {patient.last_name}</p>
                      <p className="text-xs text-slate-500">{new Date(patient.created_at).toLocaleDateString('pl-PL')}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(patient.status)}`}>
                      {STATUS_LABELS[patient.status] || patient.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">Brak pacjentów</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Statystyki</h2>
          </div>
          <div className="p-4 space-y-3">
            {[
              { label: "Wszyscy", value: data?.stats?.total || 0, icon: Users, color: "teal" },
              { label: "Zoperowani", value: data?.stats?.operated || 0, icon: CheckCircle2, color: "emerald" },
              { label: "Zaplanowani", value: data?.stats?.planned || 0, icon: Calendar, color: "blue" },
              { label: "Oczekujący", value: data?.stats?.awaiting || 0, icon: Clock, color: "amber" },
              { label: "Konsultacje", value: data?.stats?.consultation || 0, icon: User, color: "slate" },
            ].map((stat, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg bg-${stat.color}-100 flex items-center justify-center`}>
                    <stat.icon className={`w-4 h-4 text-${stat.color}-600`} />
                  </div>
                  <span className="text-sm text-slate-600">{stat.label}</span>
                </div>
                <span className="text-lg font-semibold text-slate-900">{stat.value}</span>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-slate-100">
            <button 
              onClick={() => navigate("/stats")} 
              className="w-full text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              Zobacz szczegółowe statystyki
            </button>
          </div>
        </div>
      </div>
      
      {selectedDay && (
        <DashboardDayModal
          day={selectedDay}
          surgeries={getSurgeriesForDate(selectedDay)}
          slot={getSlotForDate(selectedDay)}
          locations={locations}
          onClose={() => setSelectedDay(null)}
          onRefresh={loadDashboard}
          navigate={navigate}
        />
      )}
    </div>
  );
};

export default Dashboard;
