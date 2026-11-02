# Panduan Instalasi & Penggunaan — E-VOTE SMAPATISPA

Aplikasi pemilihan Ketua OSIS & MPK digital: kartu suara barcode, bilik suara di laptop, dan hasil langsung di monitor sekolah.

Panduan ini ditulis untuk panitia yang **belum pernah** memakai Apps Script maupun GitHub. Ikuti urutannya dari atas ke bawah. Perkiraan waktu: **45–60 menit** untuk pemasangan pertama.

---

## Daftar Isi

1. [Isi paket](#1-isi-paket)
2. [Persiapan](#2-persiapan)
3. [Memasang backend (Google Apps Script)](#3-memasang-backend-google-apps-script)
4. [Memasang frontend (GitHub Pages)](#4-memasang-frontend-github-pages)
5. [Login pertama & pengaturan awal](#5-login-pertama--pengaturan-awal)
6. [Menyiapkan data pemilihan](#6-menyiapkan-data-pemilihan)
7. [Gladi resik dengan Mode Simulasi](#7-gladi-resik-dengan-mode-simulasi)
8. [Hari pemungutan suara (SOP)](#8-hari-pemungutan-suara-sop)
9. [Impor & migrasi data dari spreadsheet lain](#9-impor--migrasi-data-dari-spreadsheet-lain)
10. [Keamanan & data rahasia](#10-keamanan--data-rahasia)
11. [Kecepatan & keep-warm](#11-kecepatan--keep-warm)
12. [Memperbarui aplikasi](#12-memperbarui-aplikasi)
13. [Kendala umum](#13-kendala-umum)
14. [Hasil pengujian](#14-hasil-pengujian)
15. [Catatan & batasan](#15-catatan--batasan)

---

## 1. Isi paket

| Berkas | Untuk apa | Dipasang di |
|---|---|---|
| `Kode.gs` | Server / backend (semua logika & database) | Editor Google Apps Script |
| `appsscript.json` | Pengaturan proyek (zona waktu Jakarta) — **opsional** | Editor Google Apps Script |
| `e-vote-smapatispa.zip` | Tampilan aplikasi (frontend) | GitHub Pages |
| `PANDUAN-INSTALASI.md` | Panduan ini | Dibaca |

Cara kerjanya:

```
 Laptop admin / Bilik / PC Monitor  ──(internet)──►  GitHub Pages (tampilan)
                                                         │  fetch JSON
                                                         ▼
                                              Google Apps Script (Kode.gs)
                                                 │                │
                                          Google Sheets      Google Drive
                                           (database)       (foto & logo)
```

---

## 2. Persiapan

1. **Akun Google khusus panitia** (disarankan), misalnya `evote.smapatispa@gmail.com`.
   Akun sekolah (Google Workspace for Education) kadang melarang Web App diakses dari luar sekolah. Akun khusus menghindari masalah itu, dan data pemilihan tidak tercampur dengan surel pribadi.
2. **Akun GitHub** gratis di https://github.com. Username akan menjadi bagian alamat situs: `username.github.io`.
3. **Git** terpasang di laptop (langkahnya ada di bagian 4).
4. Laptop dengan **Google Chrome** terbaru.

---

## 3. Memasang backend (Google Apps Script)

### 3.1 Membuat proyek & menempel kode

1. Masuk ke akun Google panitia, lalu buka https://script.google.com.
2. Klik **Proyek baru** (New project).
3. Klik judul "Proyek tanpa judul" di kiri atas, lalu ganti menjadi `E-VOTE SMAPATISPA`.
4. Di panel kiri ada berkas `Kode.gs` (atau `Code.gs`). Klik berkas itu, **hapus semua isinya**, lalu **tempel seluruh isi `Kode.gs`** dari paket ini.
5. Tekan **Ctrl+S** (Simpan).

### 3.2 Zona waktu (penting untuk jadwal)

Klik ikon **⚙️ Setelan Proyek** di panel kiri, lalu ubah **Zona waktu** menjadi **(GMT+07:00) Jakarta**.

> Opsional: centang "Tampilkan file manifes appsscript.json di editor", lalu tempel isi `appsscript.json` dari paket ini.

### 3.3 Menjalankan setup (sekali saja)

1. Di bagian atas editor, pilih fungsi **`setupAppEnvironment`** dari menu tarik-turun, lalu klik **▶ Jalankan**.
2. Google akan meminta izin. Klik **Tinjau izin**, pilih akun panitia, lalu klik **Lanjutan → Buka E-VOTE SMAPATISPA (tidak aman) → Izinkan**.
   Peringatan "tidak aman" muncul karena aplikasi ini buatan sendiri dan belum diverifikasi Google. Itu normal.
3. Buka **Log eksekusi** di bagian bawah. Contoh isinya:

```
🚀 Memulai setup E-VOTE SMAPATISPA v1.0.0...
🔐 AKUN ADMIN PERTAMA (catat sekarang — hanya tampil sekali, wajib ganti sandi saat login pertama)
   Username   : admin
   Kata sandi : XXXXXXXXXXXX
🔢 PIN PETUGAS BILIK (catat — bisa diganti di menu Pengaturan): XXXXXX
✅ Setup selesai.
   Spreadsheet : https://docs.google.com/spreadsheets/d/XXXX/edit
   Folder Drive: https://drive.google.com/drive/folders/XXXX
   Keep-warm   : aktif (tiap 1 menit)
```

4. **Catat kata sandi admin dan PIN petugas sekarang.** Keduanya hanya tampil sekali.
5. Periksa Google Drive. Folder **📁 E-VOTE SMAPATISPA** sudah terbuat, berisi database **🗃️ DB E-VOTE SMAPATISPA** dan folder Foto Calon, Identitas Aplikasi, dan Ekspor Hasil.

> Setup **aman dijalankan ulang**: data tidak dihapus, folder tidak digandakan, dan kata sandi tidak ditimpa. Lupa sandi admin? Jalankan fungsi **`resetSandiAdmin`** (lihat bagian 10).

### 3.4 Deploy sebagai Web App

1. Klik **Deploy → Deployment baru** (New deployment).
2. Klik ikon ⚙️ di samping "Pilih jenis", lalu pilih **Aplikasi web** (Web app).
3. Isi:
   - **Deskripsi:** `v1.0.0`
   - **Jalankan sebagai:** **Saya** (Me)
   - **Yang memiliki akses:** **Siapa saja** (Anyone)
4. Klik **Deploy**, lalu **salin URL Aplikasi web** (berakhiran `/exec`).
5. Uji URL itu di tab baru. Halaman yang benar menampilkan teks seperti `{"success":true,"app":"E-VOTE SMAPATISPA API",...}`.

> "Siapa saja" **tidak** berarti siapa saja bisa membuka data. Semua menu tetap wajib login, dan setiap permintaan diperiksa token serta perannya di server. URL `/exec` bukan rahasia.

---

## 4. Memasang frontend (GitHub Pages)

### 4.1 Pasang Git (sekali per laptop)

- **Windows:** unduh dari https://git-scm.com/download/win, lalu pasang dengan pilihan bawaan. Setelah itu buka **PowerShell**.
- **Mac:** buka Terminal, ketik `git --version`. Bila belum terpasang, macOS akan menawarkan pemasangan.

Periksa dengan perintah:

```bash
git --version
```

Lalu atur identitas Git (cukup sekali):

```bash
git config --global user.name "Nama Panitia"
git config --global user.email "email-akun-github@contoh.com"
```

### 4.2 Siapkan folder frontend

1. Ekstrak **`e-vote-smapatispa.zip`** (klik kanan → **Extract All / Ekstrak Semua**).
2. Hasilnya adalah folder **`e-vote-smapatispa`**. Isinya **langsung** `index.html`, `README.md`, `PANDUAN-INSTALASI.md`, folder `css`, dan folder `js`.
   **Folder inilah yang nanti di-`git init`.** Jangan masuk lebih dalam dan jangan naik satu tingkat.
3. Buka `js\config.js` dengan Notepad, lalu ganti `GANTI_DENGAN_ID_DEPLOYMENT` sehingga barisnya menjadi URL `/exec` dari langkah 3.4:

```js
GAS_URL: 'https://script.google.com/macros/s/XXXXXXXXXXXX/exec'
```

   Simpan berkasnya. **Lakukan ini sebelum push pertama.**

### 4.3 Buat repository di GitHub

1. Di github.com klik **+ → New repository**.
2. Nama: `e-vote-smapatispa`. Pilih **Public** (wajib untuk GitHub Pages gratis; berkas tampilan tidak memuat rahasia apa pun).
3. **Jangan** centang README, .gitignore, atau license. Klik **Create repository**.

### 4.4 Kirim (push) berkas

1. Buka folder `e-vote-smapatispa` di File Explorer, klik address bar, ketik `powershell`, lalu Enter. PowerShell terbuka langsung di folder itu.
2. Pastikan foldernya benar:

```powershell
dir
```

   Baris yang tampil **harus** memuat `index.html`, `css`, dan `js`. Jika yang tampil malah folder `e-vote-smapatispa`, masuk dulu dengan `cd e-vote-smapatispa`.

3. Jalankan perintah ini **satu per satu**:

```bash
git init
git add .
git commit -m "Upload pertama"
git branch -M main
git remote add origin https://github.com/USERNAME/e-vote-smapatispa.git
git push -u origin main
```

   Perhatikan tanda **titik** di akhir `git add .`, dan ganti `USERNAME` dengan username GitHub Anda.

4. Saat diminta **Password**, tempel **Personal Access Token**, bukan sandi GitHub. Saat token ditempel, layar tetap kosong; itu normal.
   Cara membuat token: https://github.com/settings/tokens → **Generate new token (classic)** → centang **repo** → Generate. Salin token `ghp_…` (hanya tampil sekali).

Push berhasil bila muncul `Writing objects: 100%` dan `* [new branch] main -> main`.

### 4.5 Aktifkan GitHub Pages

1. Di halaman repository, buka **Settings → Pages**.
2. Isi **Source:** Deploy from a branch, **Branch:** `main` / `(root)`, lalu klik **Save**.
3. Centang **Enforce HTTPS** (wajib, agar kamera untuk mode pindai kamera bisa dipakai).
4. Tunggu 1–2 menit, lalu buka `https://USERNAME.github.io/e-vote-smapatispa/`.

---

## 5. Login pertama & pengaturan awal

1. Buka situs, lalu login dengan username **admin** dan kata sandi dari log setup.
2. Aplikasi **mewajibkan ganti sandi**. Buat sandi baru minimal 8 karakter berisi huruf dan angka.
3. Buka menu **Pengaturan**:
   - **Identitas:** nama aplikasi, nama sekolah, judul acara.
   - **Logo:** seret berkas logo (PNG persegi transparan paling bagus). Logo langsung tersimpan dan dipakai di header, kartu suara, monitor, dan ikon tab.
   - **Warna:** pilih preset atau atur sendiri. Peringatan kontras muncul bila warna terlalu terang.
   - **Tampilan Monitor:** tema (Gelap disarankan untuk proyektor), tata letak (Berdampingan/Bergantian), interval pembaruan, teks berjalan, dan opsi sembunyikan angka.
   - **Bilik Suara:** bunyi bip, batas diam, dan **PIN Petugas** (ganti PIN dari setup dengan PIN baru yang mudah diingat panitia).
   - Klik **Simpan Perubahan**.
4. Tambahkan admin lain bila perlu di menu **Akun → tab Admin → Buat Akun**.

---

## 6. Menyiapkan data pemilihan

### 6.1 Pemilihan & jadwal

Menu **Pemilihan & Jadwal**:
- Nama pemilihan bawaan adalah "Ketua OSIS" dan "Ketua MPK" (bisa diganti). Urutan menentukan urutan surat suara di bilik.
- Isi **tanggal, jam mulai, jam selesai**. Aktifkan **Buka & tutup otomatis** bila ingin dibuka dan ditutup sendiri sesuai jam.

### 6.2 Akun pencalon & verifikasi

1. Menu **Akun → Buat Akun**, peran **Pencalon**. Username dibuat otomatis dari nama.
2. Berikan **slip akun** (bisa dicetak atau disalin) kepada pencalon. Sandi awal tidak bisa dilihat lagi setelah jendela slip ditutup.
3. Pencalon login, mengganti sandi, lalu mengisi data (jenis pemilihan, nama, kelas, visi, misi, foto) dan mengajukan.
4. Di menu **Calon**, panitia klik **Tinjau** untuk:
   - **Setujui** + pilih **nomor urut** (data otomatis terkunci), atau
   - **Minta Perbaikan** (catatan wajib, tampil di portal pencalon), atau
   - **Tolak** (alasan wajib).
5. Panitia juga bisa **Tambah Calon** langsung tanpa akun.

> Minimal **2 calon disetujui** per pemilihan sebelum pemungutan bisa dibuka. Data calon terkunci otomatis saat pemungutan berjalan.

### 6.3 Data pemilih (±400 siswa & guru)

Menu **Pemilih & Kartu Suara → Impor Data**. Ada tiga cara:
- **File Excel/CSV:** klik **Unduh Template**, isi kolom `NIS, Nama, Kelas, Jenis`, lalu seret berkasnya.
- **Tempel dari Spreadsheet:** blok baris di Excel/Google Sheets (termasuk judul), salin, lalu tempel.
- **Google Sheets Lain (Migrasi):** lihat bagian 9.

Klik **Periksa di Server** dulu (pratinjau, belum menyimpan), baru **Jalankan Impor**. Setiap pemilih otomatis mendapat **kode kartu unik 8 karakter**. Impor aman diulang; data yang sama tidak menjadi dobel. Guru boleh dikosongkan kelasnya, karena otomatis terisi "Guru".

### 6.4 Cetak kartu suara

Menu **Cetak Kartu**:
1. Pilih filter kelas/jenis (misalnya cetak per kelas agar mudah dibagikan wali kelas).
2. Klik **Cetak**. Di dialog printer, atur kertas **A4**, skala **100% / Actual size**, dan margin **None**. Isinya 10 kartu per lembar dengan garis potong.
3. Gunting kartu, lalu tandai sudah dicetak (aplikasi akan menanyakan).

Kartu hilang atau rusak? Buka **Pemilih → ikon ↻ (Ganti Kartu)**. Kode lama langsung tidak berlaku, lalu cetak ulang.

---

## 7. Gladi resik dengan Mode Simulasi

Lakukan sehari atau dua hari sebelum hari-H.

1. Menu **Pemilihan & Jadwal → Zona Berbahaya**: nyalakan **Mode Simulasi**, lalu klik **Buat 10 Kartu Uji**.
2. Menu **Cetak Kartu → Jenis: Kartu uji**, lalu cetak.
3. Siapkan bilik: di laptop bilik, login admin, lalu klik **Mode Bilik Suara** di menu samping → beri nama ("Bilik 1") → **Mulai Mode Bilik**.
4. Siapkan monitor: di PC yang tersambung ke TV/proyektor, login admin → **Mode Monitor** → **Mulai**. Tekan **F11** untuk layar penuh.
5. Coba pindai kartu uji, pilih calon, lalu kirim. Monitor menampilkan hasil dengan watermark **SIMULASI**.
6. Coba juga kartu yang sudah dipakai dan kartu asli (keduanya harus ditolak), serta batas waktu diam.
7. Selesai gladi: klik **Hapus Data Simulasi**, lalu **matikan Mode Simulasi**.
8. Periksa **Dasbor → Konsistensi Data** dan pastikan total suara asli = 0.

---

## 8. Hari pemungutan suara (SOP)

### Perangkat

| Perangkat | Jumlah | Catatan |
|---|---|---|
| Laptop bilik + scanner barcode/QR USB | 4–5 | Scanner mode "keyboard" (colok langsung). Pastikan bisa membaca **QR code** |
| PC + TV/proyektor (monitor) | 1–2 | 1920×1080, Chrome layar penuh |
| Laptop admin | 1 | Kontrol & bantuan |
| Internet | WiFi + hotspot cadangan | Uji sebelum mulai |

### Urutan

1. **Pagi:** nyalakan semua bilik (Mode Bilik) dan monitor (Mode Monitor).
2. Admin klik **Buka Pemungutan** di Dasbor (atau biarkan terbuka otomatis sesuai jadwal).
3. **Alur pemilih:**
   1. Meja registrasi: petugas mencocokkan siswa dengan kartunya.
   2. Masuk bilik, lalu **pindai kartu**.
   3. Pilih Ketua OSIS → **Lanjut** → pilih Ketua MPK → **Lanjut** → periksa → **KIRIM SUARA SAYA**.
   4. Keluar bilik. Petugas mencoret atau menyobek kartu (secara sistem, kartu sudah tidak berlaku).
4. Bila scanner bermasalah, petugas bisa menekan ikon 🔒 di pojok bilik → PIN → **Input Kode Manual** (kode 8 karakter di kartu).
5. Pantau **Dasbor**: kehadiran per kelas, aktivitas, dan konsistensi data.
6. **Istirahat:** klik **Jeda**, lalu **Lanjutkan** setelahnya.
7. **Selesai:** klik **Tutup Pemungutan**. Monitor menampilkan hitung mundur 3-2-1, konfeti, dan **layar pemenang**. Bila hasil seri, tampil "menunggu keputusan panitia".
8. Menu **Hasil & Rekap**: **Cetak Rekap** (berisi kolom tanda tangan), **Unduh CSV**, atau **Ekspor ke Google Sheets**.
9. Keluar dari mode bilik/monitor: ikon 🔒 (bilik) atau tombol **Esc** (monitor) → PIN → **Keluar**.

> **Kerahasiaan:** sistem hanya mencatat **bahwa** seseorang sudah memilih, tidak pernah **siapa yang dipilih**. Jika hanya satu bilik yang aktif, perubahan angka di monitor bisa ditebak. Gunakan ≥3 bilik, atau atur interval monitor 30–60 detik / sembunyikan angka sampai ditutup.

---

## 9. Impor & migrasi data dari spreadsheet lain

Menu **Pemilih & Kartu Suara → Impor Data → Google Sheets Lain (Migrasi)**. Cocok untuk:
- Spreadsheet **data siswa sekolah** (kolom dikenali otomatis: Nama / Nama Siswa, Kelas / Rombel, NIS / NISN / NIP).
- **Database E-VOTE tahun lalu**: ikut membawa calon (status "Menunggu Verifikasi") dan identitas/warna.

Prinsip:
1. Spreadsheet sumber **hanya dibaca**, tidak pernah diubah.
2. Gunakan spreadsheet milik **akun Google yang sama** dengan pemilik aplikasi, agar foto lama (ID Drive) tetap terbaca.
3. Klik **Pindai (Dry-run)** dulu untuk melihat jumlah ditambah, diperbarui, dilewati, dan bermasalah.
4. Klik **Jalankan Impor**. Menjalankan ulang tidak membuat data dobel (cocok untuk "delta" bila ada siswa baru menjelang hari-H).
5. Akun & kata sandi lama **tidak** dimigrasi (hash sandi tersimpan di proyek lama). Buat akun pencalon baru.
6. Suara/hasil tahun lalu **tidak pernah** dimigrasi.

---

## 10. Keamanan & data rahasia

Semua rahasia disimpan di **Script Properties** (Apps Script → ⚙️ Setelan Proyek → Properti skrip), **bukan** di kode, Sheets, atau GitHub:

| Nilai | Diisi oleh | Keterangan |
|---|---|---|
| `SESSION_SECRET` | Otomatis (setup) | Kunci tanda tangan sesi login |
| `PW_<id akun>` | Otomatis | Hash + garam kata sandi tiap akun (sandi asli tidak bisa dibaca siapa pun) |
| `PIN_BILIK_HASH`, `PIN_BILIK_SALT` | Otomatis / menu Pengaturan | PIN petugas (tersimpan sebagai hash) |
| `SPREADSHEET_ID`, `FOLDER_*` | Otomatis | Lokasi database & folder Drive |
| `REV_<id akun>` | Otomatis | Penanda pencabutan sesi (ganti sandi / nonaktif) |

Fungsi yang bisa dijalankan dari editor Apps Script bila darurat:

| Fungsi | Kegunaan |
|---|---|
| `resetSandiAdmin` | Membuat sandi acak baru untuk username **admin** (lihat di Log) |
| `resetPinBilik` | Membuat PIN petugas acak baru |
| `rotasiSecretSesi` | Mengeluarkan **semua** perangkat (bila curiga ada kebocoran) |
| `cekPerforma` | Ringkasan kesehatan cache, trigger, dan ukuran Script Properties |

Aturan penting:
- **Jangan bagikan** spreadsheet database ke siapa pun. Panitia cukup memakai dasbor aplikasi.
- **Jangan tambahkan editor** proyek Apps Script sembarangan, karena editor bisa melihat Script Properties.
- Login salah 5× mengunci akun 10 menit. PIN salah 5× mengunci perangkat 5 menit.
- Sesi lama otomatis tidak berlaku setelah sandi diganti atau direset.

---

## 11. Kecepatan & keep-warm

- Setup memasang trigger **`keepWarm`** setiap 1 menit agar cache (daftar calon, peta kartu, hasil live) tetap siap. Pemakaiannya sekitar **5–10 menit kuota trigger per hari**, dari batas ±90 menit/hari untuk akun Gmail biasa.
- Setelah pemilihan selesai, jalankan **`matikanKeepWarm`** dari editor. Jalankan **`nyalakanKeepWarm`** menjelang pemilihan berikutnya.
- Saat halaman login dibuka, browser juga "memanaskan" server agar login pertama tidak lambat.
- Suara dikirim lewat antrean terkunci (LockService), sehingga 4–5 bilik bisa mengirim bersamaan tanpa hitungan bertabrakan. Pengiriman ulang otomatis (saat sinyal putus) memakai kunci anti-ganda, jadi suara tidak terhitung dua kali.
- Konsol browser: ketik `Perf.table()` untuk melihat waktu setiap permintaan.

---

## 12. Memperbarui aplikasi

**Backend:** tempel `Kode.gs` versi baru → Simpan → **Deploy → Kelola deployment → ✏️ Edit → Versi: Versi baru → Deploy**.
**Jangan** membuat "Deployment baru", karena URL `/exec` akan berubah.

**Frontend:** salin berkas baru ke folder `e-vote-smapatispa` (jangan menimpa `js/config.js`), lalu jalankan:

```bash
git add .
git commit -m "Perbarui aplikasi"
git push
```

Tunggu 1–2 menit, lalu tekan **Ctrl+Shift+R** di browser.

---

## 13. Kendala umum

| Gejala | Penyebab | Solusi |
|---|---|---|
| Login: "Alamat server belum diatur" | `js/config.js` belum diisi | Isi URL `/exec`, lalu `git add . && git commit -m "config" && git push` |
| "Tidak dapat terhubung ke server" | Internet putus / URL salah / belum deploy | Cek internet; buka URL `/exec` di tab baru harus menampilkan JSON |
| Situs GitHub Pages 404 | `index.html` tidak di root repository | Pastikan `git init` dijalankan di folder yang langsung berisi `index.html` |
| Tampilan tanpa warna (CSS hilang) | Folder `css/`/`js/` tidak ikut | Jangan unggah lewat web GitHub; pakai `git push` |
| Error izin / "Akses ditolak" saat deploy | Kebijakan akun sekolah | Pakai akun Google khusus panitia |
| Bilik: "Pemungutan belum dibuka" | Status masih Persiapan / Mode Simulasi aktif | Matikan simulasi, lalu Buka Pemungutan |
| Bilik: "Kartu tidak dikenal" | Kartu lama yang sudah diganti / salah cetak | Cek di menu Pemilih, lalu Ganti Kartu & cetak ulang |
| Scanner tidak merespons | Scanner bukan mode keyboard / fokus hilang | Klik sekali di layar bilik; uji scanner di Notepad; pakai input manual |
| Kamera tidak menyala | Situs bukan HTTPS / izin kamera ditolak | Centang Enforce HTTPS; izinkan kamera di Chrome |
| Foto tidak muncul | Berkas foto terhapus di Drive | Unggah ulang foto calon |
| Lupa sandi admin / PIN | — | Jalankan `resetSandiAdmin` / `resetPinBilik` di editor |
| Jadwal meleset 1–7 jam | Zona waktu proyek salah | Setelan Proyek → (GMT+07:00) Jakarta |

---

## 14. Hasil pengujian

Aplikasi diuji sebelum diserahkan memakai **simulator Google Apps Script** (meniru Sheets, Cache, Script Properties, dan Lock) dan **browser Chrome otomatis**.

**Backend — 113 uji lulus, 0 gagal**, antara lain:
- Setup idempoten (dijalankan 2× tidak menimpa rahasia/data, trigger tepat 1).
- Login, kunci akun 5×, wajib ganti sandi, token lama dicabut, token palsu ditolak.
- Tidak ada rahasia (secret/hash/PIN/sandi) yang tersimpan di Google Sheets.
- Impor 400 pemilih: dry-run tidak menulis, impor ulang = 0 ditambah, NIS berawalan 0 tetap utuh, semua kode kartu unik tanpa huruf mirip.
- **400 suara dari 4 bilik** tanpa gagal; total = jumlah pemilih "Sudah"; kirim ulang tidak dobel; kartu tidak bisa dipakai 2×.
- Kerahasiaan: sheet Pemilih dan log tidak memuat pilihan maupun kode kartu.
- Angka disembunyikan di server untuk monitor (tidak bocor ke browser); jadwal buka/tutup otomatis; mode simulasi terpisah dari hasil asli; reset suara; migrasi spreadsheet (sumber tidak berubah).

**Browser — 29 uji lulus, 0 error JavaScript**: login, seluruh menu admin, impor tempel, cetak kartu, pengaturan warna, alur bilik lengkap (pindai → pilih → konfirmasi → kirim, kartu ganda, kartu palsu, PIN), monitor (gelap, terang, bergantian, angka tersembunyi, suara baru, layar pemenang), portal pencalon, dan tampilan HP.

**Cetak kartu:** PDF A4 berisi 10 kartu per lembar; seluruh QR code berhasil dipindai dan isinya cocok dengan kode yang tercetak.

> Pengujian dilakukan di simulator. Uji akhir di akun Google Anda tetap wajib (bagian 7: gladi resik).

---

## 15. Catatan & batasan

- **Calon bersifat perseorangan** (bukan pasangan ketua–wakil), sesuai PRD.
- **Kartu bersifat "siapa membawa, dia memilih"**. Kecocokan kartu dengan siswa dijaga petugas meja registrasi.
- **Hash kata sandi disimpan di Script Properties**, bukan di sheet Pengguna seperti rancangan awal PRD. Ini mengikuti aturan keamanan (spreadsheet sering dibagikan).
- Tema monitor bawaan **Gelap** karena lebih kontras di proyektor; bisa diganti ke Terang di Pengaturan.
- Butuh internet selama pemungutan. Tanpa internet, suara tidak terkirim, tetapi kartu tetap bisa dipakai setelah koneksi pulih.
- Pustaka QR code, pembaca Excel, dan pemindai kamera dimuat dari CDN (cdnjs/unpkg) saat dibutuhkan, sehingga perangkat perlu internet.
- Setelah pemilihan, jalankan `matikanKeepWarm` dan arsipkan spreadsheet database.

*E-VOTE SMAPATISPA v1.0.0*
