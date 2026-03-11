# AestheticaMD - System Zarządzania Pacjentami

## Oryginalny Problem
Budowa aplikacji do zarządzania pacjentami dla chirurga plastycznego twarzy z funkcjami:
- Baza pacjentów z operacjami CRUD i sortowaniem
- Integracja z Kalendarzem Google dla dat operacji (placeholder gotowy)
- Sortowanie wg preferowanego zakresu dat, daty operacji, statusu
- Śledzenie statusu: Konsultacja, Zaplanowany, Oczekujący, Zoperowany
- Upload zdjęć (7-10 na wizytę) z porównaniem przed/po
- Statystyki wg miesiąca/roku/lokalizacji z eksportem Excel
- Śledzenie ceny operacji
- Ochrona hasłem (jeden użytkownik)
- Responsywność web i mobile
- **JĘZYK: POLSKI**

## Persona Użytkownika
- **Główny użytkownik**: Chirurg plastyk twarzy
- **Poziom techniczny**: Nietechniczny
- **Przypadek użycia**: Zarządzanie kartotekami pacjentów, harmonogramem operacji i zdjęciami klinicznymi

## Stack Technologiczny
- **Frontend**: React 19 + TailwindCSS + Radix UI
- **Backend**: FastAPI + Python
- **Baza danych**: MongoDB
- **Autoryzacja**: JWT (hasło: doctor2024)

## Zaimplementowane Funkcje (Marzec 2026)
- [x] System autoryzacji z JWT
- [x] Pulpit z przeglądem statystyk i nadchodzącymi operacjami
- [x] Lista pacjentów z wyszukiwaniem, filtrowaniem, sortowaniem
- [x] Strona szczegółów pacjenta (widok podzielony)
- [x] Zarządzanie wizytami (konsultacja, operacja, kontrola)
- [x] Upload zdjęć z kategoriami (przed, po, w trakcie, inne)
- [x] Narzędzie porównywania zdjęć z suwakiem
- [x] Widok kalendarza dla dat operacji
- [x] Strona statystyk z wykresami słupkowymi
- [x] Zarządzanie lokalizacjami w ustawieniach
- [x] Eksport Excel danych pacjentów
- [x] Design responsywny dla mobile
- [x] Czysty medyczny styl (turkusowy/biały motyw)
- [x] **PEŁNA LOKALIZACJA POLSKA**
- [x] Planowanie operacji z automatycznym dopasowaniem pacjentów
- [x] Drag-and-drop kalendarz do przypisywania pacjentów
- [x] Zarządzanie slotami operacyjnymi (oznaczanie jako pełny)
- [x] Wyraziste kolory w kalendarzu (zielony=zaplanowany, czerwony=pełny, żółty=wolny)
- [x] Przenoszenie zaplanowanych pacjentów (drag-and-drop z kalendarza)
- [x] Masowe dodawanie terminów operacji (kalendarz do zaznaczania dni)
- [x] Pulpit - nadchodzące operacje jako lista (zamiast kart)
- [x] Pulpit - statystyki kompaktowe na dole
- [x] Pulpit - nazwiska i typy zabiegów w kalendarzu
- [x] Kalendarz - podgląd szczegółów dnia (modal z pacjentami i zabiegami)
- [x] Wyróżnienie lokalizacji w kalendarzu - kolorowe paski boczne
- [x] Opcja "Jak najszybciej" - flaga ASAP dla pacjentów gotowych na wcześniejszy termin
- [x] Filtrowanie i sortowanie po ASAP w liście pacjentów
- [x] Automatyczne dopasowanie z lokalizacją
- [x] Dodawanie zdjęć w formularzu pacjenta (zakładka "Zdjęcia" z uploadem)
- [x] Refaktoryzacja zdjęć - osobna kolekcja `photos` w MongoDB (rozwiązuje limit 16MB)
- [x] Naprawiony komparator zdjęć - porównywanie dowolnych dwóch zdjęć
- [x] **NOWE (10.03.2026): Sortowanie "Pacjenci bez terminu"** - ASAP najpierw, potem wg najbliższej preferowanej daty
- [x] **NOWE (10.03.2026): Filtr wg typu zabiegu** - multi-select dropdown w liście pacjentów
- [x] **NOWE (10.03.2026): Podsumowanie oczekujących pacjentów** - sortowalną tabelę w statystykach

## Endpointy API
- POST /api/auth/login - Logowanie
- GET /api/dashboard - Dane pulpitu
- CRUD /api/patients - Zarządzanie pacjentami
- CRUD /api/patients/{id}/visits - Zarządzanie wizytami
- CRUD /api/patients/{id}/visits/{vid}/photos - Zarządzanie zdjęciami
- CRUD /api/locations - Zarządzanie lokalizacjami
- GET /api/settings - Ogólne ustawienia (typy zabiegów)
- GET /api/stats - Dane statystyk
- GET /api/stats/waiting-summary - Podsumowanie oczekujących pacjentów
- GET /api/export/patients - Eksport Excel
- GET /api/calendar/status - Status Kalendarza Google

## Zaległości (Backlog)

### P1 (Wysoki priorytet)
- Integracja z Kalendarzem Google (gdy użytkownik poda dane dostępowe)
- Generowanie numeru kartoteki pacjenta (MRN)

### P2 (Średni priorytet)
- Masowy upload zdjęć z drag-and-drop
- Zaawansowane filtry wyszukiwania pacjentów
- Przypomnienia email/SMS o wizytach

### P3 (Niski priorytet)
- Opcja trybu ciemnego
- Generowanie raportów PDF
- Funkcja backup/przywracanie

## Następne Zadania
1. ~~Wgranie na serwer~~ ✅ Zrobione (10.03.2026)
2. ~~Integracja z Kalendarzem Google~~ ✅ Naprawiona (11.03.2026)
3. ~~SSL/HTTPS~~ ✅ Zrobione - Let's Encrypt (10.03.2026)
4. ~~Auto-odnowienie SSL~~ ✅ Cron job (11.03.2026)
5. ~~Backup bazy danych~~ ✅ Automatyczny codzienny backup (11.03.2026)
6. ~~Globalne wyszukiwanie~~ ✅ Ctrl+K (11.03.2026)

## W trakcie implementacji
- **Planer Rinoplastyki** - narzędzie do planowania operacji nosa na schematach
  - Schematy SVG (frontalny, profil, baza, przegroda) - UTWORZONE
  - Komponent RhinoPlanner z Fabric.js - UTWORZONE (do dokończenia)
  - Integracja z kartą pacjenta - TODO
  - Eksport PDF - TODO
  - Testowanie na tablecie - TODO

## Przyszłe zadania
- Dokończenie Planera Rinoplastyki
- Powiadomienia email/SMS przed operacją  
- Eksport PDF karty pacjenta
- Panel pacjenta
4. Rozważyć dodanie szablonów zabiegów dla typowych operacji
5. Implementacja śledzenia formularzy zgody pacjenta

## Wdrożone na serwer produkcyjny (10.03.2026) ✅
Pliki zaktualizowane przez GitHub (repo: mateuszkolator-lab/AESTHERICA):
- `backend/server.py` - dodano dotenv
- `backend/routers/stats.py` - endpoint `/stats/waiting-summary`
- `backend/routers/settings.py` - endpoint `/settings`
- `frontend/src/utils/constants.js` - funkcja `formatDateLocal`
- `frontend/src/pages/CalendarPage.jsx` - sortowanie pacjentów bez terminu
- `frontend/src/pages/PatientsList.jsx` - filtr wg typu zabiegu
- `frontend/src/pages/StatsPage.jsx` - tabela podsumowania oczekujących
