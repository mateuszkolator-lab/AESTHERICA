import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, X, Calendar, MapPin } from "lucide-react";
import api from "../utils/api";
import { STATUS_LABELS, getStatusColor } from "../utils/constants";

const GlobalSearch = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
        setResults([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Search patients
  const searchPatients = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get("/patients");
      const q = searchQuery.toLowerCase();
      const filtered = res.data.filter((p) =>
        p.first_name?.toLowerCase().includes(q) ||
        p.last_name?.toLowerCase().includes(q) ||
        p.phone?.includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.procedure_type?.toLowerCase().includes(q)
      ).slice(0, 8);
      setResults(filtered);
      setSelectedIndex(0);
    } catch (err) {
      // Search failed silently
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchPatients(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, searchPatients]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      goToPatient(results[selectedIndex].id);
    }
  };

  const goToPatient = (id) => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    navigate(`/patients/${id}`);
  };

  const close = () => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        data-testid="global-search-trigger"
      >
        <Search className="w-4 h-4" />
        <span className="hidden md:inline">Szukaj pacjenta...</span>
        <kbd className="hidden md:inline px-1.5 py-0.5 text-xs font-mono bg-slate-200 rounded">Ctrl+K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={close}>
      <div className="fixed inset-0 bg-black/50" />
      
      <div 
        className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Szukaj pacjenta po imieniu, nazwisku, telefonie..."
            className="flex-1 px-3 py-4 text-lg outline-none placeholder:text-slate-400"
            data-testid="global-search-input"
          />
          <button onClick={close} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {loading && (
            <div className="p-8 text-center text-slate-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mx-auto" />
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              Nie znaleziono pacjentów dla "{query}"
            </div>
          )}

          {!loading && results.length > 0 && (
            <ul className="py-2">
              {results.map((patient, index) => (
                <li key={patient.id}>
                  <button
                    onClick={() => goToPatient(patient.id)}
                    className={`w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                      index === selectedIndex ? "bg-teal-50" : ""
                    }`}
                    data-testid={`search-result-${patient.id}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {patient.first_name} {patient.last_name}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(patient.status)}`}>
                          {STATUS_LABELS[patient.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                        {patient.procedure_type && (
                          <span>{patient.procedure_type}</span>
                        )}
                        {patient.surgery_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {patient.surgery_date}
                          </span>
                        )}
                        {patient.phone && (
                          <span>{patient.phone}</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!query && (
            <div className="p-8 text-center text-slate-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Wpisz imie, nazwisko, telefon lub typ zabiegu</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-4">
          <span><kbd className="px-1 py-0.5 bg-slate-200 rounded">↑↓</kbd> nawigacja</span>
          <span><kbd className="px-1 py-0.5 bg-slate-200 rounded">Enter</kbd> wybierz</span>
          <span><kbd className="px-1 py-0.5 bg-slate-200 rounded">Esc</kbd> zamknij</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
