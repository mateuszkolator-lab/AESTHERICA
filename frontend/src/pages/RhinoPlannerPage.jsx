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
    items: [
      "Redukcja grzbietu", 
      "Augmentacja grzbietu", 
      "Spreaders", 
      "Elongated spreaders",
      "Radix - redukcja",
      "Radix - augmentacja"
    ]
  },
  {
    name: "Przegroda nosowa",
    items: [
      "Skrzywiona w prawo", 
      "Skrzywiona w lewo", 
      "Kolec do przyszycia - TAK",
      "Kolec do przyszycia - NIE",
      "Pobranie chrząstki",
      "Septal extension graft"
    ]
  },
  {
    name: "Czubek nosa",
    items: [
      "Projekcja ↑ większa", 
      "Projekcja ↓ mniejsza", 
      "Rotacja ↑ większa",
      "Rotacja ↓ mniejsza",
      "Shield graft", 
      "Cap graft",
      "Szwy definiujące"
    ]
  },
  {
    name: "Skrzydełka nosa",
    items: ["Zwężenie skrzydełek", "Alar base reduction", "Alar rim graft", "Wzmocnienie skrzydełek"]
  },
  {
    name: "Kolumella",
    items: ["Strut graft", "Plumping graft", "Korekcja retrakcji"]
  },
  {
    name: "Ogólny kształt nosa",
    items: [
      "Płaski", 
      "Lekko zadarty", 
      "Bardzo zadarty",
      "Zdaje się na chirurga"
    ]
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

  // Initialize single canvas
  const initCanvas = useCallback((canvasEl, fabricRef, diagramType) => {
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
    
    // Add simple label text
    const label = new IText(
      diagramType === "frontal" ? "WIDOK FRONTALNY" : 
      diagramType === "profile" ? "WIDOK PROFILOWY" : "WIDOK PODSTAWY", 
      {
        left: 200,
        top: 20,
        fontSize: 14,
        fontFamily: "Arial",
        fill: "#64748b",
        originX: "center"
      }
    );
    label.set({ selectable: false, evented: false });
    canvas.add(label);
    
    // Add helper text
    const helper = new IText("Rysuj tutaj", {
      left: 200,
      top: 240,
      fontSize: 12,
      fontFamily: "Arial",
      fill: "#94a3b8",
      originX: "center"
    });
    helper.set({ selectable: false, evented: false });
    canvas.add(helper);
    
    canvas.requestRenderAll();
    return canvas;
  }, [activeColor, brushSize]);

  // Initialize canvas when view becomes active
  useEffect(() => {
    if (loading) return;
    
    const timer = setTimeout(() => {
      if (activeView === "frontal" && canvasFrontalRef.current && !fabricFrontalRef.current) {
        initCanvas(canvasFrontalRef.current, fabricFrontalRef, "frontal");
      } else if (activeView === "profile" && canvasProfileRef.current && !fabricProfileRef.current) {
        initCanvas(canvasProfileRef.current, fabricProfileRef, "profile");
      } else if (activeView === "base" && canvasBaseRef.current && !fabricBaseRef.current) {
        initCanvas(canvasBaseRef.current, fabricBaseRef, "base");
      }
      
      // Re-render active canvas
      const canvas = getActiveCanvas();
      if (canvas) {
        canvas.requestRenderAll();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [loading, activeView, initCanvas]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      fabricFrontalRef.current?.dispose();
      fabricProfileRef.current?.dispose();
      fabricBaseRef.current?.dispose();
    };
  }, []);

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
            <div style={{ display: activeView === "frontal" ? "block" : "none", minHeight: "500px" }}>
              <canvas ref={canvasFrontalRef} data-testid="canvas-frontal" width="400" height="500" />
            </div>
            <div style={{ display: activeView === "profile" ? "block" : "none", minHeight: "500px" }}>
              <canvas ref={canvasProfileRef} data-testid="canvas-profile" width="400" height="500" />
            </div>
            <div style={{ display: activeView === "base" ? "block" : "none", minHeight: "500px" }}>
              <canvas ref={canvasBaseRef} data-testid="canvas-base" width="400" height="500" />
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

export default RhinoPlannerPage;
