import { useState } from "react";
import { X, Maximize2, Filter, SlidersHorizontal } from "lucide-react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { PHOTO_CATEGORY_LABELS } from "../../utils/constants";

const PhotoCompareModal = ({ photos, onClose }) => {
  const [leftPhoto, setLeftPhoto] = useState(photos.find(p => p.category === 'before') || photos[0]);
  const [rightPhoto, setRightPhoto] = useState(photos.find(p => p.category === 'after') || photos[photos.length > 1 ? 1 : 0]);
  const [viewMode, setViewMode] = useState("side-by-side"); // side-by-side | slider | fullscreen
  const [leftFilter, setLeftFilter] = useState("all");
  const [rightFilter, setRightFilter] = useState("all");

  const filterPhotos = (filter) => {
    if (filter === "all") return photos;
    return photos.filter(p => p.category === filter);
  };

  const leftPhotos = filterPhotos(leftFilter);
  const rightPhotos = filterPhotos(rightFilter);

  const categories = [
    { value: "all", label: "Wszystkie" },
    { value: "before", label: "Przed" },
    { value: "after", label: "Po" },
    { value: "during", label: "W trakcie" },
    { value: "other", label: "Inne" }
  ];

  return (
    <div className="fixed inset-0 bg-black/95 flex flex-col z-50" data-testid="photo-compare-modal">
      {/* Header */}
      <div className="p-4 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-white">Porównanie zdjęć przed i po</h2>
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
              <div className="mb-3 flex items-center gap-3">
                <select
                  value={leftFilter}
                  onChange={(e) => {
                    setLeftFilter(e.target.value);
                    const filtered = filterPhotos(e.target.value);
                    if (filtered.length > 0 && !filtered.find(p => p.id === leftPhoto?.id)) {
                      setLeftPhoto(filtered[0]);
                    }
                  }}
                  className="px-3 py-2 bg-white/10 text-white border border-white/20 rounded-lg text-sm"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value} className="text-black">{cat.label}</option>
                  ))}
                </select>
                <select
                  value={leftPhotos.findIndex(p => p.id === leftPhoto?.id)}
                  onChange={(e) => setLeftPhoto(leftPhotos[parseInt(e.target.value)])}
                  className="flex-1 px-3 py-2 bg-white/10 text-white border border-white/20 rounded-lg text-sm"
                  data-testid="left-photo-select"
                >
                  {leftPhotos.map((photo, i) => (
                    <option key={photo.id} value={i} className="text-black">
                      {photo.visitDate} - {PHOTO_CATEGORY_LABELS[photo.category] || "Zdjęcie"} {i + 1}
                    </option>
                  ))}
                </select>
              </div>
              {leftPhoto && (
                <div className="flex-1 flex items-center justify-center bg-black/50 rounded-lg overflow-hidden">
                  <img 
                    src={leftPhoto.data} 
                    alt="Porównanie lewe" 
                    className="max-w-full max-h-[60vh] object-contain" 
                  />
                </div>
              )}
              <div className="mt-2 text-center">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  leftPhoto?.category === 'before' ? 'bg-amber-500 text-white' :
                  leftPhoto?.category === 'after' ? 'bg-emerald-500 text-white' :
                  'bg-white/20 text-white'
                }`}>
                  {PHOTO_CATEGORY_LABELS[leftPhoto?.category] || "Zdjęcie"}
                </span>
              </div>
            </div>
            
            {/* Divider */}
            <div className="hidden md:flex items-center">
              <div className="w-px h-full bg-white/20" />
            </div>
            
            {/* Right Panel */}
            <div className="flex-1 flex flex-col">
              <div className="mb-3 flex items-center gap-3">
                <select
                  value={rightFilter}
                  onChange={(e) => {
                    setRightFilter(e.target.value);
                    const filtered = filterPhotos(e.target.value);
                    if (filtered.length > 0 && !filtered.find(p => p.id === rightPhoto?.id)) {
                      setRightPhoto(filtered[0]);
                    }
                  }}
                  className="px-3 py-2 bg-white/10 text-white border border-white/20 rounded-lg text-sm"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value} className="text-black">{cat.label}</option>
                  ))}
                </select>
                <select
                  value={rightPhotos.findIndex(p => p.id === rightPhoto?.id)}
                  onChange={(e) => setRightPhoto(rightPhotos[parseInt(e.target.value)])}
                  className="flex-1 px-3 py-2 bg-white/10 text-white border border-white/20 rounded-lg text-sm"
                  data-testid="right-photo-select"
                >
                  {rightPhotos.map((photo, i) => (
                    <option key={photo.id} value={i} className="text-black">
                      {photo.visitDate} - {PHOTO_CATEGORY_LABELS[photo.category] || "Zdjęcie"} {i + 1}
                    </option>
                  ))}
                </select>
              </div>
              {rightPhoto && (
                <div className="flex-1 flex items-center justify-center bg-black/50 rounded-lg overflow-hidden">
                  <img 
                    src={rightPhoto.data} 
                    alt="Porównanie prawe" 
                    className="max-w-full max-h-[60vh] object-contain" 
                  />
                </div>
              )}
              <div className="mt-2 text-center">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  rightPhoto?.category === 'before' ? 'bg-amber-500 text-white' :
                  rightPhoto?.category === 'after' ? 'bg-emerald-500 text-white' :
                  'bg-white/20 text-white'
                }`}>
                  {PHOTO_CATEGORY_LABELS[rightPhoto?.category] || "Zdjęcie"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Slider View */
          <div className="flex-1 flex flex-col">
            <div className="mb-4 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-white/60 text-sm">Lewy:</span>
                <select
                  value={photos.findIndex(p => p.id === leftPhoto?.id)}
                  onChange={(e) => setLeftPhoto(photos[parseInt(e.target.value)])}
                  className="px-3 py-2 bg-white/10 text-white border border-white/20 rounded-lg text-sm"
                >
                  {photos.map((photo, i) => (
                    <option key={photo.id} value={i} className="text-black">
                      {photo.visitDate} - {PHOTO_CATEGORY_LABELS[photo.category] || "Zdjęcie"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/60 text-sm">Prawy:</span>
                <select
                  value={photos.findIndex(p => p.id === rightPhoto?.id)}
                  onChange={(e) => setRightPhoto(photos[parseInt(e.target.value)])}
                  className="px-3 py-2 bg-white/10 text-white border border-white/20 rounded-lg text-sm"
                >
                  {photos.map((photo, i) => (
                    <option key={photo.id} value={i} className="text-black">
                      {photo.visitDate} - {PHOTO_CATEGORY_LABELS[photo.category] || "Zdjęcie"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {leftPhoto && rightPhoto && (
              <div className="flex-1 max-w-4xl mx-auto w-full rounded-lg overflow-hidden">
                <ReactCompareSlider
                  itemOne={<ReactCompareSliderImage src={leftPhoto.data} alt="Przed" style={{ objectFit: 'contain' }} />}
                  itemTwo={<ReactCompareSliderImage src={rightPhoto.data} alt="Po" style={{ objectFit: 'contain' }} />}
                  style={{ height: "100%", maxHeight: "65vh" }}
                />
              </div>
            )}
            
            <div className="mt-4 flex items-center justify-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-white text-sm">{PHOTO_CATEGORY_LABELS[leftPhoto?.category] || "Lewe"}</span>
              </div>
              <div className="text-white/40">|</div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-white text-sm">{PHOTO_CATEGORY_LABELS[rightPhoto?.category] || "Prawe"}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick select thumbnails */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="text-white/60 text-xs shrink-0">Szybki wybór:</span>
          {photos.slice(0, 8).map((photo, i) => (
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
              className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                leftPhoto?.id === photo.id ? 'border-amber-500' :
                rightPhoto?.id === photo.id ? 'border-emerald-500' :
                'border-transparent hover:border-white/50'
              }`}
            >
              <img src={photo.data} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
          {photos.length > 8 && (
            <span className="text-white/40 text-xs">+{photos.length - 8} więcej</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoCompareModal;
