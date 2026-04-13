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
- Drag-and-drop pacjentów na kalendarz (naprawiony 13.04.2026)
- Integracja z Google Calendar
- Potwierdzenie telefoniczne ("P") na kalendarzu i w karcie pacjenta

### Statystyki - DONE
- Podsumowanie procedur, eksport do Excela
- Dostęp tylko dla administratora

### RhinoPlanner - DONE
- Canvas Fabric.js z 3 widokami anatomicznymi
- Narzędzia rysowania, eksport PDF

## Naprawione błędy (13.04.2026)
- **Drag & Drop bug**: Pacjenci niepowiązani ze slotem (assigned_patient_id innego pacjenta) nie mogli być przenoszeni. Naprawiono frontend (usunięto zbędny PUT z null) i backend (zmiana na model_dump(exclude_unset=True)).
- **Ostrzeżenie przy zmianie placówki**: Dodano modal ostrzegawczy przy przenoszeniu pacjenta między różnymi placówkami (np. Pro-Familia → Medicus) z kolorowymi badge'ami i wymogiem potwierdzenia.

## Code Review Refactoring (13.04.2026)
- **Hardcoded secrets**: Przeniesiono dane uwierzytelniające z testów do os.getenv() (4 pliki testowe)
- **Hook dependencies**: Naprawiono 30 instancji brakujących zależności useEffect we wszystkich 12 plikach za pomocą useCallback
- **AuthContext**: Opakowano login/logout/updateUser/isAdmin w useCallback dla stabilnych referencji
- **Console statements**: Usunięto wszystkie 14 instrukcji console.log/error z produkcyjnego kodu
- **Random → secrets**: Zamieniono moduł random na secrets w generatorze testowych pacjentów (utils.py)

## Filtrowanie po placówkach (13.04.2026) - DONE
- **Model użytkownika**: Dodano pola `location_ids` (lista ID placówek) i `global_access` (bool) do schematu użytkownika
- **JWT Token**: Token zawiera `location_ids` i `global_access` użytkownika
- **Migracja**: Automatyczna migracja istniejących użytkowników przy starcie serwera (admini → global_access=true)
- **Filtrowanie API**: Wszystkie endpointy filtrowane po placówkach:
  - Pacjenci (GET /api/patients) - widzi swoich + nieprzypisanych
  - Kalendarz (GET /api/surgery-slots/calendar-data) - widzi sloty swojej placówki
  - Pulpit (GET /api/dashboard) - filtrowane statystyki i nadchodzące operacje
  - Kontrole (GET /api/controls/patients) - filtrowane kontrole pooperacyjne
  - Statystyki (GET /api/stats) - filtrowane dane statystyczne
  - Eksport (GET /api/export/patients) - filtrowane dane
- **UI Użytkownicy**: Kolumna "Placówki" w tabeli, checkboxy lokalizacji i toggle "Dostęp globalny" w modalach dodawania/edycji
- **Reguły**: Admin widzi wszystko. Użytkownik z global_access widzi wszystko. Reszta widzi tylko dane swoich placówek + pacjentów bez przypisanej placówki.

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
- POST /api/patients/{id}/confirm - Toggle potwierdzenia tel.

### Kontrole
- GET /api/controls/patients - Lista z kontrolami
- POST /api/controls/patients/{id}/complete - Oznacz kontrolę
- DELETE /api/controls/patients/{id}/complete/{type} - Cofnij
- POST /api/controls/patients/{id}/no-contact - Toggle brak kontaktu

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

### Kalendarz
- GET /api/surgery-slots/calendar-data - Dane kalendarza
- POST /api/surgery-slots/{id}/assign/{patient_id} - Przypisz pacjenta
- POST /api/surgery-slots/{id}/unassign - Odpisz pacjenta

## Wiele preferowanych zakresów dat (13.04.2026) - DONE
- Pacjent może mieć wiele preferowanych zakresów dat (np. marzec-kwiecień + wrzesień-październik)
- Nowe pole `preferred_dates` (tablica obiektów {start, end}) w modelu pacjenta
- Backward-compatible: stare pola `preferred_date_start`/`preferred_date_end` nadal działają jako fallback
- UI: Dynamiczne pola z przyciskami dodaj/usuń w modalu edycji/dodawania pacjenta
- Backend: Logika sugestii slotów sprawdza wszystkie zakresy dat pacjenta
- Wyświetlanie: Karta pacjenta, lista pacjentów, kalendarz (panel bez terminu), planowanie

## Przyszłe zadania
- (P1) Testy RhinoPlanner na tablecie z rysikiem
- (P1) Eksport statystyk do Excela
- (P2) Powiadomienia email/SMS
- (P3) Portal pacjenta

## Konfiguracja
- Logo kliniki: /public/logo-rhinoplasty.svg
- Baza danych: MongoDB via motor (AsyncIOMotorClient)
- Frontend: React + Tailwind CSS + Shadcn UI
- Backend: FastAPI + PyJWT
