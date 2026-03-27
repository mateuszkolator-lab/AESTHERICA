# AestheticaMD - System Zarządzania Pacjentami

## Opis projektu
Aplikacja webowa do zarządzania pacjentami dla kliniki chirurgii plastycznej, z funkcją planowania operacji rinoplastyki (RhinoPlanner).

## Zaimplementowane funkcje

### System użytkowników (NOWE - 27.03.2026)
- Logowanie z email + hasło (zamiast wspólnego hasła)
- Dwie role: Administrator i Lekarz
- Panel zarządzania użytkownikami (tylko dla admina):
  - Dodawanie nowych użytkowników
  - Edycja danych użytkowników
  - Resetowanie haseł
  - Dezaktywacja kont
  - Usuwanie użytkowników
- Pierwszy admin: mateusz.kolator@gmail.com

### Zarządzanie pacjentami
- Dodawanie, edycja, usuwanie pacjentów
- Sortowanie i filtrowanie listy
- Flaga "ASAP" dla pilnych przypadków
- Globalne wyszukiwanie (Ctrl+K)

### Zdjęcia pacjentów
- Upload i zarządzanie zdjęciami
- Tagowanie kątów (frontal, profil, etc.)
- Porównanie przed/po

### Kalendarz i planowanie
- Integracja z Google Calendar
- Sortowanie pacjentów bez daty
- Widok kalendarza

### Statystyki
- Podsumowanie procedur
- Tabela pacjentów oczekujących

### RhinoPlanner (NOWE - 12.03.2026)
- Canvas Fabric.js z 3 widokami (frontalny, profilowy, podstawy)
- Narzędzia rysowania: pędzel, gumka, kształty, tekst
- 7 kolorów + 5 rozmiarów pędzla
- Schematy anatomiczne jako tło (z plików PNG)
- Formularz procedur chirurgicznych:
  - Grzbiet nosa (Radix, Spreaders, etc.)
  - Przegroda nosowa (Skrzywienie, Kolec, SEG)
  - Czubek nosa (Projekcja, Rotacja)
  - Skrzydełka (Lateral crural strut, Batten graft)
  - Kolumella (Columellar show)
  - Materiał do augmentacji (żebro, ucho, powięź)
  - Planowany kształt nosa
- Eksport do PDF z logo "KOLATOR RHINOPLASTY"
- Zapis planów do bazy MongoDB (kolekcja `rhinoplans`)

## Naprawione błędy (23.03.2026)
- ✅ Schemat anatomiczny był obcięty - naprawiono funkcję `setCanvasBackground` (prawidłowe skalowanie i centrowanie)
- ✅ Czerwone linie na canvas - usunięto, canvas działa poprawnie
- ✅ Canvas zmieniony z 500x600 na 500x500 aby dopasować do schematów
- ✅ Wszystkie 3 widoki (frontalny, profilowy, podstawy) wyświetlają schematy prawidłowo

## Endpointy API

### RhinoPlanner
- PUT /api/rhinoplanner/patient/{patient_id} - Zapisz/aktualizuj plan
- GET /api/rhinoplanner/patient/{patient_id} - Pobierz plan
- DELETE /api/rhinoplanner/patient/{patient_id} - Usuń plan

## Pliki schematów anatomicznych
- /public/diagram-frontal.png - Widok frontalny (500x500, gotowy)
- /public/diagram-frontal2.png - Widok frontalny 2 (500x500)
- /public/diagram-profile.png - Widok profilowy (500x500)
- /public/diagram-profile2.png - Widok profilowy 2 (500x500)
- /public/diagram-base1.png - Widok podstawy (500x500)
- /public/diagram-base2.png - Widok podstawy 2 (500x500)

## Do zrobienia (następna sesja)
1. Przetestować RhinoPlanner na tablecie z rysikiem
2. Dodać możliwość rysowania na schematach (testy rysowania)

## Przyszłe zadania
- (P1) Eksport statystyk do Excela
- (P2) Powiadomienia email/SMS
- (P3) Portal pacjenta

## Konfiguracja
- Logo kliniki: /public/logo-rhinoplasty.svg
- Hasło aplikacji: Matikolati123!
