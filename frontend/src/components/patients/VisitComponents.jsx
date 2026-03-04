import { useState } from "react";
import { X, Camera, Trash2, Eye, Edit2, Check } from "lucide-react";
import { toast } from "sonner";
import api from "../../utils/api";
import { PHOTO_ANGLE_LABELS, PHOTO_ANGLE_OPTIONS, VISIT_TYPE_OPTIONS, VISIT_TYPE_LABELS } from "../../utils/constants";

export const AddVisitModal = ({ patientId, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    type: "consultation",
    customType: "",
    notes: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const submitData = {
        date: formData.date,
        type: formData.type === "custom" && formData.customType ? formData.customType : formData.type,
        notes: formData.notes
      };
      await api.post(`/patients/${patientId}/visits`, submitData);
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
            <label className="block text-sm font-medium text-slate-700 mb-2">Typ wizyty</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              data-testid="visit-type-select"
            >
              {VISIT_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {formData.type === "custom" && (
              <input
                type="text"
                placeholder="Wpisz własny typ wizyty..."
                value={formData.customType}
                onChange={(e) => setFormData({ ...formData, customType: e.target.value })}
                className="w-full mt-2 px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            )}
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

export const PhotoUploadModal = ({ patientId, visitId, onClose, onSuccess }) => {
  const [files, setFiles] = useState([]); // [{file, angle, preview}]
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files).map(file => ({
      file,
      angle: "front",
      customAngle: "",
      preview: URL.createObjectURL(file)
    }));
    setFiles([...files, ...newFiles]);
  };

  const removeFile = (index) => {
    const newFiles = [...files];
    URL.revokeObjectURL(newFiles[index].preview);
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  const updateFileAngle = (index, angle) => {
    const newFiles = [...files];
    newFiles[index].angle = angle;
    setFiles(newFiles);
  };

  const updateFileCustomAngle = (index, customAngle) => {
    const newFiles = [...files];
    newFiles[index].customAngle = customAngle;
    setFiles(newFiles);
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
      for (const item of files) {
        const base64 = await fileToBase64(item.file);
        const finalAngle = item.angle === "other" && item.customAngle ? item.customAngle : item.angle;
        await api.post(`/patients/${patientId}/visits/${visitId}/photos`, {
          data: base64,
          filename: item.file.name,
          angle: finalAngle
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
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-semibold text-slate-900">Prześlij zdjęcia</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
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
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Wybrane zdjęcia ({files.length}):</p>
              {files.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    className="w-20 h-20 object-cover rounded-lg shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-600 truncate mb-2">{item.file.name}</p>
                    <select
                      value={item.angle}
                      onChange={(e) => updateFileAngle(i, e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      {PHOTO_ANGLE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {item.angle === "other" && (
                      <input
                        type="text"
                        placeholder="Własny opis kąta..."
                        value={item.customAngle}
                        onChange={(e) => updateFileCustomAngle(i, e.target.value)}
                        className="w-full mt-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    )}
                  </div>
                  <button
                    onClick={() => removeFile(i)}
                    className="p-1.5 hover:bg-red-100 rounded-lg text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex gap-4 shrink-0">
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
  );
};

// Photo Edit Modal
export const PhotoEditModal = ({ photo, patientId, visitId, onClose, onSuccess }) => {
  const [angle, setAngle] = useState(photo.angle || "front");
  const [customAngle, setCustomAngle] = useState(
    PHOTO_ANGLE_OPTIONS.find(o => o.value === photo.angle) ? "" : photo.angle || ""
  );
  const [caption, setCaption] = useState(photo.caption || "");
  const [saving, setSaving] = useState(false);

  // Check if current angle is custom
  const isCustomAngle = !PHOTO_ANGLE_OPTIONS.find(o => o.value === photo.angle) && photo.angle;

  const handleSave = async () => {
    setSaving(true);
    try {
      const finalAngle = angle === "other" && customAngle ? customAngle : angle;
      await api.put(`/patients/${patientId}/visits/${visitId}/photos/${photo.id}`, {
        angle: finalAngle,
        caption: caption || null
      });
      toast.success("Zdjęcie zaktualizowane");
      onSuccess();
    } catch (err) {
      toast.error("Nie udało się zaktualizować zdjęcia");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900">Edytuj zdjęcie</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex justify-center">
            <img src={photo.data} alt="" className="max-h-48 rounded-lg object-contain" />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Kąt zdjęcia</label>
            <select
              value={isCustomAngle ? "other" : angle}
              onChange={(e) => {
                setAngle(e.target.value);
                if (e.target.value !== "other") setCustomAngle("");
              }}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {PHOTO_ANGLE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {(angle === "other" || isCustomAngle) && (
              <input
                type="text"
                placeholder="Własny opis kąta..."
                value={customAngle || (isCustomAngle ? photo.angle : "")}
                onChange={(e) => {
                  setCustomAngle(e.target.value);
                  setAngle("other");
                }}
                className="w-full mt-2 px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Opis (opcjonalnie)</label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Dodaj opis zdjęcia..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-slate-200 flex gap-4">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium">
            Anuluj
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? "Zapisywanie..." : <><Check className="w-4 h-4" /> Zapisz</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export const VisitCard = ({ visit, patientId, onUpdate }) => {
  const [showUpload, setShowUpload] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const [editingPhoto, setEditingPhoto] = useState(null);

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
            className="px-3 py-1.5 text-sm bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg transition-colors flex items-center gap-1"
            data-testid={`upload-photo-${visit.id}`}
          >
            <Camera className="w-4 h-4" />
            Dodaj
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
                    title="Podgląd"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingPhoto(photo)}
                    className="p-2 bg-white rounded-lg"
                    title="Edytuj"
                  >
                    <Edit2 className="w-4 h-4 text-blue-500" />
                  </button>
                  <button
                    onClick={() => handleDeletePhoto(photo.id)}
                    className="p-2 bg-white rounded-lg"
                    title="Usuń"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
                {photo.angle && (
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded">
                    {PHOTO_ANGLE_LABELS[photo.angle] || photo.angle}
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

      {editingPhoto && (
        <PhotoEditModal
          photo={editingPhoto}
          patientId={patientId}
          visitId={visit.id}
          onClose={() => setEditingPhoto(null)}
          onSuccess={() => { setEditingPhoto(null); onUpdate(); }}
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
          {expandedPhoto.angle && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 text-white rounded-lg">
              {PHOTO_ANGLE_LABELS[expandedPhoto.angle] || expandedPhoto.angle}
              {expandedPhoto.caption && ` - ${expandedPhoto.caption}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
