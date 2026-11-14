#!/usr/bin/env bash
set -euo pipefail

ACTION="${SSH_ORIGINAL_COMMAND:-}"
REBUILD_DIR="/opt/diamante-rebuild/Diamante"

case "$ACTION" in
  health)
    echo "===== HOST ====="
    hostname
    date -Is
    uptime
    echo
    echo "===== DISK ====="
    df -h /
    echo
    echo "===== MEMORY ====="
    free -h
    ;;
  services)
    echo "===== SYSTEMD ====="
    systemctl is-active diamante-api.service 2>/dev/null || true
    systemctl --no-pager --full status diamante-api.service 2>/dev/null | head -n 24 || true
    echo
    echo "===== PM2 ====="
    if command -v pm2 >/dev/null 2>&1; then pm2 list; else echo "PM2 não instalado para este utilizador."; fi
    echo
    echo "===== LISTENING PORTS ====="
    ss -lntp 2>/dev/null | head -n 35 || true
    ;;
  nginx)
    echo "===== NGINX STATUS ====="
    systemctl is-active nginx 2>/dev/null || true
    echo
    echo "===== NGINX CONFIG TEST ====="
    nginx -t 2>&1 || true
    echo
    echo "===== ENABLED SERVER BLOCKS ====="
    grep -RInE '^[[:space:]]*(listen|server_name|root|proxy_pass)[[:space:]]' /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null | head -n 100 || true
    ;;
  rebuild_git_status)
    echo "===== REBUILD REPOSITORY ====="
    if [[ ! -d "$REBUILD_DIR/.git" ]]; then echo "Repositório não encontrado em $REBUILD_DIR"; exit 2; fi
    git -C "$REBUILD_DIR" branch --show-current
    git -C "$REBUILD_DIR" log -1 --format='%h %s'
    git -C "$REBUILD_DIR" status --short --branch
    ;;
  *)
    echo "Operação não permitida."
    exit 64
    ;;
esac
