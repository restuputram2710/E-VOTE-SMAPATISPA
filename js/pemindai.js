/* ============================================================================
   E-VOTE SMAPATISPA — Pemindai QR lewat kamera (HP / laptop / tablet)

   • Elemen video PERSISTEN: dibuat sekali, dipindah antar-layar, tidak ikut
     terhapus ketika layar bilik digambar ulang (penyebab kamera "hitam").
   • Memakai mesin baca tercepat yang tersedia di perangkat:
       1) BarcodeDetector bawaan browser (Android, Chromebook, Mac) — tanpa unduhan
       2) jsQR di Web Worker (Windows, Linux, iPhone) — tidak membuat layar patah-patah
       3) jsQR di thread utama (cadangan terakhir)
   • Gambar hanya diproses saat diminta (aktif) dan berhenti saat tab tersembunyi.
   ============================================================================ */
(function () {
  'use strict';
  const EV = window.EV;

  const PESAN = {
    INSECURE: 'Kamera hanya bisa dipakai lewat alamat https:// (situs GitHub Pages), bukan dari file di komputer.',
    UNSUPPORTED: 'Browser ini tidak mendukung kamera. Buka situs dengan Google Chrome, jangan dari dalam aplikasi WhatsApp atau Instagram.',
    NotAllowedError: 'Izin kamera ditolak. Ketuk ikon di kiri alamat situs → Izin / Setelan situs → Kamera → Izinkan, lalu tekan Coba Lagi.',
    NotFoundError: 'Kamera tidak ditemukan di perangkat ini.',
    NotReadableError: 'Kamera sedang dipakai aplikasi lain (Zoom, WhatsApp, aplikasi Kamera, atau tab lain). Tutup aplikasi itu lalu tekan Coba Lagi.',
    OverconstrainedError: 'Kamera yang dipilih tidak tersedia. Pilih kamera lain di Menu Petugas → Pengaturan Pemindai.',
    DECODER: 'Mesin pembaca QR gagal dimuat. Periksa koneksi internet lalu tekan Coba Lagi.',
    ENDED: 'Kamera terputus. Menyambungkan ulang…',
    LAIN: 'Kamera tidak dapat dibuka.'
  };
  const ALIAS = {
    PermissionDeniedError: 'NotAllowedError', SecurityError: 'NotAllowedError', DevicesNotFoundError: 'NotFoundError',
    TrackStartError: 'NotReadableError', AbortError: 'NotReadableError', ConstraintNotSatisfiedError: 'OverconstrainedError'
  };
  function galat(kode, asli) {
    const e = new Error(PESAN[kode] && kode !== 'LAIN' ? PESAN[kode] : PESAN.LAIN + (asli && asli.message ? ' (' + asli.message + ')' : ''));
    e.kode = kode; return e;
  }
  function normalGalat(e) {
    if (e && e.kode) return e;
    const n = (e && e.name) || '';
    const k = ALIAS[n] || n;
    return galat(PESAN[k] ? k : 'LAIN', e);
  }

  // ------------------------------------------------------------------ mesin baca (dipakai bersama)
  let mesinP = null, paksaJs = false;
  function mesin() {
    if (!mesinP) mesinP = buatMesin().catch(e => { mesinP = null; throw e; });
    return mesinP;
  }
  async function buatMesin() {
    if (!paksaJs) { const n = await mesinNative(); if (n) return n; }
    try { return await mesinWorker(); } catch (e) { /* lanjut ke thread utama */ }
    let f;
    try { f = await EV.ui.LIB.jsqr(); } catch (e) { throw galat('DECODER'); }
    const fn = (f && f.default) || f;
    if (typeof fn !== 'function') throw galat('DECODER');
    return {
      jenis: 'js', label: 'jsQR', butuhGambar: true,
      baca: async img => { const r = fn(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' }); return r ? r.data : null; }
    };
  }
  async function mesinNative() {
    if (!('BarcodeDetector' in window)) return null;
    try {
      const f = await window.BarcodeDetector.getSupportedFormats();
      if (!f || f.indexOf('qr_code') < 0) return null;
      const det = new window.BarcodeDetector({ formats: ['qr_code'] });
      return {
        jenis: 'native', label: 'Bawaan perangkat', butuhGambar: false,
        baca: async src => { const r = await det.detect(src); return r && r.length ? r[0].rawValue : null; }
      };
    } catch (e) { return null; }
  }
  function mesinWorker() {
    return new Promise((res, rej) => {
      const kode = "var f=null;self.onmessage=function(e){var d=e.data;" +
        "if(d.t==='init'){for(var i=0;i<d.urls.length&&!f;i++){try{importScripts(d.urls[i]);f=self.jsQR&&(self.jsQR.default||self.jsQR);if(typeof f!=='function')f=null;}catch(x){}}self.postMessage({t:'init',ok:!!f});return;}" +
        "var v=null;if(f){try{var r=f(new Uint8ClampedArray(d.buf),d.w,d.h,{inversionAttempts:'dontInvert'});v=r?r.data:null;}catch(x){}}" +
        "self.postMessage({t:'r',id:d.id,v:v});};";
      let w, url;
      try { url = URL.createObjectURL(new Blob([kode], { type: 'text/javascript' })); w = new Worker(url); } catch (e) { return rej(e); }
      const antre = new Map();
      let id = 0, siap = false;
      const m = {
        jenis: 'worker', label: 'jsQR (latar belakang)', butuhGambar: true, rusak: false,
        baca: img => new Promise(ok => {
          if (m.rusak) return ok(null);
          const i = ++id;
          const t = setTimeout(() => { antre.delete(i); ok(null); }, 2000);
          antre.set(i, v => { clearTimeout(t); ok(v); });
          w.postMessage({ t: 'r', id: i, buf: img.data.buffer, w: img.width, h: img.height }, [img.data.buffer]);
        })
      };
      const batas = setTimeout(() => { if (!siap) { w.terminate(); rej(new Error('worker lambat')); } }, 20000);
      w.onmessage = e => {
        const d = e.data;
        if (d.t === 'init') {
          clearTimeout(batas); siap = d.ok;
          URL.revokeObjectURL(url);
          if (!d.ok) { w.terminate(); return rej(new Error('jsQR gagal dimuat di worker')); }
          return res(m);
        }
        const f = antre.get(d.id); if (f) { antre.delete(d.id); f(d.v); }
      };
      w.onerror = ev => {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (!siap) { clearTimeout(batas); w.terminate(); return rej(new Error('worker galat')); }
        m.rusak = true; mesinP = null; w.terminate();
      };
      w.postMessage({ t: 'init', urls: EV.ui.LIB.URL_JSQR.map(u => new URL(u, location.href).href) });
    });
  }

  // ------------------------------------------------------------------ satu pemindai = satu kamera
  function buat(opsi) {
    opsi = Object.assign({ kameraId: '', hadap: 'user', cermin: 'auto' }, opsi || {});
    const S = { stream: null, track: null, aktif: false, jalan: false, timer: 0, putaran: 0, mulaiP: null, mesin: null, hadapAktif: '', kameraAktif: '', cermin: true, msBaca: 0, galatBaca: 0 };

    const root = document.createElement('div');
    root.className = 'pemindai';
    const video = document.createElement('video');
    video.setAttribute('playsinline', ''); video.setAttribute('muted', ''); video.setAttribute('autoplay', '');
    video.muted = true; video.playsInline = true; video.disablePictureInPicture = true;
    root.appendChild(video);
    const kanvas = document.createElement('canvas');
    const ctx = kanvas.getContext('2d', { willReadFrequently: true });

    const lapor = (st, x) => { try { if (opsi.onStatus) opsi.onStatus(st, x); } catch (e) { /* abaikan */ } };
    const hidup = () => !!(S.track && S.track.readyState === 'live');

    function pasang(slot) {
      if (!slot) return;
      slot.insertBefore(root, slot.firstChild);
      if (S.stream && video.paused) video.play().catch(() => {});
    }

    function terapkanCermin() {
      S.cermin = opsi.cermin === 'auto' ? S.hadapAktif !== 'environment' : !!opsi.cermin;
      root.classList.toggle('cermin', S.cermin);
    }
    function pasangStream(stream) {
      lepasStream();
      S.stream = stream;
      S.track = stream.getVideoTracks()[0];
      video.srcObject = stream;
      const set = (S.track && S.track.getSettings && S.track.getSettings()) || {};
      S.hadapAktif = set.facingMode || '';
      S.kameraAktif = set.deviceId || '';
      terapkanCermin();
      const trk = S.track;
      trk.addEventListener('ended', () => { if (S.track === trk) { hentikanLoop(); lapor('putus', galat('ENDED')); } });
      try {
        const cap = trk.getCapabilities ? trk.getCapabilities() : {};
        if (cap.focusMode && cap.focusMode.indexOf('continuous') >= 0) trk.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
      } catch (e) { /* tidak didukung */ }
    }
    function lepasStream() {
      hentikanLoop();
      if (S.stream) S.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { /* abaikan */ } });
      S.stream = null; S.track = null;
      try { video.srcObject = null; } catch (e) { /* abaikan */ }
    }

    async function bukaKamera() {
      if (!window.isSecureContext) throw galat('INSECURE');
      const md = navigator.mediaDevices;
      if (!md || !md.getUserMedia) throw galat('UNSUPPORTED');
      const dasar = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
      const v = opsi.kameraId ? Object.assign({ deviceId: { exact: opsi.kameraId } }, dasar) : Object.assign({ facingMode: opsi.hadap || 'user' }, dasar);
      try { return await md.getUserMedia({ audio: false, video: v }); }
      catch (e) {
        const n = e && e.name;
        if (n === 'OverconstrainedError' || n === 'ConstraintNotSatisfiedError' || (opsi.kameraId && n === 'NotFoundError')) {
          opsi.kameraId = '';
          return md.getUserMedia({ audio: false, video: true }); // cadangan: kamera apa pun yang ada
        }
        throw e;
      }
    }

    function mulai() {
      if (S.mulaiP) return S.mulaiP;
      S.mulaiP = (async () => {
        lapor('memulai');
        const pMesin = S.mesin && !S.mesin.rusak ? Promise.resolve(S.mesin) : mesin();
        pMesin.catch(() => {});
        if (!hidup()) pasangStream(await bukaKamera());
        if (video.paused) await Promise.race([video.play().catch(() => {}), new Promise(r => setTimeout(r, 3000))]);
        S.mesin = await pMesin;
        lapor('siap', info());
        if (S.aktif) jalankan();
        return info();
      })().catch(e => { const g = normalGalat(e); lapor('galat', g); throw g; })
        .finally(() => { S.mulaiP = null; });
      return S.mulaiP;
    }

    // ---------------------------------------------------------------- putaran baca
    function aktif(v) { S.aktif = !!v; if (S.aktif) jalankan(); else hentikanLoop(); }
    function jalankan() { if (S.jalan || !S.aktif || !S.mesin || !hidup()) return; S.jalan = true; jadwal(0); }
    function hentikanLoop() { S.jalan = false; clearTimeout(S.timer); }
    function jadwal(ms) { clearTimeout(S.timer); S.timer = setTimeout(putar, ms); }

    function ambilGambar() {
      const vw = video.videoWidth, vh = video.videoHeight;
      S.putaran++;
      let sx = 0, sy = 0, sw = vw, sh = vh, maks = 800;
      if (S.putaran % 2) { // bergantian: potongan tengah resolusi penuh (kartu dekat) …
        const s = Math.min(vw, vh) * 0.82;
        sx = (vw - s) / 2; sy = (vh - s) / 2; sw = sh = s; maks = 600;
      } // … dan seluruh bingkai diperkecil (kartu agak jauh / di pinggir)
      const sk = Math.min(1, maks / Math.max(sw, sh));
      const w = Math.max(1, Math.round(sw * sk)), h = Math.max(1, Math.round(sh * sk));
      if (kanvas.width !== w || kanvas.height !== h) { kanvas.width = w; kanvas.height = h; }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
      return ctx.getImageData(0, 0, w, h);
    }

    async function putar() {
      if (!S.jalan) return;
      if (document.hidden || video.readyState < 2 || !video.videoWidth) return jadwal(200);
      let teks = null;
      const t0 = performance.now();
      try {
        if (S.mesin.rusak) { S.mesin = await mesin(); }
        teks = S.mesin.butuhGambar ? await S.mesin.baca(ambilGambar()) : await S.mesin.baca(video);
        S.galatBaca = 0;
      } catch (e) {
        // BarcodeDetector bawaan kadang tersedia tapi layanannya tidak jalan → pindah ke jsQR
        if (++S.galatBaca >= 8 && S.mesin && S.mesin.jenis === 'native') {
          paksaJs = true; mesinP = null; S.galatBaca = 0;
          try { S.mesin = await mesin(); } catch (x) { hentikanLoop(); lapor('galat', normalGalat(x)); return; }
        }
      }
      S.msBaca = S.msBaca ? S.msBaca * 0.8 + (performance.now() - t0) * 0.2 : performance.now() - t0;
      if (!S.jalan) return;
      if (teks) { try { if (opsi.onKode) opsi.onKode(String(teks)); } catch (e) { /* abaikan */ } }
      jadwal(S.mesin && S.mesin.jenis === 'native' ? 35 : 10);
    }

    // ---------------------------------------------------------------- pengaturan
    async function daftarKamera() {
      try {
        const d = await navigator.mediaDevices.enumerateDevices();
        return d.filter(x => x.kind === 'videoinput').map((x, i) => ({ id: x.deviceId, label: x.label || ('Kamera ' + (i + 1)) }));
      } catch (e) { return []; }
    }
    function atur(baru) {
      const gantiKamera = ('kameraId' in baru && baru.kameraId !== opsi.kameraId) || ('hadap' in baru && baru.hadap !== opsi.hadap);
      Object.assign(opsi, baru);
      terapkanCermin();
      if (gantiKamera) { lepasStream(); return mulai(); }
      return Promise.resolve(info());
    }
    function berhenti() {
      S.aktif = false; lepasStream();
      document.removeEventListener('visibilitychange', onVis);
    }
    function info() {
      return {
        hidup: hidup(), mesin: S.mesin ? S.mesin.jenis : '', mesinLabel: S.mesin ? S.mesin.label : '',
        label: S.track ? S.track.label : '', hadap: S.hadapAktif, kameraId: S.kameraAktif, cermin: S.cermin,
        msBaca: Math.round(S.msBaca), lebar: video.videoWidth, tinggi: video.videoHeight
      };
    }
    // kembali dari tab lain / layar HP menyala lagi → sambungkan ulang bila kamera mati
    const onVis = () => { if (!document.hidden && S.aktif && !hidup()) mulai().catch(() => {}); };
    document.addEventListener('visibilitychange', onVis);

    return { el: root, video, pasang, mulai, aktif, berhenti, daftarKamera, atur, info, hidup, siap: () => hidup() && !!S.mesin && !S.mesin.rusak };
  }

  EV.Pemindai = { buat, siapkan: () => mesin().catch(() => null), PESAN };
})();
