import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, X, Settings } from "lucide-react";
import api from "../utils/api";

const DISMISS_KEY = "gcal_alert_dismissed_at";
const DISMISS_HOURS = 4;

export const CalendarSyncAlert = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    const ts = Number(sessionStorage.getItem(DISMISS_KEY) || 0);
    return ts && Date.now() - ts < DISMISS_HOURS * 3600 * 1000;
  });

  const load = useCallback(async () => {
    try {
      const res = await api.get("/calendar/health");
      setStatus(res.data);
    } catch (err) { /* non-critical */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Alert when Google was in use (credentials or sync history) and the last check/sync failed,
  // or when credentials were dropped after an auth failure (invalid_grant).
  const wasUsed = status && (status.has_credentials || status.last_sync || status.last_pull_at);
  const failing = status && ((status.health && status.health.ok === false) || (!status.has_credentials && status.last_error));
  const broken = status && status.configured && wasUsed && failing;
  if (!broken || dismissed) return null;

  const reason = status.health?.error || status.last_error || "Połączenie z Google Calendar nie działa";

  return (
    <div className="bg-red-600 text-white" data-testid="gcal-sync-alert">
      <div className="px-6 py-3 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <div className="flex-1 min-w-0 text-sm">
          <span className="font-semibold">Synchronizacja z Google Calendar nie działa.</span>{" "}
          <span className="opacity-90 truncate">{reason}</span>
          {status.last_error_at && <span className="opacity-75 ml-2 text-xs">({new Date(status.last_error_at).toLocaleString("pl-PL")})</span>}
        </div>
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center gap-1.5 bg-white text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-semibold shrink-0"
          data-testid="gcal-alert-settings"
        >
          <Settings className="w-4 h-4" /> Połącz ponownie
        </button>
        <button
          onClick={() => { sessionStorage.setItem(DISMISS_KEY, String(Date.now())); setDismissed(true); }}
          className="p-1.5 hover:bg-red-700 rounded-lg shrink-0"
          title="Ukryj na 4 godziny"
          data-testid="gcal-alert-dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default CalendarSyncAlert;
