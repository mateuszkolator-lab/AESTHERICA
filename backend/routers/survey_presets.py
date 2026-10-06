"""Predefined PROMs templates (Polish). Seeded once; editable afterwards."""

def _scale(labels):
    return [{"value": i, "label": lab, "score": i} for i, lab in enumerate(labels)]

NOSE_LABELS = ["Nie stanowi problemu", "Bardzo łagodny problem", "Umiarkowany problem", "Dość duży problem", "Poważny problem"]
NOSE_ITEMS = [
    "Zatkany nos / uczucie niedrożności nosa",
    "Blokada nosa",
    "Trudności w oddychaniu przez nos",
    "Trudności ze snem",
    "Trudności z nabraniem wystarczającej ilości powietrza przez nos podczas wysiłku",
]

SCHNOS_LABELS = ["Brak problemu", "Bardzo łagodny", "Łagodny", "Umiarkowany", "Poważny", "Skrajny problem"]
SCHNOS_ITEMS = [
    ("O", "Trudności w oddychaniu przez nos"),
    ("O", "Zatkany lub niedrożny nos"),
    ("O", "Trudności w oddychaniu przez nos podczas wysiłku"),
    ("O", "Trudności w oddychaniu przez nos podczas snu"),
    ("C", "Obniżony nastrój i poczucie własnej wartości z powodu nosa"),
    ("C", "Kształt czubka nosa"),
    ("C", "Prostość nosa"),
    ("C", "Wygląd nosa z profilu"),
    ("C", "Dopasowanie nosa do reszty twarzy"),
    ("C", "Ogólna symetria nosa"),
]

ROE_ITEMS = [
    ("Czy podoba Ci się wygląd Twojego nosa?", ["Wcale", "Trochę", "Umiarkowanie", "Bardzo", "Całkowicie"]),
    ("Jak dobrze oddychasz przez nos?", ["Wcale", "Słabo", "Umiarkowanie", "Dobrze", "Bardzo dobrze"]),
    ("Jak sądzisz, na ile Twoim przyjaciołom i bliskim podoba się Twój nos?", ["Wcale", "Trochę", "Umiarkowanie", "Bardzo", "Całkowicie"]),
    ("Czy uważasz, że obecny wygląd Twojego nosa ogranicza Twoją aktywność społeczną lub zawodową?", ["Zawsze", "Często", "Czasami", "Rzadko", "Nigdy"]),
    ("Na ile jesteś pewny/a, że wygląd Twojego nosa jest najlepszy z możliwych?", ["Wcale", "Trochę", "Umiarkowanie", "Bardzo", "Całkowicie"]),
    ("Czy chciałbyś/chciałabyś chirurgicznie zmienić wygląd lub funkcję swojego nosa?", ["Zdecydowanie tak", "Raczej tak", "Możliwe", "Raczej nie", "Nie"]),
]

DEFAULT_TIMEPOINTS = [
    {"key": "pre", "label": "Przed zabiegiem", "offset_days": 0},
    {"key": "3m", "label": "3 miesiące po zabiegu", "offset_days": 90},
    {"key": "12m", "label": "12 miesięcy po zabiegu", "offset_days": 365},
]

PRESET_TEMPLATES = [
    {
        "code": "NOSE",
        "name": "NOSE – Nasal Obstruction Symptom Evaluation",
        "description": "Ocena nasilenia objawów niedrożności nosa (5 pytań, 0–4).",
        "instructions": "Proszę ocenić, jak duży problem stanowiły dla Ciebie poniższe dolegliwości w ciągu OSTATNIEGO MIESIĄCA.",
        "active": True,
        "timepoints": DEFAULT_TIMEPOINTS,
        "sections": [],
        "questions": [
            {"id": f"nose{i+1}", "type": "scale", "text": t, "required": True, "options": _scale(NOSE_LABELS)}
            for i, t in enumerate(NOSE_ITEMS)
        ],
        "scoring": {"mode": "sum", "multiplier": 5, "scale_to_100": False, "subscales": [],
                    "note": "Suma 0–20 pomnożona ×5 → 0–100. Wyższy wynik = większa niedrożność."},
    },
    {
        "code": "SCHNOS",
        "name": "SCHNOS – Standardized Cosmesis and Health Nasal Outcomes Survey",
        "description": "10 pytań (0–5): podskala niedrożności SCHNOS-O (1–4) i estetyki SCHNOS-C (5–10).",
        "instructions": "W ciągu ostatniego miesiąca, jak duży problem stanowiły dla Ciebie poniższe kwestie?",
        "active": True,
        "timepoints": DEFAULT_TIMEPOINTS,
        "sections": [{"key": "O", "label": "Niedrożność (SCHNOS-O)"}, {"key": "C", "label": "Estetyka (SCHNOS-C)"}],
        "questions": [
            {"id": f"schnos{i+1}", "type": "scale", "text": t, "required": True, "section": sec, "options": _scale(SCHNOS_LABELS)}
            for i, (sec, t) in enumerate(SCHNOS_ITEMS)
        ],
        "scoring": {"mode": "sum", "scale_to_100": True, "subscales": [
            {"key": "SCHNOS_O", "label": "SCHNOS-O", "section": "O", "mode": "sum", "scale_to_100": True},
            {"key": "SCHNOS_C", "label": "SCHNOS-C", "section": "C", "mode": "sum", "scale_to_100": True},
        ], "note": "Każda podskala: suma / (liczba pytań × 5) × 100. Wyższy wynik = większy problem."},
    },
    {
        "code": "ROE",
        "name": "ROE – Rhinoplasty Outcome Evaluation",
        "description": "Ocena satysfakcji po rynoplastyce (6 pytań, 0–4).",
        "instructions": "Proszę wybrać odpowiedź najlepiej opisującą Twoje odczucia.",
        "active": True,
        "timepoints": DEFAULT_TIMEPOINTS,
        "sections": [],
        "questions": [
            {"id": f"roe{i+1}", "type": "single", "text": t, "required": True, "options": _scale(labels)}
            for i, (t, labels) in enumerate(ROE_ITEMS)
        ],
        "scoring": {"mode": "sum", "scale_to_100": True, "subscales": [],
                    "note": "Suma 0–24 / 24 × 100. Wyższy wynik = większa satysfakcja."},
    },
]
