# AestheticaMD - Instrukcja wdrożenia na OVH VPS

## Wymagania
- Ubuntu 24.04
- Dostęp root/sudo
- Min. 2GB RAM, 20GB dysk

---

## KROK 1: Połącz się z serwerem

```bash
ssh root@57.128.255.232
```

---

## KROK 2: Zainstaluj Docker

Skopiuj i wklej tę komendę:

```bash
apt update && apt upgrade -y && curl -fsSL https://get.docker.com | sh && systemctl enable docker && systemctl start docker
```

Sprawdź czy działa:
```bash
docker --version
```

---

## KROK 3: Utwórz katalog aplikacji

```bash
mkdir -p /opt/aesthetica-md
cd /opt/aesthetica-md
```

---

## KROK 4: Prześlij pliki aplikacji

Na swoim komputerze (nie na serwerze!) uruchom:

```bash
scp -r /sciezka/do/aesthetica-md/* root@57.128.255.232:/opt/aesthetica-md/
```

Lub użyj SFTP (np. FileZilla, WinSCP).

---

## KROK 5: Skonfiguruj środowisko

Na serwerze:

```bash
cd /opt/aesthetica-md
cp .env.example .env
nano .env
```

Uzupełnij wartości:
```
SERVER_IP=57.128.255.232
MONGO_PASSWORD=WygenerujSilneHaslo123!
JWT_SECRET=WygenerujLosowyString456!
ADMIN_PASSWORD=TwojeHasloDoLogowania
```

**WAŻNE:** Zapisz te hasła w bezpiecznym miejscu!

Aby wygenerować bezpieczne hasła:
```bash
openssl rand -base64 32
```

---

## KROK 6: Uruchom aplikację

```bash
cd /opt/aesthetica-md
docker compose up -d --build
```

Pierwsze uruchomienie może potrwać 5-10 minut (pobieranie obrazów, budowanie).

Sprawdź status:
```bash
docker compose ps
```

Wszystkie kontenery powinny mieć status "Up".

---

## KROK 7: Otwórz aplikację

W przeglądarce wejdź na:
```
http://57.128.255.232
```

Zaloguj się hasłem ustawionym w `ADMIN_PASSWORD`.

---

## Przydatne komendy

### Sprawdź logi
```bash
docker compose logs -f
```

### Restart aplikacji
```bash
docker compose restart
```

### Zatrzymaj aplikację
```bash
docker compose down
```

### Backup bazy danych
```bash
./backup.sh
```

### Aktualizacja aplikacji
```bash
docker compose down
docker compose up -d --build
```

---

## Rozwiązywanie problemów

### Aplikacja nie działa
```bash
docker compose logs backend
docker compose logs frontend
```

### Brak miejsca na dysku
```bash
docker system prune -a
```

### Reset bazy danych (UWAGA: usuwa wszystkie dane!)
```bash
docker compose down -v
docker compose up -d
```

---

## Backup automatyczny (cron)

Dodaj do crontab:
```bash
crontab -e
```

Dodaj linię (backup codziennie o 3:00):
```
0 3 * * * /opt/aesthetica-md/backup.sh
```

---

## Bezpieczeństwo

1. **Zmień domyślne hasła** w pliku `.env`
2. **Skonfiguruj firewall:**
   ```bash
   ufw allow 22/tcp
   ufw allow 80/tcp
   ufw enable
   ```
3. **Regularnie aktualizuj system:**
   ```bash
   apt update && apt upgrade -y
   ```

---

## Wsparcie

W razie problemów sprawdź logi:
```bash
docker compose logs -f --tail=100
```
