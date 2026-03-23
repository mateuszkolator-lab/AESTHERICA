import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  ChevronLeft, Save, Download, Trash2, Undo, Redo,
  Pencil, Eraser, Circle, Square, Type, Palette,
  RotateCcw, ZoomIn, ZoomOut, Move, Image as ImageIcon
} from "lucide-react";
import { Canvas, PencilBrush, Circle as FabricCircle, Rect, IText, Line, FabricImage } from "fabric";
import { jsPDF } from "jspdf";
import api from "../utils/api";

// Dostępne diagramy tła
const BACKGROUND_DIAGRAMS = {
  frontal: [
    { id: "frontal1", name: "Frontalny 1", src: "/diagram-frontal.png" },
    { id: "frontal2", name: "Frontalny 2", src: "/diagram-frontal2.png" },
  ],
  profile: [
    { id: "profile1", name: "Profil 1", src: "/diagram-profile.png" },
    { id: "profile2", name: "Profil 2", src: "/diagram-profile2.png" },
  ],
  base: [
    { id: "base1", name: "Podstawa", src: "/diagram-base1.png" },
    { id: "base2", name: "Czubek (szczegóły)", src: "/diagram-base2.png" },
  ]
};

// Predefiniowane procedury rinoplastyki
const PROCEDURE_CATEGORIES = [
  {
    name: "Grzbiet nosa",
    items: [
      "Redukcja grzbietu", 
      "Augmentacja grzbietu", 
      "Spreaders", 
      "Elongated spreaders"
    ],
    grouped: [
      { label: "Radix", options: ["redukcja", "augmentacja"] }
    ]
  },
  {
    name: "Przegroda nosowa",
    items: [
      "Pobranie chrząstki",
      "Septal extension graft",
      "Kolec nosowy - zredukować"
    ],
    grouped: [
      { label: "Skrzywienie", options: ["w prawo", "w lewo"] },
      { label: "Kolec do przyszycia", options: ["TAK", "NIE"] }
    ]
  },
  {
    name: "Czubek nosa",
    items: [
      "Shield graft", 
      "Cap graft",
      "Szwy definiujące"
    ],
    grouped: [
      { label: "Projekcja", options: ["↑ większa", "↓ mniejsza"] },
      { label: "Rotacja", options: ["↑ większa", "↓ mniejsza"] }
    ]
  },
  {
    name: "Skrzydełka nosa",
    items: [
      "Zwężenie skrzydełek", 
      "Alar base reduction", 
      "Alar rim graft", 
      "Wzmocnienie skrzydełek",
      "Lateral crural strut graft",
      "Batten graft"
    ]
  },
  {
    name: "Kolumella",
    items: [
      "Strut graft", 
      "Plumping graft", 
      "Korekcja retrakcji"
    ],
    grouped: [
      { label: "Columellar show", options: ["zwiększyć", "zmniejszyć"] }
    ]
  },
  {
    name: "Materiał do augmentacji",
    items: [
      "Chrząstka przegrody",
      "Chrząstka ucha",
      "Chrząstka żebra",
      "Powięź"
    ],
    grouped: [
      { label: "Ryzyko potrzeby żebra", options: ["małe", "średnie", "duże"] }
    ]
  },
  {
    name: "Planowany kształt nosa",
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
  const [showDiagramPicker, setShowDiagramPicker] = useState(false);
  const [selectedDiagrams, setSelectedDiagrams] = useState({
    frontal: null,
    profile: null,
    base: null
  });
  
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
      width: 500,
      height: 500,
      backgroundColor: "#ffffff",
      isDrawingMode: true,
      selection: true
    });
    
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = "#ef4444"; // Default red
    canvas.freeDrawingBrush.width = 4; // Default size
    
    fabricRef.current = canvas;
    
    // Add simple label text (will be removed when background is set)
    const label = new IText(
      diagramType === "frontal" ? "WIDOK FRONTALNY" : 
      diagramType === "profile" ? "WIDOK PROFILOWY" : "WIDOK PODSTAWY", 
      {
        left: 250,
        top: 20,
        fontSize: 14,
        fontFamily: "Arial",
        fill: "#64748b",
        originX: "center"
      }
    );
    label.set({ selectable: false, evented: false, isLabel: true });
    canvas.add(label);
    
    // Add helper text (will be removed when background is set)
    const helper = new IText("Kliknij 'Wybierz schemat' aby ustawić tło", {
      left: 250,
      top: 250,
      fontSize: 12,
      fontFamily: "Arial",
      fill: "#94a3b8",
      originX: "center"
    });
    helper.set({ selectable: false, evented: false, isLabel: true });
    canvas.add(helper);
    
    canvas.requestRenderAll();
    return canvas;
  }, []); // No dependencies - stable function

  // Initialize canvas when view becomes active
  useEffect(() => {
    if (loading) return;
    
    // Longer delay to ensure DOM is ready
    const timer = setTimeout(() => {
      console.log("Initializing canvas, activeView:", activeView);
      console.log("Refs:", canvasFrontalRef.current, fabricFrontalRef.current);
      
      if (activeView === "frontal" && canvasFrontalRef.current && !fabricFrontalRef.current) {
        console.log("Creating frontal canvas");
        initCanvas(canvasFrontalRef.current, fabricFrontalRef, "frontal");
      } else if (activeView === "profile" && canvasProfileRef.current && !fabricProfileRef.current) {
        initCanvas(canvasProfileRef.current, fabricProfileRef, "profile");
      } else if (activeView === "base" && canvasBaseRef.current && !fabricBaseRef.current) {
        initCanvas(canvasBaseRef.current, fabricBaseRef, "base");
      }
      
      // Re-render active canvas
      const canvas = getActiveCanvas();
      if (canvas) {
        console.log("Re-rendering canvas, objects:", canvas.getObjects().length);
        canvas.requestRenderAll();
      }
    }, 500); // Increased delay

    return () => clearTimeout(timer);
  }, [loading, activeView, initCanvas]);
  
  // Cleanup on unmount
  useEffect(() => {
    const frontal = fabricFrontalRef.current;
    const profile = fabricProfileRef.current;
    const base = fabricBaseRef.current;
    return () => {
      frontal?.dispose();
      profile?.dispose();
      base?.dispose();
    };
  }, []);

  // Funkcja do ustawienia tła diagramu
  const setCanvasBackground = async (diagramSrc) => {
    const canvas = getActiveCanvas();
    if (!canvas) return;
    
    try {
      const imgEl = new Image();
      imgEl.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        imgEl.onload = resolve;
        imgEl.onerror = reject;
        imgEl.src = diagramSrc;
      });
      
      // Usuń stare tło i etykiety NAJPIERW
      const objects = canvas.getObjects().slice(); // kopia tablicy
      objects.forEach(obj => {
        if (obj.isBackground || obj.isLabel) {
          canvas.remove(obj);
        }
      });
      
      // Użyj stałych wymiarów canvas (500x500)
      const canvasWidth = 500;
      const canvasHeight = 500;
      
      // Debug - sprawdź wymiary
      console.log("Image dimensions:", imgEl.width, "x", imgEl.height);
      console.log("Canvas dimensions:", canvasWidth, "x", canvasHeight);
      
      // Skaluj obraz proporcjonalnie aby CAŁY był widoczny (contain)
      const scaleX = canvasWidth / imgEl.width;
      const scaleY = canvasHeight / imgEl.height;
      const scale = Math.min(scaleX, scaleY); // contain - cały obraz widoczny
      
      console.log("Scale:", scale, "scaleX:", scaleX, "scaleY:", scaleY);
      
      // Wyśrodkuj obraz
      const scaledWidth = imgEl.width * scale;
      const scaledHeight = imgEl.height * scale;
      const left = (canvasWidth - scaledWidth) / 2;
      const top = (canvasHeight - scaledHeight) / 2;
      
      console.log("Position - left:", left, "top:", top);
      console.log("Scaled size:", scaledWidth, "x", scaledHeight);
      
      // Ustaw obraz wyśrodkowany - CAŁY obraz musi być widoczny
      const fabricImg = new FabricImage(imgEl, {
        left: left,
        top: top,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        scaleX: scale,
        scaleY: scale,
        opacity: 0.7
      });
      
      fabricImg.isBackground = true;
      canvas.add(fabricImg);
      canvas.sendObjectToBack(fabricImg);
      canvas.requestRenderAll();
      
      // Zapisz wybrany diagram
      setSelectedDiagrams(prev => ({
        ...prev,
        [activeView]: diagramSrc
      }));
      
      setShowDiagramPicker(false);
      toast.success("Tło ustawione!");
    } catch (err) {
      console.error("Failed to load diagram:", err);
      toast.error("Nie udało się załadować diagramu");
    }
  };

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
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // === STRONA 1: Nagłówek i diagramy ===
      
      // Nagłówek z logo
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, 40, "F");
      
      // Dodaj logo (konwertowane z SVG)
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve;
          logoImg.onerror = reject;
          logoImg.src = '/logo-rhinoplasty.svg';
        });
        
        // Konwersja SVG do canvas, potem do PNG
        const canvas = document.createElement('canvas');
        canvas.width = 525;
        canvas.height = 107;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(logoImg, 0, 0, 525, 107);
        const logoDataUrl = canvas.toDataURL('image/png');
        
        // Dodaj logo do PDF (wycentrowane)
        const logoWidth = 70;
        const logoHeight = 14;
        pdf.addImage(logoDataUrl, 'PNG', (pageWidth - logoWidth) / 2, 8, logoWidth, logoHeight);
      } catch (e) {
        // Fallback - tekst jeśli logo się nie załaduje
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(29, 29, 27);
        pdf.text("KOLATOR RHINOPLASTY", pageWidth / 2, 18, { align: "center" });
      }
      
      // Linia pod logo
      pdf.setDrawColor(220, 220, 220);
      pdf.line(20, 28, pageWidth - 20, 28);
      
      // Tytuł dokumentu
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(13, 148, 136); // teal-600
      pdf.text("PLAN OPERACJI RINOPLASTYKI", pageWidth / 2, 38, { align: "center" });
      
      // Reset text color
      pdf.setTextColor(0, 0, 0);
      
      // Dane pacjenta - box
      pdf.setFillColor(248, 250, 252); // slate-50
      pdf.roundedRect(15, 45, pageWidth - 30, 22, 3, 3, "F");
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("Pacjent:", 20, 54);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${patient?.first_name} ${patient?.last_name}`, 45, 54);
      
      pdf.setFont("helvetica", "bold");
      pdf.text("Data planowania:", 110, 54);
      pdf.setFont("helvetica", "normal");
      pdf.text(new Date().toLocaleDateString("pl-PL"), 150, 54);
      
      pdf.setFont("helvetica", "bold");
      pdf.text("Nr pacjenta:", 20, 62);
      pdf.setFont("helvetica", "normal");
      pdf.text(patientId.substring(0, 8).toUpperCase(), 50, 62);
      
      // Diagramy - 3 w rzędzie
      let yPos = 75;
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(71, 85, 105); // slate-600
      pdf.text("Schematy operacyjne", 20, yPos);
      pdf.setTextColor(0, 0, 0);
      yPos += 8;
      
      const canvases = [
        { ref: fabricFrontalRef, name: "Frontalny" },
        { ref: fabricProfileRef, name: "Profilowy" },
        { ref: fabricBaseRef, name: "Podstawy" }
      ];
      
      const imgWidth = 55;
      const imgHeight = 70;
      let xPos = 20;
      
      for (const { ref, name } of canvases) {
        // Label
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.text(name, xPos + imgWidth/2, yPos, { align: "center" });
        
        // Border
        pdf.setDrawColor(200, 200, 200);
        pdf.setFillColor(250, 250, 250);
        pdf.roundedRect(xPos, yPos + 3, imgWidth, imgHeight, 2, 2, "FD");
        
        // Image or placeholder
        if (ref.current && ref.current.getObjects().length > 0) {
          const dataUrl = ref.current.toDataURL({ format: "png", quality: 0.8 });
          pdf.addImage(dataUrl, "PNG", xPos + 1, yPos + 4, imgWidth - 2, imgHeight - 2);
        } else {
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(150, 150, 150);
          pdf.text("Brak rysunku", xPos + imgWidth/2, yPos + imgHeight/2 + 3, { align: "center" });
          pdf.setTextColor(0, 0, 0);
        }
        
        xPos += imgWidth + 10;
      }
      
      yPos += imgHeight + 15;
      
      // === Procedury na tej samej stronie ===
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(71, 85, 105);
      pdf.text("Planowane procedury", 20, yPos);
      pdf.setTextColor(0, 0, 0);
      yPos += 8;
      
      pdf.setFontSize(9);
      
      const procedureEntries = Object.entries(selectedProcedures).filter(([_, items]) => items && items.length > 0);
      
      // 2 kolumny dla procedur
      const colWidth = (pageWidth - 40) / 2;
      let col = 0;
      let colYPos = yPos;
      let maxColY = yPos;
      
      procedureEntries.forEach(([category, items], index) => {
        const xOffset = 20 + col * colWidth;
        
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(13, 148, 136);
        pdf.text(category, xOffset, colYPos);
        pdf.setTextColor(0, 0, 0);
        colYPos += 5;
        
        pdf.setFont("helvetica", "normal");
        items.forEach(item => {
          pdf.text(`• ${item}`, xOffset + 3, colYPos);
          colYPos += 4;
        });
        colYPos += 3;
        
        if (colYPos > maxColY) maxColY = colYPos;
        
        // Switch to second column after half
        if (index === Math.floor(procedureEntries.length / 2) - 1) {
          col = 1;
          colYPos = yPos;
        }
      });
      
      yPos = maxColY + 5;
      
      // === Notatki ===
      if (yPos > pageHeight - 80 && (notes || surgeonNotes)) {
        pdf.addPage();
        yPos = 20;
      }
      
      // Notatki ogólne
      if (notes) {
        pdf.setFillColor(248, 250, 252);
        const notesLines = pdf.splitTextToSize(notes, pageWidth - 50);
        const notesHeight = Math.max(notesLines.length * 4 + 12, 20);
        pdf.roundedRect(15, yPos, pageWidth - 30, notesHeight, 3, 3, "F");
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(71, 85, 105);
        pdf.text("Notatki", 20, yPos + 7);
        pdf.setTextColor(0, 0, 0);
        
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.text(notesLines, 20, yPos + 13);
        yPos += notesHeight + 5;
      }
      
      // Notatki chirurga
      if (surgeonNotes) {
        pdf.setFillColor(254, 252, 232); // yellow-50
        const surgeonLines = pdf.splitTextToSize(surgeonNotes, pageWidth - 50);
        const surgeonHeight = Math.max(surgeonLines.length * 4 + 12, 20);
        pdf.roundedRect(15, yPos, pageWidth - 30, surgeonHeight, 3, 3, "F");
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(161, 98, 7); // yellow-700
        pdf.text("Notatki chirurgiczne", 20, yPos + 7);
        pdf.setTextColor(0, 0, 0);
        
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.text(surgeonLines, 20, yPos + 13);
      }
      
      // Stopka na każdej stronie
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);
        pdf.text(
          `Wygenerowano: ${new Date().toLocaleString("pl-PL")} | Strona ${i} z ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
      }
      
      // Zapisz PDF
      const fileName = `RhinoPlan_${patient?.last_name}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
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
            <ToolButton 
              icon={<ImageIcon className="w-5 h-5" />} 
              onClick={() => setShowDiagramPicker(true)}
              title="Wybierz tło"
              active={showDiagramPicker}
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
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 relative">
            {/* Przycisk wyboru tła */}
            <button
              onClick={() => setShowDiagramPicker(true)}
              className="absolute top-2 right-2 z-10 flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-600 transition-colors"
            >
              <ImageIcon className="w-4 h-4" />
              Wybierz schemat
            </button>
            
            <div style={{ display: activeView === "frontal" ? "block" : "none", minHeight: "500px" }}>
              <canvas ref={canvasFrontalRef} data-testid="canvas-frontal" width="500" height="500" style={{ border: "1px solid #e2e8f0", borderRadius: "8px" }} />
            </div>
            <div style={{ display: activeView === "profile" ? "block" : "none", minHeight: "500px" }}>
              <canvas ref={canvasProfileRef} data-testid="canvas-profile" width="500" height="500" style={{ border: "1px solid #e2e8f0", borderRadius: "8px" }} />
            </div>
            <div style={{ display: activeView === "base" ? "block" : "none", minHeight: "500px" }}>
              <canvas ref={canvasBaseRef} data-testid="canvas-base" width="500" height="500" style={{ border: "1px solid #e2e8f0", borderRadius: "8px" }} />
            </div>
          </div>

          {/* Modal wyboru diagramu */}
          {showDiagramPicker && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDiagramPicker(false)}>
              <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">
                  Wybierz schemat dla: {activeView === "frontal" ? "Widok frontalny" : activeView === "profile" ? "Widok profilowy" : "Widok podstawy"}
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  {BACKGROUND_DIAGRAMS[activeView]?.map(diagram => (
                    <button
                      key={diagram.id}
                      onClick={() => setCanvasBackground(diagram.src)}
                      className="border-2 border-slate-200 rounded-lg p-2 hover:border-teal-500 hover:bg-teal-50 transition-all"
                    >
                      <img 
                        src={diagram.src} 
                        alt={diagram.name}
                        className="w-full h-40 object-contain bg-white rounded"
                      />
                      <p className="text-sm font-medium text-slate-700 mt-2">{diagram.name}</p>
                    </button>
                  ))}
                </div>
                
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setShowDiagramPicker(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Formularz procedur */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Planowane procedury
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {PROCEDURE_CATEGORIES.map(category => (
                <div 
                  key={category.name} 
                  className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold text-slate-800 text-base mb-4 pb-2 border-b border-slate-200">
                    {category.name}
                  </h3>
                  <div className="space-y-3">
                    {/* Grouped options (label + choices) */}
                    {category.grouped && category.grouped.map(group => (
                      <div key={group.label} className="bg-white rounded-lg p-3 border border-slate-100">
                        <span className="text-sm text-slate-700 font-medium block mb-2">{group.label}</span>
                        <div className="flex flex-wrap gap-2">
                          {group.options.map(option => (
                            <label 
                              key={option} 
                              className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-full border transition-all text-sm ${
                                (selectedProcedures[category.name] || []).includes(`${group.label} - ${option}`)
                                  ? 'bg-teal-50 border-teal-300 text-teal-700'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-teal-200 hover:bg-teal-50/50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={(selectedProcedures[category.name] || []).includes(`${group.label} - ${option}`)}
                                onChange={() => toggleProcedure(category.name, `${group.label} - ${option}`)}
                                className="w-3.5 h-3.5 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                              />
                              <span>{option}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    {/* Regular items */}
                    {category.items && category.items.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {category.items.map(item => (
                          <label 
                            key={item} 
                            className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border transition-all ${
                              (selectedProcedures[category.name] || []).includes(item)
                                ? 'bg-teal-50 border-teal-200'
                                : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={(selectedProcedures[category.name] || []).includes(item)}
                              onChange={() => toggleProcedure(category.name, item)}
                              className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                            />
                            <span className="text-sm text-slate-700">{item}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Notatki */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 p-5">
                <label className="block text-sm font-semibold text-slate-800 mb-3">
                  Notatki ogólne
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Dodatkowe informacje o planie..."
                  className="w-full h-32 px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none text-sm"
                  data-testid="notes-textarea"
                />
              </div>
              <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 p-5">
                <label className="block text-sm font-semibold text-slate-800 mb-3">
                  Notatki chirurga
                </label>
                <textarea
                  value={surgeonNotes}
                  onChange={(e) => setSurgeonNotes(e.target.value)}
                  placeholder="Techniczne notatki chirurgiczne..."
                  className="w-full h-32 px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none text-sm"
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
