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

## Ostatnie zmiany (17.06.2026)
- Backup bazy: router `/api/backup` (admin) – status/run/download/files; scheduler w lifespan (1 kopia dziennie do BACKUP_DIR, retencja BACKUP_KEEP=14); sekcja „Kopia zapasowa bazy” w Ustawieniach (BackupSection.jsx). Wymaga BACKUP_DIR w backend/.env (na serwerze: /var/backups/aestheticamd)
- Przywracanie rezygnacji: POST /api/patients/{id}/restore → awaiting, historia w `cancellation_history`, przycisk w karcie i na liście (ikona RotateCcw dla rezygnacji)
- Auto-wylogowanie: interceptor axios (utils/api.js) – 401 → czyszczenie tokenu, redirect /login, toast „Sesja wygasła”; backend verify_token zwraca 401 dla tokenów bez location_ids/global_access
- Powód rezygnacji: CancelReasonModal (presety + własny) na liście i w karcie; pole w formularzu edycji; `cancellation_reason` w karcie i historii; Statystyki – karta „Rezygnacje” z podziałem na powody (`cancellations_by_reason`)
- Statusy: nowy "Zastanawia się" (thinking); "Rezygnacja" wybieralna w edycji karty, na liście i w karcie (klik w badge)
- Rezygnacja: backend czyści surgery_date (zapisuje cancelled_surgery_date), usuwa wydarzenie z Google Calendar, wpis w historii zmian
- Fix: ręcznie wybrany status (operated/cancelled/thinking) nie jest już nadpisywany auto-statusem w formularzu
- Lista pacjentów: domyślnie ukrywa Zoperowanych i Rezygnacje (chip "Ukryto… Pokaż")
- Kontrole per zabieg: procedure_types.control_intervals [{days,label}] – edytor w Ustawieniach (presety + własne); klucze kontroli "<days>d", legacy (1_week…) mapowane
- Okno "Czy zabiegi się odbyły?" po zalogowaniu (GET /api/patients/pending-surgery-confirmations, POST /api/patients/{id}/surgery-outcome) – Odbył się → operated; Nie odbył się → awaiting + data usunięta
- Fix: brak importu `api` w Sidebar (sync Google przy wylogowaniu nie działał)
- Serwer: certbot – przejście na plugin nginx + deploy-hook reload nginx (auto-odnawianie SSL)

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
