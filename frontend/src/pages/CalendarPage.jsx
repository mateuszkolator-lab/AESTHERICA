import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Calendar, ChevronLeft, ChevronRight, User, MapPin, 
  Phone, X, Zap, GripVertical
} from "lucide-react";
import api from "../utils/api";
import { 
  STATUS_LABELS, getStatusColorBg, getLocationColor, 
  getDaysInMonth, formatDateLocal
} from "../utils/constants";

const CalendarPage = () => {
  const [calendarData, setCalendarData] = useState(null);
  const [patients, setPatients] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [draggedPatient, setDraggedPatient] = useState(null);
  const [showUnassigned, setShowUnassigned] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [calRes, patientsRes, locRes] = await Promise.all([
        api.get("/surgery-slots/calendar-data"),
        api.get("/patients"),
        api.get("/locations")
      ]);
      setCalendarData(calRes.data);
      setPatients(patientsRes.data.filter(p => p.surgery_date));
      setLocations(locRes.data);
    } catch (err) {
      toast.error("Nie udało się załadować kalendarza");
    } finally {
      setLoading(false);
    }
  };

  const getPatientsByDate = (date) => {
    if (!date) return [];
    const dateStr = formatDateLocal(date);
    return patients.filter(p => p.surgery_date === dateStr);
  };

  const getSlotByDate = (date) => {
    if (!date || !calendarData?.slots) return null;
    const dateStr = formatDateLocal(date);
    return calendarData.slots.find(s => s.date === dateStr);
  };

  const handleDragStart = (e, patient) => {
    setDraggedPatient(patient);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", patient.id);
  };

  const handleDragEnd = () => {
    setDraggedPatient(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e, date) => {
    e.preventDefault();
    if (!draggedPatient || !date) return;

    const dateStr = formatDateLocal(date);
    const targetSlot = calendarData?.slots?.find(s => s.date === dateStr);

    if (targetSlot?.is_full) {
      toast.error("Ten termin jest oznaczony jako pełny");
      setDraggedPatient(null);
      return;
    }

    if (draggedPatient.surgery_date === dateStr) {
      setDraggedPatient(null);
      return;
    }

    try {
      // 1. Unassign from old slot if exists
      if (draggedPatient.surgery_date) {
        const previousSlot = calendarData?.slots?.find(
          s => s.date === draggedPatient.surgery_date && s.assigned_patient_id === draggedPatient.id
        );
        if (previousSlot) {
          await api.post(`/surgery-slots/${previousSlot.id}/unassign`);
        } else {
          // No slot match — just clear surgery_date so assign sets it fresh
          await api.put(`/patients/${draggedPatient.id}`, { surgery_date: null });
        }
      }

      // 2. Assign to target
      if (targetSlot) {
        await api.post(`/surgery-slots/${targetSlot.id}/assign/${draggedPatient.id}`);
      } else {
        // Update patient date directly (no slot for this day)
        await api.put(`/patients/${draggedPatient.id}`, { surgery_date: dateStr, status: "planned" });
      }

      toast.success(`Przeniesiono ${draggedPatient.first_name} ${draggedPatient.last_name} na ${dateStr}`);
      loadData();
    } catch (err) {
      toast.error("Nie udało się przenieść pacjenta");
    }
    setDraggedPatient(null);
  };

  // Sortuj pacjentów bez terminu: ASAP najpierw, potem wg preferowanej daty
  const sortedUnassignedPatients = useMemo(() => {
    const patients = calendarData?.unassigned_patients || [];
    return [...patients].sort((a, b) => {
      if (a.asap && !b.asap) return -1;
      if (!a.asap && b.asap) return 1;
      const dateA = a.preferred_date_start || "9999-99-99";
      const dateB = b.preferred_date_start || "9999-99-99";
      return dateA.localeCompare(dateB);
    });
  }, [calendarData?.unassigned_patients]);

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleString("pl-PL", { month: "long", year: "numeric" });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;

  return (
    <div className="p-6 lg:p-8" data-testid="calendar-page">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Unassigned Patients Panel */}
        {showUnassigned && (
          <div className="lg:w-80 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm h-fit lg:sticky lg:top-8">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">Bez terminu</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Przeciągnij na kalendarz</p>
                </div>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                  {calendarData?.unassigned_patients?.length || 0}
                </span>
              </div>
              <div className="p-3 max-h-[calc(100vh-250px)] overflow-y-auto">
                {sortedUnassignedPatients.length > 0 ? (
                  <div className="space-y-2">
                    {sortedUnassignedPatients.map((patient) => (
                      <div
                        key={patient.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, patient)}
                        onDragEnd={handleDragEnd}
                        className={`group p-3 rounded-xl cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
                          patient.asap 
                            ? "bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 hover:border-amber-400"
                            : "bg-slate-50 border border-slate-200 hover:border-slate-300"
                        }`}
                        data-testid={`draggable-patient-${patient.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-4 h-4 text-slate-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {patient.asap && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-bold rounded">
                                  <Zap className="w-3 h-3" />
                                  ASAP
                                </span>
                              )}
                              {patient.location_id && (() => {
                                const locName = locations?.find(l => l.id === patient.location_id)?.name;
                                if (!locName) return null;
                                const color = getLocationColor(locName);
                                return (
                                  <span
                                    className="px-1.5 py-0.5 text-[10px] font-bold rounded text-white"
                                    style={{ backgroundColor: color?.hex || '#94a3b8' }}
                                  >
                                    {locName.trim().substring(0, 3).toUpperCase()}
                                  </span>
                                );
                              })()}
                              <span className="font-semibold text-slate-900 text-sm truncate">
                                {patient.first_name} {patient.last_name}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {patient.procedure_type || "Zabieg nieokreślony"}
                            </div>
                            {(patient.preferred_date_start || patient.preferred_date_end) && (
                              <div className="mt-1.5 text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded inline-block">
                                Preferowany: {patient.preferred_date_start || "?"} → {patient.preferred_date_end || "?"}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm">Wszyscy mają terminy</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Calendar */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Kalendarz operacji
              </h1>
              <p className="text-slate-500 mt-1 text-sm">Przeciągnij pacjentów na wybrane daty</p>
            </div>
            <button
              onClick={() => setShowUnassigned(!showUnassigned)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 font-medium text-sm shadow-sm transition-colors"
            >
              {showUnassigned ? "Ukryj panel" : "Pokaż pacjentów bez terminu"}
            </button>
          </div>

          {/* Calendar Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Month Navigation */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentMonth(new Date())}
                  className="px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                >
                  Dziś
                </button>
                <div className="flex items-center">
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    data-testid="prev-month"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    data-testid="next-month"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              </div>
              <h2 className="text-xl font-semibold text-slate-900 capitalize">{monthName}</h2>
              <div className="w-28" /> {/* Spacer */}
            </div>

            {/* Calendar Grid */}
            <div className="p-4">
              {/* Day Headers */}
              <div className="grid grid-cols-7 mb-2">
                {["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"].map((day, i) => (
                  <div key={day} className={`text-center text-xs font-semibold py-3 ${i >= 5 ? 'text-slate-400' : 'text-slate-600'}`}>
                    <span className="hidden lg:inline">{day}</span>
                    <span className="lg:hidden">{day.slice(0, 3)}</span>
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-xl overflow-hidden">
                {days.map((day, i) => {
                  const dayPatients = getPatientsByDate(day);
                  const slot = getSlotByDate(day);
                  const isToday = day && day.toDateString() === new Date().toDateString();
                  const isFull = slot?.is_full;
                  const hasSlot = !!slot;
                  const isPast = day && day < today;
                  const isWeekend = day && (day.getDay() === 0 || day.getDay() === 6);
                  const hasPatients = dayPatients.length > 0;
                  
                  const isOperatingDay = day && hasSlot && !isPast;
                  
                  return (
                    <div
                      key={i}
                      onDragOver={day && !isPast ? handleDragOver : undefined}
                      onDrop={day && !isPast ? (e) => handleDrop(e, day) : undefined}
                      onClick={day && (dayPatients.length > 0 || hasSlot) ? () => setSelectedDay(day) : undefined}
                      className={`min-h-[110px] lg:min-h-[120px] p-2 transition-all relative cursor-pointer ${
                        !day 
                          ? "bg-slate-100" 
                          : isPast 
                            ? "bg-slate-50 opacity-60"
                            : isWeekend && !hasSlot && !hasPatients
                              ? "bg-slate-50"
                              : hasSlot && isFull
                                ? "bg-red-50/60"
                                : hasSlot
                                  ? "bg-emerald-50/50"
                                  : "bg-white"
                      } ${
                        draggedPatient && day && !isPast && !isFull 
                          ? "ring-2 ring-inset ring-teal-400 bg-teal-50/50" 
                          : ""
                      } ${
                        day && !isPast ? "hover:bg-slate-50" : ""
                      }`}
                    >
                      {isOperatingDay && (
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-[6px]"
                          style={{ backgroundColor: slot?.location_name ? (getLocationColor(slot.location_name)?.hex || '#94a3b8') : (isFull ? '#dc2626' : '#059669') }}
                        />
                      )}
                      {day && (
                        <>
                          {/* Day Header */}
                          <div className="flex items-center justify-between mb-1">
                            <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                              isToday 
                                ? "bg-teal-600 text-white" 
                                : isPast 
                                  ? "text-slate-400"
                                  : "text-slate-700 hover:bg-slate-100"
                            }`}>
                              {day.getDate()}
                            </div>
                            <div className="flex items-center gap-1">
                              {hasSlot && slot.location_name && (
                                <span 
                                  className="px-1.5 py-0.5 text-[9px] font-bold rounded text-white"
                                  style={{ backgroundColor: getLocationColor(slot.location_name)?.hex || '#94a3b8' }}
                                >
                                  {slot.location_name.substring(0, 3).toUpperCase()}
                                </span>
                              )}
                              {isFull && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded">
                                  Pełny
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Events */}
                          <div className="space-y-1 relative z-20">
                            {dayPatients.slice(0, 3).map((patient) => (
                              <div
                                key={patient.id}
                                draggable={!isPast}
                                onDragStart={!isPast ? (e) => {
                                  e.stopPropagation();
                                  handleDragStart(e, patient);
                                } : undefined}
                                onDragEnd={handleDragEnd}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/patients/${patient.id}`);
                                }}
                                className={`px-2 py-1 rounded-lg text-xs font-medium truncate transition-all ${
                                  isPast ? "cursor-default" : "cursor-grab active:cursor-grabbing hover:shadow-md hover:scale-[1.02]"
                                } ${
                                  draggedPatient?.id === patient.id ? "opacity-50 ring-2 ring-teal-400" : ""
                                } bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200`}
                                title={`${patient.first_name} ${patient.last_name}${patient.asap ? ' (ASAP)' : ''} — przeciągnij aby zmienić termin`}
                                data-testid={`calendar-event-${patient.id}`}
                              >
                                <div className="flex items-center gap-1">
                                  {patient.asap && <Zap className="w-3.5 h-3.5 shrink-0 text-amber-500" />}
                                  <span className="truncate">{patient.first_name} {patient.last_name[0]}.</span>
                                </div>
                              </div>
                            ))}
                            {dayPatients.length > 3 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedDay(day); }}
                                className="text-[10px] text-teal-600 hover:text-teal-700 font-medium w-full text-left px-1"
                              >
                                +{dayPatients.length - 3} więcej
                              </button>
                            )}
                            {!dayPatients.length && hasSlot && !isFull && (
                              <div className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-medium">
                                Wolny termin
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 lg:gap-6 text-xs text-slate-600 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>ASAP</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-[6px] h-4 rounded-sm" style={{ backgroundColor: '#f97316' }} />
              <span>Pro-Familia</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-[6px] h-4 rounded-sm" style={{ backgroundColor: '#8b5cf6' }} />
              <span>Medicus</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded">Pełny</span>
              <span>Brak wolnych miejsc</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Day Detail Modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDay(null)}>
          <div 
            className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {selectedDay.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h2>
                {(() => {
                  const slot = getSlotByDate(selectedDay);
                  return slot && (
                    <div className="flex items-center gap-2 mt-1">
                      {slot.is_full && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">Pełny</span>
                      )}
                      {slot.location_name && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {slot.location_name}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
              {(() => {
                const dayPatients = getPatientsByDate(selectedDay);
                const slot = getSlotByDate(selectedDay);
                
                if (dayPatients.length === 0 && slot) {
                  return (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">Brak umówionych pacjentów</p>
                      <p className="text-sm text-slate-400 mt-1">Ten termin jest dostępny do rezerwacji</p>
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                      Pacjenci ({dayPatients.length})
                    </h3>
                    {dayPatients.map((patient) => (
                      <div 
                        key={patient.id}
                        className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all hover:shadow-md ${
                          patient.asap 
                            ? "bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200"
                            : "bg-slate-50 hover:bg-slate-100"
                        }`}
                        onClick={() => navigate(`/patients/${patient.id}`)}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          patient.asap ? "bg-gradient-to-br from-amber-400 to-orange-400" : getStatusColorBg(patient.status)
                        }`}>
                          {patient.asap ? (
                            <Zap className="w-6 h-6 text-white" />
                          ) : (
                            <User className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900">{patient.first_name} {patient.last_name}</p>
                            {patient.asap && (
                              <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-bold rounded">
                                ASAP
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                              {patient.procedure_type || "Zabieg nieokreślony"}
                            </span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              patient.status === 'planned' ? 'bg-blue-100 text-blue-800' :
                              patient.status === 'operated' ? 'bg-emerald-100 text-emerald-800' :
                              'bg-slate-100 text-slate-800'
                            }`}>
                              {STATUS_LABELS[patient.status] || patient.status}
                            </span>
                          </div>
                          {patient.phone && (
                            <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              {patient.phone}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 bg-slate-50">
              <button
                onClick={() => setSelectedDay(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl hover:bg-white font-medium transition-colors"
              >
                Zamknij
              </button>
              <button
                onClick={() => navigate('/planning')}
                className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium transition-colors"
              >
                Zarządzaj terminami
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
