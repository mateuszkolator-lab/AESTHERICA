import { useState, useEffect } from "react";
import { History, User, Clock, ChevronDown, ChevronUp } from "lucide-react";
import api from "../utils/api";

const ACTION_LABELS = {
  "create": "Utworzono pacjenta",
  "update": "Zaktualizowano dane",
  "delete": "Usunięto pacjenta",
  "add_visit": "Dodano wizytę",
  "delete_visit": "Usunięto wizytę",
  "add_photo": "Dodano zdjęcie",
  "delete_photo": "Usunięto zdjęcie",
  "update_photo": "Zaktualizowano zdjęcie",
  "add_rhinoplan": "Utworzono plan operacji",
  "update_rhinoplan": "Zaktualizowano plan operacji",
  "delete_rhinoplan": "Usunięto plan operacji"
};

const ACTION_COLORS = {
  "create": "bg-green-100 text-green-700",
  "update": "bg-blue-100 text-blue-700",
  "delete": "bg-red-100 text-red-700",
  "add_visit": "bg-teal-100 text-teal-700",
  "delete_visit": "bg-orange-100 text-orange-700",
  "add_photo": "bg-purple-100 text-purple-700",
  "delete_photo": "bg-pink-100 text-pink-700"
};

const PatientAuditLog = ({ patientId }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState({});

  useEffect(() => {
    loadLogs();
  }, [patientId]);

  const loadLogs = async () => {
    try {
      const res = await api.get(`/audit/patient/${patientId}?limit=50`);
      setLogs(res.data);
    } catch (err) {
      // Audit log loading is non-critical
    } finally {
      setLoading(false);
    }
  };

  const toggleEntry = (logId) => {
    setExpandedEntries(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return <span className="text-slate-400 italic">brak</span>;
    if (typeof value === "boolean") return value ? "Tak" : "Nie";
    if (typeof value === "number") return value.toLocaleString("pl-PL");
    return String(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-700" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="patient-audit-log">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
            <History className="w-5 h-5 text-slate-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-900">Historia zmian</h3>
            <p className="text-sm text-slate-500">{logs.length} {logs.length === 1 ? 'wpis' : 'wpisów'}</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100">
          {logs.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-500">
              <History className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p>Brak historii zmian</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-700'}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {log.user_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(log.timestamp)}
                        </span>
                      </div>

                      {log.details && (
                        <p className="mt-2 text-sm text-slate-600">{log.details}</p>
                      )}

                      {log.changes && Object.keys(log.changes).length > 0 && (
                        <div className="mt-2">
                          <button
                            onClick={() => toggleEntry(log.id)}
                            className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1"
                          >
                            {expandedEntries[log.id] ? "Ukryj szczegóły" : "Pokaż szczegóły"}
                            {expandedEntries[log.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          
                          {expandedEntries[log.id] && (
                            <div className="mt-2 bg-slate-50 rounded-lg p-3 text-sm">
                              <table className="w-full">
                                <thead>
                                  <tr className="text-left text-xs text-slate-500">
                                    <th className="pb-2 font-medium">Pole</th>
                                    <th className="pb-2 font-medium">Było</th>
                                    <th className="pb-2 font-medium">Jest</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(log.changes).map(([field, change]) => (
                                    <tr key={field} className="border-t border-slate-200">
                                      <td className="py-2 font-medium text-slate-700">{field}</td>
                                      <td className="py-2 text-red-600">{formatValue(change.old)}</td>
                                      <td className="py-2 text-green-600">{formatValue(change.new)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PatientAuditLog;
