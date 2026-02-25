#!/bin/bash
# Database backup script - runs every 8 hours via cron
# Keeps last 30 backups (10 days worth)

BACKUP_DIR="/root/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

mkdir -p $BACKUP_DIR

# Dump and compress
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

# Remove backups older than 10 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +10 -delete

echo "Backup created: $BACKUP_FILE ($(du -h $BACKUP_FILE | cut -f1))"
