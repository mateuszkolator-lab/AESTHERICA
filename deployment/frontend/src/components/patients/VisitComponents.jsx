import { useState } from "react";
import { X, Camera, Upload, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import api from "../../utils/api";
import { PHOTO_CATEGORY_LABELS } from "../../utils/constants";

// Add Visit Modal
export const AddVisitModal = ({ patientId, onClose, onSuccess }) => {
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

// Photo Upload Modal
export const PhotoUploadModal = ({ patientId, visitId, onClose, onSuccess }) => {
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

    const fileToBase64 = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
      });
    };

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

// Visit Card Component
export const VisitCard = ({ visit, patientId, onUpdate }) => {
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

  const VISIT_TYPE_LABELS = {
    consultation: "Konsultacja",
    surgery: "Operacja",
    follow_up: "Wizyta kontrolna"
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
