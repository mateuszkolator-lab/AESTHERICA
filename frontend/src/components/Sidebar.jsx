import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import { 
  Users, Calendar, BarChart3, Settings, LogOut, 
  Menu, Home, CalendarPlus, Shield, User, ClipboardCheck, ClipboardList, X
} from "lucide-react";

const Sidebar = ({ currentPath }) => {
  const { logout, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [currentPath]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.post("/calendar/sync-all");
    } catch (err) {
      // Sync failed silently — don't block logout
    }
    logout();
    navigate("/login");
  };

  const navItems = [
    { path: "/", icon: Home, label: "Pulpit" },
    { path: "/patients", icon: Users, label: "Pacjenci" },
    { path: "/planning", icon: CalendarPlus, label: "Planowanie" },
    { path: "/calendar", icon: Calendar, label: "Kalendarz" },
    { path: "/controls", icon: ClipboardCheck, label: "Kontrole" },
    { path: "/surveys", icon: ClipboardList, label: "Ankiety" },
    { path: "/stats", icon: BarChart3, label: "Statystyki", adminOnly: true },
    { path: "/settings", icon: Settings, label: "Ustawienia" },
  ];

  // Add Users management for admins
  if (isAdmin()) {
    navItems.push({ path: "/users", icon: Shield, label: "Użytkownicy", adminOnly: true });
  }

  const showLabels = !collapsed || mobileOpen;

  return (
    <>
      {/* Mobile top bar (hidden on desktop) */}
      <header className="lg:hidden sticky top-0 z-30 h-14 bg-white border-b border-slate-200 flex items-center gap-3 px-4" data-testid="mobile-topbar">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Otwórz menu"
          data-testid="mobile-menu-button"
        >
          <Menu className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-lg font-semibold text-teal-700 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
          AestheticaMD
        </h1>
      </header>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} data-testid="mobile-menu-overlay" />
      )}

      <aside
        className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300
          max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-72 max-lg:shadow-2xl max-lg:transform
          ${mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}
          lg:h-screen lg:sticky lg:top-0 ${collapsed ? 'lg:w-20' : 'lg:w-64'}`}
        data-testid="sidebar"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          {showLabels && (
            <h1 className="text-xl font-semibold text-teal-700 tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              AestheticaMD
            </h1>
          )}
          <button 
            onClick={() => setCollapsed(!collapsed)} 
            className="hidden lg:block p-2 hover:bg-slate-100 rounded-lg transition-colors"
            data-testid="sidebar-toggle"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <button 
            onClick={() => setMobileOpen(false)} 
            className="lg:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Zamknij menu"
            data-testid="mobile-menu-close"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {navItems.filter(item => !item.adminOnly || isAdmin()).map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    currentPath === item.path || (item.path !== "/" && currentPath.startsWith(item.path + "/"))
                      ? item.adminOnly ? 'bg-purple-50 text-purple-700' : 'bg-teal-50 text-teal-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="w-5 h-5" />
                  {showLabels && <span className="font-medium">{item.label}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        
        {/* User info */}
        {user && showLabels && (
          <div className="px-4 py-3 border-t border-slate-100">
            <div className="flex items-center gap-3 px-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                user.role === "admin" ? "bg-purple-100 text-purple-600" : "bg-teal-100 text-teal-600"
              }`}>
                {user.role === "admin" ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {user.role === "admin" ? "Administrator" : "Użytkownik"}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors disabled:opacity-50"
            data-testid="logout-button"
          >
            <LogOut className={`w-5 h-5 ${loggingOut ? 'animate-spin' : ''}`} />
            {showLabels && <span className="font-medium">{loggingOut ? "Synchronizacja..." : "Wyloguj"}</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
