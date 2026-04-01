# AestheticaMD - System Zarządzania Pacjentami

## Opis projektu
Aplikacja webowa do zarządzania pacjentami dla kliniki chirurgii plastycznej twarzy, z funkcją planowania operacji rinoplastyki (RhinoPlanner).

## Zaimplementowane funkcje

### System uwierzytelniania (JWT) - DONE
- Logowanie z email + hasło
- Dwie role: Administrator i Użytkownik
- Panel zarządzania użytkownikami (tylko admin):
  - Dodawanie, edycja, usuwanie użytkowników
  - Resetowanie haseł, dezaktywacja kont
- Admin domyślny: mateusz.kolator@gmail.com

### Kontrole pooperacyjne - DONE
- Lista pacjentów po operacji z harmonogramem kontroli
- 5 terminów: 1 tydzień, 1 miesiąc, 3 miesiące, 6 miesięcy, 1 rok
- Oznaczanie kontroli jako wykonanych
- Sortowanie chronologiczne, filtry (wszyscy, zaległe, do wykonania)

### Historia zmian pacjentów (Audit Log) - DONE
- Śledzenie zmian: kto, co i kiedy zmienił
- Widok w szczegółach pacjenta

### Zarządzanie pacjentami - DONE
- CRUD pacjentów, sortowanie, filtrowanie
- Flaga ASAP, status Rezygnacja
- Zmiana statusu bezpośrednio z listy pacjentów (dropdown)
- Globalne wyszukiwanie (Ctrl+K)

### Zdjęcia pacjentów - DONE
- Upload, tagowanie kątów, porównanie przed/po

### Kalendarz i planowanie - DONE
- Google/Apple Calendar UI z ASAP badges
- Obramowania: zielone (wolne) / czerwone (pełne)
- Drag-and-drop pacjentów na kalendarz
- Integracja z Google Calendar

### Statystyki - DONE
- Podsumowanie procedur, eksport do Excela

### RhinoPlanner - DONE
- Canvas Fabric.js z 3 widokami anatomicznymi
- Narzędzia rysowania, eksport PDF

## Testy - Wyniki (28.03.2026)
- Backend API: 100% (16/16 testów)
- Frontend UI: 100% (wszystkie flow)
- Plik raportu: /app/test_reports/iteration_3.json

## Endpointy API

### Uwierzytelnianie
- POST /api/auth/login - Logowanie
- GET /api/auth/verify - Weryfikacja tokenu

### Użytkownicy
- GET /api/users/ - Lista (admin)
- POST /api/users/ - Dodaj (admin)
- PUT /api/users/{id} - Edytuj (admin)
- DELETE /api/users/{id} - Usuń (admin)
- POST /api/users/{id}/reset-password - Reset hasła (admin)
- GET /api/users/me - Bieżący użytkownik

### Pacjenci
- GET /api/patients - Lista
- POST /api/patients - Dodaj
- GET /api/patients/{id} - Szczegóły
- PUT /api/patients/{id} - Edytuj
- DELETE /api/patients/{id} - Usuń

### Kontrole
- GET /api/controls/patients - Lista z kontrolami
- POST /api/controls/patients/{id}/complete - Oznacz kontrolę
- DELETE /api/controls/patients/{id}/complete/{type} - Cofnij

### Audyt
- GET /api/audit/patient/{id} - Historia pacjenta
- GET /api/audit/recent - Ostatnie zmiany

### RhinoPlanner
- PUT /api/rhinoplanner/patient/{id} - Zapisz plan
- GET /api/rhinoplanner/patient/{id} - Pobierz plan
- DELETE /api/rhinoplanner/patient/{id} - Usuń plan

### Statystyki
- GET /api/dashboard - Pulpit
- GET /api/stats - Statystyki
- GET /api/export/patients - Eksport Excel

## Przyszłe zadania
- (P1) Testy RhinoPlanner na tablecie z rysikiem
- (P2) Powiadomienia email/SMS
- (P3) Portal pacjenta

## Konfiguracja
- Logo kliniki: /public/logo-rhinoplasty.svg
- Baza danych: MongoDB via motor (AsyncIOMotorClient)
- Frontend: React + Tailwind CSS + Shadcn UI
- Backend: FastAPI + PyJWT
