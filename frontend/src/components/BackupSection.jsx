import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Database, Download, HardDriveDownload, Trash2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import api from "../utils/api";

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDateTime = (iso) => new Date(iso).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const saveBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

export const BackupSection = () => {
  const [status, setStatus] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/backup/status");
      setStatus(res.data);
    } catch (err) {
      // non-critical
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await api.get("/backup/download", { responseType: "blob" });
      const cd = res.headers["content-disposition"] || "";
      const match = cd.match(/filename="?([^";]+)"?/);
      saveBlob(res.data, match?.[1] || `aestheticamd_${new Date().toISOString().slice(0, 10)}.zip`);
      toast.success("Kopia bazy pobrana");
    } catch (err) {
      toast.error("Nie udało się pobrać kopii bazy");
    } finally {
      setDownloading(false);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const res = await api.post("/backup/run");
      toast.success(`Utworzono kopię: ${res.data.name}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Nie udało się utworzyć kopii");
    } finally {
      setRunning(false);
    }
  };

  const handleDownloadFile = async (name) => {
    try {
      const res = await api.get(`/backup/files/${name}`, { responseType: "blob" });
      saveBlob(res.data, name);
    } catch (err) {
      toast.error("Nie udało się pobrać pliku");
    }
  };

  const handleDelete = async (name) => {
    if (!window.confirm(`Usunąć kopię ${name}?`)) return;
    try {
      await api.delete(`/backup/files/${name}`);
      toast.success("Kopia usunięta");
      load();
    } catch (err) {
      toast.error("Nie udało się usunąć kopii");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 mb-6" data-testid="backup-section">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-slate-900">Kopia zapasowa bazy</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRunNow}
            disabled={running || !status?.auto_enabled}
            className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            data-testid="backup-run-button"
          >
            <RefreshCw className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
            {running ? "Tworzenie..." : "Utwórz kopię teraz"}
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            data-testid="backup-download-button"
          >
            <HardDriveDownload className="w-4 h-4" />
            {downloading ? "Przygotowywanie..." : "Pobierz kopię bazy"}
          </button>
        </div>
      </div>
      <div className="p-6">
        <div className={`p-4 rounded-lg mb-4 flex items-start gap-3 ${status?.auto_enabled ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`} data-testid="backup-auto-status">
          {status?.auto_enabled ? <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />}
          <div className="text-sm">
            <p className={`font-medium ${status?.auto_enabled ? "text-emerald-800" : "text-amber-800"}`}>
              {status?.auto_enabled ? "Codzienny automatyczny backup włączony" : "Automatyczny backup wyłączony"}
            </p>
            <p className={status?.auto_enabled ? "text-emerald-700" : "text-amber-700"}>
              {status?.auto_enabled
                ? <>Kopie zapisywane w <code className="bg-white/60 px-1 rounded">{status.dir}</code>, przechowywane ostatnie {status.keep}. {status.last_backup ? `Ostatnia: ${formatDateTime(status.last_backup.created_at)}` : "Pierwsza kopia zostanie utworzona w ciągu godziny."}</>
                : <>Ustaw <code className="bg-white/60 px-1 rounded">BACKUP_DIR=/var/backups/aestheticamd</code> w pliku backend/.env i zrestartuj usługę.</>}
            </p>
          </div>
        </div>

        {status?.backups?.length > 0 && (
          <div className="space-y-2" data-testid="backup-list">
            {status.backups.map((b) => (
              <div key={b.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg" data-testid={`backup-file-${b.name}`}>
                <div>
                  <p className="font-medium text-slate-900 text-sm">{b.name}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(b.created_at)} · {formatSize(b.size)}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleDownloadFile(b.name)} className="p-2 hover:bg-slate-200 rounded-lg" title="Pobierz" data-testid={`backup-download-${b.name}`}>
                    <Download className="w-4 h-4 text-slate-600" />
                  </button>
                  <button onClick={() => handleDelete(b.name)} className="p-2 hover:bg-red-100 rounded-lg" title="Usuń" data-testid={`backup-delete-${b.name}`}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400 mt-4">
          Kopia to plik ZIP z jednym plikiem JSON na każdą kolekcję (pacjenci, zdjęcia, wizyty, użytkownicy, ustawienia…). Przywrócenie: <code>mongoimport --db NAZWA --collection patients --jsonArray patients.json</code>.
        </p>
      </div>
    </div>
  );
};

export default BackupSection;
