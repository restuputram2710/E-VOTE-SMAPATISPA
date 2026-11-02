/* ============================================================================
   E-VOTE SMAPATISPA — Mode Bilik Suara (kiosk)
   Pindai kartu → pilih calon tiap pemilihan → konfirmasi → kirim → selesai
   Tidak pernah menampilkan hasil. Keluar/input manual memerlukan PIN petugas.
   ============================================================================ */
(function () {
  'use strict';
  const EV = window.EV;
  const { esc, ic, $, $$, fmt, toast, modal, foto, ring, bunyi } = EV.ui;

  const S = {};
  const KENDALA = {
    KARTU_TIDAK_DIKENAL: ['bad', 'xBulat', 'Kartu Tidak Dikenal', 'Kode pada kartu tidak terdaftar. Pastikan Anda memakai kartu suara resmi dari panitia.'],
    KARTU_SUDAH_DIGUNAKAN: ['bad', 'larang', 'Kartu Sudah Digunakan', 'Kartu ini sudah dipakai untuk memilih. Setiap kartu hanya berlaku satu kali.'],
    KARTU_TIDAK_AKTIF: ['bad', 'gembok', 'Kartu Tidak Aktif', ''],
    PEMUNGUTAN_BELUM_DIBUKA: ['info', 'jamPasir', 'Pemungutan Belum Dibuka', 'Silakan tunggu aba-aba dari panitia.'],
    PEMUNGUTAN_DIJEDA: ['warn', 'pause', 'Pemungutan Sedang Dijeda', 'Bilik sementara tidak menerima kartu. Tunggu hingga panitia melanjutkan.'],
    PEMUNGUTAN_DITUTUP: ['info', 'gembok', 'Pemungutan Sudah Ditutup', 'Terima kasih. Pemungutan suara telah selesai.'],
    NETWORK: ['warn', 'wifiOff', 'Gangguan Koneksi', 'Tidak dapat terhubung ke server. Suara Anda belum terkirim — kartu masih bisa dipakai.'],
    WAKTU_HABIS: ['info', 'timer', 'Waktu Habis', 'Sesi dibatalkan karena tidak ada aktivitas. Kartu Anda masih bisa digunakan.'],
    SESI_BERAKHIR: ['info', 'timer', 'Sesi Berakhir', 'Silakan pindai ulang kartu Anda. Suara belum terkirim.'],
    BILIK_DIJEDA: ['warn', 'peringatan', 'Bilik Dijeda Sementara', 'Terlalu banyak kartu tidak dikenal. Hubungi petugas.'],
    PILIHAN_TIDAK_VALID: ['warn', 'peringatan', 'Pilihan Perlu Diulang', 'Daftar calon diperbarui. Silakan pindai ulang kartu dan pilih kembali.']
  };

  function render() {
    const dev = EV.Sesi.perangkat();
    Object.assign(S, { dev, ballot: dev.ballot || null, status: null, bip: true, idle: 60, layar: 'siaga', pemilih: null, sesi: null, langkah: 0, pilihan: {}, buffer: '', bufAt: 0, idleAt: 0, sibuk: false, conn: 'ok', scan: null, abaikan: {}, kodeAktif: '', kamStatus: '', kamGalat: null, tIzin: 0 });
    const cfg = EV.state.cfg;
    document.body.className = '';
    $('#app').innerHTML = `
      <div class="booth" id="booth">
        <div class="bg-blobs"></div>
        <header class="booth-top">${EV.app.logoHtml('brand-logo blob')}<div class="brand-text"><b>${esc(cfg.nama_aplikasi)}</b><span>${esc(cfg.judul_acara)}</span></div>
          <span class="spacer"></span><span id="b-status"></span></header>
        <main class="booth-body" id="bb" aria-live="polite"></main>
        <footer class="booth-foot">${ic('vote')}<b>${esc(dev.nama)}</b><span class="conn ok" id="b-conn"><span class="dot"></span>Terhubung</span><span class="cam-chip hidden" id="b-cam"></span><span class="hide-sm">${ic('perisai', 'ic-sm')} Pilihan Anda rahasia — tidak ada yang bisa melihatnya.</span>
          <button class="lock-btn" id="b-kunci" aria-label="Menu petugas (PIN)">${ic('gembok')}</button></footer>
      </div>`;
    $('#b-kunci').addEventListener('click', menuPetugas);
    const onKey = e => tombol(e);
    const onAkt = () => { S.idleAt = Date.now(); };
    const layarPenuh = () => { if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); };
    document.addEventListener('keydown', onKey);
    ['pointerdown', 'touchstart', 'keydown'].forEach(ev => document.addEventListener(ev, onAkt, { passive: true }));
    document.addEventListener('pointerdown', layarPenuh, { once: true });
    const blokMenu = e => e.preventDefault();
    document.addEventListener('contextmenu', blokMenu);
    EV.app.onCleanup(() => {
      document.removeEventListener('keydown', onKey);
      ['pointerdown', 'touchstart', 'keydown'].forEach(ev => document.removeEventListener(ev, onAkt));
      document.removeEventListener('contextmenu', blokMenu);
      if (S.scan) { S.scan.berhenti(); S.scan = null; }
      clearTimeout(S.tIzin);
    });
    EV.app.setiap(cekStatus, 20000);
    EV.app.setiap(tikIdle, 250);
    cekStatus(true);
    siaga();
  }

  // ------------------------------------------------------------------ status & koneksi
  async function cekStatus(awal) {
    const r = await EV.api('device.status', {}, { retry: 0 });
    if (!r.success) { if (r.code === 'NETWORK') setConn('bad'); return; }
    setConn('ok');
    S.status = r.data.status; S.bip = r.data.bip; S.idle = r.data.idle || 60;
    $('#b-status').innerHTML = S.status.simulasi ? `<span class="pill pill-warn pill-lg">${ic('tabung')}Mode Simulasi</span>` : EV.ui.pillStatus(S.status.status, true);
    if ((awal === true || (S.ballot && S.ballot.versi !== r.data.ballotVer)) && S.layar === 'siaga') muatBallot();
    if (S.layar === 'siaga') perbaruiInfoSiaga();
  }
  async function muatBallot() {
    const r = await EV.api('ballot', {}, { retry: 1 });
    if (r.success) { S.ballot = r.data.ballot; const dev = EV.Sesi.perangkat(); if (dev) { dev.ballot = S.ballot; EV.Sesi.setPerangkat(dev); } }
  }
  function setConn(k) {
    S.conn = k;
    const el = $('#b-conn'); if (!el) return;
    el.className = 'conn ' + k;
    el.innerHTML = '<span class="dot"></span>' + (k === 'ok' ? 'Terhubung' : k === 'warn' ? 'Menghubungkan…' : 'Terputus');
  }

  // ------------------------------------------------------------------ input pemindai
  // Scanner USB/Bluetooth bekerja seperti keyboard — tetap aktif sebagai cadangan meski memakai kamera.
  function tombol(e) {
    if (document.querySelector('.modal-root')) return;
    if (S.layar !== 'siaga' || S.sibuk) return;
    if (e.key === 'Enter') {
      const kode = S.buffer; S.buffer = '';
      if (kode.replace(/[^A-Za-z0-9]/g, '').length >= 6) validasi(kode, true);
      return;
    }
    if (e.key.length === 1 && /[A-Za-z0-9-]/.test(e.key)) {
      if (Date.now() - S.bufAt > 1500) S.buffer = '';
      S.buffer += e.key; S.bufAt = Date.now();
    }
  }
  const normKode = t => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  // jeda per kartu: kartu yang masih dipegang di depan kamera tidak terbaca berulang kali
  function abaikan(kode, ms) { if (kode) S.abaikan[kode] = Math.max(S.abaikan[kode] || 0, Date.now() + ms); }
  function bolehBaca(kode) { const t = S.abaikan[kode]; return !t || Date.now() > t; }

  // ------------------------------------------------------------------ kamera
  const pakaiKamera = () => (S.dev.pemindai || 'kamera') === 'kamera';
  function pemindai() {
    if (!S.scan) {
      S.scan = EV.Pemindai.buat({
        kameraId: S.dev.kameraId || '', hadap: S.dev.kameraHadap || 'user', cermin: S.dev.cermin === undefined ? 'auto' : S.dev.cermin,
        onKode: kodeDariKamera, onStatus: statusKamera
      });
    }
    return S.scan;
  }
  function kodeDariKamera(teks) {
    if (S.layar !== 'siaga' || S.sibuk || document.querySelector('.modal-root')) return;
    const kode = normKode(teks);
    if (kode.length !== 8) return;          // bukan QR kartu suara → abaikan diam-diam (tidak dihitung kartu salah)
    if (!bolehBaca(kode)) return;
    const box = $('#cam-slot');
    if (box) { box.classList.remove('hit'); void box.offsetWidth; box.classList.add('hit'); }
    validasi(kode);
  }
  function nyalakanKamera() {
    const sc = pemindai();
    sc.pasang($('#cam-slot'));
    sc.aktif(true);
    if (sc.siap()) return statusKamera('siap', sc.info());
    clearTimeout(S.tIzin);
    S.tIzin = setTimeout(() => { if (S.kamStatus === 'memulai' && S.layar === 'siaga') tampilKamera('izin'); }, 4500);
    sc.mulai().catch(() => { /* ditampilkan lewat statusKamera */ });
  }
  function statusKamera(st, x) {
    S.kamStatus = st;
    if (st === 'galat') S.kamGalat = x;
    const chip = $('#b-cam');
    if (chip) {
      chip.classList.remove('hidden');
      chip.className = 'cam-chip ' + (st === 'siap' ? 'ok' : st === 'galat' ? 'bad' : 'warn');
      chip.innerHTML = ic('kamera', 'ic-sm') + (st === 'siap' ? 'Kamera siap' : st === 'galat' ? 'Kamera mati' : 'Membuka kamera…');
    }
    if (st === 'putus') setTimeout(() => { if (S.layar === 'siaga' && S.scan && !S.scan.hidup()) nyalakanKamera(); }, 2000);
    if (S.layar === 'siaga') tampilKamera(st, x);
  }
  function tampilKamera(st, x) {
    const el = $('#cam-msg'), box = $('#cam-slot');
    if (!el || !box) return;
    box.classList.toggle('siap', st === 'siap');
    if (st === 'siap') { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    if (st === 'memulai' || st === 'izin' || st === 'putus') {
      el.innerHTML = `<span class="spin"></span><b>${st === 'putus' ? 'Menyambungkan ulang kamera…' : 'Membuka kamera…'}</b>${st === 'izin' ? '<small>Jika muncul pertanyaan izin kamera, pilih <b>Izinkan</b>.</small>' : ''}`;
    } else {
      el.innerHTML = `<span class="cm-ic">${ic('kamera', 'ic-lg')}</span><b>Kamera belum bisa dibuka</b><small>${esc(x && x.message ? x.message : '')}</small>
        <button class="btn" id="cam-ulang">${ic('segarkan')}Coba Lagi</button>`;
      $('#cam-ulang', el).addEventListener('click', e => { e.stopPropagation(); nyalakanKamera(); });
    }
  }

  // ------------------------------------------------------------------ layar: siaga
  function infoSiaga() {
    const st = S.status ? S.status.status : null;
    return st && st !== 'Dibuka' && !(S.status && S.status.simulasi)
      ? `<div class="alert alert-warn siaga-alert">${ic('info')}<div>Status pemungutan: <b>${esc(st)}</b>. Kartu belum bisa dipakai sampai pemungutan dibuka.</div></div>` : '';
  }
  function perbaruiInfoSiaga() { const el = $('#siaga-info'); if (el) el.innerHTML = infoSiaga(); }
  function siaga() {
    S.layar = 'siaga'; S.pemilih = null; S.sesi = null; S.pilihan = {}; S.langkah = 0; S.sibuk = false; S.kodeAktif = '';
    const kamera = pakaiKamera();
    $('#bb').innerHTML = `<div class="idle ${kamera ? 'idle-kamera' : ''}">
      <div class="idle-in">
        ${kamera ? `<div class="cam-box" id="cam-slot"><div class="cam-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="scan-beam" aria-hidden="true"></div><div class="cam-msg" id="cam-msg" hidden></div></div>`
          : `<div class="scan-ilus"><div class="scan-card"><div class="sc-head"></div><div class="sc-l1"></div><div class="sc-l2"></div><div class="sc-qr"></div></div><div class="scan-corners"></div><div class="scan-beam"></div></div>`}
        <h1>Pindai Kartu Suara Anda</h1>
        <p>${kamera ? 'Hadapkan <b>QR code</b> pada kartu ke kamera, tepat di dalam kotak' : 'Arahkan barcode pada kartu ke alat pemindai'}</p>
        <div id="siaga-info">${infoSiaga()}</div>
        ${kamera ? '' : `<div class="hint-down">${ic('bawahPanah', 'ic-xl')}</div>`}
        <div id="cek-kartu" class="cek-kartu"></div>
      </div></div>`;
    if (kamera) nyalakanKamera();
    else if (S.scan) { S.scan.berhenti(); S.scan = null; }
  }

  async function validasi(kode, manual) {
    if (S.sibuk) return;
    kode = normKode(kode);
    if (!manual && !bolehBaca(kode)) return;
    S.sibuk = true; S.kodeAktif = kode;
    abaikan(kode, 4000);
    if (S.scan) S.scan.aktif(false);       // berhenti membaca selama kartu diperiksa & pemilih memilih
    const el = $('#cek-kartu');
    if (el) el.innerHTML = `<span class="pill pill-info pill-lg"><span class="spin" style="width:16px;height:16px;border:2.5px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .7s linear infinite"></span>Memeriksa kartu…</span>`;
    const r = await EV.api('bilik.validate', { kode }, { retry: 1 });
    S.sibuk = false;
    if (!r.success) {
      if (r.code === 'NETWORK') setConn('bad');
      if (S.bip) bunyi('gagal');
      abaikan(kode, r.code === 'NETWORK' ? 3000 : 14000);
      return kendala(r.code, r.message);
    }
    setConn('ok');
    if (S.bip) bunyi('ok');
    if (!S.ballot || !S.ballot.pemilihan || !S.ballot.pemilihan.length) await muatBallot();
    if (!S.ballot || !S.ballot.pemilihan.length) return kendala('PILIHAN_TIDAK_VALID', 'Belum ada calon yang disetujui.');
    S.pemilih = r.data; S.sesi = r.data.sesi; S.langkah = 0; S.pilihan = {};
    suratSuara();
  }

  // ------------------------------------------------------------------ layar: surat suara
  function kepalaSurat() {
    const langkah = S.ballot.pemilihan.map(p => p.nama).concat(['Konfirmasi']);
    const i = S.layar === 'konfirmasi' ? langkah.length - 1 : S.langkah;
    return `<div class="ballot-head">
      <div class="hello"><h2>Halo, ${esc(S.pemilih.nama)}</h2><p>${esc(S.pemilih.kelas)}${S.pemilih.simulasi ? ' · <span class="pill pill-warn">Kartu Uji</span>' : ''}</p></div>
      <div class="stepper">${langkah.map((s, j) => `${j ? `<div class="step-line ${j <= i ? 'done' : ''}"></div>` : ''}<div class="step ${j < i ? 'done' : j === i ? 'now' : ''}"><span class="s-dot">${j < i ? ic('cek', 'ic-sm') : j + 1}</span><span class="lbl">${esc(s)}</span></div>`).join('')}</div>
      <div class="idle-ring" id="idle-ring" title="Sisa waktu"></div></div>`;
  }
  function suratSuara() {
    S.layar = 'surat'; S.idleAt = Date.now();
    const p = S.ballot.pemilihan[S.langkah], dipilih = S.pilihan[p.id];
    $('#bb').innerHTML = `${kepalaSurat()}
      <div class="ballot-title"><h1>Pilih ${esc(p.nama)}</h1><p>Ketuk satu calon, lalu tekan <b>Lanjut</b>.</p></div>
      <div class="bgrid ${dipilih ? 'has-sel' : ''}" role="radiogroup" aria-label="Calon ${esc(p.nama)}">
        ${p.calon.map(c => `<article class="bcard ${dipilih === c.id ? 'sel' : ''}" data-id="${esc(c.id)}" role="radio" aria-checked="${dipilih === c.id}" tabindex="0">
          <span class="no-urut">${String(c.nomor).padStart(2, '0')}</span>
          ${dipilih === c.id ? `<span class="stamp">${ic('cek')}<span>DIPILIH</span></span>` : ''}
          ${foto(c.foto, 168, c.nama)}
          <div class="bc-name">${esc(c.nama)}</div><div class="bc-kelas">${esc(c.kelas)}</div>
          <button class="btn btn-outline btn-visi" data-visi="${esc(c.id)}">${ic('buku', 'ic-sm')}Visi & Misi</button>
          <button class="btn btn-pilih" data-pilih="${esc(c.id)}">${dipilih === c.id ? ic('cekBulat') + 'DIPILIH' : 'PILIH'}</button></article>`).join('')}
      </div>
      <div class="booth-actions">
        ${S.langkah === 0 ? `<button class="btn btn-ghost btn-lg" id="b-batal">${ic('x')}Batalkan</button>` : `<button class="btn btn-outline btn-xl" id="b-kembali">${ic('panahKiri')}Kembali</button>`}
        <button class="btn btn-xl" id="b-lanjut" ${dipilih ? '' : 'disabled'}>${S.langkah === S.ballot.pemilihan.length - 1 ? 'Lanjut ke Konfirmasi' : 'Lanjut'}${ic('panahKanan')}</button>
      </div>`;
    $$('.bcard', $('#bb')).forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('[data-visi]')) return;
        pilih(p, card.dataset.id);
      });
      card.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pilih(p, card.dataset.id); } });
    });
    $$('[data-visi]', $('#bb')).forEach(b => b.addEventListener('click', e => { e.stopPropagation(); visiMisi(p, p.calon.find(c => c.id === b.dataset.visi)); }));
    $('#b-lanjut').addEventListener('click', () => { if (!S.pilihan[p.id]) return; if (S.langkah < S.ballot.pemilihan.length - 1) { S.langkah++; suratSuara(); } else konfirmasi(); });
    const kb = $('#b-kembali'); if (kb) kb.addEventListener('click', () => { S.langkah--; suratSuara(); });
    const bt = $('#b-batal'); if (bt) bt.addEventListener('click', batalkan);
    tikIdle();
  }
  function pilih(p, id) { S.pilihan[p.id] = id; if (S.bip) bunyi('ok'); suratSuara(); }
  function visiMisi(p, c) {
    const m = modal({
      title: '', size: 'lg', body: `<div class="row" style="gap:22px;align-items:center;flex-wrap:wrap;margin-bottom:18px">${foto(c.foto, 130, c.nama)}
        <div><span class="no-urut" style="height:34px;font-size:16px">${String(c.nomor).padStart(2, '0')}</span><h2 style="margin-top:10px;font-size:28px">${esc(c.nama)}</h2><p class="muted" style="font-size:17px">${esc(c.kelas)} · Calon ${esc(p.nama)}</p></div></div>
        <div class="form-section"><h3>${ic('bintang')}Visi</h3><p style="font-size:18px;line-height:1.6;white-space:pre-line">${esc(c.visi)}</p></div>
        <div class="form-section"><h3>${ic('buku')}Misi</h3><ol style="margin:0;padding-left:22px;display:grid;gap:8px;font-size:17px;line-height:1.55">${String(c.misi || '').split(/\n+/).filter(Boolean).map(x => `<li>${esc(x.replace(/^\s*(\d+[.)]|[-•*])\s*/, ''))}</li>`).join('')}</ol></div>`,
      foot: `<button class="btn btn-ghost btn-lg" data-close>Tutup</button><button class="btn btn-lg" id="vm-pilih">${ic('cek')}Pilih Calon Ini</button>`
    });
    $('.modal-head', m.el) && $('.modal-head', m.el).remove();
    $('#vm-pilih', m.el).addEventListener('click', () => { m.close(); pilih(p, c.id); });
  }
  async function batalkan() {
    const ok = await EV.ui.konfirmasi({ title: 'Batalkan pemilihan?', message: 'Suara belum dikirim. Kartu Anda tetap bisa dipakai untuk memilih nanti.', ok: 'Ya, Batalkan', batal: 'Lanjut Memilih', icon: false });
    if (ok) { abaikan(S.kodeAktif, 6000); siaga(); }
  }

  // ------------------------------------------------------------------ layar: konfirmasi
  function konfirmasi() {
    S.layar = 'konfirmasi'; S.idleAt = Date.now();
    const daftar = S.ballot.pemilihan.map(p => ({ p, c: p.calon.find(x => x.id === S.pilihan[p.id]) }));
    $('#bb').innerHTML = `${kepalaSurat()}
      <div class="ballot-title"><h1>Periksa Pilihan Anda</h1><p>Pastikan pilihan sudah benar sebelum dikirim.</p></div>
      <div class="confirm-grid">${daftar.map((x, i) => `<div class="confirm-card">${foto(x.c.foto, 104, x.c.nama)}<div style="min-width:0;flex:1"><div class="cf-lbl">${esc(x.p.nama)}</div>
        <div class="cf-name">${esc(x.c.nama)}</div><div class="row" style="gap:8px"><span class="no-urut">${String(x.c.nomor).padStart(2, '0')}</span><span class="muted">${esc(x.c.kelas)}</span></div></div>
        <button class="btn btn-ghost" data-ubah="${i}">${ic('edit')}Ubah</button></div>`).join('')}</div>
      <div class="alert" style="max-width:720px;margin:24px auto 0;font-size:16px">${ic('info')}<div>Suara <b>tidak dapat diubah</b> setelah dikirim. Pilihan Anda dirahasiakan.</div></div>
      <button class="btn btn-ok btn-kirim" id="b-kirim">${ic('vote', 'ic-lg')}KIRIM SUARA SAYA</button>`;
    $$('[data-ubah]', $('#bb')).forEach(b => b.addEventListener('click', () => { S.langkah = Number(b.dataset.ubah); suratSuara(); }));
    $('#b-kirim').addEventListener('click', kirim);
    tikIdle();
  }
  async function kirim() {
    if (S.sibuk) return;
    S.sibuk = true; S.layar = 'mengirim';
    const btn = $('#b-kirim');
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Mengirim suara…';
    $$('[data-ubah]').forEach(b => { b.disabled = true; });
    const idem = EV.ui.uuid();
    const r = await EV.api('bilik.submit', { sesi: S.sesi, pilihan: S.pilihan, idem }, { retry: 3 });
    S.sibuk = false;
    if (!r.success) { if (r.code === 'NETWORK') setConn('bad'); if (S.bip) bunyi('gagal'); return kendala(r.code, r.message); }
    setConn('ok');
    selesai();
  }

  // ------------------------------------------------------------------ layar: selesai & kendala
  function selesai() {
    abaikan(S.kodeAktif, 25000);            // kartu yang baru dipakai tidak memicu "Sudah Digunakan" bila masih di depan kamera
    S.layar = 'selesai'; S.pemilih = null; S.sesi = null; S.pilihan = {};
    if (S.bip) bunyi('sukses');
    $('#bb').innerHTML = `<div class="layar-selesai"><div>
      <div class="box-ilus"><div class="paper">${ic('cek')}</div><div class="box"><div class="slot"></div>${ic('vote', 'ic-xl')}</div><div class="check-big">${ic('cek')}</div></div>
      <h1>Terima Kasih!</h1><p>Suara Anda telah tercatat dan dirahasiakan.</p>
      <div class="countdown">Kembali ke awal dalam <b id="cd">5</b> detik</div></div></div>`;
    EV.ui.konfeti(2200);
    hitungMundur(5, siaga);
  }
  function kendala(kode, pesan) {
    S.layar = 'kendala'; S.pemilih = null; S.sesi = null; S.pilihan = {};
    const k = KENDALA[kode] || ['warn', 'peringatan', 'Terjadi Kendala', ''];
    $('#bb').innerHTML = `<div class="trouble ${k[0] === 'bad' ? '' : k[0]}"><div>
      <div class="t-ic">${ic(k[1])}</div><h1>${k[2]}</h1><p>${esc(k[3] || pesan || 'Silakan hubungi petugas.')}</p>
      <div class="t-foot">Silakan hubungi petugas bila perlu bantuan · Kembali otomatis dalam <b id="cd">6</b> detik</div>
      <button class="btn btn-outline btn-lg" id="t-ok" style="margin-top:18px">${ic('panahKiri')}Kembali Sekarang</button></div></div>`;
    $('#t-ok').addEventListener('click', siaga);
    hitungMundur(6, siaga);
  }
  function hitungMundur(n, lalu) {
    const layar = S.layar;
    const t = setInterval(() => {
      n--;
      const el = $('#cd'); if (el) el.textContent = n;
      if (n <= 0 || S.layar !== layar) { clearInterval(t); if (S.layar === layar) lalu(); }
    }, 1000);
    EV.app.onCleanup(() => clearInterval(t));
  }

  // ------------------------------------------------------------------ batas waktu diam
  function tikIdle() {
    if (S.layar !== 'surat' && S.layar !== 'konfirmasi') return;
    if (document.querySelector('.modal-root')) S.idleAt = Math.max(S.idleAt, Date.now() - 1000);
    const total = (S.idle || 60) * 1000, sisa = Math.max(0, total - (Date.now() - S.idleAt));
    const el = $('#idle-ring');
    if (el) {
      const d = Math.ceil(sisa / 1000);
      el.innerHTML = ring(sisa / total * 100, 72, 7, `<b style="font-size:18px;${d <= 15 ? 'color:var(--warn)' : ''}">${d}</b><span>detik</span>`);
      const val = el.querySelector('.r-val'); if (val) { val.style.transition = 'none'; if (d <= 15) val.style.stroke = 'var(--warn)'; }
    }
    if (sisa <= 0) { document.querySelectorAll('.modal-root').forEach(m => m.remove()); kendala('WAKTU_HABIS'); }
  }

  // ------------------------------------------------------------------ PIN petugas (dipakai juga oleh monitor)
  function pinModal(judul, onBenar) {
    let pin = '';
    const m = modal({
      title: judul || 'Masukkan PIN Petugas', sub: 'Hanya untuk panitia.', size: '',
      body: `<div class="pin-dots" id="pd">${'<i></i>'.repeat(6)}</div><div class="pinpad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-n="${n}">${n}</button>`).join('')}<button data-n="hapus" aria-label="Hapus">${ic('backspace')}</button><button data-n="0">0</button><button data-n="batal" aria-label="Batal">${ic('x')}</button></div><div id="pin-msg" class="center small" style="margin-top:12px;min-height:20px"></div>`
    });
    const gambar = () => $$('#pd i', m.el).forEach((d, i) => d.classList.toggle('on', i < pin.length));
    const tekan = async n => {
      if (n === 'batal') return m.close();
      if (n === 'hapus') { pin = pin.slice(0, -1); return gambar(); }
      if (pin.length >= 6) return;
      pin += n; gambar();
      if (pin.length === 6) {
        $('#pin-msg', m.el).innerHTML = '<span class="muted">Memeriksa…</span>';
        const r = await EV.api('device.pin', { pin, tujuan: 'akses' }, { retry: 1 });
        if (r.success) { m.close(); onBenar(pin); }
        else { $('#pin-msg', m.el).innerHTML = `<span style="color:var(--bad);font-weight:600">${esc(r.message)}</span>`; const pd = $('#pd', m.el); pd.classList.add('shake'); setTimeout(() => pd.classList.remove('shake'), 400); pin = ''; gambar(); }
      }
    };
    $$('[data-n]', m.el).forEach(b => b.addEventListener('click', () => tekan(b.dataset.n)));
    const ketik = e => { if (/^\d$/.test(e.key)) tekan(e.key); else if (e.key === 'Backspace') tekan('hapus'); };
    document.addEventListener('keydown', ketik);
    const tutupAsli = m.close; m.close = v => { document.removeEventListener('keydown', ketik); tutupAsli(v); };
    return m;
  }
  function keluarPerangkat(pin, mode) {
    EV.api('device.pin', { pin, tujuan: 'keluar' }, { retry: 0 });
    EV.Sesi.clearPerangkat();
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* abaikan */ }
    toast(mode === 'monitor' ? 'Mode monitor diakhiri.' : 'Mode bilik diakhiri. Masuk sebagai admin untuk memulai ulang.', 'info');
    EV.app.pergi('login');
  }
  function menuPetugas() {
    pinModal('Menu Petugas', pin => {
      const m = modal({
        title: 'Menu Petugas', sub: S.dev.nama,
        body: `<div class="stack" style="gap:12px">
          <button class="btn btn-outline btn-lg btn-block" id="mp-manual">${ic('keyboard')}Input Kode Manual</button>
          <button class="btn btn-outline btn-lg btn-block" id="mp-scan">${ic('kamera')}Pengaturan Pemindai</button>
          <button class="btn btn-outline btn-lg btn-block" id="mp-muat">${ic('segarkan')}Muat Ulang Data Calon</button>
          <button class="btn btn-danger-soft btn-lg btn-block" id="mp-keluar">${ic('keluar')}Keluar Mode Bilik</button></div>`,
        foot: `<button class="btn btn-ghost" data-close>Tutup</button>`
      });
      $('#mp-manual', m.el).addEventListener('click', () => {
        m.close();
        const k = modal({
          title: 'Input Kode Manual', sub: 'Ketik 8 karakter kode yang tercetak di bawah nama pada kartu.',
          body: `<input class="input mono" id="km" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" style="height:64px;font-size:28px;text-align:center;letter-spacing:.2em;text-transform:uppercase" placeholder="K7QX M3PA" aria-label="Kode kartu">`,
          foot: `<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-lg" id="km-ok">${ic('panahKanan')}Proses</button>`
        });
        const proses = () => { const v = $('#km', k.el).value.replace(/[^A-Za-z0-9]/g, ''); if (v.length !== 8) return toast('Kode kartu harus 8 karakter.', 'warn'); k.close(); if (S.layar !== 'siaga') siaga(); validasi(v, true); };
        $('#km-ok', k.el).addEventListener('click', proses);
        $('#km', k.el).addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') proses(); });
      });
      $('#mp-scan', m.el).addEventListener('click', () => { m.close(); pengaturanPemindai(); });
      $('#mp-muat', m.el).addEventListener('click', async e => { await EV.ui.sibuk(e.currentTarget, muatBallot); toast('Data calon dimuat ulang.', 'ok'); m.close(); });
      $('#mp-keluar', m.el).addEventListener('click', () => { m.close(); keluarPerangkat(pin, 'bilik'); });
    });
  }

  // ------------------------------------------------------------------ pengaturan pemindai (petugas)
  async function pengaturanPemindai() {
    let mode = pakaiKamera() ? 'kamera' : 'usb';
    let cermin = S.dev.cermin === undefined ? 'auto' : S.dev.cermin;
    const sc = mode === 'kamera' ? pemindai() : null;
    const kam = sc ? await sc.daftarKamera() : [];
    const inf = sc ? sc.info() : null;
    const pilihNow = S.dev.kameraId ? 'id:' + S.dev.kameraId : 'hadap:' + (S.dev.kameraHadap || 'user');
    const m = modal({
      title: 'Pengaturan Pemindai', sub: S.dev.nama, size: 'lg',
      body: `<div class="stack" style="gap:16px">
        <div class="field"><span class="label">Cara memindai kartu</span><div class="seg seg-penuh" id="ps-mode">
          <button data-v="kamera">${ic('kamera')}Kamera</button><button data-v="usb">${ic('scan')}Scanner USB</button></div></div>
        <div id="ps-kam" class="stack" style="gap:16px">
          <div class="field"><label for="ps-pilih">Kamera</label><select class="input" id="ps-pilih">
            <option value="hadap:user">Kamera depan (otomatis)</option>
            <option value="hadap:environment">Kamera belakang (otomatis)</option>
            ${kam.map(k => `<option value="id:${esc(k.id)}">${esc(k.label)}</option>`).join('')}
          </select><span class="help">Laptop: pakai webcam bawaan. HP/tablet di dudukan: pakai kamera depan.</span></div>
          <div class="field"><span class="label">Tampilan video</span><div class="seg seg-penuh" id="ps-cermin">
            <button data-v="auto">Otomatis</button><button data-v="ya">Cermin</button><button data-v="tidak">Normal</button></div>
            <span class="help">Cermin memudahkan pemilih mengarahkan kartu. Tidak memengaruhi pembacaan QR.</span></div>
          ${inf ? `<div class="alert info-pemindai">${ic('info')}<div>Mesin baca: <b>${esc(inf.mesinLabel || '—')}</b>${inf.msBaca ? ` · ±${inf.msBaca} ms per bacaan` : ''}${inf.lebar ? ` · ${inf.lebar}×${inf.tinggi}` : ''}<br><span class="small muted">${esc(inf.label || 'Kamera belum aktif')}</span></div></div>` : ''}
        </div></div>`,
      foot: `<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-lg" id="ps-simpan">${ic('cek')}Simpan</button>`
    });
    const pilih = $('#ps-pilih', m.el);
    if ([...pilih.options].some(o => o.value === pilihNow)) pilih.value = pilihNow;
    const gambar = () => {
      $$('#ps-mode [data-v]', m.el).forEach(b => b.classList.toggle('on', b.dataset.v === mode));
      $$('#ps-cermin [data-v]', m.el).forEach(b => b.classList.toggle('on', b.dataset.v === (cermin === 'auto' ? 'auto' : cermin ? 'ya' : 'tidak')));
      $('#ps-kam', m.el).hidden = mode !== 'kamera';
    };
    $$('#ps-mode [data-v]', m.el).forEach(b => b.addEventListener('click', () => { mode = b.dataset.v; gambar(); }));
    $$('#ps-cermin [data-v]', m.el).forEach(b => b.addEventListener('click', () => { cermin = b.dataset.v === 'auto' ? 'auto' : b.dataset.v === 'ya'; gambar(); }));
    gambar();
    $('#ps-simpan', m.el).addEventListener('click', () => {
      const v = pilih.value, dev = EV.Sesi.perangkat() || S.dev;
      dev.pemindai = mode; dev.cermin = cermin;
      dev.kameraId = v.indexOf('id:') === 0 ? v.slice(3) : '';
      dev.kameraHadap = v.indexOf('hadap:') === 0 ? v.slice(6) : 'user';
      EV.Sesi.setPerangkat(dev); S.dev = dev;
      m.close();
      if (mode === 'kamera' && S.scan) S.scan.atur({ kameraId: dev.kameraId, hadap: dev.kameraHadap, cermin }).catch(() => {});
      if (mode !== 'kamera') { const chip = $('#b-cam'); if (chip) chip.className = 'cam-chip hidden'; }
      toast('Pengaturan pemindai disimpan.', 'ok');
      if (S.layar === 'siaga') siaga();
    });
  }

  EV.bilik = { render, pinModal, keluarPerangkat };
})();
