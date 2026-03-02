#!/bin/bash

# ===========================================
# AestheticaMD - Skrypt backup'u
# ===========================================

BACKUP_DIR="/opt/aesthetica-md/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/aesthetica_backup_$DATE.gz"

echo "Tworzenie backup'u bazy danych..."

# Backup MongoDB
docker exec aesthetica_mongodb mongodump \
    --username aesthetica_admin \
    --password "$MONGO_PASSWORD" \
    --authenticationDatabase admin \
    --db aesthetica_md \
    --archive=/backups/aesthetica_backup_$DATE.gz \
    --gzip

echo "Backup zapisany: $BACKUP_FILE"

# Usuń backupy starsze niż 30 dni
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete
echo "Usunięto stare backupy (>30 dni)"
