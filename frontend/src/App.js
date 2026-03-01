import { useState, useEffect, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { 
  Users, Calendar, BarChart3, Settings, LogOut, Plus, Search, Filter, 
  ChevronLeft, ChevronRight, Edit, Trash2, Eye, Upload, X, Download,
  Clock, CheckCircle2, AlertCircle, User, Phone, Mail, MapPin, DollarSign,
  Camera, ArrowLeftRight, Menu, Home
} from "lucide-react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

const useAuth = () => useContext(AuthContext);

// API helper with auth
const api = {
  get: (url, config = {}) => {
    const token = localStorage.getItem("token");
    return axios.get(`${API}${url}`, {
      ...config,
      headers: { ...config.headers, Authorization: `Bearer ${token}` }
    });
  },
  post: (url, data, config = {}) => {
    const token = localStorage.getItem("token");
    return axios.post(`${API}${url}`, data, {
      ...config,
      headers: { ...config.headers, Authorization: `Bearer ${token}` }
    });
  },
  put: (url, data, config = {}) => {
    const token = localStorage.getItem("token");
    return axios.put(`${API}${url}`, data, {
      ...config,
      headers: { ...config.headers, Authorization: `Bearer ${token}` }
    });
  },
  delete: (url, config = {}) => {
    const token = localStorage.getItem("token");
    return axios.delete(`${API}${url}`, {
      ...config,
      headers: { ...config.headers, Authorization: `Bearer ${token}` }
    });
  }
};

// Polish translations
const STATUS_LABELS = {
  consultation: "Konsultacja",
  planned: "Zaplanowany",
  awaiting: "Oczekujący",
  operated: "Zoperowany"
};

const VISIT_TYPE_LABELS = {
  consultation: "Konsultacja",
  surgery: "Operacja",
  follow_up: "Wizyta kontrolna"
};

const PHOTO_CATEGORY_LABELS = {
  before: "Przed",
  after: "Po",
  during: "W trakcie",
  other: "Inne"
};

// ==================== LOGIN PAGE ====================
const LoginPage = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login`, { password });
      login(res.data.token);
      toast.success("Witaj ponownie!");
      navigate("/");
    } catch (err) {
      toast.error("Nieprawidłowe hasło");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img 
          src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?crop=entropy&cs=srgb&fm=jpg&q=85" 
          alt="Klinika" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-teal-700/80 to-teal-900/90" />
        <div className="relative z-10 flex flex-col justify-center p-16 text-white">
          <h1 className="text-5xl font-semibold tracking-tight mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
            AestheticaMD
          </h1>
          <p className="text-xl text-teal-100 max-w-md">
            Profesjonalne zarządzanie pacjentami w chirurgii plastycznej twarzy
          </p>
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <h1 className="text-3xl font-semibold text-teal-700 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              AestheticaMD
            </h1>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Witaj ponownie
            </h2>
            <p className="text-slate-500 mb-8">Wprowadź hasło, aby kontynuować</p>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Hasło</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  placeholder="Wprowadź hasło"
                  data-testid="password-input"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
                data-testid="login-button"
              >
                {loading ? "Logowanie..." : "Zaloguj się"}
              </button>
            </form>
          </div>
          
          <p className="text-center text-sm text-slate-400 mt-6">
            Domyślne hasło: doctor2024
          </p>
        </div>
      </div>
    </div>
  );
};

// ==================== SIDEBAR ====================
const Sidebar = ({ currentPath }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { path: "/", icon: Home, label: "Pulpit" },
    { path: "/patients", icon: Users, label: "Pacjenci" },
    { path: "/calendar", icon: Calendar, label: "Kalendarz" },
    { path: "/stats", icon: BarChart3, label: "Statystyki" },
    { path: "/settings", icon: Settings, label: "Ustawienia" },
  ];

  return (
    <aside className={`bg-white border-r border-slate-200 h-screen sticky top-0 flex flex-col transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        {!collapsed && (
          <h1 className="text-xl font-semibold text-teal-700 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            AestheticaMD
          </h1>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)} 
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          data-testid="sidebar-toggle"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <button
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  currentPath === item.path 
                    ? 'bg-teal-50 text-teal-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5" />
                {!collapsed && <span className="font-medium">{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={() => { logout(); navigate("/login"); }}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
          data-testid="logout-button"
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="font-medium">Wyloguj</span>}
        </button>
      </div>
    </aside>
  );
};

// ==================== DASHBOARD ====================
const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await api.get("/dashboard");
      setData(res.data);
    } catch (err) {
      toast.error("Nie udało się załadować pulpitu");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      consultation: "bg-slate-100 text-slate-800",
      planned: "bg-blue-100 text-blue-800",
      awaiting: "bg-amber-100 text-amber-800",
      operated: "bg-emerald-100 text-emerald-800"
    };
    return colors[status] || colors.consultation;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;

  return (
    <div className="p-8" data-testid="dashboard-page">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Pulpit</h1>
        <p className="text-slate-500 mt-1">Witaj ponownie! Oto przegląd Twojej praktyki.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Wszyscy pacjenci", value: data?.stats?.total || 0, icon: Users, color: "teal" },
          { label: "Zoperowani", value: data?.stats?.operated || 0, icon: CheckCircle2, color: "emerald" },
          { label: "Zaplanowani", value: data?.stats?.planned || 0, icon: Calendar, color: "blue" },
          { label: "Oczekujący", value: data?.stats?.awaiting || 0, icon: Clock, color: "amber" },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-all" data-testid={`stat-${stat.label.toLowerCase().replace(' ', '-')}`}>
            <div className={`w-10 h-10 rounded-lg bg-${stat.color}-100 flex items-center justify-center mb-4`}>
              <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
            </div>
            <p className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>{stat.value}</p>
            <p className="text-sm text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Surgeries */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Nadchodzące operacje</h2>
            <button onClick={() => navigate("/calendar")} className="text-sm text-teal-600 hover:text-teal-700 font-medium">Zobacz wszystkie</button>
          </div>
          <div className="p-6">
            {data?.upcoming_surgeries?.length > 0 ? (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {data.upcoming_surgeries.map((patient) => (
                  <div 
                    key={patient.id} 
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                    onClick={() => navigate(`/patients/${patient.id}`)}
                    data-testid={`upcoming-${patient.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-teal-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{patient.first_name} {patient.last_name}</p>
                        <p className="text-sm text-slate-500">{patient.procedure_type || "Zabieg do ustalenia"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-slate-900">{patient.surgery_date}</p>
                      <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(patient.status)}`}>
                        {STATUS_LABELS[patient.status] || patient.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">Brak nadchodzących operacji</p>
            )}
          </div>
        </div>

        {/* Recent Patients */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Ostatni pacjenci</h2>
            <button onClick={() => navigate("/patients")} className="text-sm text-teal-600 hover:text-teal-700 font-medium">Zobacz wszystkich</button>
          </div>
          <div className="p-6">
            {data?.recent_patients?.length > 0 ? (
              <div className="space-y-3">
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
                      <p className="font-medium text-slate-900 truncate">{patient.first_name} {patient.last_name}</p>
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
      </div>
    </div>
  );
};

// ==================== PATIENTS LIST ====================
const PatientsList = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState([]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showAddModal, setShowAddModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadPatients();
  }, [sortBy, sortOrder]);

  const loadPatients = async () => {
    try {
      const params = new URLSearchParams();
      params.append("sort_by", sortBy);
      params.append("sort_order", sortOrder);
      
      const res = await api.get(`/patients?${params.toString()}`);
      setPatients(res.data);
    } catch (err) {
      toast.error("Nie udało się załadować pacjentów");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatusFilter = (status) => {
    if (statusFilters.includes(status)) {
      setStatusFilters(statusFilters.filter(s => s !== status));
    } else {
      setStatusFilters([...statusFilters, status]);
    }
  };

  const clearStatusFilters = () => {
    setStatusFilters([]);
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
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    const colors = {
      consultation: "bg-slate-100 text-slate-800",
      planned: "bg-blue-100 text-blue-800",
      awaiting: "bg-amber-100 text-amber-800",
      operated: "bg-emerald-100 text-emerald-800"
    };
    return colors[status] || colors.consultation;
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Czy na pewno chcesz usunąć tego pacjenta?")) return;
    try {
      await api.delete(`/patients/${id}`);
      toast.success("Pacjent usunięty");
      loadPatients();
    } catch (err) {
      toast.error("Nie udało się usunąć pacjenta");
    }
  };

  const statusOptions = [
    { value: "consultation", label: "Konsultacja" },
    { value: "planned", label: "Zaplanowany" },
    { value: "awaiting", label: "Oczekujący" },
    { value: "operated", label: "Zoperowany" }
  ];

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
          
          {/* Multi-select Status Filter */}
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
                  {statusOptions.map((option) => (
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
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            data-testid="sort-order"
          >
            {sortOrder === "asc" ? "↑ Rosnąco" : "↓ Malejąco"}
          </button>
        </div>

        {/* Active filters and counter */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            {statusFilters.map((status) => (
              <span
                key={status}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(status)}`}
              >
                {STATUS_LABELS[status]}
                <button
                  onClick={() => toggleStatusFilter(status)}
                  className="ml-1 hover:opacity-70"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {statusFilters.length > 0 && (
              <button
                onClick={clearStatusFilters}
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

      {/* Click outside to close dropdown */}
      {showStatusDropdown && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => setShowStatusDropdown(false)}
        />
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
                      <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(patient.status)}`}>
                        {STATUS_LABELS[patient.status] || patient.status}
                      </span>
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

      {showAddModal && <AddPatientModal onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); loadPatients(); }} />}
    </div>
  );
};

// ==================== ADD PATIENT MODAL ====================
const AddPatientModal = ({ onClose, onSuccess, initialData = null }) => {
  const [formData, setFormData] = useState(initialData || {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    gender: "",
    status: "consultation",
    procedure_type: "",
    preferred_date_start: "",
    preferred_date_end: "",
    surgery_date: "",
    location_id: "",
    price: "",
    notes: ""
  });
  const [locations, setLocations] = useState([]);
  const [procedureTypes, setProcedureTypes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [locRes, ptRes] = await Promise.all([
        api.get("/locations"),
        api.get("/procedure-types")
      ]);
      setLocations(locRes.data);
      setProcedureTypes(ptRes.data);
    } catch (err) {
      console.error("Nie udało się załadować danych");
    }
  };

  const handleProcedureTypeChange = (value) => {
    setFormData({ ...formData, procedure_type: value });
    // Auto-fill price if procedure type has default price
    const pt = procedureTypes.find(p => p.name === value);
    if (pt?.default_price && !formData.price) {
      setFormData(prev => ({ ...prev, procedure_type: value, price: pt.default_price.toString() }));
    }
  };

  const handleSurgeryDateChange = (value) => {
    // Auto-set status to "planned" when surgery date is set
    const newStatus = value && formData.status === "consultation" ? "planned" : formData.status;
    setFormData({ ...formData, surgery_date: value, status: value ? (formData.status === "consultation" || formData.status === "awaiting" ? "planned" : formData.status) : formData.status });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = { ...formData };
      if (data.price) data.price = parseFloat(data.price);
      else delete data.price;
      
      if (initialData) {
        await api.put(`/patients/${initialData.id}`, data);
        toast.success("Pacjent zaktualizowany");
      } else {
        await api.post("/patients", data);
        toast.success("Pacjent dodany");
      }
      onSuccess();
    } catch (err) {
      toast.error(initialData ? "Nie udało się zaktualizować pacjenta" : "Nie udało się dodać pacjenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="add-patient-modal">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {initialData ? "Edytuj pacjenta" : "Dodaj nowego pacjenta"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="close-modal">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Imię *</label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="first-name-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nazwisko *</label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="last-name-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="email-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Telefon</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="phone-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Data urodzenia</label>
              <input
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="dob-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Płeć</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="gender-select"
              >
                <option value="">Wybierz</option>
                <option value="female">Kobieta</option>
                <option value="male">Mężczyzna</option>
                <option value="other">Inna</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="status-select"
              >
                <option value="consultation">Konsultacja (Niezdecydowany)</option>
                <option value="planned">Zaplanowany</option>
                <option value="awaiting">Oczekujący na termin</option>
                <option value="operated">Zoperowany</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Rodzaj zabiegu</label>
              <select
                value={formData.procedure_type}
                onChange={(e) => handleProcedureTypeChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="procedure-select"
              >
                <option value="">Wybierz zabieg</option>
                {procedureTypes.map((pt) => (
                  <option key={pt.id} value={pt.name}>{pt.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Preferowany zakres dat</label>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="date"
                value={formData.preferred_date_start}
                onChange={(e) => setFormData({ ...formData, preferred_date_start: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="preferred-start-input"
              />
              <input
                type="date"
                value={formData.preferred_date_end}
                onChange={(e) => setFormData({ ...formData, preferred_date_end: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="preferred-end-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Data operacji</label>
              <input
                type="date"
                value={formData.surgery_date}
                onChange={(e) => handleSurgeryDateChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="surgery-date-input"
              />
              {formData.surgery_date && (formData.status === "consultation" || formData.status === "awaiting") && (
                <p className="text-xs text-teal-600 mt-1">Status zostanie automatycznie zmieniony na "Zaplanowany"</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Lokalizacja</label>
              <select
                value={formData.location_id}
                onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                data-testid="location-select"
              >
                <option value="">Wybierz lokalizację</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Cena (PLN)</label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="price-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Notatki</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="notes-input"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
              data-testid="submit-patient"
            >
              {loading ? "Zapisywanie..." : (initialData ? "Zaktualizuj" : "Dodaj pacjenta")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==================== PATIENT DETAIL ====================
const PatientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddVisit, setShowAddVisit] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);

  useEffect(() => {
    loadPatient();
    loadLocations();
  }, [id]);

  const loadPatient = async () => {
    try {
      const res = await api.get(`/patients/${id}`);
      setPatient(res.data);
    } catch (err) {
      toast.error("Nie udało się załadować pacjenta");
      navigate("/patients");
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    try {
      const res = await api.get("/locations");
      setLocations(res.data);
    } catch (err) {
      console.error("Nie udało się załadować lokalizacji");
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      consultation: "bg-slate-100 text-slate-800",
      planned: "bg-blue-100 text-blue-800",
      awaiting: "bg-amber-100 text-amber-800",
      operated: "bg-emerald-100 text-emerald-800"
    };
    return colors[status] || colors.consultation;
  };

  const getLocationName = (locationId) => {
    const loc = locations.find((l) => l.id === locationId);
    return loc ? loc.name : "-";
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;
  if (!patient) return null;

  const allPhotos = patient.visits?.flatMap((v) => v.photos.map((p) => ({ ...p, visitDate: v.date, visitType: v.type }))) || [];

  return (
    <div className="flex flex-col md:flex-row min-h-screen" data-testid="patient-detail-page">
      {/* Left Sidebar - Patient Info */}
      <div className="w-full md:w-1/3 bg-white border-r border-slate-200 p-6 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
        <button
          onClick={() => navigate("/patients")}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
          data-testid="back-button"
        >
          <ChevronLeft className="w-4 h-4" />
          Powrót do pacjentów
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center">
            <User className="w-8 h-8 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {patient.first_name} {patient.last_name}
            </h1>
            <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(patient.status)}`}>
              {STATUS_LABELS[patient.status] || patient.status}
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowEditModal(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium transition-colors mb-6"
          data-testid="edit-patient-button"
        >
          <Edit className="w-4 h-4" />
          Edytuj pacjenta
        </button>

        <div className="space-y-4">
          {patient.email && (
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-slate-400" />
              <span className="text-slate-600">{patient.email}</span>
            </div>
          )}
          {patient.phone && (
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-slate-400" />
              <span className="text-slate-600">{patient.phone}</span>
            </div>
          )}
          {patient.location_id && (
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-slate-400" />
              <span className="text-slate-600">{getLocationName(patient.location_id)}</span>
            </div>
          )}
          {patient.price && (
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-slate-400" />
              <span className="text-slate-600">{patient.price.toLocaleString('pl-PL')} PLN</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 mt-6 pt-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Szczegóły zabiegu</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-500">Rodzaj zabiegu</p>
              <p className="font-medium text-slate-900">{patient.procedure_type || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Data operacji</p>
              <p className="font-medium text-slate-900">{patient.surgery_date || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Preferowany zakres dat</p>
              <p className="font-medium text-slate-900">
                {patient.preferred_date_start && patient.preferred_date_end 
                  ? `${patient.preferred_date_start} do ${patient.preferred_date_end}`
                  : "-"}
              </p>
            </div>
          </div>
        </div>

        {patient.notes && (
          <div className="border-t border-slate-100 mt-6 pt-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Notatki</h3>
            <p className="text-slate-600 whitespace-pre-wrap">{patient.notes}</p>
          </div>
        )}
      </div>

      {/* Right Panel - Visits & Photos */}
      <div className="flex-1 bg-slate-50 p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Wizyty i zdjęcia</h2>
          <div className="flex gap-3">
            {allPhotos.length >= 2 && (
              <button
                onClick={() => setShowCompare(true)}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-white font-medium transition-colors"
                data-testid="compare-photos-button"
              >
                <ArrowLeftRight className="w-4 h-4" />
                Porównaj
              </button>
            )}
            <button
              onClick={() => setShowAddVisit(true)}
              className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              data-testid="add-visit-button"
            >
              <Plus className="w-4 h-4" />
              Dodaj wizytę
            </button>
          </div>
        </div>

        {patient.visits?.length > 0 ? (
          <div className="space-y-6">
            {patient.visits.sort((a, b) => new Date(b.date) - new Date(a.date)).map((visit) => (
              <VisitCard 
                key={visit.id} 
                visit={visit} 
                patientId={patient.id}
                onUpdate={loadPatient}
                onSelectVisit={() => setSelectedVisit(visit)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Camera className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Brak zarejestrowanych wizyt</p>
            <button
              onClick={() => setShowAddVisit(true)}
              className="mt-4 text-teal-600 hover:text-teal-700 font-medium"
            >
              Dodaj pierwszą wizytę
            </button>
          </div>
        )}
      </div>

      {showEditModal && (
        <AddPatientModal 
          initialData={patient}
          onClose={() => setShowEditModal(false)} 
          onSuccess={() => { setShowEditModal(false); loadPatient(); }} 
        />
      )}

      {showAddVisit && (
        <AddVisitModal
          patientId={patient.id}
          onClose={() => setShowAddVisit(false)}
          onSuccess={() => { setShowAddVisit(false); loadPatient(); }}
        />
      )}

      {showCompare && (
        <PhotoCompareModal
          photos={allPhotos}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
};

// ==================== VISIT CARD ====================
const VisitCard = ({ visit, patientId, onUpdate }) => {
  const [showUpload, setShowUpload] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState(null);

  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm("Usunąć to zdjęcie?")) return;
    try {
      await api.delete(`/patients/${patientId}/visits/${visit.id}/photos/${photoId}`);
      toast.success("Zdjęcie usunięte");
      onUpdate();
    } catch (err) {
      toast.error("Nie udało się usunąć zdjęcia");
    }
  };

  const handleDeleteVisit = async () => {
    if (!window.confirm("Usunąć tę wizytę i wszystkie jej zdjęcia?")) return;
    try {
      await api.delete(`/patients/${patientId}/visits/${visit.id}`);
      toast.success("Wizyta usunięta");
      onUpdate();
    } catch (err) {
      toast.error("Nie udało się usunąć wizyty");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200" data-testid={`visit-${visit.id}`}>
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-900">{visit.date}</span>
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
              {VISIT_TYPE_LABELS[visit.type] || visit.type}
            </span>
          </div>
          {visit.notes && <p className="text-sm text-slate-500 mt-1">{visit.notes}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUpload(true)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            data-testid={`upload-photo-${visit.id}`}
          >
            <Upload className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={handleDeleteVisit}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
            data-testid={`delete-visit-${visit.id}`}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>
      
      <div className="p-6">
        {visit.photos?.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {visit.photos.map((photo) => (
              <div key={photo.id} className="relative group">
                <img
                  src={photo.data}
                  alt={photo.caption || "Zdjęcie pacjenta"}
                  className="w-full h-32 object-cover rounded-lg cursor-pointer"
                  onClick={() => setExpandedPhoto(photo)}
                  data-testid={`photo-${photo.id}`}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <button
                    onClick={() => setExpandedPhoto(photo)}
                    className="p-2 bg-white rounded-lg"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePhoto(photo.id)}
                    className="p-2 bg-white rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
                {photo.category && (
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded">
                    {PHOTO_CATEGORY_LABELS[photo.category] || photo.category}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-center py-4">Brak zdjęć dla tej wizyty</p>
        )}
      </div>

      {showUpload && (
        <PhotoUploadModal
          patientId={patientId}
          visitId={visit.id}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); onUpdate(); }}
        />
      )}

      {expandedPhoto && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setExpandedPhoto(null)}>
          <button className="absolute top-4 right-4 text-white" onClick={() => setExpandedPhoto(null)}>
            <X className="w-8 h-8" />
          </button>
          <img
            src={expandedPhoto.data}
            alt={expandedPhoto.caption || "Zdjęcie pacjenta"}
            className="max-w-full max-h-[90vh] object-contain"
          />
        </div>
      )}
    </div>
  );
};

// ==================== ADD VISIT MODAL ====================
const AddVisitModal = ({ patientId, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "consultation",
    notes: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/patients/${patientId}/visits`, formData);
      toast.success("Wizyta dodana");
      onSuccess();
    } catch (err) {
      toast.error("Nie udało się dodać wizyty");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="add-visit-modal">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-900">Dodaj wizytę</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Data</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="visit-date-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Typ</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="visit-type-select"
            >
              <option value="consultation">Konsultacja</option>
              <option value="surgery">Operacja</option>
              <option value="follow_up">Wizyta kontrolna</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Notatki</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="visit-notes-input"
            />
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium">
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 rounded-lg font-medium disabled:opacity-50"
              data-testid="submit-visit"
            >
              {loading ? "Dodawanie..." : "Dodaj wizytę"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==================== PHOTO UPLOAD MODAL ====================
const PhotoUploadModal = ({ patientId, visitId, onClose, onSuccess }) => {
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState("before");
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles([...files, ...newFiles]);
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);

    try {
      for (const file of files) {
        const base64 = await fileToBase64(file);
        await api.post(`/patients/${patientId}/visits/${visitId}/photos`, {
          data: base64,
          filename: file.name,
          category: category
        });
      }
      toast.success(`Przesłano ${files.length} zdjęć`);
      onSuccess();
    } catch (err) {
      toast.error("Nie udało się przesłać zdjęć");
    } finally {
      setUploading(false);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="photo-upload-modal">
      <div className="bg-white rounded-xl max-w-lg w-full">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-900">Prześlij zdjęcia</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Kategoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="photo-category-select"
            >
              <option value="before">Przed</option>
              <option value="after">Po</option>
              <option value="during">W trakcie zabiegu</option>
              <option value="other">Inne</option>
            </select>
          </div>

          <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="photo-input"
              data-testid="photo-file-input"
            />
            <label htmlFor="photo-input" className="cursor-pointer">
              <Camera className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">Kliknij, aby wybrać zdjęcia</p>
              <p className="text-sm text-slate-400 mt-1">lub przeciągnij i upuść</p>
            </label>
          </div>

          {files.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {files.map((file, i) => (
                <div key={i} className="relative">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-20 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium">
              Anuluj
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="flex-1 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 rounded-lg font-medium disabled:opacity-50"
              data-testid="upload-photos-button"
            >
              {uploading ? "Przesyłanie..." : `Prześlij ${files.length} zdjęć`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== PHOTO COMPARE MODAL ====================
const PhotoCompareModal = ({ photos, onClose }) => {
  const [leftPhoto, setLeftPhoto] = useState(photos[0]);
  const [rightPhoto, setRightPhoto] = useState(photos[photos.length > 1 ? 1 : 0]);

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-50" data-testid="photo-compare-modal">
      <div className="p-4 flex justify-between items-center border-b border-white/10">
        <h2 className="text-xl font-semibold text-white">Porównanie Przed i Po</h2>
        <button onClick={onClose} className="text-white p-2 hover:bg-white/10 rounded-lg">
          <X className="w-6 h-6" />
        </button>
      </div>
      
      <div className="flex-1 flex flex-col md:flex-row p-4 gap-4">
        <div className="flex-1 flex flex-col">
          <div className="mb-4">
            <select
              value={photos.findIndex(p => p.id === leftPhoto?.id)}
              onChange={(e) => setLeftPhoto(photos[parseInt(e.target.value)])}
              className="w-full px-4 py-2 bg-white/10 text-white border border-white/20 rounded-lg"
              data-testid="left-photo-select"
            >
              {photos.map((photo, i) => (
                <option key={photo.id} value={i} className="text-black">
                  {photo.visitDate} - {PHOTO_CATEGORY_LABELS[photo.category] || "Zdjęcie"} {i + 1}
                </option>
              ))}
            </select>
          </div>
          {leftPhoto && (
            <div className="flex-1 flex items-center justify-center">
              <img src={leftPhoto.data} alt="Porównanie lewe" className="max-w-full max-h-[60vh] object-contain rounded-lg" />
            </div>
          )}
        </div>
        
        <div className="hidden md:flex items-center">
          <div className="w-px h-full bg-white/20" />
        </div>
        
        <div className="flex-1 flex flex-col">
          <div className="mb-4">
            <select
              value={photos.findIndex(p => p.id === rightPhoto?.id)}
              onChange={(e) => setRightPhoto(photos[parseInt(e.target.value)])}
              className="w-full px-4 py-2 bg-white/10 text-white border border-white/20 rounded-lg"
              data-testid="right-photo-select"
            >
              {photos.map((photo, i) => (
                <option key={photo.id} value={i} className="text-black">
                  {photo.visitDate} - {PHOTO_CATEGORY_LABELS[photo.category] || "Zdjęcie"} {i + 1}
                </option>
              ))}
            </select>
          </div>
          {rightPhoto && (
            <div className="flex-1 flex items-center justify-center">
              <img src={rightPhoto.data} alt="Porównanie prawe" className="max-w-full max-h-[60vh] object-contain rounded-lg" />
            </div>
          )}
        </div>
      </div>

      {leftPhoto && rightPhoto && (
        <div className="p-4 border-t border-white/10">
          <p className="text-white text-center mb-4">Porównanie suwakiem</p>
          <div className="max-w-4xl mx-auto h-[300px]">
            <ReactCompareSlider
              itemOne={<ReactCompareSliderImage src={leftPhoto.data} alt="Przed" />}
              itemTwo={<ReactCompareSliderImage src={rightPhoto.data} alt="Po" />}
              style={{ height: "100%" }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== CALENDAR PAGE ====================
const CalendarPage = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const res = await api.get("/patients");
      setPatients(res.data.filter(p => p.surgery_date));
    } catch (err) {
      toast.error("Nie udało się załadować kalendarza");
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getPatientsByDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split("T")[0];
    return patients.filter(p => p.surgery_date === dateStr);
  };

  const getStatusColor = (status) => {
    const colors = {
      planned: "bg-blue-500",
      awaiting: "bg-amber-500",
      operated: "bg-emerald-500"
    };
    return colors[status] || "bg-slate-500";
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleString("pl-PL", { month: "long", year: "numeric" });

  const dayNames = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;

  return (
    <div className="p-8" data-testid="calendar-page">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Kalendarz operacji</h1>
        <p className="text-slate-500 mt-1">Przeglądaj i zarządzaj zaplanowanymi operacjami</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}
            className="p-2 hover:bg-slate-100 rounded-lg"
            data-testid="prev-month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-semibold text-slate-900 capitalize">{monthName}</h2>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}
            className="p-2 hover:bg-slate-100 rounded-lg"
            data-testid="next-month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-sm font-semibold text-slate-500 py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {days.map((day, i) => {
              const dayPatients = getPatientsByDate(day);
              const isToday = day && day.toDateString() === new Date().toDateString();
              
              return (
                <div
                  key={i}
                  className={`min-h-[100px] p-2 rounded-lg border ${
                    day ? "border-slate-100 hover:border-slate-200" : "border-transparent"
                  } ${isToday ? "bg-teal-50 border-teal-200" : ""}`}
                >
                  {day && (
                    <>
                      <p className={`text-sm font-medium ${isToday ? "text-teal-700" : "text-slate-600"}`}>
                        {day.getDate()}
                      </p>
                      <div className="mt-1 space-y-1">
                        {dayPatients.slice(0, 3).map((patient) => (
                          <div
                            key={patient.id}
                            onClick={() => navigate(`/patients/${patient.id}`)}
                            className={`px-2 py-1 rounded text-xs text-white cursor-pointer truncate ${getStatusColor(patient.status)}`}
                            data-testid={`calendar-event-${patient.id}`}
                          >
                            {patient.first_name} {patient.last_name[0]}.
                          </div>
                        ))}
                        {dayPatients.length > 3 && (
                          <p className="text-xs text-slate-500">+{dayPatients.length - 3} więcej</p>
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

      {/* Google Calendar Status */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Integracja z Kalendarzem Google</p>
            <p className="text-sm text-amber-700 mt-1">
              Synchronizacja z Kalendarzem Google nie jest jeszcze skonfigurowana. Dodaj dane API Google w Ustawieniach, aby włączyć automatyczną synchronizację.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== STATISTICS PAGE ====================
const StatsPage = () => {
  const [stats, setStats] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [year]);

  const loadStats = async () => {
    try {
      const res = await api.get(`/stats?year=${year}`);
      setStats(res.data);
    } catch (err) {
      toast.error("Nie udało się załadować statystyk");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API}/export/patients?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pacjenci_${year}.xlsx`;
      a.click();
      toast.success("Eksport pobrany");
    } catch (err) {
      toast.error("Nie udało się wyeksportować");
    }
  };

  const months = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" /></div>;

  const procedureData = months.map((month, i) => {
    const monthNum = String(i + 1).padStart(2, "0");
    const found = stats?.procedures_by_month?.find((p) => p.month === monthNum);
    return { month, count: found?.count || 0 };
  });

  const revenueData = months.map((month, i) => {
    const monthNum = String(i + 1).padStart(2, "0");
    const found = stats?.revenue_by_month?.find((p) => p.month === monthNum);
    return { month, revenue: found?.revenue || 0 };
  });

  return (
    <div className="p-8" data-testid="statistics-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>Statystyki</h1>
          <p className="text-slate-500 mt-1">Przegląd wyników praktyki</p>
        </div>
        <div className="flex gap-3">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            data-testid="year-select"
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium transition-colors"
            data-testid="export-button"
          >
            <Download className="w-4 h-4" />
            Eksport Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Wszyscy pacjenci</p>
          <p className="text-3xl font-semibold text-slate-900 mt-2">{stats?.total_patients || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Zoperowani</p>
          <p className="text-3xl font-semibold text-emerald-600 mt-2">{stats?.by_status?.operated || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Zaplanowani</p>
          <p className="text-3xl font-semibold text-blue-600 mt-2">{stats?.by_status?.planned || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-500">Oczekujący</p>
          <p className="text-3xl font-semibold text-amber-600 mt-2">{stats?.by_status?.awaiting || 0}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Zabiegi wg miesiąca</h3>
          <div className="h-64 flex items-end gap-2">
            {procedureData.map((item, i) => {
              const maxCount = Math.max(...procedureData.map(d => d.count), 1);
              const height = (item.count / maxCount) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-teal-500 rounded-t"
                    style={{ height: `${height}%`, minHeight: item.count > 0 ? "8px" : "0" }}
                  />
                  <p className="text-xs text-slate-500 mt-2">{item.month}</p>
                  <p className="text-xs font-medium text-slate-700">{item.count}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Przychód wg miesiąca</h3>
          <div className="h-64 flex items-end gap-2">
            {revenueData.map((item, i) => {
              const maxRevenue = Math.max(...revenueData.map(d => d.revenue), 1);
              const height = (item.revenue / maxRevenue) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-emerald-500 rounded-t"
                    style={{ height: `${height}%`, minHeight: item.revenue > 0 ? "8px" : "0" }}
                  />
                  <p className="text-xs text-slate-500 mt-2">{item.month}</p>
                  <p className="text-xs font-medium text-slate-700">{(item.revenue / 1000).toFixed(0)}k</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Procedures by Location */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Zabiegi wg lokalizacji</h3>
        {stats?.procedures_by_location?.length > 0 ? (
          <div className="space-y-4">
            {stats.procedures_by_location.map((item, i) => {
              const maxCount = Math.max(...stats.procedures_by_location.map(l => l.count), 1);
              const width = (item.count / maxCount) * 100;
              return (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-700">{item.location}</span>
                    <span className="font-medium text-slate-900">{item.count} zabiegów</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3">
                    <div className="bg-teal-500 h-3 rounded-full" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">Brak danych. Dodaj lokalizacje i wykonaj zabiegi, aby zobaczyć statystyki.</p>
        )}
      </div>
    </div>
  );
};

// ==================== SETTINGS PAGE ====================
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

// ==================== LOCATION MODAL ====================
const LocationModal = ({ location, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: location?.name || "",
    address: location?.address || ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (location) {
        await api.put(`/locations/${location.id}`, formData);
        toast.success("Lokalizacja zaktualizowana");
      } else {
        await api.post("/locations", formData);
        toast.success("Lokalizacja dodana");
      }
      onSuccess();
    } catch (err) {
      toast.error(location ? "Nie udało się zaktualizować lokalizacji" : "Nie udało się dodać lokalizacji");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="location-modal">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-900">{location ? "Edytuj lokalizację" : "Dodaj lokalizację"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nazwa *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="np. Klinika Główna"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="location-name-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Adres</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="ul. Medyczna 123"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="location-address-input"
            />
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium">
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 rounded-lg font-medium disabled:opacity-50"
              data-testid="submit-location"
            >
              {loading ? "Zapisywanie..." : (location ? "Zaktualizuj" : "Dodaj")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==================== PROCEDURE TYPE MODAL ====================
const ProcedureTypeModal = ({ procedureType, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: procedureType?.name || "",
    description: procedureType?.description || "",
    default_price: procedureType?.default_price?.toString() || ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = { ...formData };
      if (data.default_price) data.default_price = parseFloat(data.default_price);
      else delete data.default_price;

      if (procedureType) {
        await api.put(`/procedure-types/${procedureType.id}`, data);
        toast.success("Rodzaj zabiegu zaktualizowany");
      } else {
        await api.post("/procedure-types", data);
        toast.success("Rodzaj zabiegu dodany");
      }
      onSuccess();
    } catch (err) {
      toast.error(procedureType ? "Nie udało się zaktualizować" : "Nie udało się dodać");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="procedure-type-modal">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-900">{procedureType ? "Edytuj rodzaj zabiegu" : "Dodaj rodzaj zabiegu"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nazwa zabiegu *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="np. Rinoplastyka"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="procedure-name-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Opis</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Krótki opis zabiegu"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="procedure-description-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Domyślna cena (PLN)</label>
            <input
              type="number"
              value={formData.default_price}
              onChange={(e) => setFormData({ ...formData, default_price: e.target.value })}
              placeholder="0.00"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="procedure-price-input"
            />
            <p className="text-xs text-slate-500 mt-1">Cena zostanie automatycznie uzupełniona przy wyborze zabiegu</p>
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium">
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 rounded-lg font-medium disabled:opacity-50"
              data-testid="submit-procedure-type"
            >
              {loading ? "Zapisywanie..." : (procedureType ? "Zaktualizuj" : "Dodaj")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==================== MAIN APP ====================
const AppLayout = ({ children }) => {
  const location = window.location.pathname;
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar currentPath={location} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <AppLayout>{children}</AppLayout>;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem("token"));

  const login = (token) => {
    localStorage.setItem("token", token);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/patients" element={<ProtectedRoute><PatientsList /></ProtectedRoute>} />
          <Route path="/patients/:id" element={<ProtectedRoute><PatientDetail /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
          <Route path="/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
