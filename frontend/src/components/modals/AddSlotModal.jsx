import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import api from "../../utils/api";
import { getDaysInMonth } from "../../utils/constants";

const WEEKDAY_NAMES = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

const AddSlotModal = ({ locations, slot, onClose, onSuccess }) => {
  const [mode, setMode] = useState(slot ? "single" : "single");
  const [formData, setFormData] = useState({
    date: slot?.date || "",
    location_id: slot?.location_id || "",
    notes: slot?.notes || "",
    is_full: slot?.is_full || false
  });
  const [multiDates, setMultiDates] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const toggleDate = (date) => {
    if (!date) return;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    if (dateStr < todayStr) {
      toast.error("Nie można wybrać daty z przeszłości");
      return;
    }
    
    if (multiDates.includes(dateStr)) {
      setMultiDates(multiDates.filter(d => d !== dateStr));
    } else {
      setMultiDates([...multiDates, dateStr].sort());
    }
  };

  const isDateSelected = (date) => {
    if (!date) return false;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return multiDates.includes(dateStr);
  };

  const clearAllDates = () => {
    setMultiDates([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (slot) {
        await api.put(`/surgery-slots/${slot.id}`, formData);
        toast.success("Termin operacji zaktualizowany");
      } else if (mode === "single") {
        await api.post("/surgery-slots", formData);
        toast.success("Termin operacji dodany");
      } else {
        if (multiDates.length === 0) {
          toast.error("Zaznacz przynajmniej jedną datę");
          setLoading(false);
          return;
        }
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const date of multiDates) {
          try {
            await api.post("/surgery-slots", {
              date,
              location_id: formData.location_id,
              notes: formData.notes,
              is_full: false
            });
            successCount++;
          } catch (err) {
            errorCount++;
          }
        }
        
        if (successCount > 0) {
          toast.success(`Dodano ${successCount} terminów operacji`);
        }
        if (errorCount > 0) {
          toast.error(`Nie udało się dodać ${errorCount} terminów (mogą już istnieć)`);
        }
      }
      onSuccess();
    } catch (err) {
      toast.error(slot ? "Nie udało się zaktualizować terminu" : "Nie udało się dodać terminu");
    } finally {
      setLoading(false);
    }
  };

  const days = getDaysInMonth(calendarMonth);
  const monthName = calendarMonth.toLocaleString("pl-PL", { month: "long", year: "numeric" });
  const todayDate = new Date();
  const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

  const formatDay = (date) => {
    if (!date) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="add-slot-modal">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-slate-900">
            {slot ? "Edytuj termin operacji" : "Dodaj termin operacji"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {!slot && (
          <div className="px-6 pt-4">
            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  mode === "single" 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
                data-testid="mode-single"
              >
                Pojedynczy termin
              </button>
              <button
                type="button"
                onClick={() => setMode("multiple")}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  mode === "multiple" 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
                data-testid="mode-multiple"
              >
                Wiele terminów
              </button>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {(mode === "single" || slot) ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Data operacji *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="slot-date-input"
              />
            </div>
          ) : (
            <>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                    className="p-1.5 hover:bg-slate-200 rounded-lg"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-semibold text-slate-700 capitalize">{monthName}</span>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                    className="p-1.5 hover:bg-slate-200 rounded-lg"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="p-3">
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {WEEKDAY_NAMES.map((day) => (
                      <div key={day} className="text-center text-xs font-semibold text-slate-500 py-1">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-7 gap-1">
                    {days.map((day, i) => {
                      const isSelected = isDateSelected(day);
                      const dayStr = day ? formatDay(day) : "";
                      const isToday = dayStr === today;
                      const isPast = dayStr && dayStr < today;
                      
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleDate(day)}
                          disabled={!day || isPast}
                          className={`aspect-square p-1 rounded-lg text-sm font-medium transition-all ${
                            !day 
                              ? "" 
                              : isPast
                                ? "text-slate-300 cursor-not-allowed"
                                : isSelected
                                  ? "bg-teal-600 text-white ring-2 ring-teal-300"
                                  : isToday
                                    ? "bg-teal-100 text-teal-700 hover:bg-teal-200"
                                    : "hover:bg-slate-100 text-slate-700"
                          }`}
                          data-testid={day ? `cal-day-${dayStr}` : undefined}
                        >
                          {day?.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-sm text-slate-600">
                    Zaznaczono: <strong className="text-teal-700">{multiDates.length}</strong> dni
                  </span>
                  {multiDates.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllDates}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Wyczyść wszystko
                    </button>
                  )}
                </div>
              </div>
              
              {multiDates.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Wybrane daty
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-lg">
                    {multiDates.map((date) => (
                      <span
                        key={date}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-800 text-xs font-medium rounded-lg"
                      >
                        {date}
                        <button
                          type="button"
                          onClick={() => setMultiDates(multiDates.filter(d => d !== date))}
                          className="p-0.5 hover:bg-teal-200 rounded"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Lokalizacja</label>
            <select
              value={formData.location_id}
              onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="slot-location-select"
            >
              <option value="">Wybierz lokalizację</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Notatki</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="np. Rano, sala 2"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="slot-notes-input"
            />
          </div>
          {(mode === "single" || slot) && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_full"
                checked={formData.is_full}
                onChange={(e) => setFormData({ ...formData, is_full: e.target.checked })}
                className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                data-testid="slot-full-checkbox"
              />
              <label htmlFor="is_full" className="text-sm text-slate-700">Oznacz jako pełny (niedostępny)</label>
            </div>
          )}
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium">
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading || (mode === "multiple" && !slot && multiDates.length === 0)}
              className="flex-1 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 rounded-lg font-medium disabled:opacity-50"
              data-testid="submit-slot"
            >
              {loading ? "Zapisywanie..." : (slot ? "Zaktualizuj" : mode === "multiple" ? `Dodaj ${multiDates.length} terminów` : "Dodaj termin")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSlotModal;
