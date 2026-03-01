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
- [x] **NOWE: Wyraziste kolory w kalendarzu** (zielony=zaplanowany, czerwony=pełny, żółty=wolny)
- [x] **NOWE: Przenoszenie zaplanowanych pacjentów** (drag-and-drop z kalendarza)
- [x] **NOWE: Masowe dodawanie terminów operacji** (kalendarz do zaznaczania dni)
- [x] **NOWE: Pulpit - nadchodzące operacje jako lista** (zamiast kart)
- [x] **NOWE: Pulpit - statystyki kompaktowe na dole**
- [x] **NOWE: Pulpit - nazwiska i typy zabiegów** w kalendarzu (znaczniki RIN, BLE, LIF itp.)
- [x] **NOWE: Kalendarz - podgląd szczegółów dnia** (modal z pacjentami i zabiegami)
- [x] **NOWE: Wyróżnienie lokalizacji w kalendarzu** - kolorowe paski boczne (pomarańczowy=Pro-Familia, fioletowy=Medicus) + kropki
- [x] **NOWE: Opcja "Jak najszybciej"** - flaga ASAP dla pacjentów gotowych na wcześniejszy termin
- [x] **NOWE: Filtrowanie i sortowanie po ASAP** w liście pacjentów
- [x] **NOWE: Automatyczne dopasowanie z lokalizacją** - pacjenci przypisywani do terminów wg lokalizacji w karcie pacjenta
- [x] **NOWE: Dodawanie zdjęć w formularzu pacjenta** (zakładka "Zdjęcia" z uploadem)

## Endpointy API
- POST /api/auth/login - Logowanie
- GET /api/dashboard - Dane pulpitu
- CRUD /api/patients - Zarządzanie pacjentami
- CRUD /api/patients/{id}/visits - Zarządzanie wizytami
- CRUD /api/patients/{id}/visits/{vid}/photos - Zarządzanie zdjęciami
- CRUD /api/locations - Zarządzanie lokalizacjami
- GET /api/stats - Dane statystyk
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
1. Dodać integrację z Kalendarzem Google gdy użytkownik poda dane API
2. Rozważyć dodanie szablonów zabiegów dla typowych operacji
3. Implementacja śledzenia formularzy zgody pacjenta
