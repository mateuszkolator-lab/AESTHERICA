# AestheticaMD - System Zarządzania Pacjentami

## Opis projektu
Aplikacja webowa do zarządzania pacjentami dla kliniki chirurgii plastycznej twarzy, z funkcją planowania operacji rinoplastyki (RhinoPlanner).

## Zaimplementowane funkcje

### System uwierzytelniania (JWT) - DONE
- Logowanie z email + hasło
- Dwie role: Administrator i Użytkownik
- Panel zarządzania użytkownikami (tylko admin)
- Admin domyślny: mateusz.kolator@gmail.com

### Filtrowanie po placówkach - DONE (13.04.2026)
- Użytkownicy przypisani do placówek (location_ids) z flagą global_access
- Admin i global_access widzą wszystko, reszta widzi dane swojej placówki + nieprzypisanych
- Filtrowanie: Pacjenci, Kalendarz, Pulpit, Kontrole, Statystyki, Eksport, Sugestie
- UI: Kolumna "Placówki" w tabeli użytkowników, checkboxy lokalizacji w modalach

### Kontrole pooperacyjne - DONE
- Lista pacjentów po operacji z harmonogramem kontroli (5 terminów)
- Oznaczanie kontroli jako wykonanych, "Brak kontaktu" toggle
- Sortowanie chronologiczne, filtry

### Historia zmian pacjentów (Audit Log) - DONE

### Zarządzanie pacjentami - DONE
- CRUD, sortowanie, filtrowanie, flaga ASAP, status Rezygnacja
- Zmiana statusu z listy, globalne wyszukiwanie (Ctrl+K)
- Wiele preferowanych zakresów dat (preferred_dates) - 13.04.2026

### Zdjęcia pacjentów - DONE

### Kalendarz i planowanie - DONE
- Google/Apple Calendar UI z ASAP badges, PRO/MED badges
- Drag-and-drop z ostrzeżeniem przy zmianie placówki
- Potwierdzenie telefoniczne ("P")

### Statystyki - DONE (tylko admin)
- Przychody planowane vs zrealizowane, filtrowanie po placówce

### RhinoPlanner - DONE
- Canvas Fabric.js z 3 widokami, eksport PDF

## Naprawione błędy (13.04.2026)
- Drag & Drop: Pacjenci niepowiązani ze slotem nie mogli być przenoszeni
- Modal ostrzegawczy przy zmianie placówki (D&D PRO→MED)

## Code Review Refactoring (13.04.2026)
- Hardcoded secrets → os.getenv() w testach
- 30 instancji brakujących hook dependencies → useCallback
- AuthContext → useCallback dla stabilnych referencji
- 14 console.log/error usunięte z produkcyjnego kodu
- random → secrets w generatorze testowych pacjentów

## Wiele preferowanych zakresów dat (13.04.2026)
- preferred_dates: [{start, end}, ...] z backward-compat
- Dynamiczne pola dat z dodaj/usuń we wszystkich widokach
- Logika sugestii sprawdza wszystkie zakresy

## Endpointy API
- POST /api/auth/login, GET /api/auth/verify
- CRUD /api/users/, /api/patients, /api/surgery-slots
- GET /api/dashboard, /api/stats, /api/export/patients
- GET /api/controls/patients, /api/audit/patient/{id}
- PUT/GET/DELETE /api/rhinoplanner/patient/{id}
- POST /api/patients/{id}/confirm (toggle "P")
- POST /api/controls/patients/{id}/no-contact

## Przyszłe zadania
- (P1) Testy RhinoPlanner na tablecie z rysikiem
- (P1) Eksport statystyk do Excela
- (P2) Powiadomienia email/SMS
- (P3) Portal pacjenta

## Konfiguracja
- Baza danych: MongoDB via motor (AsyncIOMotorClient)
- Frontend: React + Tailwind CSS + Shadcn UI
- Backend: FastAPI + PyJWT
