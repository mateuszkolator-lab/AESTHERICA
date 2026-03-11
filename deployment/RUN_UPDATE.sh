#!/bin/bash
echo "============================================"
echo " AKTUALIZACJA AestheticaMD - 10.03.2026"
echo "============================================"
cd /opt/aesthetica-md/deployment

echo "[1/5] Zatrzymuję kontenery..."
docker-compose down

echo "[2/5] Backend..."
bash /tmp/UPDATE_BACKEND.sh

echo "[3/5] Constants..."
bash /tmp/UPDATE_CONSTANTS.sh

echo "[4/5] JSX pages..."
bash /tmp/UPDATE_JSX.sh

echo "[5/5] Przebudowa..."
docker-compose build --no-cache
docker-compose up -d

echo ""
echo "============================================"
echo " GOTOWE!"
echo "============================================"
echo "Sprawdź: docker-compose logs -f"
