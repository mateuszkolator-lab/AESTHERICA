import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  ChevronLeft, Save, Download, Trash2, Undo, Redo,
  Pencil, Eraser, Circle, Square, Type, Palette,
  RotateCcw, ZoomIn, ZoomOut, Move
} from "lucide-react";
import { Canvas, PencilBrush, Circle as FabricCircle, Rect, IText, Line, FabricImage } from "fabric";
import { jsPDF } from "jspdf";
import api from "../utils/api";

// Predefiniowane procedury rinoplastyki
const PROCEDURE_CATEGORIES = [
  {
    name: "Grzbiet nosa",
    items: ["Redukcja garbka", "Augmentacja grzbietu", "Osteotomia lateralna", "Osteotomia medialna", "Spreader grafts"]
  },
  {
    name: "Czubek nosa",
    items: ["Zmniejszenie czubka", "Projekcja czubka", "Rotacja czubka", "Szwy definiujące", "Cephalic trim", "Shield graft", "Cap graft"]
  },
  {
    name: "Skrzydełka nosa",
    items: ["Zwężenie skrzydełek", "Alar base reduction", "Alar rim graft", "Wzmocnienie skrzydełek"]
  },
  {
    name: "Przegroda nosowa",
    items: ["Korekcja przegrody", "Pobranie chrząstki", "Extracorporeal septoplasty"]
  },
  {
    name: "Kolumella",
    items: ["Strut graft", "Plumping graft", "Korekcja retrakcji"]
  }
];

// Konfiguracja narzędzi
const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#8b5cf6", "#000000", "#ffffff"];
const BRUSH_SIZES = [2, 4, 6, 8, 12];

const RhinoPlannerPage = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Canvas refs dla każdego widoku
  const canvasFrontalRef = useRef(null);
  const canvasProfileRef = useRef(null);
  const canvasBaseRef = useRef(null);
  const fabricFrontalRef = useRef(null);
  const fabricProfileRef = useRef(null);
  const fabricBaseRef = useRef(null);
  
  // Stan aktywnego widoku i narzędzi
  const [activeView, setActiveView] = useState("frontal");
  const [activeTool, setActiveTool] = useState("pencil");
  const [activeColor, setActiveColor] = useState("#ef4444");
  const [brushSize, setBrushSize] = useState(4);
  
  // Stan formularza procedur
  const [selectedProcedures, setSelectedProcedures] = useState({});
  const [notes, setNotes] = useState("");
  const [surgeonNotes, setSurgeonNotes] = useState("");
  
  // Historia dla undo/redo
  const [history, setHistory] = useState({ frontal: [], profile: [], base: [] });
  const [historyIndex, setHistoryIndex] = useState({ frontal: -1, profile: -1, base: -1 });

  // Pobierz dane pacjenta i istniejący plan
  useEffect(() => {
    loadData();
  }, [patientId]);

  const loadData = async () => {
    try {
      const [patientRes, planRes] = await Promise.all([
        api.get(`/patients/${patientId}`),
        api.get(`/rhinoplanner/patient/${patientId}`)
      ]);
      
      setPatient(patientRes.data);
      
      if (planRes.data) {
        // Załaduj istniejący plan
        setNotes(planRes.data.notes || "");
        setSurgeonNotes(planRes.data.surgeon_notes || "");
        
        // Konwertuj procedury na format formularza
        const procedures = {};
        (planRes.data.procedures || []).forEach(p => {
          procedures[p.category] = p.items;
        });
        setSelectedProcedures(procedures);
        
        // Canvas zostanie załadowany po inicjalizacji
        setTimeout(() => {
          if (planRes.data.canvas_frontal && fabricFrontalRef.current) {
            fabricFrontalRef.current.loadFromJSON(planRes.data.canvas_frontal, () => {
              fabricFrontalRef.current.renderAll();
            });
          }
          if (planRes.data.canvas_profile && fabricProfileRef.current) {
            fabricProfileRef.current.loadFromJSON(planRes.data.canvas_profile, () => {
              fabricProfileRef.current.renderAll();
            });
          }
          if (planRes.data.canvas_base && fabricBaseRef.current) {
            fabricBaseRef.current.loadFromJSON(planRes.data.canvas_base, () => {
              fabricBaseRef.current.renderAll();
            });
          }
        }, 500);
      }
    } catch (err) {
      toast.error("Nie udało się załadować danych");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Inicjalizacja canvasów Fabric.js
  useEffect(() => {
    if (loading) return;

    const initCanvas = async (canvasEl, fabricRef, svgDataUrl) => {
      if (!canvasEl || fabricRef.current) return;
      
      const canvas = new Canvas(canvasEl, {
        width: 400,
        height: 500,
        backgroundColor: "#fafafa",
        isDrawingMode: true,
        selection: true
      });
      
      canvas.freeDrawingBrush = new PencilBrush(canvas);
      canvas.freeDrawingBrush.color = activeColor;
      canvas.freeDrawingBrush.width = brushSize;
      
      fabricRef.current = canvas;
      
      // Load background image using FabricImage
      try {
        const img = await FabricImage.fromURL(svgDataUrl, {
          crossOrigin: 'anonymous'
        });
        img.set({
          selectable: false,
          evented: false,
          scaleX: canvas.width / img.width,
          scaleY: canvas.height / img.height
        });
        canvas.backgroundImage = img;
        canvas.renderAll();
      } catch (err) {
        console.error("Failed to load background image:", err);
      }
      
      return canvas;
    };

    // Inicjalizuj wszystkie canvasy
    initCanvas(canvasFrontalRef.current, fabricFrontalRef, createNoseDiagramFrontal());
    initCanvas(canvasProfileRef.current, fabricProfileRef, createNoseDiagramProfile());
    initCanvas(canvasBaseRef.current, fabricBaseRef, createNoseDiagramBase());

    return () => {
      fabricFrontalRef.current?.dispose();
      fabricProfileRef.current?.dispose();
      fabricBaseRef.current?.dispose();
    };
  }, [loading]);

  // Aktualizuj narzędzie rysowania
  useEffect(() => {
    const canvas = getActiveCanvas();
    if (!canvas) return;

    if (activeTool === "pencil") {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = activeColor;
      canvas.freeDrawingBrush.width = brushSize;
    } else if (activeTool === "eraser") {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = "#ffffff";
      canvas.freeDrawingBrush.width = brushSize * 3;
    } else {
      canvas.isDrawingMode = false;
    }
  }, [activeTool, activeColor, brushSize, activeView]);

  const getActiveCanvas = () => {
    switch (activeView) {
      case "frontal": return fabricFrontalRef.current;
      case "profile": return fabricProfileRef.current;
      case "base": return fabricBaseRef.current;
      default: return null;
    }
  };

  // Dodaj kształty
  const addShape = (type) => {
    const canvas = getActiveCanvas();
    if (!canvas) return;

    canvas.isDrawingMode = false;
    let shape;

    switch (type) {
      case "circle":
        shape = new FabricCircle({
          radius: 30,
          fill: "transparent",
          stroke: activeColor,
          strokeWidth: 2,
          left: 150,
          top: 150
        });
        break;
      case "rect":
        shape = new Rect({
          width: 60,
          height: 40,
          fill: "transparent",
          stroke: activeColor,
          strokeWidth: 2,
          left: 150,
          top: 150
        });
        break;
      case "line":
        shape = new Line([50, 50, 150, 50], {
          stroke: activeColor,
          strokeWidth: 2
        });
        break;
      case "text":
        shape = new IText("Tekst", {
          left: 150,
          top: 150,
          fontSize: 16,
          fill: activeColor,
          fontFamily: "Arial"
        });
        break;
      default:
        return;
    }

    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.renderAll();
  };

  // Wyczyść canvas
  const clearCanvas = () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    
    canvas.getObjects().forEach(obj => canvas.remove(obj));
    canvas.renderAll();
    toast.info("Wyczyszczono widok");
  };

  // Zapisz plan
  const savePlan = async () => {
    setSaving(true);
    try {
      const procedures = Object.entries(selectedProcedures)
        .filter(([_, items]) => items && items.length > 0)
        .map(([category, items]) => ({ category, items }));

      const planData = {
        canvas_frontal: fabricFrontalRef.current ? JSON.stringify(fabricFrontalRef.current.toJSON()) : null,
        canvas_profile: fabricProfileRef.current ? JSON.stringify(fabricProfileRef.current.toJSON()) : null,
        canvas_base: fabricBaseRef.current ? JSON.stringify(fabricBaseRef.current.toJSON()) : null,
        procedures,
        notes,
        surgeon_notes: surgeonNotes
      };

      await api.put(`/rhinoplanner/patient/${patientId}`, planData);
      toast.success("Plan zapisany!");
    } catch (err) {
      toast.error("Nie udało się zapisać planu");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Eksport do PDF
  const exportToPDF = async () => {
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      // Nagłówek
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("Plan Rinoplastyki", pageWidth / 2, 20, { align: "center" });
      
      // Dane pacjenta
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Pacjent: ${patient?.first_name} ${patient?.last_name}`, 20, 35);
      pdf.text(`Data: ${new Date().toLocaleDateString("pl-PL")}`, 20, 42);
      
      let yPos = 55;
      
      // Diagramy
      const canvases = [
        { ref: fabricFrontalRef, name: "Widok frontalny" },
        { ref: fabricProfileRef, name: "Widok profilowy" },
        { ref: fabricBaseRef, name: "Widok podstawy" }
      ];
      
      for (const { ref, name } of canvases) {
        if (ref.current) {
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "bold");
          pdf.text(name, 20, yPos);
          yPos += 5;
          
          const dataUrl = ref.current.toDataURL({ format: "png", quality: 0.8 });
          pdf.addImage(dataUrl, "PNG", 20, yPos, 55, 70);
          yPos += 75;
          
          if (yPos > 250) {
            pdf.addPage();
            yPos = 20;
          }
        }
      }
      
      // Nowa strona dla procedur
      pdf.addPage();
      yPos = 20;
      
      // Wybrane procedury
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Planowane procedury", 20, yPos);
      yPos += 10;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      
      Object.entries(selectedProcedures).forEach(([category, items]) => {
        if (items && items.length > 0) {
          pdf.setFont("helvetica", "bold");
          pdf.text(`${category}:`, 20, yPos);
          yPos += 6;
          pdf.setFont("helvetica", "normal");
          items.forEach(item => {
            pdf.text(`  • ${item}`, 25, yPos);
            yPos += 5;
          });
          yPos += 3;
        }
      });
      
      // Notatki
      if (notes) {
        yPos += 10;
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Notatki:", 20, yPos);
        yPos += 7;
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const splitNotes = pdf.splitTextToSize(notes, pageWidth - 40);
        pdf.text(splitNotes, 20, yPos);
      }
      
      // Notatki chirurga
      if (surgeonNotes) {
        yPos += 20;
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.text("Notatki chirurga:", 20, yPos);
        yPos += 7;
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const splitSurgeonNotes = pdf.splitTextToSize(surgeonNotes, pageWidth - 40);
        pdf.text(splitSurgeonNotes, 20, yPos);
      }
      
      // Zapisz PDF
      pdf.save(`RhinoPlan_${patient?.last_name}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("PDF wyeksportowany!");
    } catch (err) {
      toast.error("Błąd eksportu PDF");
      console.error(err);
    }
  };

  // Toggle procedury
  const toggleProcedure = (category, item) => {
    setSelectedProcedures(prev => {
      const current = prev[category] || [];
      const updated = current.includes(item)
        ? current.filter(i => i !== item)
        : [...current, item];
      return { ...prev, [category]: updated };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="rhinoplanner-page">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/patients/${patientId}`)}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
              data-testid="back-button"
            >
              <ChevronLeft className="w-5 h-5" />
              Powrót
            </button>
            <div>
              <h1 className="text-xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
                RhinoPlanner
              </h1>
              <p className="text-sm text-slate-500">
                {patient?.first_name} {patient?.last_name}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={savePlan}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              data-testid="save-plan-button"
            >
              <Save className="w-4 h-4" />
              {saving ? "Zapisywanie..." : "Zapisz plan"}
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium transition-colors"
              data-testid="export-pdf-button"
            >
              <Download className="w-4 h-4" />
              Eksportuj PDF
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Panel narzędzi */}
        <div className="w-full lg:w-16 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-2 lg:p-3 flex lg:flex-col items-center gap-2 overflow-x-auto lg:overflow-visible">
          <div className="flex lg:flex-col gap-1">
            <ToolButton 
              icon={<Pencil className="w-5 h-5" />} 
              active={activeTool === "pencil"} 
              onClick={() => setActiveTool("pencil")}
              title="Ołówek"
            />
            <ToolButton 
              icon={<Eraser className="w-5 h-5" />} 
              active={activeTool === "eraser"} 
              onClick={() => setActiveTool("eraser")}
              title="Gumka"
            />
            <ToolButton 
              icon={<Move className="w-5 h-5" />} 
              active={activeTool === "select"} 
              onClick={() => setActiveTool("select")}
              title="Zaznacz"
            />
          </div>
          
          <div className="w-px h-6 lg:w-6 lg:h-px bg-slate-200" />
          
          <div className="flex lg:flex-col gap-1">
            <ToolButton 
              icon={<Circle className="w-5 h-5" />} 
              onClick={() => addShape("circle")}
              title="Okrąg"
            />
            <ToolButton 
              icon={<Square className="w-5 h-5" />} 
              onClick={() => addShape("rect")}
              title="Prostokąt"
            />
            <ToolButton 
              icon={<Type className="w-5 h-5" />} 
              onClick={() => addShape("text")}
              title="Tekst"
            />
          </div>
          
          <div className="w-px h-6 lg:w-6 lg:h-px bg-slate-200" />
          
          <div className="flex lg:flex-col gap-1">
            <ToolButton 
              icon={<RotateCcw className="w-5 h-5" />} 
              onClick={clearCanvas}
              title="Wyczyść"
            />
          </div>
          
          <div className="w-px h-6 lg:w-6 lg:h-px bg-slate-200" />
          
          {/* Kolory */}
          <div className="flex lg:flex-col gap-1">
            {COLORS.map(color => (
              <button
                key={color}
                onClick={() => setActiveColor(color)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  activeColor === color ? "border-slate-900 scale-110" : "border-slate-300"
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          
          <div className="w-px h-6 lg:w-6 lg:h-px bg-slate-200" />
          
          {/* Rozmiar pędzla */}
          <div className="flex lg:flex-col gap-1">
            {BRUSH_SIZES.map(size => (
              <button
                key={size}
                onClick={() => setBrushSize(size)}
                className={`w-8 h-8 rounded flex items-center justify-center transition-all ${
                  brushSize === size ? "bg-teal-100 text-teal-700" : "hover:bg-slate-100"
                }`}
                title={`Rozmiar ${size}`}
              >
                <div 
                  className="rounded-full bg-current" 
                  style={{ width: size + 2, height: size + 2 }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Główny obszar z canvasami */}
        <div className="flex-1 p-4 lg:p-6">
          {/* Zakładki widoków */}
          <div className="flex gap-2 mb-4">
            {[
              { id: "frontal", label: "Widok frontalny" },
              { id: "profile", label: "Widok profilowy" },
              { id: "base", label: "Widok podstawy" }
            ].map(view => (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeView === view.id
                    ? "bg-teal-700 text-white"
                    : "bg-white border border-slate-200 hover:bg-slate-50"
                }`}
                data-testid={`view-tab-${view.id}`}
              >
                {view.label}
              </button>
            ))}
          </div>

          {/* Canvasy */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
            <div className={activeView === "frontal" ? "block" : "hidden"}>
              <canvas ref={canvasFrontalRef} data-testid="canvas-frontal" />
            </div>
            <div className={activeView === "profile" ? "block" : "hidden"}>
              <canvas ref={canvasProfileRef} data-testid="canvas-profile" />
            </div>
            <div className={activeView === "base" ? "block" : "hidden"}>
              <canvas ref={canvasBaseRef} data-testid="canvas-base" />
            </div>
          </div>

          {/* Formularz procedur */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Planowane procedury
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {PROCEDURE_CATEGORIES.map(category => (
                <div key={category.name} className="space-y-2">
                  <h3 className="font-medium text-slate-700">{category.name}</h3>
                  <div className="space-y-1">
                    {category.items.map(item => (
                      <label 
                        key={item} 
                        className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={(selectedProcedures[category.name] || []).includes(item)}
                          onChange={() => toggleProcedure(category.name, item)}
                          className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                        />
                        <span className="text-sm text-slate-600">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Notatki */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notatki ogólne
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Dodatkowe informacje o planie..."
                  className="w-full h-32 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  data-testid="notes-textarea"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notatki chirurga
                </label>
                <textarea
                  value={surgeonNotes}
                  onChange={(e) => setSurgeonNotes(e.target.value)}
                  placeholder="Techniczne notatki chirurgiczne..."
                  className="w-full h-32 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  data-testid="surgeon-notes-textarea"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Komponent przycisku narzędzia
const ToolButton = ({ icon, active, onClick, title }) => (
  <button
    onClick={onClick}
    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
      active 
        ? "bg-teal-100 text-teal-700" 
        : "hover:bg-slate-100 text-slate-600"
    }`}
    title={title}
  >
    {icon}
  </button>
);

// Funkcje generujące diagramy SVG jako data URL
function encodeToBase64(str) {
  // Handle UTF-8 characters properly
  return btoa(unescape(encodeURIComponent(str)));
}

function createNoseDiagramFrontal() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
      <rect fill="#fafafa" width="400" height="500"/>
      <!-- Face outline -->
      <ellipse cx="200" cy="220" rx="120" ry="160" fill="none" stroke="#e2e8f0" stroke-width="1"/>
      <!-- Nose - frontal view -->
      <path d="M200 100 L200 280" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4"/>
      <!-- Nose bridge -->
      <path d="M185 120 Q200 115 215 120 L218 200 Q200 210 182 200 Z" fill="none" stroke="#64748b" stroke-width="1.5"/>
      <!-- Nose tip -->
      <ellipse cx="200" cy="240" rx="35" ry="25" fill="none" stroke="#64748b" stroke-width="1.5"/>
      <!-- Ala nasi -->
      <path d="M165 250 Q150 260 155 280 Q165 290 180 280" fill="none" stroke="#64748b" stroke-width="1.5"/>
      <path d="M235 250 Q250 260 245 280 Q235 290 220 280" fill="none" stroke="#64748b" stroke-width="1.5"/>
      <!-- Nostrils -->
      <ellipse cx="180" cy="265" rx="12" ry="8" fill="none" stroke="#64748b" stroke-width="1"/>
      <ellipse cx="220" cy="265" rx="12" ry="8" fill="none" stroke="#64748b" stroke-width="1"/>
      <!-- Eyes (reference) -->
      <ellipse cx="150" cy="150" rx="25" ry="12" fill="none" stroke="#cbd5e1" stroke-width="1"/>
      <ellipse cx="250" cy="150" rx="25" ry="12" fill="none" stroke="#cbd5e1" stroke-width="1"/>
      <!-- Label -->
      <text x="200" y="30" text-anchor="middle" fill="#64748b" font-size="14" font-family="Arial">WIDOK FRONTALNY</text>
    </svg>
  `;
  return "data:image/svg+xml;base64," + encodeToBase64(svg);
}

function createNoseDiagramProfile() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
      <rect fill="#fafafa" width="400" height="500"/>
      <!-- Head profile outline -->
      <path d="M280 100 Q320 150 310 220 Q300 300 260 350 Q220 380 180 370" fill="none" stroke="#e2e8f0" stroke-width="1"/>
      <!-- Forehead -->
      <path d="M200 80 Q230 85 240 120" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
      <!-- Nasion -->
      <circle cx="235" cy="140" r="3" fill="#94a3b8"/>
      <!-- Nose bridge -->
      <path d="M235 140 L260 200 Q270 230 265 250" fill="none" stroke="#64748b" stroke-width="2"/>
      <!-- Nose tip -->
      <circle cx="270" cy="255" r="20" fill="none" stroke="#64748b" stroke-width="1.5"/>
      <!-- Columella -->
      <path d="M265 275 L255 310 Q250 320 240 315" fill="none" stroke="#64748b" stroke-width="1.5"/>
      <!-- Upper lip -->
      <path d="M240 315 Q230 320 220 315" fill="none" stroke="#cbd5e1" stroke-width="1"/>
      <!-- Ala -->
      <path d="M280 250 Q295 260 290 280 Q280 290 265 275" fill="none" stroke="#64748b" stroke-width="1.5"/>
      <!-- Eye (reference) -->
      <ellipse cx="200" cy="150" rx="20" ry="10" fill="none" stroke="#cbd5e1" stroke-width="1"/>
      <!-- Guide lines -->
      <line x1="100" y1="255" x2="300" y2="255" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4"/>
      <text x="105" y="250" fill="#94a3b8" font-size="10" font-family="Arial">Tip defining point</text>
      <!-- Label -->
      <text x="200" y="30" text-anchor="middle" fill="#64748b" font-size="14" font-family="Arial">WIDOK PROFILOWY</text>
    </svg>
  `;
  return "data:image/svg+xml;base64," + encodeToBase64(svg);
}

function createNoseDiagramBase() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
      <rect fill="#fafafa" width="400" height="500"/>
      <!-- Nose - base view (from below) -->
      <!-- Outer outline -->
      <path d="M200 100 Q280 150 280 220 Q280 300 200 350 Q120 300 120 220 Q120 150 200 100" fill="none" stroke="#64748b" stroke-width="1.5"/>
      <!-- Tip (triangle) -->
      <path d="M200 120 L240 200 L160 200 Z" fill="none" stroke="#64748b" stroke-width="1.5"/>
      <!-- Columella -->
      <rect x="190" y="200" width="20" height="80" fill="none" stroke="#64748b" stroke-width="1.5" rx="5"/>
      <!-- Nostrils -->
      <ellipse cx="155" cy="260" rx="30" ry="45" fill="none" stroke="#64748b" stroke-width="1.5"/>
      <ellipse cx="245" cy="260" rx="30" ry="45" fill="none" stroke="#64748b" stroke-width="1.5"/>
      <!-- Outer ala -->
      <path d="M125 240 Q100 260 110 300 Q125 320 140 310" fill="none" stroke="#64748b" stroke-width="1.5"/>
      <path d="M275 240 Q300 260 290 300 Q275 320 260 310" fill="none" stroke="#64748b" stroke-width="1.5"/>
      <!-- Soft triangle -->
      <path d="M170 200 L200 180 L230 200" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3"/>
      <!-- Center line -->
      <line x1="200" y1="100" x2="200" y2="350" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4"/>
      <!-- Labels -->
      <text x="200" y="30" text-anchor="middle" fill="#64748b" font-size="14" font-family="Arial">WIDOK PODSTAWY</text>
      <text x="200" y="400" text-anchor="middle" fill="#94a3b8" font-size="11" font-family="Arial">Widok od dolu (basal view)</text>
    </svg>
  `;
  return "data:image/svg+xml;base64," + encodeToBase64(svg);
}

export default RhinoPlannerPage;
