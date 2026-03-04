import { useState, useMemo } from "react";
import { X, Calendar } from "lucide-react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { PHOTO_ANGLE_LABELS, VISIT_TYPE_LABELS } from "../../utils/constants";

const PhotoCompareModal = ({ photos, visits = [], onClose }) => {
  // Grupuj zdjęcia według wizyt
  const photosByVisit = useMemo(() => {
    const grouped = {};
    
    // Najpierw dodaj zdjęcia z wizyt
    if (visits && visits.length > 0) {
      visits.forEach(visit => {
        if (visit.photos && visit.photos.length > 0) {
          const visitLabel = `${visit.date} - ${VISIT_TYPE_LABELS[visit.type] || visit.type}`;
          grouped[visit.id] = {
            label: visitLabel,
            date: visit.date,
            type: visit.type,
            photos: visit.photos.map(p => ({
              ...p,
              visitId: visit.id,
              visitDate: visit.date,
              visitType: visit.type,
              visitLabel: visitLabel
            }))
          };
        }
      });
    }
    
    // Dodaj zdjęcia bezpośrednie (bez wizyty) jeśli istnieją
    const directPhotos = photos.filter(p => !p.visitId && !p.visitDate);
    if (directPhotos.length > 0) {
      grouped['direct'] = {
        label: 'Zdjęcia bezpośrednie',
        date: null,
        type: null,
        photos: directPhotos.map(p => ({
          ...p,
          visitLabel: 'Zdjęcia bezpośrednie'
        }))
      };
    }
    
    return grouped;
  }, [photos, visits]);

  // Wszystkie zdjęcia płasko
  const allPhotos = useMemo(() => {
    const result = [];
    Object.values(photosByVisit).forEach(group => {
      result.push(...group.photos);
    });
    return result;
  }, [photosByVisit]);

  const [leftPhoto, setLeftPhoto] = useState(allPhotos[0] || null);
  const [rightPhoto, setRightPhoto] = useState(allPhotos.length > 1 ? allPhotos[1] : null);
  const [viewMode, setViewMode] = useState("side-by-side");
  const [leftVisitFilter, setLeftVisitFilter] = useState("all");
  const [rightVisitFilter, setRightVisitFilter] = useState("all");

  // Filtruj zdjęcia według wizyty
  const getFilteredPhotos = (filter) => {
    if (filter === "all") return allPhotos;
    return photosByVisit[filter]?.photos || [];
  };

  const leftPhotos = getFilteredPhotos(leftVisitFilter);
  const rightPhotos = getFilteredPhotos(rightVisitFilter);

  const getPhotoLabel = (photo, index) => {
    const angleLabel = PHOTO_ANGLE_LABELS[photo?.angle] || photo?.angle || "";
    return angleLabel ? `${angleLabel} #${index + 1}` : `Zdjęcie #${index + 1}`;
  };

  const visitOptions = [
    { value: "all", label: "Wszystkie wizyty" },
    ...Object.entries(photosByVisit).map(([id, group]) => ({
      value: id,
      label: group.label
    }))
  ];

  if (allPhotos.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50" data-testid="photo-compare-modal">
        <div className="bg-white rounded-xl p-8 text-center max-w-md">
          <p className="text-slate-600 mb-4">Brak zdjęć do porównania</p>
          <button onClick={onClose} className="px-4 py-2 bg-teal-700 text-white rounded-lg">
            Zamknij
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/95 flex flex-col z-50" data-testid="photo-compare-modal">
      {/* Header */}
      <div className="p-4 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-white">Porównanie zdjęć</h2>
          <div className="flex gap-1 bg-white/10 rounded-lg p-1">
            <button
              onClick={() => setViewMode("side-by-side")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === "side-by-side" ? "bg-white text-black" : "text-white hover:bg-white/20"
              }`}
            >
              Obok siebie
            </button>
            <button
              onClick={() => setViewMode("slider")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === "slider" ? "bg-white text-black" : "text-white hover:bg-white/20"
              }`}
            >
              Suwak
            </button>
          </div>
        </div>
        <button onClick={onClose} className="text-white p-2 hover:bg-white/10 rounded-lg">
          <X className="w-6 h-6" />
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        {viewMode === "side-by-side" ? (
          <div className="flex-1 flex flex-col md:flex-row gap-4">
            {/* Left Panel */}
            <div className="flex-1 flex flex-col">
              <div className="mb-3 space-y-2">
                {/* Wybór wizyty */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-white/60" />
                  <select
                    value={leftVisitFilter}
                    onChange={(e) => {
                      setLeftVisitFilter(e.target.value);
                      const filtered = getFilteredPhotos(e.target.value);
                      if (filtered.length > 0 && !filtered.find(p => p.id === leftPhoto?.id)) {
                        setLeftPhoto(filtered[0]);
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-white/10 text-white border border-white/20 rounded-lg text-sm"
                  >
                    {visitOptions.map(opt => (
                      <option key={opt.value} value={opt.value} className="text-black">{opt.label}</option>
                    ))}
                  </select>
                </div>
                {/* Wybór zdjęcia */}
                <select
                  value={leftPhotos.findIndex(p => p.id === leftPhoto?.id)}
                  onChange={(e) => setLeftPhoto(leftPhotos[parseInt(e.target.value)])}
                  className="w-full px-3 py-2 bg-white/10 text-white border border-white/20 rounded-lg text-sm"
                  data-testid="left-photo-select"
                >
                  {leftPhotos.map((photo, i) => (
                    <option key={photo.id} value={i} className="text-black">
                      {getPhotoLabel(photo, i)}
                    </option>
                  ))}
                </select>
              </div>
              {leftPhoto && (
                <div className="flex-1 flex items-center justify-center bg-black/50 rounded-lg overflow-hidden">
                  <img 
                    src={leftPhoto.data} 
                    alt="Porównanie lewe" 
                    className="max-w-full max-h-[55vh] object-contain" 
                  />
                </div>
              )}
              <div className="mt-2 text-center">
                <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-amber-500 text-white">
                  {leftPhoto?.visitLabel || "Zdjęcie lewe"}
                </span>
              </div>
            </div>
            
            {/* Divider */}
            <div className="hidden md:flex items-center">
              <div className="w-px h-full bg-white/20" />
            </div>
            
            {/* Right Panel */}
            <div className="flex-1 flex flex-col">
              <div className="mb-3 space-y-2">
                {/* Wybór wizyty */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-white/60" />
                  <select
                    value={rightVisitFilter}
                    onChange={(e) => {
                      setRightVisitFilter(e.target.value);
                      const filtered = getFilteredPhotos(e.target.value);
                      if (filtered.length > 0 && !filtered.find(p => p.id === rightPhoto?.id)) {
                        setRightPhoto(filtered[0]);
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-white/10 text-white border border-white/20 rounded-lg text-sm"
                  >
                    {visitOptions.map(opt => (
                      <option key={opt.value} value={opt.value} className="text-black">{opt.label}</option>
                    ))}
                  </select>
                </div>
                {/* Wybór zdjęcia */}
                <select
                  value={rightPhotos.findIndex(p => p.id === rightPhoto?.id)}
                  onChange={(e) => setRightPhoto(rightPhotos[parseInt(e.target.value)])}
                  className="w-full px-3 py-2 bg-white/10 text-white border border-white/20 rounded-lg text-sm"
                  data-testid="right-photo-select"
                >
                  {rightPhotos.map((photo, i) => (
                    <option key={photo.id} value={i} className="text-black">
                      {getPhotoLabel(photo, i)}
                    </option>
                  ))}
                </select>
              </div>
              {rightPhoto && (
                <div className="flex-1 flex items-center justify-center bg-black/50 rounded-lg overflow-hidden">
                  <img 
                    src={rightPhoto.data} 
                    alt="Porównanie prawe" 
                    className="max-w-full max-h-[55vh] object-contain" 
                  />
                </div>
              )}
              <div className="mt-2 text-center">
                <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-emerald-500 text-white">
                  {rightPhoto?.visitLabel || "Zdjęcie prawe"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Slider View */
          <div className="flex-1 flex flex-col">
            <div className="mb-4 flex flex-wrap items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-sm font-medium">Lewe:</span>
                <select
                  value={allPhotos.findIndex(p => p.id === leftPhoto?.id)}
                  onChange={(e) => setLeftPhoto(allPhotos[parseInt(e.target.value)])}
                  className="px-3 py-2 bg-white/10 text-white border border-white/20 rounded-lg text-sm max-w-[200px]"
                >
                  {allPhotos.map((photo, i) => (
                    <option key={photo.id} value={i} className="text-black">
                      {photo.visitLabel ? `${photo.visitLabel.split(' - ')[0]} - ${getPhotoLabel(photo, i)}` : getPhotoLabel(photo, i)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 text-sm font-medium">Prawe:</span>
                <select
                  value={allPhotos.findIndex(p => p.id === rightPhoto?.id)}
                  onChange={(e) => setRightPhoto(allPhotos[parseInt(e.target.value)])}
                  className="px-3 py-2 bg-white/10 text-white border border-white/20 rounded-lg text-sm max-w-[200px]"
                >
                  {allPhotos.map((photo, i) => (
                    <option key={photo.id} value={i} className="text-black">
                      {photo.visitLabel ? `${photo.visitLabel.split(' - ')[0]} - ${getPhotoLabel(photo, i)}` : getPhotoLabel(photo, i)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {leftPhoto && rightPhoto && (
              <div className="flex-1 max-w-4xl mx-auto w-full rounded-lg overflow-hidden">
                <ReactCompareSlider
                  itemOne={<ReactCompareSliderImage src={leftPhoto.data} alt="Lewe" style={{ objectFit: 'contain' }} />}
                  itemTwo={<ReactCompareSliderImage src={rightPhoto.data} alt="Prawe" style={{ objectFit: 'contain' }} />}
                  style={{ height: "100%", maxHeight: "60vh" }}
                />
              </div>
            )}
            
            <div className="mt-4 flex items-center justify-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-white text-sm">{leftPhoto?.visitLabel || "Lewe"}</span>
              </div>
              <div className="text-white/40">|</div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-white text-sm">{rightPhoto?.visitLabel || "Prawe"}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick select thumbnails grouped by visit */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-start gap-4 overflow-x-auto pb-2">
          {Object.entries(photosByVisit).map(([visitId, group]) => (
            <div key={visitId} className="shrink-0">
              <p className="text-white/60 text-xs mb-2 truncate max-w-[150px]">{group.label}</p>
              <div className="flex gap-2">
                {group.photos.slice(0, 4).map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => {
                      if (!leftPhoto || (leftPhoto && rightPhoto)) {
                        setLeftPhoto(photo);
                        setRightPhoto(null);
                      } else {
                        setRightPhoto(photo);
                      }
                    }}
                    className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                      leftPhoto?.id === photo.id ? 'border-amber-500' :
                      rightPhoto?.id === photo.id ? 'border-emerald-500' :
                      'border-transparent hover:border-white/50'
                    }`}
                  >
                    <img src={photo.data} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
                {group.photos.length > 4 && (
                  <span className="text-white/40 text-xs self-center">+{group.photos.length - 4}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PhotoCompareModal;
