import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { 
  Users, Calendar, BarChart3, Settings, LogOut, 
  Menu, Home, CalendarPlus
} from "lucide-react";

const Sidebar = ({ currentPath }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { path: "/", icon: Home, label: "Pulpit" },
    { path: "/patients", icon: Users, label: "Pacjenci" },
    { path: "/planning", icon: CalendarPlus, label: "Planowanie" },
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

export default Sidebar;
