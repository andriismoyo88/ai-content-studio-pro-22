# Deployment Checklist - YouTube Automation

Ikuti langkah-langkah ini untuk memastikan aplikasi berjalan normal di VPS Linux Debian.

## 1. Persiapan Environment
- [ ] Install Node.js (v18+) dan npm.
- [ ] Install PM2 secara global: `npm install -g pm2`.
- [ ] Install FFmpeg: `sudo apt update && sudo apt install ffmpeg`.
- [ ] Clone repository ke `/var/www/youtube-automation`.

## 2. Konfigurasi Aplikasi
- [ ] Copy `.env.example` menjadi `.env`: `cp .env.example .env`.
- [ ] Edit `.env` dan masukkan API Key serta secret yang diperlukan.
- [ ] Pastikan file `client_secret.json` (jika ada) berada di root folder.

## 3. Build & Dependencies
- [ ] Install dependencies: `npm install`.
- [ ] Build frontend: `npm run build`.

## 4. Process Management (PM2)
- [ ] Jalankan aplikasi dengan PM2: `pm2 start ecosystem.config.json`.
- [ ] Simpan list proses PM2: `pm2 save`.
- [ ] Setup PM2 startup: `pm2 startup`.

## 5. Nginx Reverse Proxy
- [ ] Copy isi `nginx.conf.example` ke `/etc/nginx/sites-available/youtube-automation`.
- [ ] Buat symbolic link: `sudo ln -s /etc/nginx/sites-available/youtube-automation /etc/nginx/sites-enabled/`.
- [ ] Test konfigurasi Nginx: `sudo nginx -t`.
- [ ] Restart Nginx: `sudo systemctl restart nginx`.

## 6. File Permissions
- [ ] Pastikan folder storage writable: `chmod -R 775 storage uploads`.
- [ ] Pastikan user nginx/www-data memiliki akses (opsional): `sudo chown -R www-data:www-data storage uploads`.

## 7. Verifikasi Final
- [ ] Cek log PM2: `pm2 logs youtube-automation`.
- [ ] Buka domain/IP di browser.
- [ ] Cek Console Browser (F12) untuk memastikan tidak ada error CORS atau Network.
- [ ] Test upload video kecil untuk memastikan FFmpeg dan storage berjalan normal.
