# Dane serwera produkcyjnego

## SSH
- User: ubuntu
- Host: vps-28fc4228
- Komenda: `ssh ubuntu@vps-28fc4228`

## Deploy
```bash
# 0. BACKUP przed aktualizacją (baza + .env)
sudo mkdir -p /var/backups/aestheticamd
sudo mongodump --db $(grep DB_NAME /var/www/aestheticamd/backend/.env | cut -d= -f2 | tr -d '"') --out /var/backups/aestheticamd/pre_deploy_$(date +%F_%H%M)
sudo cp /var/www/aestheticamd/backend/.env /var/backups/aestheticamd/backend.env.bak

# 1. Na serwerze:
cd /tmp && rm -rf AESTHERICA && git clone https://github.com/mateuszkolator-lab/AESTHERICA.git

# 2. Skopiuj pliki:
sudo cp -r /tmp/AESTHERICA/backend/* /var/www/aestheticamd/backend/ && sudo cp -r /tmp/AESTHERICA/frontend/* /var/www/aestheticamd/frontend/

# 3. Przebuduj frontend:
cd /var/www/aestheticamd/frontend && yarn install && yarn build

# 4. Restart backendu:
sudo systemctl restart aestheticamd
```

## Instalacja od zera (jednorazowa - już zrobiona 14.04.2026)
- Node 20+, Python 3.12, MongoDB 7.0, nginx
- venv: /var/www/aestheticamd/backend/venv
- systemd service: aestheticamd.service
- nginx config: /etc/nginx/sites-available/aestheticamd
- Backend .env: /var/www/aestheticamd/backend/.env
- Frontend .env: /var/www/aestheticamd/frontend/.env

## Automatyczny backup w aplikacji (od 17.06.2026)
Jednorazowo na serwerze:
```bash
sudo mkdir -p /var/backups/aestheticamd
SVC_USER=$(grep -i '^User=' /etc/systemd/system/aestheticamd.service | cut -d= -f2); sudo chown ${SVC_USER:-root}:${SVC_USER:-root} /var/backups/aestheticamd
echo 'BACKUP_DIR=/var/backups/aestheticamd' | sudo tee -a /var/www/aestheticamd/backend/.env
echo 'BACKUP_KEEP=14' | sudo tee -a /var/www/aestheticamd/backend/.env
sudo systemctl restart aestheticamd
```
Aplikacja tworzy codziennie 1 plik `aestheticamd_YYYY-MM-DD.zip` (JSON per kolekcja), trzyma ostatnie 14. Pobieranie/ręczne tworzenie w Ustawienia → Kopia zapasowa bazy (tylko admin).
Przywracanie: rozpakuj ZIP i `mongoimport --db <DB_NAME> --collection patients --drop --jsonArray patients.json` (dla każdej kolekcji).

## GitHub
- Repo: https://github.com/mateuszkolator-lab/AESTHERICA.git

## Domena
- aestheticamd.ovh
