import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE } from "../utils/api";

const LoginPage = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { password });
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

export default LoginPage;
