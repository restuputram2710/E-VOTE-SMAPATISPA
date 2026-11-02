# E-VOTE SMAPATISPA — Frontend

Aplikasi web pemilihan Ketua OSIS & MPK berbasis kartu suara barcode, dengan hasil langsung di monitor.
Folder ini adalah **frontend** yang dipasang di GitHub Pages. Backend-nya adalah Google Apps Script (`Kode.gs`, disajikan terpisah).

## Satu-satunya yang perlu diisi

Buka `js/config.js` lalu ganti `GANTI_DENGAN_ID_DEPLOYMENT` dengan URL Web App Apps Script (berakhiran `/exec`).

## Struktur

```
index.html          ← halaman tunggal (login, admin, pencalon, bilik, monitor)
css/style.css       ← sistem desain "Civic Vanguard"
js/config.js        ← URL server (/exec)
js/icons.js         ← ikon Lucide (ISC)
js/api.js           ← komunikasi ke server (fetch text/plain, batch, warmup)
js/ui.js            ← helper tampilan
js/app.js           ← tema, router, login, ganti sandi
js/admin.js         ← panel admin
js/impor.js         ← impor & migrasi data pemilih
js/pencalon.js      ← portal pencalon
js/bilik.js         ← Mode Bilik Suara (kiosk)
js/monitor.js       ← Mode Monitor (TV/proyektor)
```

Panduan lengkap: lihat `PANDUAN-INSTALASI.md`.
