# Dane serwera produkcyjnego

## SSH
- User: ubuntu
- Host: vps-28fc4228
- Komenda: `ssh ubuntu@vps-28fc4228`

## Deploy
```bash
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

## GitHub
- Repo: https://github.com/mateuszkolator-lab/AESTHERICA.git

## Domena
- aestheticamd.ovh
