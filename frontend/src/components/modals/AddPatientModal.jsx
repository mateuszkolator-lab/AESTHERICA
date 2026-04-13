import { useState, useEffect } from "react";
import { X, Image as ImageIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import api from "../../utils/api";

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
    notes: "",
    asap: false
  });
  const [locations, setLocations] = useState([]);
  const [procedureTypes, setProcedureTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

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
      toast.error("Nie udało się załadować danych");
    }
  };

  const handleProcedureTypeChange = (value) => {
    setFormData({ ...formData, procedure_type: value });
    const pt = procedureTypes.find(p => p.name === value);
    if (pt?.default_price && !formData.price) {
      setFormData(prev => ({ ...prev, procedure_type: value, price: pt.default_price.toString() }));
    }
  };

  const handleSurgeryDateChange = (value) => {
    setFormData({ ...formData, surgery_date: value, status: value ? (formData.status === "consultation" || formData.status === "awaiting" ? "planned" : formData.status) : formData.status });
  };

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      category: "before",
      description: ""
    }));
    setPhotos([...photos, ...newPhotos]);
  };

  const removePhoto = (index) => {
    const newPhotos = [...photos];
    URL.revokeObjectURL(newPhotos[index].preview);
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
  };

  const updatePhotoCategory = (index, category) => {
    const newPhotos = [...photos];
    newPhotos[index].category = category;
    setPhotos(newPhotos);
  };

  const updatePhotoDescription = (index, description) => {
    const newPhotos = [...photos];
    newPhotos[index].description = description;
    setPhotos(newPhotos);
  };

  const uploadPhotosForPatient = async (patientId) => {
    if (photos.length === 0) return;
    
    setUploadingPhotos(true);
    let uploaded = 0;
    
    for (const photo of photos) {
      try {
        const formDataObj = new FormData();
        formDataObj.append("file", photo.file);
        formDataObj.append("category", photo.category);
        if (photo.description) {
          formDataObj.append("description", photo.description);
        }
        
        await api.post(`/patients/${patientId}/photos`, formDataObj, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        uploaded++;
      } catch (err) {
        // Photo upload failed, continue with remaining
      }
    }
    
    setUploadingPhotos(false);
    return uploaded;
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
        if (photos.length > 0) {
          const uploaded = await uploadPhotosForPatient(initialData.id);
          if (uploaded > 0) {
            toast.success(`Pacjent zaktualizowany, dodano ${uploaded} zdjęć`);
          } else {
            toast.success("Pacjent zaktualizowany");
          }
        } else {
          toast.success("Pacjent zaktualizowany");
        }
      } else {
        const response = await api.post("/patients", data);
        const newPatientId = response.data.id;
        
        if (photos.length > 0) {
          const uploaded = await uploadPhotosForPatient(newPatientId);
          if (uploaded > 0) {
            toast.success(`Pacjent dodany z ${uploaded} zdjęciami`);
          } else {
            toast.success("Pacjent dodany");
          }
        } else {
          toast.success("Pacjent dodany");
        }
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
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {initialData ? "Edytuj pacjenta" : "Dodaj nowego pacjenta"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="close-modal">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-6 pt-4 border-b border-slate-200">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab("info")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "info"
                  ? "border-teal-600 text-teal-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Dane pacjenta
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("photos")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "photos"
                  ? "border-teal-600 text-teal-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Zdjęcia
              {photos.length > 0 && (
                <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 text-xs font-semibold rounded-full">
                  {photos.length}
                </span>
              )}
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {activeTab === "info" ? (
            <div className="space-y-6">
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

              <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <input
                  type="checkbox"
                  id="asap"
                  checked={formData.asap}
                  onChange={(e) => setFormData({ ...formData, asap: e.target.checked })}
                  className="w-5 h-5 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                  data-testid="asap-checkbox"
                />
                <label htmlFor="asap" className="flex-1">
                  <span className="font-medium text-amber-900">Jak najszybciej</span>
                  <p className="text-xs text-amber-700 mt-0.5">Pacjent jest gotowy zmienić termin na wcześniejszy w razie rezygnacji innego pacjenta</p>
                </label>
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
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
                <input
                  type="file"
                  id="photo-upload"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <label
                  htmlFor="photo-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-teal-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">Kliknij aby dodać zdjęcia</span>
                  <span className="text-xs text-slate-500">JPG, PNG, max 10MB na zdjęcie</span>
                </label>
              </div>

              {photos.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Dodane zdjęcia ({photos.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative border border-slate-200 rounded-lg overflow-hidden">
                        <img
                          src={photo.preview}
                          alt={`Zdjęcie ${index + 1}`}
                          className="w-full h-32 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="p-2 bg-white space-y-2">
                          <select
                            value={photo.category}
                            onChange={(e) => updatePhotoCategory(index, e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                          >
                            <option value="before">Przed</option>
                            <option value="after">Po</option>
                            <option value="during">W trakcie</option>
                            <option value="other">Inne</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Opis (opcjonalny)"
                            value={photo.description}
                            onChange={(e) => updatePhotoDescription(index, e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {photos.length === 0 && (
                <p className="text-center text-slate-500 text-sm py-4">
                  Brak dodanych zdjęć. Możesz dodać zdjęcia teraz lub później w karcie pacjenta.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-4 pt-6 mt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading || uploadingPhotos}
              className="flex-1 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="submit-patient"
            >
              {loading || uploadingPhotos ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {uploadingPhotos ? "Wysyłanie zdjęć..." : "Zapisywanie..."}
                </>
              ) : (
                initialData ? "Zaktualizuj" : `Dodaj pacjenta${photos.length > 0 ? ` (+${photos.length} zdjęć)` : ""}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPatientModal;
