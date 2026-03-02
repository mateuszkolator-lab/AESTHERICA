import { useState } from "react";
import { X, Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "../../utils/api";

// Location Modal
export const LocationModal = ({ location, onClose, onSuccess }) => {
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

// Procedure Type Modal
export const ProcedureTypeModal = ({ procedureType, onClose, onSuccess }) => {
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
