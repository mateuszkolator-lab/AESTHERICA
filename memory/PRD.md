# AestheticaMD - System Zarządzania Pacjentami

## Opis projektu
Aplikacja webowa do zarządzania pacjentami dla kliniki chirurgii plastycznej twarzy.

## Zaimplementowane funkcje
- System uwierzytelniania (JWT) z rolami Admin/Użytkownik
- Filtrowanie po placówkach (location_ids, global_access)
- Zarządzanie pacjentami (CRUD, sortowanie, filtrowanie, ASAP, wiele preferowanych zakresów dat)
- Kalendarz i planowanie (drag & drop, PRO/MED badges, ostrzeżenie przy zmianie placówki)
- Synchronizacja z Google Calendar (auto przy tworzeniu/edycji/assign/unassign/potwierdzeniu + sync-all + sync przy wylogowaniu)
- Potwierdzenie telefoniczne ("P") z sync do Google Calendar (prefix "P/")
- Kontrole pooperacyjne z "Brak kontaktu"
- Statystyki (tylko admin, filtrowanie po placówce)
- RhinoPlanner (canvas Fabric.js, eksport PDF)
- Historia zmian pacjentów (Audit Log)

## Ostatnie zmiany (26.05.2026)
- Auto-sync Google Calendar przy tworzeniu nowego pacjenta z datą zabiegu
- Endpoint /api/calendar/sync-all do pełnej synchronizacji
- Przycisk "Synchronizuj wszystko z Google Calendar" w Ustawieniach
- Auto-sync przy wylogowaniu (przycisk "Synchronizacja...")
- Obsługa invalid_grant - czytelny komunikat i auto-reset tokenów
- Badge "P" przy potwierdzonych pacjentach na liście nadchodzących operacji (Pulpit)
- Filtrowanie nadchodzących operacji po placówce (Pulpit)
- Filtrowanie terminów po placówce (Planowanie)
- Kolumna "Placówka" z badge'ami na liście pacjentów
- Ostrzeżenie w formularzu gdy brak lokalizacji + potwierdzenie przed zapisem
- Kolejność: Nazwisko Imię (formularz + lista)
- Auto-status: konsultacja/oczekujący/zaplanowany zależnie od dat
- Fix kalendarza "Wiele terminów" (UTC→local, kolejność dni Pn-Nd)
- Google Cloud: zmiana z Testing na Production (tokeny nie wygasają)

## Serwer produkcyjny
- Domena: https://aestheticamd.ovh
- SSH: ubuntu@vps-28fc4228
- Pliki: /var/www/aestheticamd/
- Backend service: aestheticamd.service
- Nginx: /etc/nginx/sites-available/aestheticamd
- SSL: Let's Encrypt (certbot)

## Przyszłe zadania
- (P1) Eksport statystyk do Excela
- (P2) Powiadomienia SMS/Email do pacjentów
- (P2) Dashboard z KPI (przychód, % wypełnienia slotów)
- (P3) Portal pacjenta
- (P3) Moduł rozliczeń
