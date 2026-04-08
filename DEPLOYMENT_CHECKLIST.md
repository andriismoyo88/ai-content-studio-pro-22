# Deployment Checklist - YouTube Automation (Production Fix)

Ikuti langkah-langkah ini untuk memperbaiki masalah fitur yang tidak berjalan di VPS.

## 1. Persiapan Environment & Permissions
- [ ] Jalankan script setup: `sudo bash setup-vps.sh`.
- [ ] Pastikan folder `uploads/` dan `storage/` writable oleh user `www-data`.
- [ ] Copy `.env.example` menjadi `.env` dan isi semua API Key.

## 2. Update Code & Build
- [ ] Pastikan `server.ts` sudah menggunakan versi terbaru (Static Serving Fix).
- [ ] Jalankan `npm install`.
- [ ] Jalankan `npm run build` (Wajib untuk production).

## 3. Nginx Configuration (Kritikal)
- [ ] Edit `/etc/nginx/nginx.conf` atau site config Anda.
- [ ] Tambahkan `client_max_body_size 5000M;` di dalam blok `http` atau `server`.
- [ ] Pastikan `proxy_pass` mengarah ke `http://localhost:3000`.
- [ ] Restart Nginx: `sudo systemctl restart nginx`.

## 4. Process Management
- [ ] Hapus proses lama: `pm2 delete youtube-automation` (jika ada).
- [ ] Jalankan ulang: `pm2 start ecosystem.config.json`.
- [ ] Cek log: `pm2 logs youtube-automation`.

## 5. Validasi Fitur
- [ ] **Upload Video**: Cek apakah file muncul di folder `uploads/` di VPS.
- [ ] **Preview Video**: Pastikan video bisa diputar di browser (Cek URL `/uploads/...`).
- [ ] **GDrive Import**: Cek log PM2 untuk memastikan download berhasil ke `storage/videos/`.
- [ ] **Stats**: Pastikan grafik CPU/RAM di Dashboard bergerak.

## 6. Hardening & Monitoring
- [ ] Cek `df -h` secara berkala untuk memantau sisa storage VPS.
- [ ] Gunakan `pm2 monit` untuk memantau penggunaan RAM.
- [ ] Pastikan `TOKEN_ENCRYPTION_KEY` di `.env` sudah diganti dengan string random yang kuat.
