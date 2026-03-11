#!/bin/bash
cd /opt/aesthetica-md/deployment
echo "=== CONSTANTS UPDATE ==="
cat > frontend/src/utils/constants.js << 'EOF'
export const STATUS_LABELS = {consultation: "Konsultacja", planned: "Zaplanowany", awaiting: "Oczekujacy", operated: "Zoperowany"};
export const VISIT_TYPE_LABELS = {consultation: "Konsultacja", surgery: "Operacja", follow_up: "Wizyta kontrolna", "7_days_after": "7 dni po zabiegu", "1_month_after": "Miesiac po", "3_months_after": "3 miesiace po", "6_months_after": "6 miesiecy po", "1_year_after": "Rok po", photo_upload: "Zdjecia", custom: "Inna"};
export const VISIT_TYPE_OPTIONS = [{value: "consultation", label: "Konsultacja"}, {value: "surgery", label: "Operacja"}, {value: "7_days_after", label: "7 dni po zabiegu"}, {value: "1_month_after", label: "Miesiac po"}, {value: "3_months_after", label: "3 miesiace po"}, {value: "6_months_after", label: "6 miesiecy po"}, {value: "1_year_after", label: "Rok po"}, {value: "follow_up", label: "Wizyta kontrolna"}, {value: "custom", label: "Inna"}];
export const PHOTO_CATEGORY_LABELS = {before: "Przed", after: "Po", during: "W trakcie", other: "Inne"};
export const PHOTO_ANGLE_LABELS = {front: "Przod", left_profile: "Profil lewy", right_profile: "Profil prawy", left_oblique: "Skos lewy", right_oblique: "Skos prawy", base: "Podstawa", helicopter: "Helikopter", other: "Inne"};
export const PHOTO_ANGLE_OPTIONS = [{value: "front", label: "Przod"}, {value: "left_profile", label: "Profil lewy"}, {value: "right_profile", label: "Profil prawy"}, {value: "left_oblique", label: "Skos lewy (3/4)"}, {value: "right_oblique", label: "Skos prawy (3/4)"}, {value: "base", label: "Podstawa nosa"}, {value: "helicopter", label: "Helikopter"}, {value: "other", label: "Inny"}];
export const STATUS_OPTIONS = [{value: "consultation", label: "Konsultacja"}, {value: "planned", label: "Zaplanowany"}, {value: "awaiting", label: "Oczekujacy"}, {value: "operated", label: "Zoperowany"}];
export const getStatusColor = (status) => {const c = {consultation: "bg-slate-100 text-slate-800", planned: "bg-blue-100 text-blue-800", awaiting: "bg-amber-100 text-amber-800", operated: "bg-emerald-100 text-emerald-800"}; return c[status] || c.consultation;};
export const getStatusColorBg = (status) => {const c = {planned: "bg-blue-600", awaiting: "bg-amber-500", operated: "bg-emerald-600"}; return c[status] || "bg-slate-500";};
export const getLocationColor = (n) => {if (!n) return null; const m = {"Pro-Familia": {border: "border-l-orange-500", dot: "bg-orange-500"}, "Medicus": {border: "border-l-violet-500", dot: "bg-violet-500"}}; for (const [k, v] of Object.entries(m)) {if (n.includes(k)) return v;} const c = [{border: "border-l-cyan-500", dot: "bg-cyan-500"}, {border: "border-l-pink-500", dot: "bg-pink-500"}]; const h = n.split('').reduce((a, c) => a + c.charCodeAt(0), 0); return c[h % c.length];};
export const getProcedureAbbrev = (t) => {if (!t) return "?"; const m = {"Rinoplastyka": "RIN", "Rhinoplasty": "RIN", "Blefaroplastyka": "BLE", "Lifting": "LIF", "Otoplastyka": "OTO", "Liposukcja": "LIP"}; return m[t] || t.substring(0, 3).toUpperCase();};
export const getDaysInMonth = (date) => {const y = date.getFullYear(), m = date.getMonth(); const f = new Date(y, m, 1), l = new Date(y, m + 1, 0); const d = l.getDate(), s = f.getDay(), days = []; for (let i = 0; i < s; i++) days.push(null); for (let i = 1; i <= d; i++) days.push(new Date(y, m, i)); return days;};
export const DAY_NAMES = ["Nd", "Pn", "Wt", "Sr", "Cz", "Pt", "So"];
export const MONTH_NAMES = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paz", "Lis", "Gru"];
export const formatDateLocal = (date) => {const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0'); return \`\${y}-\${m}-\${d}\`;};
EOF
echo "constants.js OK"
