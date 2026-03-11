// SVG Schematy nosa dla Planera Rinoplastyki

export const NoseFrontal = () => (
  <svg viewBox="0 0 200 250" className="w-full h-full">
    {/* Kontur twarzy */}
    <path d="M 40 20 Q 100 0 160 20" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Brwi */}
    <path d="M 45 35 Q 70 25 90 35" fill="none" stroke="#333" strokeWidth="1"/>
    <path d="M 110 35 Q 130 25 155 35" fill="none" stroke="#333" strokeWidth="1"/>
    
    {/* Oczy - kontury */}
    <ellipse cx="65" cy="50" rx="18" ry="10" fill="none" stroke="#333" strokeWidth="1"/>
    <ellipse cx="135" cy="50" rx="18" ry="10" fill="none" stroke="#333" strokeWidth="1"/>
    
    {/* Nos - grzbiet */}
    <path d="M 100 40 L 100 60" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Kości nosowe */}
    <path d="M 85 45 L 90 75 L 100 65 L 110 75 L 115 45" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Upper lateral cartilages */}
    <path d="M 90 75 Q 85 90 80 105" fill="none" stroke="#333" strokeWidth="1.5"/>
    <path d="M 110 75 Q 115 90 120 105" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Lower lateral cartilages - skrzydełka */}
    <path d="M 80 105 Q 60 115 55 135 Q 60 150 80 155" fill="none" stroke="#333" strokeWidth="1.5"/>
    <path d="M 120 105 Q 140 115 145 135 Q 140 150 120 155" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Tip - czubek nosa */}
    <path d="M 80 155 Q 100 170 120 155" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Columella */}
    <path d="M 95 155 L 95 175 Q 100 180 105 175 L 105 155" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Nozdrza */}
    <ellipse cx="75" cy="165" rx="12" ry="8" fill="#e5e5e5" stroke="#333" strokeWidth="1"/>
    <ellipse cx="125" cy="165" rx="12" ry="8" fill="#e5e5e5" stroke="#333" strokeWidth="1"/>
    
    {/* Przegroda - środkowa linia */}
    <path d="M 100 65 L 100 155" fill="none" stroke="#333" strokeWidth="1" strokeDasharray="3,3"/>
    
    {/* Usta */}
    <path d="M 70 200 Q 100 215 130 200" fill="none" stroke="#333" strokeWidth="1"/>
    <path d="M 85 200 Q 100 190 115 200" fill="none" stroke="#333" strokeWidth="1"/>
  </svg>
);

export const NoseProfile = () => (
  <svg viewBox="0 0 200 250" className="w-full h-full">
    {/* Kontur czoła */}
    <path d="M 140 10 Q 150 30 145 50" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Nasion - początek nosa */}
    <path d="M 145 50 Q 140 55 138 60" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Grzbiet nosa - dorsum */}
    <path d="M 138 60 L 100 130" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Tip - czubek */}
    <path d="M 100 130 Q 95 140 100 150 Q 110 155 115 145" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Columella */}
    <path d="M 115 145 Q 120 155 125 160" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Nozdrze */}
    <ellipse cx="108" cy="158" rx="10" ry="6" fill="#e5e5e5" stroke="#333" strokeWidth="1" transform="rotate(-20, 108, 158)"/>
    
    {/* Warga górna */}
    <path d="M 125 160 Q 130 170 135 175 Q 140 180 145 180" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Warga dolna */}
    <path d="M 145 180 Q 150 190 145 200 Q 140 210 135 215" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Podbródek */}
    <path d="M 135 215 Q 130 230 140 240" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Kości nosowe - struktura */}
    <path d="M 138 60 Q 145 80 140 100" fill="none" stroke="#333" strokeWidth="1" strokeDasharray="2,2"/>
    
    {/* Upper lateral cartilage */}
    <path d="M 130 85 Q 120 100 110 120" fill="none" stroke="#333" strokeWidth="1" strokeDasharray="2,2"/>
    
    {/* Lower lateral cartilage */}
    <path d="M 110 120 Q 105 135 100 150" fill="none" stroke="#333" strokeWidth="1" strokeDasharray="2,2"/>
    
    {/* Przegroda */}
    <path d="M 138 60 Q 130 110 115 145" fill="none" stroke="#333" strokeWidth="1" strokeDasharray="3,3"/>
    
    {/* Oko */}
    <ellipse cx="165" cy="55" rx="12" ry="6" fill="none" stroke="#333" strokeWidth="1"/>
    
    {/* Ucho */}
    <path d="M 40 60 Q 25 80 30 110 Q 35 130 45 125 Q 50 115 45 100" fill="none" stroke="#333" strokeWidth="1"/>
  </svg>
);

export const NoseBase = () => (
  <svg viewBox="0 0 200 200" className="w-full h-full">
    {/* Kontur zewnętrzny nosa */}
    <path d="M 100 30 Q 60 50 50 100 Q 55 130 70 145 Q 100 170 130 145 Q 145 130 150 100 Q 140 50 100 30" 
          fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Skrzydełka - alar */}
    <path d="M 50 100 Q 40 110 45 130 Q 55 145 70 145" fill="none" stroke="#333" strokeWidth="1.5"/>
    <path d="M 150 100 Q 160 110 155 130 Q 145 145 130 145" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Nozdrza - otwory */}
    <ellipse cx="70" cy="115" rx="18" ry="25" fill="#e5e5e5" stroke="#333" strokeWidth="1.5" transform="rotate(-15, 70, 115)"/>
    <ellipse cx="130" cy="115" rx="18" ry="25" fill="#e5e5e5" stroke="#333" strokeWidth="1.5" transform="rotate(15, 130, 115)"/>
    
    {/* Columella */}
    <path d="M 90 140 L 90 160 Q 100 170 110 160 L 110 140" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Przegroda */}
    <path d="M 100 50 L 100 140" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Tip - domal segment */}
    <path d="M 85 85 Q 100 75 115 85" fill="none" stroke="#333" strokeWidth="1" strokeDasharray="2,2"/>
    
    {/* Lateral crura */}
    <path d="M 85 85 Q 65 95 55 110" fill="none" stroke="#333" strokeWidth="1" strokeDasharray="2,2"/>
    <path d="M 115 85 Q 135 95 145 110" fill="none" stroke="#333" strokeWidth="1" strokeDasharray="2,2"/>
    
    {/* Medial crura */}
    <path d="M 90 140 Q 95 120 100 100" fill="none" stroke="#333" strokeWidth="1" strokeDasharray="2,2"/>
    <path d="M 110 140 Q 105 120 100 100" fill="none" stroke="#333" strokeWidth="1" strokeDasharray="2,2"/>
  </svg>
);

export const NoseSeptum = () => (
  <svg viewBox="0 0 200 250" className="w-full h-full">
    {/* Przekrój przegrody */}
    
    {/* Kość czołowa */}
    <path d="M 50 20 L 150 20 L 150 40 L 50 40 Z" fill="#f0f0f0" stroke="#333" strokeWidth="1.5"/>
    <text x="100" y="33" textAnchor="middle" fontSize="8" fill="#666">Kość czołowa</text>
    
    {/* Blaszka sitowa */}
    <path d="M 95 40 L 105 40 L 105 70 L 95 70 Z" fill="#e0e0e0" stroke="#333" strokeWidth="1"/>
    
    {/* Przegroda chrzęstna */}
    <path d="M 85 70 L 115 70 L 110 180 L 90 180 Z" fill="#d4edda" stroke="#333" strokeWidth="1.5"/>
    <text x="100" y="130" textAnchor="middle" fontSize="8" fill="#155724">Chrząstka przegrody</text>
    
    {/* Przegroda kostna - vomer */}
    <path d="M 92 180 L 108 180 L 105 220 L 95 220 Z" fill="#f0f0f0" stroke="#333" strokeWidth="1"/>
    <text x="100" y="205" textAnchor="middle" fontSize="7" fill="#666">Vomer</text>
    
    {/* Kolec nosowy przedni */}
    <path d="M 90 220 Q 100 235 110 220" fill="none" stroke="#333" strokeWidth="1.5"/>
    
    {/* Kości nosowe - boczne */}
    <path d="M 50 40 L 85 70 L 85 50 L 50 40" fill="#f5f5f5" stroke="#333" strokeWidth="1"/>
    <path d="M 150 40 L 115 70 L 115 50 L 150 40" fill="#f5f5f5" stroke="#333" strokeWidth="1"/>
    
    {/* Upper lateral cartilage */}
    <path d="M 60 70 L 85 70 L 80 110 L 55 100 Z" fill="#d1ecf1" stroke="#333" strokeWidth="1"/>
    <path d="M 140 70 L 115 70 L 120 110 L 145 100 Z" fill="#d1ecf1" stroke="#333" strokeWidth="1"/>
    
    {/* Lower lateral cartilage */}
    <path d="M 55 100 L 80 110 L 70 160 L 45 150 Z" fill="#fff3cd" stroke="#333" strokeWidth="1"/>
    <path d="M 145 100 L 120 110 L 130 160 L 155 150 Z" fill="#fff3cd" stroke="#333" strokeWidth="1"/>
    
    {/* Etykiety */}
    <text x="35" y="85" fontSize="7" fill="#0c5460">ULC</text>
    <text x="160" y="85" fontSize="7" fill="#0c5460">ULC</text>
    <text x="30" y="135" fontSize="7" fill="#856404">LLC</text>
    <text x="160" y="135" fontSize="7" fill="#856404">LLC</text>
  </svg>
);

export const schematicsList = [
  { id: 'frontal', name: 'Frontalny', component: NoseFrontal },
  { id: 'profile', name: 'Profil', component: NoseProfile },
  { id: 'base', name: 'Baza', component: NoseBase },
  { id: 'septum', name: 'Przegroda', component: NoseSeptum }
];
