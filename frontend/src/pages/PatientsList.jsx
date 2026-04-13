import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Users, Search, Filter, Plus, ChevronRight, 
  X, Eye, Trash2, User, Sparkles, MapPin 
} from "lucide-react";
import api from "../utils/api";
import { STATUS_LABELS, getStatusColor, STATUS_OPTIONS } from "../utils/constants";
import AddPatientModal from "../components/modals/AddPatientModal";

const PatientsList = () => {
  const [patients, setPatients] = useState([]);
  const [locations, setLocations] = useState([]);
  const [procedureTypes, setProcedureTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState([]);
  const [procedureFilters, setProcedureFilters] = useState([]);
  const [locationFilter, setLocationFilter] = useState("");
  const [asapFilter, setAsapFilter] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showProcedureDropdown, setShowProcedureDropdown] = useState(false);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusChangeId, setStatusChangeId] = useState(null);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append("sort_by", sortBy);
      params.append("sort_order", sortOrder);
      
      const [patientsRes, locationsRes, settingsRes] = await Promise.all([
        api.get(`/patients?${params.toString()}`),
        api.get("/locations"),
        api.get("/settings")
      ]);
      setPatients(patientsRes.data);
      setLocations(locationsRes.data);
      setProcedureTypes(settingsRes.data?.procedure_types || []);
    } catch (err) {
      toast.error("Nie udało się załadować pacjentów");
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleStatusFilter = (status) => {
    if (statusFilters.includes(status)) {
      setStatusFilters(statusFilters.filter(s => s !== status));
    } else {
      setStatusFilters([...statusFilters, status]);
    }
  };

  const toggleProcedureFilter = (procedure) => {
    if (procedureFilters.includes(procedure)) {
      setProcedureFilters(procedureFilters.filter(p => p !== procedure));
    } else {
      setProcedureFilters([...procedureFilters, procedure]);
    }
  };

  const clearStatusFilters = () => {
    setStatusFilters([]);
  };

  const clearProcedureFilters = () => {
    setProcedureFilters([]);
  };

  const filteredPatients = patients.filter((p) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      p.first_name.toLowerCase().includes(query) ||
      p.last_name.toLowerCase().includes(query) ||
      (p.email && p.email.toLowerCase().includes(query)) ||
      (p.phone && p.phone.includes(query))
    );
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(p.status);
    const matchesProcedure = procedureFilters.length === 0 || procedureFilters.includes(p.procedure_type);
    const matchesLocation = !locationFilter || p.location_id === locationFilter;
    const matchesAsap = !asapFilter || p.asap === true;
    return matchesSearch && matchesStatus && matchesProcedure && matchesLocation && matchesAsap;
  });

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Czy na pewno chcesz usunąć tego pacjenta?")) return;
    try {
      await api.delete(`/patients/${id}`);
      toast.success("Pacjent usunięty");
      loadData();
    } catch (err) {
      toast.error("Nie udało się usunąć pacjenta");
    }
  };

  const handleStatusChange = async (patientId, newStatus, e) => {
    e.stopPropagation();
    setStatusChangeId(null);
    try {
      await api.put(`/patients/${patientId}`, { status: newStatus });
      setPatients(prev => prev.map(p => p.id === patientId ? { ...p, status: newStatus } : p));
      toast.success(`Status zmieniony na: ${STATUS_LABELS[newStatus]}`);
    } catch (err) {
      toast.error("Nie udało się zmienić statusu");
    }
  };

  return (
    <div className="p-8" data-testid="patients-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Pacjenci</h1>
          <p className="text-slate-500 mt-1">{patients.length} pacjentów łącznie</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
          data-testid="add-patient-button"
        >
          <Plus className="w-5 h-5" />
          Dodaj pacjenta
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj pacjentów..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="search-input"
            />
          </div>
          
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white flex items-center gap-2 min-w-[180px]"
              data-testid="status-filter-button"
            >
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-slate-700">
                {statusFilters.length === 0 ? "Wszystkie statusy" : `Wybrano: ${statusFilters.length}`}
              </span>
              <ChevronRight className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${showStatusDropdown ? 'rotate-90' : ''}`} />
            </button>
            
            {showStatusDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-20" data-testid="status-dropdown">
                <div className="p-2 border-b border-slate-100">
                  <button
                    onClick={clearStatusFilters}
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Wyczyść filtry
                  </button>
                </div>
                <div className="p-2 space-y-1">
                  {STATUS_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={statusFilters.includes(option.value)}
                        onChange={() => toggleStatusFilter(option.value)}
                        className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                        data-testid={`status-checkbox-${option.value}`}
                      />
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(option.value)}`}>
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Procedure Type Filter */}
          <div className="relative">
            <button
              onClick={() => { setShowProcedureDropdown(!showProcedureDropdown); setShowStatusDropdown(false); }}
              className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white flex items-center gap-2 min-w-[180px]"
              data-testid="procedure-filter-button"
            >
              <Filter className="w-4 h-4 text-blue-500" />
              <span className="text-slate-700">
                {procedureFilters.length === 0 ? "Wszystkie zabiegi" : `Zabiegi: ${procedureFilters.length}`}
              </span>
              <ChevronRight className={`w-4 h-4 text-slate-400 ml-auto transition-transform ${showProcedureDropdown ? 'rotate-90' : ''}`} />
            </button>
            
            {showProcedureDropdown && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-20" data-testid="procedure-dropdown">
                <div className="p-2 border-b border-slate-100">
                  <button
                    onClick={clearProcedureFilters}
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Wyczyść filtry
                  </button>
                </div>
                <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                  {procedureTypes.map((procedure) => (
                    <label
                      key={procedure}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={procedureFilters.includes(procedure)}
                        onChange={() => toggleProcedureFilter(procedure)}
                        className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                        data-testid={`procedure-checkbox-${procedure}`}
                      />
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {procedure}
                      </span>
                    </label>
                  ))}
                  {procedureTypes.length === 0 && (
                    <p className="text-sm text-slate-400 px-3 py-2">Brak zdefiniowanych zabiegów</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            data-testid="location-filter"
          >
            <option value="">Wszystkie lokalizacje</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>

          <button
            onClick={() => setAsapFilter(!asapFilter)}
            className={`px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              asapFilter 
                ? "bg-amber-500 text-white" 
                : "border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
            data-testid="asap-filter"
          >
            <Sparkles className="w-4 h-4" />
            Jak najszybciej
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            data-testid="sort-by"
          >
            <option value="created_at">Data dodania</option>
            <option value="surgery_date">Data operacji</option>
            <option value="preferred_date_start">Preferowana data</option>
            <option value="last_name">Nazwisko</option>
            <option value="location_id">Lokalizacja</option>
            <option value="asap">Jak najszybciej</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            data-testid="sort-order"
          >
            {sortOrder === "asc" ? "Rosnąco" : "Malejąco"}
          </button>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            {statusFilters.map((status) => (
              <span
                key={status}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(status)}`}
              >
                {STATUS_LABELS[status]}
                <button onClick={() => toggleStatusFilter(status)} className="ml-1 hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {procedureFilters.map((procedure) => (
              <span
                key={procedure}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800"
              >
                {procedure}
                <button onClick={() => toggleProcedureFilter(procedure)} className="ml-1 hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {locationFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                <MapPin className="w-3 h-3" />
                {locations.find(l => l.id === locationFilter)?.name || "Lokalizacja"}
                <button onClick={() => setLocationFilter("")} className="ml-1 hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {asapFilter && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                <Sparkles className="w-3 h-3" />
                Jak najszybciej
                <button onClick={() => setAsapFilter(false)} className="ml-1 hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {(statusFilters.length > 0 || procedureFilters.length > 0 || locationFilter || asapFilter) && (
              <button
                onClick={() => { clearStatusFilters(); clearProcedureFilters(); setLocationFilter(""); setAsapFilter(false); }}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Wyczyść wszystko
              </button>
            )}
          </div>
          <div className="text-sm font-medium text-slate-600" data-testid="results-counter">
            Wyświetlono: <span className="text-teal-700">{filteredPatients.length}</span> z {patients.length}
          </div>
        </div>
      </div>

      {(showStatusDropdown || showProcedureDropdown || statusChangeId) && (
        <div className="fixed inset-0 z-10" onClick={() => { setShowStatusDropdown(false); setShowProcedureDropdown(false); setStatusChangeId(null); }} />
      )}

      {/* Patients Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Pacjent</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Kontakt</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Preferowana data</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Data operacji</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-600">Zabieg</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-600">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPatients.map((patient) => (
                  <tr 
                    key={patient.id} 
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/patients/${patient.id}`)}
                    data-testid={`patient-row-${patient.id}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{patient.first_name} {patient.last_name}</p>
                          {patient.date_of_birth && <p className="text-sm text-slate-500">Ur.: {patient.date_of_birth}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {patient.email && <p className="text-slate-600">{patient.email}</p>}
                        {patient.phone && <p className="text-slate-500">{patient.phone}</p>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatusChangeId(statusChangeId === patient.id ? null : patient.id);
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:ring-slate-300 ${getStatusColor(patient.status)}`}
                          data-testid={`status-badge-${patient.id}`}
                          title="Kliknij aby zmienić status"
                        >
                          {STATUS_LABELS[patient.status] || patient.status}
                          <ChevronRight className={`w-3 h-3 transition-transform ${statusChangeId === patient.id ? 'rotate-90' : ''}`} />
                        </button>
                        {patient.asap && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700" title="Jak najszybciej">
                            <Sparkles className="w-3 h-3" />
                          </span>
                        )}
                        {statusChangeId === patient.id && (
                          <div
                            className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-30 py-1"
                            data-testid={`status-dropdown-${patient.id}`}
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                onClick={(e) => handleStatusChange(patient.id, option.value, e)}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                  patient.status === option.value
                                    ? "bg-slate-100 font-semibold"
                                    : "hover:bg-slate-50"
                                }`}
                                data-testid={`status-option-${patient.id}-${option.value}`}
                              >
                                <span className={`w-2 h-2 rounded-full ${
                                  option.value === 'consultation' ? 'bg-slate-500' :
                                  option.value === 'planned' ? 'bg-blue-500' :
                                  option.value === 'awaiting' ? 'bg-amber-500' :
                                  option.value === 'operated' ? 'bg-emerald-500' :
                                  'bg-red-500'
                                }`} />
                                {option.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {patient.preferred_date_start || patient.preferred_date_end ? (
                        <div className="text-sm">
                          <p className="text-slate-600">{patient.preferred_date_start || "?"}</p>
                          <p className="text-slate-400">do {patient.preferred_date_end || "?"}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {patient.surgery_date || "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {patient.procedure_type || "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/patients/${patient.id}`); }}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          data-testid={`view-${patient.id}`}
                        >
                          <Eye className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(patient.id, e)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          data-testid={`delete-${patient.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredPatients.length === 0 && (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Nie znaleziono pacjentów</p>
            </div>
          )}
        </div>
      )}

      {showAddModal && <AddPatientModal onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); loadData(); }} />}
    </div>
  );
};

export default PatientsList;
