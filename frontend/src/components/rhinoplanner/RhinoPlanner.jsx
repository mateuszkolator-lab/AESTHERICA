import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Pencil, Eraser, Type, ArrowRight, Circle, Square,
  Undo2, Redo2, Download, Save, Trash2, ChevronLeft,
  Palette, Minus, Plus
} from "lucide-react";
import { Canvas, PencilBrush, Line, Circle as FabricCircle, Textbox } from "fabric";
import { jsPDF } from "jspdf";
import api from "../../utils/api";
import { NoseFrontal, NoseProfile, NoseBase, NoseSeptum, schematicsList } from "./NoseSchematics";

// Kolory dla legendy
const COLORS = {
  resection: { color: '#dc2626', name: 'Resekcja', shortName: 'Usuniecie' },
  graft: { color: '#2563eb', name: 'Graft', shortName: 'Graft' },
  suture: { color: '#16a34a', name: 'Szew', shortName: 'Szew' },
  incision: { color: '#9333ea', name: 'Ciecie', shortName: 'Ciecie' },
  note: { color: '#000000', name: 'Notatka', shortName: 'Notatka' }
};

const BRUSH_SIZES = [2, 4, 6, 8, 12];

const RhinoPlanner = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [activeView, setActiveView] = useState('frontal');
  const [activeTool, setActiveTool] = useState('pencil');
  const [activeColor, setActiveColor] = useState('resection');
  const [brushSize, setBrushSize] = useState(4);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [procedureType, setProcedureType] = useState('Rinoplastyka');
  
  const canvasRefs = useRef({});
  const fabricCanvases = useRef({});
  const historyRef = useRef({ frontal: [], profile: [], base: [], septum: [] });
  const historyIndexRef = useRef({ frontal: -1, profile: -1, base: -1, septum: -1 });

  // Load patient data
  useEffect(() => {
    const loadPatient = async () => {
      try {
        const res = await api.get(`/patients/${patientId}`);
        setPatient(res.data);
        
        // Load existing plan if exists
        if (res.data.rhinoPlan) {
          setNotes(res.data.rhinoPlan.notes || '');
          setProcedureType(res.data.rhinoPlan.procedureType || 'Rinoplastyka');
        }
      } catch (err) {
        toast.error("Nie udalo sie zaladowac pacjenta");
        navigate('/patients');
      } finally {
        setLoading(false);
      }
    };
    loadPatient();
  }, [patientId, navigate]);

  // Initialize Fabric canvases
  useEffect(() => {
    if (loading) return;

    schematicsList.forEach(({ id }) => {
      if (canvasRefs.current[id] && !fabricCanvases.current[id]) {
        const canvas = new Canvas(canvasRefs.current[id], {
          isDrawingMode: true,
          width: 400,
          height: 400,
          backgroundColor: 'transparent'
        });
        
        canvas.freeDrawingBrush = new PencilBrush(canvas);
        canvas.freeDrawingBrush.color = COLORS[activeColor].color;
        canvas.freeDrawingBrush.width = brushSize;
        
        // Load saved data
        if (patient?.rhinoPlan?.canvasData?.[id]) {
          canvas.loadFromJSON(patient.rhinoPlan.canvasData[id], () => {
            canvas.renderAll();
          });
        }
        
        fabricCanvases.current[id] = canvas;
      }
    });

    return () => {
      Object.values(fabricCanvases.current).forEach(canvas => {
        canvas.dispose();
      });
      fabricCanvases.current = {};
    };
  }, [loading, patient]);

  // Update brush settings when color/size changes
  useEffect(() => {
    Object.values(fabricCanvases.current).forEach(canvas => {
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = COLORS[activeColor].color;
        canvas.freeDrawingBrush.width = brushSize;
      }
      canvas.isDrawingMode = activeTool === 'pencil';
    });
  }, [activeColor, brushSize, activeTool]);

  const handleToolChange = (tool) => {
    setActiveTool(tool);
    const canvas = fabricCanvases.current[activeView];
    if (!canvas) return;

    if (tool === 'pencil') {
      canvas.isDrawingMode = true;
    } else if (tool === 'eraser') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = '#ffffff';
      canvas.freeDrawingBrush.width = brushSize * 3;
    } else {
      canvas.isDrawingMode = false;
    }
  };

  const handleClear = () => {
    const canvas = fabricCanvases.current[activeView];
    if (canvas) {
      canvas.clear();
      canvas.backgroundColor = 'transparent';
      canvas.renderAll();
    }
  };

  const handleUndo = () => {
    const canvas = fabricCanvases.current[activeView];
    if (canvas) {
      const objects = canvas.getObjects();
      if (objects.length > 0) {
        canvas.remove(objects[objects.length - 1]);
        canvas.renderAll();
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const canvasData = {};
      Object.entries(fabricCanvases.current).forEach(([id, canvas]) => {
        canvasData[id] = canvas.toJSON();
      });

      await api.put(`/patients/${patientId}`, {
        rhinoPlan: {
          canvasData,
          notes,
          procedureType,
          updatedAt: new Date().toISOString()
        }
      });
      
      toast.success("Plan zapisany");
    } catch (err) {
      toast.error("Blad podczas zapisywania");
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    // Header
    pdf.setFontSize(18);
    pdf.text("Plan Rinoplastyki", pageWidth / 2, 15, { align: 'center' });
    
    pdf.setFontSize(11);
    pdf.text(`Pacjent: ${patient?.first_name} ${patient?.last_name}`, 15, 25);
    pdf.text(`Data: ${new Date().toLocaleDateString('pl-PL')}`, 15, 32);
    pdf.text(`Procedura: ${procedureType}`, 15, 39);
    
    // Legend
    pdf.setFontSize(9);
    let legendY = 48;
    pdf.text("Legenda:", 15, legendY);
    Object.entries(COLORS).forEach(([key, { color, name }], idx) => {
      pdf.setFillColor(color);
      pdf.rect(15 + idx * 35, legendY + 2, 4, 4, 'F');
      pdf.setTextColor(0, 0, 0);
      pdf.text(name, 21 + idx * 35, legendY + 5);
    });
    
    // Schematics
    const positions = [
      { x: 15, y: 60, label: 'Frontalny' },
      { x: 105, y: 60, label: 'Profil' },
      { x: 15, y: 150, label: 'Baza' },
      { x: 105, y: 150, label: 'Przegroda' }
    ];
    
    const views = ['frontal', 'profile', 'base', 'septum'];
    
    for (let i = 0; i < views.length; i++) {
      const canvas = fabricCanvases.current[views[i]];
      const pos = positions[i];
      
      pdf.setFontSize(10);
      pdf.text(pos.label, pos.x, pos.y);
      
      if (canvas) {
        const dataUrl = canvas.toDataURL({ format: 'png', quality: 1 });
        pdf.addImage(dataUrl, 'PNG', pos.x, pos.y + 2, 80, 80);
      }
    }
    
    // Notes
    if (notes) {
      pdf.setFontSize(10);
      pdf.text("Notatki:", 15, 240);
      pdf.setFontSize(9);
      const splitNotes = pdf.splitTextToSize(notes, pageWidth - 30);
      pdf.text(splitNotes, 15, 247);
    }
    
    // Footer
    pdf.setFontSize(8);
    pdf.text("AestheticaMD - System Zarzadzania Pacjentami", pageWidth / 2, 290, { align: 'center' });
    
    pdf.save(`plan_rinoplastyki_${patient?.last_name}_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success("PDF wyeksportowany");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6" data-testid="rhino-planner">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(`/patients/${patientId}`)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Plan Rinoplastyki</h1>
              <p className="text-sm text-slate-500">
                {patient?.first_name} {patient?.last_name} | {new Date().toLocaleDateString('pl-PL')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Zapisywanie...' : 'Zapisz'}
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Eksport PDF
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Toolbar */}
        <div className="lg:col-span-1 space-y-4">
          {/* Tools */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Narzedzia</h3>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handleToolChange('pencil')}
                className={`p-3 rounded-lg transition-colors ${activeTool === 'pencil' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 hover:bg-slate-200'}`}
                title="Rysuj"
              >
                <Pencil className="w-5 h-5 mx-auto" />
              </button>
              <button
                onClick={() => handleToolChange('eraser')}
                className={`p-3 rounded-lg transition-colors ${activeTool === 'eraser' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 hover:bg-slate-200'}`}
                title="Gumka"
              >
                <Eraser className="w-5 h-5 mx-auto" />
              </button>
              <button
                onClick={handleUndo}
                className="p-3 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                title="Cofnij"
              >
                <Undo2 className="w-5 h-5 mx-auto" />
              </button>
              <button
                onClick={handleClear}
                className="p-3 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition-colors"
                title="Wyczysc"
              >
                <Trash2 className="w-5 h-5 mx-auto" />
              </button>
            </div>
          </div>

          {/* Colors */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Kolory (Legenda)</h3>
            <div className="space-y-2">
              {Object.entries(COLORS).map(([key, { color, name }]) => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveColor(key);
                    setActiveTool('pencil');
                  }}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${activeColor === key ? 'bg-slate-100 ring-2 ring-teal-500' : 'hover:bg-slate-50'}`}
                >
                  <div className="w-6 h-6 rounded-full border-2 border-slate-300" style={{ backgroundColor: color }} />
                  <span className="text-sm text-slate-700">{name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Brush Size */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Grubosc linii</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBrushSize(Math.max(1, brushSize - 1))}
                className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="flex-1 text-center">
                <span className="text-lg font-semibold">{brushSize}px</span>
              </div>
              <button
                onClick={() => setBrushSize(Math.min(20, brushSize + 1))}
                className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-center gap-1 mt-3">
              {BRUSH_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => setBrushSize(size)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${brushSize === size ? 'bg-teal-100' : 'bg-slate-100'}`}
                >
                  <div 
                    className="rounded-full bg-slate-700" 
                    style={{ width: size + 2, height: size + 2 }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Procedure Type */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Typ zabiegu</h3>
            <select
              value={procedureType}
              onChange={(e) => setProcedureType(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg"
            >
              <option>Rinoplastyka</option>
              <option>Septoplastyka</option>
              <option>Septorynoplastyka</option>
              <option>Rinoplastyka rewzyjna</option>
            </select>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Notatki</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dodatkowe uwagi, oczekiwania pacjenta..."
              rows={4}
              className="w-full p-2 border border-slate-200 rounded-lg resize-none text-sm"
            />
          </div>
        </div>

        {/* Canvas Area */}
        <div className="lg:col-span-3">
          {/* View Tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {schematicsList.map(({ id, name }) => (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  activeView === id 
                    ? 'bg-teal-600 text-white' 
                    : 'bg-white border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          {/* Canvas Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {schematicsList.map(({ id, name, component: SchematicComponent }) => (
              <div 
                key={id}
                className={`bg-white rounded-xl border-2 transition-all ${
                  activeView === id ? 'border-teal-500 shadow-lg' : 'border-slate-200'
                }`}
              >
                <div className="p-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{name}</span>
                  <button
                    onClick={() => setActiveView(id)}
                    className={`text-xs px-2 py-1 rounded ${
                      activeView === id ? 'bg-teal-100 text-teal-700' : 'bg-slate-100'
                    }`}
                  >
                    {activeView === id ? 'Aktywny' : 'Wybierz'}
                  </button>
                </div>
                <div className="relative" style={{ aspectRatio: '1' }}>
                  {/* Background SVG */}
                  <div className="absolute inset-0 p-4 pointer-events-none opacity-50">
                    <SchematicComponent />
                  </div>
                  {/* Drawing Canvas */}
                  <canvas
                    ref={(el) => canvasRefs.current[id] = el}
                    className={`absolute inset-0 w-full h-full ${activeView !== id ? 'pointer-events-none' : ''}`}
                    style={{ touchAction: 'none' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RhinoPlanner;
