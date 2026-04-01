import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Users, Calendar, ChevronLeft, ChevronRight, User, 
  CheckCircle2, Clock, Zap
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;

  return (
    <div className="p-8" data-testid="dashboard-page">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Pulpit</h1>
        <p className="text-slate-500 mt-1">Witaj ponownie! Oto przegląd Twojej praktyki.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Preview - Google/Apple style */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
              >
                Dziś
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 capitalize" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {monthName}
            </h2>
            <div className="w-24" /> {/* Spacer for balance */}
          </div>
          
          <div className="p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"].map((day, i) => (
                <div key={day} className={`text-center text-xs font-semibold py-2 ${i >= 5 ? 'text-slate-400' : 'text-slate-500'}`}>
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">
              {days.map((day, i) => {
                const slot = getSlotForDate(day);
                const surgeries = getSurgeriesForDate(day);
                const isToday = day && day.toDateString() === new Date().toDateString();
                const hasSlot = !!slot;
                const isFull = slot?.is_full;
                const hasPatients = surgeries.length > 0;
                const isPast = day && day < today;
                const isWeekend = day && (day.getDay() === 0 || day.getDay() === 6);
                const hasAsap = surgeries.some(p => p.asap);
                
                const isOperatingDay = day && hasSlot && !isPast;
                
                return (
                  <div
                    key={i}
                    onClick={() => day && (hasSlot || hasPatients) && setSelectedDay(day)}
                    data-testid={day ? `dashboard-day-${day.getDate()}` : undefined}
                    className={`min-h-[90px] p-1.5 transition-all relative ${
                      !day 
                        ? "bg-slate-50" 
                        : isPast 
                          ? "bg-slate-50/80 cursor-default"
                          : isWeekend && !hasSlot
                            ? "bg-slate-50 hover:bg-slate-100 cursor-pointer"
                            : hasSlot && isFull
                              ? "bg-red-50/50 hover:bg-red-50 cursor-pointer"
                              : hasSlot
                                ? "bg-emerald-50/40 hover:bg-emerald-50 cursor-pointer"
                                : "bg-white hover:bg-slate-50 cursor-pointer"
                    }`}
                  >
                    {isOperatingDay && (
                      <div className={`absolute left-0 top-0 bottom-0 w-[5px] ${isFull ? 'bg-red-500' : 'bg-emerald-500'}`} />
                    )}
                    {day && (
                      <>
                        {/* Day number */}
                        <div className="flex items-center justify-between mb-1">
                          <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${
                            isToday 
                              ? "bg-teal-600 text-white" 
                              : isPast 
                                ? "text-slate-400"
                                : "text-slate-700"
                          }`}>
                            {day.getDate()}
                          </div>
                          {hasSlot && slot.location_name && (
                            <div 
                              className={`w-2 h-2 rounded-full ${getLocationColor(slot.location_name)?.dot}`}
                              title={slot.location_name}
                            />
                          )}
                        </div>
                        
                        {/* Events */}
                        <div className="space-y-0.5">
                          {surgeries.slice(0, 2).map((patient, idx) => (
                            <div 
                              key={idx}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] leading-tight truncate ${
                                patient.asap 
                                  ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                              title={`${patient.first_name} ${patient.last_name} - ${patient.procedure_type || 'Zabieg'}${patient.asap ? ' (ASAP)' : ''}`}
                            >
                              {patient.asap && <Zap className="w-2.5 h-2.5 shrink-0" />}
                              <span className="truncate font-medium">{patient.last_name}</span>
                            </div>
                          ))}
                          {surgeries.length > 2 && (
                            <p className="text-[10px] text-slate-500 pl-1">+{surgeries.length - 2} więcej</p>
                          )}
                          {!hasPatients && hasSlot && !isFull && (
                            <div className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-medium">
                              Wolny termin
                            </div>
                          )}
                          {isFull && (
                            <div className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-medium">
                              Niedostępny
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200" />
                <span>Zabieg</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
                <span>ASAP</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-[5px] h-3.5 rounded-sm bg-emerald-500" />
                <span>Wolny dzień op.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-[5px] h-3.5 rounded-sm bg-red-500" />
                <span>Pełny dzień op.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Surgeries */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Nadchodzące operacje</h2>
            <span className="px-2.5 py-1 bg-teal-100 text-teal-800 text-xs font-semibold rounded-full">
              {data?.upcoming_surgeries?.length || 0}
            </span>
          </div>
          <div className="p-4 max-h-[400px] overflow-y-auto">
            {data?.upcoming_surgeries?.length > 0 ? (
              <div className="space-y-2">
                {data.upcoming_surgeries.map((patient) => (
                  <div 
                    key={patient.id} 
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                      patient.asap 
                        ? "bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 hover:border-amber-300"
                        : "bg-slate-50 hover:bg-slate-100"
                    }`}
                    onClick={() => navigate(`/patients/${patient.id}`)}
                    data-testid={`upcoming-${patient.id}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      patient.asap ? "bg-amber-200" : "bg-teal-100"
                    }`}>
                      {patient.asap ? (
                        <Zap className="w-5 h-5 text-amber-700" />
                      ) : (
                        <Calendar className="w-5 h-5 text-teal-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 text-sm truncate">
                          {patient.first_name} {patient.last_name}
                        </p>
                        {patient.asap && (
                          <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-bold rounded">
                            ASAP
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{patient.procedure_type || "Zabieg do ustalenia"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-teal-700">
                        {new Date(patient.surgery_date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                      </p>
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
              Zobacz pełny kalendarz →
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Patients */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Ostatni pacjenci</h2>
            <button onClick={() => navigate("/patients")} className="text-sm text-teal-600 hover:text-teal-700 font-medium">
              Zobacz wszystkich →
            </button>
          </div>
          <div className="p-4">
            {data?.recent_patients?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.recent_patients.map((patient) => (
                  <div 
                    key={patient.id}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors"
                    onClick={() => navigate(`/patients/${patient.id}`)}
                    data-testid={`recent-${patient.id}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-600" />
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
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
                  <div className={`w-8 h-8 rounded-lg bg-${stat.color}-100 flex items-center justify-center`}>
                    <stat.icon className={`w-4 h-4 text-${stat.color}-600`} />
                  </div>
                  <span className="text-sm text-slate-600">{stat.label}</span>
                </div>
                <span className="text-xl font-bold text-slate-900">{stat.value}</span>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-slate-100">
            <button 
              onClick={() => navigate("/stats")} 
              className="w-full text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              Zobacz szczegółowe statystyki →
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
