#!/bin/bash

# Setup VPS for YouTube Automation App
# Run this script as root or with sudo

APP_DIR="/var/www/youtube-automation"
UPLOADS_DIR="$APP_DIR/uploads"
STORAGE_DIR="$APP_DIR/storage"
LOGS_DIR="$APP_DIR/logs"

echo "[1/5] Creating directories..."
mkdir -p $UPLOADS_DIR
mkdir -p $STORAGE_DIR/videos
mkdir -p $STORAGE_DIR/thumbnails
mkdir -p $LOGS_DIR

echo "[2/5] Setting permissions..."
# Change ownership to the user running the app (usually www-data or your current user)
# Replace 'www-data' with your actual user if different
chown -R www-data:www-data $APP_DIR

# Set directory permissions to 775 (rwxrwxr-x)
chmod -R 775 $UPLOADS_DIR
chmod -R 775 $STORAGE_DIR
chmod -R 775 $LOGS_DIR

echo "[3/5] Installing system dependencies..."
apt update
apt install -y ffmpeg nodejs npm nginx

echo "[4/5] Installing PM2..."
npm install -g pm2

echo "[5/5] Setup complete!"
echo "Next steps:"
echo "1. Edit .env file"
echo "2. Run 'npm install'"
echo "3. Run 'npm run build'"
echo "4. Run 'pm2 start ecosystem.config.json'"
echo "5. Configure Nginx using nginx.conf.example"
