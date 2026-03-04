// Polish translations
export const STATUS_LABELS = {
  consultation: "Konsultacja",
  planned: "Zaplanowany",
  awaiting: "Oczekujący",
  operated: "Zoperowany"
};

export const VISIT_TYPE_LABELS = {
  consultation: "Konsultacja",
  surgery: "Operacja",
  follow_up: "Wizyta kontrolna",
  "7_days_after": "7 dni po zabiegu",
  "1_month_after": "Miesiąc po",
  "3_months_after": "3 miesiące po",
  "6_months_after": "6 miesięcy po",
  "1_year_after": "Rok po",
  photo_upload: "Zdjęcia",
  custom: "Inna"
};

export const VISIT_TYPE_OPTIONS = [
  { value: "consultation", label: "Konsultacja" },
  { value: "surgery", label: "Operacja" },
  { value: "7_days_after", label: "7 dni po zabiegu" },
  { value: "1_month_after", label: "Miesiąc po" },
  { value: "3_months_after", label: "3 miesiące po" },
  { value: "6_months_after", label: "6 miesięcy po" },
  { value: "1_year_after", label: "Rok po" },
  { value: "follow_up", label: "Wizyta kontrolna" },
  { value: "custom", label: "Inna (wpisz własną)" }
];

export const PHOTO_CATEGORY_LABELS = {
  before: "Przed",
  after: "Po",
  during: "W trakcie",
  other: "Inne"
};

// Etykiety kątów zdjęć (nowy system)
export const PHOTO_ANGLE_LABELS = {
  front: "Przód",
  left_profile: "Profil lewy",
  right_profile: "Profil prawy",
  left_oblique: "Skos lewy",
  right_oblique: "Skos prawy",
  base: "Podstawa",
  other: "Inne"
};

// Opcje kątów do wyboru w formularzach
export const PHOTO_ANGLE_OPTIONS = [
  { value: "front", label: "Przód" },
  { value: "left_profile", label: "Profil lewy" },
  { value: "right_profile", label: "Profil prawy" },
  { value: "left_oblique", label: "Skos lewy (3/4)" },
  { value: "right_oblique", label: "Skos prawy (3/4)" },
  { value: "base", label: "Podstawa nosa" },
  { value: "other", label: "Inny" }
];

export const STATUS_OPTIONS = [
  { value: "consultation", label: "Konsultacja" },
  { value: "planned", label: "Zaplanowany" },
  { value: "awaiting", label: "Oczekujący" },
  { value: "operated", label: "Zoperowany" }
];

export const getStatusColor = (status) => {
  const colors = {
    consultation: "bg-slate-100 text-slate-800",
    planned: "bg-blue-100 text-blue-800",
    awaiting: "bg-amber-100 text-amber-800",
    operated: "bg-emerald-100 text-emerald-800"
  };
  return colors[status] || colors.consultation;
};

export const getStatusColorBg = (status) => {
  const colors = {
    planned: "bg-blue-600",
    awaiting: "bg-amber-500",
    operated: "bg-emerald-600"
  };
  return colors[status] || "bg-slate-500";
};

// Get location color - each location gets a unique color
export const getLocationColor = (locationName) => {
  if (!locationName) return null;
  const colorMap = {
    "Pro-Familia": { border: "border-l-orange-500", dot: "bg-orange-500" },
    "Medicus": { border: "border-l-violet-500", dot: "bg-violet-500" },
  };
  for (const [key, value] of Object.entries(colorMap)) {
    if (locationName.includes(key)) return value;
  }
  const colors = [
    { border: "border-l-cyan-500", dot: "bg-cyan-500" },
    { border: "border-l-pink-500", dot: "bg-pink-500" },
    { border: "border-l-lime-500", dot: "bg-lime-500" },
    { border: "border-l-indigo-500", dot: "bg-indigo-500" },
  ];
  const hash = locationName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// Get procedure type abbreviation
export const getProcedureAbbrev = (procedureType) => {
  if (!procedureType) return "?";
  const abbrevMap = {
    "Rinoplastyka": "RIN",
    "Rhinoplasty": "RIN",
    "Blefaroplastyka": "BLE",
    "Lifting": "LIF",
    "Otoplastyka": "OTO",
    "Liposukcja": "LIP"
  };
  return abbrevMap[procedureType] || procedureType.substring(0, 3).toUpperCase();
};

// Calendar helpers
export const getDaysInMonth = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDay = firstDay.getDay();
  
  const days = [];
  for (let i = 0; i < startingDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }
  return days;
};

export const DAY_NAMES = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];
export const MONTH_NAMES = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
