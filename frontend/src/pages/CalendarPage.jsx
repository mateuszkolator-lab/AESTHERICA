import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Calendar, ChevronLeft, ChevronRight, User, MapPin, 
  Phone, X, Sparkles
} from "lucide-react";
import api from "../utils/api";
import { 
  STATUS_LABELS, getStatusColorBg, getLocationColor, 
  getDaysInMonth, DAY_NAMES, formatDateLocal
} from "../utils/constants";

const CalendarPage = () => {
  const [calendarData, setCalendarData] = useState(null);
  const [patients, setPatients] = useState([]);
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
      const [calRes, patientsRes] = await Promise.all([
        api.get("/surgery-slots/calendar-data"),
        api.get("/patients")
      ]);
      setCalendarData(calRes.data);
      setPatients(patientsRes.data.filter(p => p.surgery_date));
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
      if (draggedPatient.surgery_date) {
        const previousSlot = calendarData?.slots?.find(s => s.date === draggedPatient.surgery_date && s.assigned_patient_id === draggedPatient.id);
        if (previousSlot) {
          await api.post(`/surgery-slots/${previousSlot.id}/unassign`);
        }
      }

      if (targetSlot) {
        await api.post(`/surgery-slots/${targetSlot.id}/assign/${draggedPatient.id}`);
      } else {
        const newSlot = await api.post("/surgery-slots", { date: dateStr });
        await api.post(`/surgery-slots/${newSlot.data.id}/assign/${draggedPatient.id}`);
      }
      toast.success(`Pacjent przeniesiony na ${dateStr}`);
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
      // ASAP na górze
      if (a.asap && !b.asap) return -1;
      if (!a.asap && b.asap) return 1;
      
      // Potem wg preferowanej daty (najbliższa pierwsza)
      const dateA = a.preferred_date_start || "9999-99-99";
      const dateB = b.preferred_date_start || "9999-99-99";
      return dateA.localeCompare(dateB);
    });
  }, [calendarData?.unassigned_patients]);

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleString("pl-PL", { month: "long", year: "numeric" });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;

  return (
    <div className="p-8" data-testid="calendar-page">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Unassigned Patients Panel */}
        {showUnassigned && (
          <div className="lg:w-80 bg-white rounded-xl border border-slate-200 h-fit lg:sticky lg:top-8">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Pacjenci bez terminu</h3>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                {calendarData?.unassigned_patients?.length || 0}
              </span>
            </div>
            <div className="p-3 max-h-[600px] overflow-y-auto">
              {sortedUnassignedPatients.length > 0 ? (
                <div className="space-y-2">
                  {sortedUnassignedPatients.map((patient) => (
                    <div
                      key={patient.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, patient)}
                      className="p-3 bg-slate-50 rounded-lg cursor-grab active:cursor-grabbing hover:bg-slate-100 transition-colors border border-slate-200"
                      data-testid={`draggable-patient-${patient.id}`}
                    >
                      <div className="flex items-center gap-2">
                        {patient.asap && (
                          <Sparkles className="w-4 h-4 text-amber-500" title="Jak najszybciej" />
                        )}
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-900 text-sm">{patient.first_name} {patient.last_name}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {patient.procedure_type || "Zabieg nieokreślony"}
                      </div>
                      {(patient.preferred_date_start || patient.preferred_date_end) && (
                        <div className="mt-1 text-xs text-teal-600">
                          Pref: {patient.preferred_date_start || "?"} - {patient.preferred_date_end || "?"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm text-center py-4">Wszyscy pacjenci mają przypisane terminy</p>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
              Przeciągnij pacjenta na dzień w kalendarzu. Możesz też przenosić zaplanowanych pacjentów.
            </div>
          </div>
        )}

        {/* Calendar */}
        <div className="flex-1">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Kalendarz operacji</h1>
              <p className="text-slate-500 mt-1">Przeciągnij pacjentów na wybrane daty</p>
            </div>
            <button
              onClick={() => setShowUnassigned(!showUnassigned)}
              className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium text-sm"
            >
              {showUnassigned ? "Ukryj panel" : "Pokaż pacjentów"}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="p-2 hover:bg-slate-100 rounded-lg"
                data-testid="prev-month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-semibold text-slate-900 capitalize">{monthName}</h2>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                className="p-2 hover:bg-slate-100 rounded-lg"
                data-testid="next-month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {DAY_NAMES.map((day) => (
                  <div key={day} className="text-center text-sm font-semibold text-slate-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {days.map((day, i) => {
                  const dayPatients = getPatientsByDate(day);
                  const slot = getSlotByDate(day);
                  const isToday = day && day.toDateString() === new Date().toDateString();
                  const isFull = slot?.is_full;
                  const hasSlot = !!slot;
                  
                  return (
                    <div
                      key={i}
                      onDragOver={day ? handleDragOver : undefined}
                      onDrop={day ? (e) => handleDrop(e, day) : undefined}
                      className={`min-h-[100px] p-2 rounded-lg border-2 transition-colors overflow-hidden ${
                        !day 
                          ? "border-transparent" 
                          : isFull 
                            ? "border-red-400 bg-red-100" 
                            : dayPatients.length > 0
                              ? "border-emerald-400 bg-emerald-50 hover:bg-emerald-100"
                              : hasSlot 
                                ? "border-amber-400 bg-amber-50 hover:bg-amber-100" 
                                : isToday 
                                  ? "border-teal-400 bg-teal-50" 
                                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      } ${draggedPatient && day && !isFull ? "ring-2 ring-teal-400 ring-opacity-70" : ""} ${hasSlot && slot.location_name ? `border-l-4 ${getLocationColor(slot.location_name)?.border}` : ""}`}
                    >
                      {day && (
                        <>
                          <div 
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => (dayPatients.length > 0 || hasSlot) && setSelectedDay(day)}
                          >
                            <div className="flex items-center gap-1.5">
                              <p className={`text-sm font-medium ${isToday ? "text-teal-700" : "text-slate-600"}`}>
                                {day.getDate()}
                              </p>
                              {hasSlot && slot.location_name && (
                                <div 
                                  className={`w-2.5 h-2.5 rounded-full ${getLocationColor(slot.location_name)?.dot}`}
                                  title={slot.location_name}
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {isFull && (
                                <span className="px-1.5 py-0.5 bg-red-200 text-red-800 text-[10px] font-medium rounded">
                                  Pełny
                                </span>
                              )}
                              {hasSlot && !isFull && !slot.assigned_patient_id && (
                                <span className="px-1.5 py-0.5 bg-teal-200 text-teal-800 text-[10px] font-medium rounded">
                                  Termin
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-1 space-y-1">
                            {dayPatients.slice(0, 3).map((patient) => (
                              <div
                                key={patient.id}
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  handleDragStart(e, patient);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/patients/${patient.id}`);
                                }}
                                className={`px-2 py-1 rounded text-xs text-white cursor-grab active:cursor-grabbing truncate shadow-sm hover:shadow-md transition-shadow ${getStatusColorBg(patient.status)}`}
                                title={`${patient.first_name} ${patient.last_name} - przeciągnij aby zmienić datę`}
                                data-testid={`calendar-event-${patient.id}`}
                              >
                                {patient.first_name} {patient.last_name[0]}.
                              </div>
                            ))}
                            {dayPatients.length > 3 && (
                              <p className="text-xs text-slate-500">+{dayPatients.length - 3} więcej</p>
                            )}
                            {(dayPatients.length > 0 || hasSlot) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDay(day);
                                }}
                                className="w-full text-[10px] text-teal-600 hover:text-teal-700 font-medium mt-1 pt-1 border-t border-slate-200/50"
                              >
                                Szczegóły
                              </button>
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
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-600 bg-white p-4 rounded-lg border border-slate-200">
            <span className="font-medium text-slate-700">Legenda:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-amber-400 bg-amber-50" />
              <span>Wolny termin</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-emerald-400 bg-emerald-50" />
              <span>Z pacjentem</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border-2 border-red-400 bg-red-100" />
              <span>Pełny/Niedostępny</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-600" />
              <span>Zaplanowany</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-600" />
              <span>Zoperowany</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm border-l-4 border-l-orange-500 bg-slate-100" />
              <span>Lokalizacja</span>
            </div>
          </div>
          
          <p className="mt-3 text-sm text-slate-500 text-center">
            Kliknij na dzień z pacjentami lub terminem, aby zobaczyć szczegóły
          </p>
        </div>
      </div>
      
      {/* Day Detail Modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDay(null)}>
          <div 
            className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {selectedDay.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h2>
                {(() => {
                  const slot = getSlotByDate(selectedDay);
                  return slot && (
                    <div className="flex items-center gap-2 mt-1">
                      {slot.is_full && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">Pełny</span>
                      )}
                      {slot.location_name && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {slot.location_name}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
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
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                      Umówieni pacjenci ({dayPatients.length})
                    </h3>
                    {dayPatients.map((patient) => (
                      <div 
                        key={patient.id}
                        className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                        onClick={() => navigate(`/patients/${patient.id}`)}
                      >
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${getStatusColorBg(patient.status)}`}>
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900">{patient.first_name} {patient.last_name}</p>
                          <div className="flex items-center gap-2 mt-1">
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
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setSelectedDay(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium"
              >
                Zamknij
              </button>
              <button
                onClick={() => navigate('/planning')}
                className="flex-1 px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-medium"
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
