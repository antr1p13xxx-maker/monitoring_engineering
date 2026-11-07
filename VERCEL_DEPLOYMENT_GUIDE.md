# Panduan Lengkap Deploy Aplikasi ke Vercel (vercel.app)

Aplikasi **Monitoring Design & Drawing Engineering & KPI** telah dikonfigurasi penuh agar dapat langsung di-deploy dan berjalan online di platform **Vercel** (`.vercel.app`).

---

## 1. File Konfigurasi yang Telah Disediakan

1. **`vercel.json`**
   - Mengatur framework: `Vite`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Route rewrite otomatis untuk API serverless (`/api/*`) dan fallback SPA (`/index.html`) agar tidak terjadi 404 saat refresh halaman.
2. **`/api/ai-insights.ts`**
   - Serverless Function Vercel untuk memproses fitur *AI Insight & Rekomendasi* (Gemini AI).
3. **`.vercelignore`**
   - Mencegah file build cache dan dependencies lokal ter-upload secara berlebihan.

---

## 2. Cara Deploy (2 Pilihan Mudah)

### Pilihan A: Melalui GitHub & Dashboard Vercel (Paling Direkomendasikan)
1. **Push source code** project ini ke repository GitHub Anda (misalnya: `monitoring-engineering`).
2. Buka **[vercel.com](https://vercel.com)** dan login menggunakan akun GitHub Anda.
3. Klik tombol **"Add New..."** lalu pilih **"Project"**.
4. Pilih repository GitHub Anda, lalu klik **"Import"**.
5. Pada bagian **Environment Variables** di halaman setup Vercel, tambahkan:
   - `GEMINI_API_KEY`: *(Masukkan API Key Gemini Anda jika ingin mengaktifkan AI Insight live, opsional)*
6. Biarkan pengaturan **Framework Preset** mendeteksi **Vite** secara otomatis (Build Command: `npm run build`, Output Directory: `dist`).
7. Klik tombol **"Deploy"**.
8. Dalam waktu ~1-2 menit, aplikasi Anda akan online di domain:
   👉 `https://nama-proyek-anda.vercel.app`

---

### Pilihan B: Menggunakan Vercel CLI (Lewat Terminal Komputer)
1. Install Vercel CLI jika belum ada:
   ```bash
   npm i -g vercel
   ```
2. Login ke akun Vercel Anda:
   ```bash
   vercel login
   ```
3. Di dalam direktori project ini, jalankan perintah deploy:
   ```bash
   vercel
   ```
4. Ikuti instruksi di terminal (tekan Enter untuk opsi default).
5. Untuk deploy ke production domain permanen:
   ```bash
   vercel --prod
   ```

---

## 3. Database Firebase di Vercel

Karena konfigurasi Firebase Anda (`monitoring-engineering-c8ba8`) telah terintegrasi di file `firebase-applet-config.json` dan client SDK, **database Cloud Firestore langsung aktif otomatis** saat aplikasi dibuka di domain `vercel.app` tanpa konfigurasi tambahan!

Data proyek, checklist 3D/2D, target KPI, dan review cost/error akan langsung tersinkronisasi secara real-time.
