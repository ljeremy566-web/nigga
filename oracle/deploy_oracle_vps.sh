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

# 1.5. Crear swap de 2 GB si no existe (evita falta de RAM en VMs Micro de 1 GB durante npm install / tsc)
if [ -z "$(swapon --show)" ] && [ ! -f /swapfile ]; then
    echo "💾 Configurando archivo swap de 2 GB..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
fi

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

# 6. Abrir puerto 3000 en iptables (Oracle Ubuntu bloquea puertos extras por defecto)
if command -v iptables &> /dev/null; then
    if ! sudo iptables -C INPUT -p tcp --dport 3000 -j ACCEPT 2>/dev/null; then
        sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT || true
        sudo netfilter-persistent save 2>/dev/null || true
    fi
fi

# 7. Limpiar cron duplicado (node-cron interno ya corre el día 1 de cada mes a las 00:00)
(crontab -l 2>/dev/null | grep -Fv "/api/cron/orchestrate") | crontab - 2>/dev/null || true

echo ""
echo "======================================================"
echo "🎉 ¡Oracle Worker Desplegado y Activo 24/7 con Éxito!"
echo "Estado del servicio:"
sudo systemctl status youtube-instagram-oracle.service --no-pager
echo "======================================================"
