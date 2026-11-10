#!/usr/bin/env bash
# =========================================================================
# SCRIPT DE DESPLIEGUE EN ORACLE CLOUD VPS (UBUNTU / DEBIAN)
# Proyecto: YouTube Data API v3 + Instagram Intelligence + Gemini AI Oracle
# =========================================================================

set -e

echo "🚀 [Oracle Deploy] Iniciando aprovisionamiento en Oracle Cloud..."

# 1. Actualizar repositorios e instalar paquetes base
sudo apt-get update -y
sudo apt-get install -y curl git ufw

# 2. Instalar Node.js 22 LTS si no está presente
if ! command -v node &> /dev/null; then
    echo "📦 Instalando Node.js 22 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✅ Node versión: $(node -v) | NPM versión: $(npm -v)"

# 3. Directorio de la aplicación
APP_DIR="/home/$USER/youtube-supabase-api"
mkdir -p "$APP_DIR"

echo "📂 Directorio de la app: $APP_DIR"

# 4. Instalar dependencias y compilar
cd "$APP_DIR"
if [ -f "package.json" ]; then
    npm install
    npm run build
fi

# 5. Configurar systemd daemon para que corra 24/7
echo "⚙️ Configurando servicio Systemd..."
sudo cp oracle/youtube-instagram-oracle.service /etc/systemd/system/youtube-instagram-oracle.service
sudo sed -i "s|User=ubuntu|User=$USER|g" /etc/systemd/system/youtube-instagram-oracle.service
sudo sed -i "s|/home/ubuntu/youtube-supabase-api|$APP_DIR|g" /etc/systemd/system/youtube-instagram-oracle.service

sudo systemctl daemon-reload
sudo systemctl enable youtube-instagram-oracle.service
sudo systemctl restart youtube-instagram-oracle.service

# 6. Configurar Cron mensual (Día 1 de cada mes a las 00:00)
echo "⏰ Configurando tarea programada Cron..."
CRON_JOB="0 0 1 * * curl -s -X POST http://localhost:3000/api/cron/orchestrate -H 'Content-Type: application/json' -d '{\"niche\":\"Inteligencia Artificial y Productividad\",\"instagramAccount\":\"@creatorshub\"}' >> /tmp/oracle_cron.log 2>&1"
(crontab -l 2>/dev/null | grep -Fv "/api/cron/orchestrate" ; echo "$CRON_JOB") | crontab -

echo ""
echo "======================================================"
echo "🎉 ¡Oracle Worker Desplegado y Activo 24/7 con Éxito!"
echo "Estado del servicio:"
sudo systemctl status youtube-instagram-oracle.service --no-pager
echo "======================================================"
