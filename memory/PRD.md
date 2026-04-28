# AestheticaMD - System Zarządzania Pacjentami

## Opis projektu
Aplikacja webowa do zarządzania pacjentami dla kliniki chirurgii plastycznej twarzy.

## Zaimplementowane funkcje
- System uwierzytelniania (JWT) z rolami Admin/Użytkownik
- Filtrowanie po placówkach (location_ids, global_access)
- Zarządzanie pacjentami (CRUD, sortowanie, filtrowanie, ASAP, wiele preferowanych zakresów dat)
- Kalendarz i planowanie (drag & drop, PRO/MED badges, ostrzeżenie przy zmianie placówki)
- Synchronizacja z Google Calendar (automatyczna przy assign/unassign/zmiana statusu/potwierdzenie)
- Potwierdzenie telefoniczne ("P") z sync do Google Calendar
- Kontrole pooperacyjne z "Brak kontaktu"
- Statystyki (tylko admin, filtrowanie po placówce)
- RhinoPlanner (canvas Fabric.js, eksport PDF)
- Historia zmian pacjentów (Audit Log)

## Ostatnie zmiany (28.04.2026)
- Kolumna "Placówka" z badge'ami PRO/MED na liście pacjentów
- Ostrzeżenie w formularzu gdy brak lokalizacji + potwierdzenie przed zapisem
- Kolejność w formularzu: Nazwisko, Imię
- Kolejność na liście: Nazwisko Imię
- Auto-status: konsultacja/oczekujący/zaplanowany zależnie od dat
- Google Calendar: prefix "P/" przy potwierdzonych, sync przy każdej zmianie pól
- Fix kalendarza "Wiele terminów" (UTC→local, kolejność dni Pn-Nd)
- Filtrowanie terminów po placówce w zakładce Planowanie

## Przyszłe zadania
- (P1) Eksport statystyk do Excela
- (P2) Powiadomienia email/SMS
- (P3) Portal pacjenta
