#!/bin/bash

# ===========================================
# AestheticaMD - Skrypt instalacyjny
# Ubuntu 24.04 / OVH VPS
# ===========================================

set -e

echo "=========================================="
echo "  AestheticaMD - Instalacja"
echo "=========================================="

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Sprawdź czy uruchomiono jako root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Uruchom skrypt jako root (sudo)${NC}"
    exit 1
fi

# 1. Aktualizacja systemu
echo -e "${YELLOW}[1/6] Aktualizacja systemu...${NC}"
apt update && apt upgrade -y

# 2. Instalacja Docker
echo -e "${YELLOW}[2/6] Instalacja Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
else
    echo "Docker już zainstalowany"
fi

# 3. Instalacja Docker Compose
echo -e "${YELLOW}[3/6] Instalacja Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    apt install -y docker-compose-plugin
fi

# 4. Tworzenie katalogu aplikacji
echo -e "${YELLOW}[4/6] Tworzenie struktury katalogów...${NC}"
mkdir -p /opt/aesthetica-md
mkdir -p /opt/aesthetica-md/backups

# 5. Konfiguracja firewall
echo -e "${YELLOW}[5/6] Konfiguracja firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp   # SSH
    ufw allow 80/tcp   # HTTP
    ufw allow 443/tcp  # HTTPS (na przyszłość)
    ufw --force enable
fi

# 6. Instrukcje końcowe
echo -e "${GREEN}=========================================="
echo "  Instalacja zakończona!"
echo "==========================================${NC}"
echo ""
echo "Następne kroki:"
echo "1. Prześlij pliki aplikacji do /opt/aesthetica-md/"
echo "2. Skopiuj .env.example do .env i uzupełnij"
echo "3. Uruchom: docker compose up -d"
echo ""
echo -e "${YELLOW}Szczegóły w pliku INSTRUKCJA.md${NC}"
