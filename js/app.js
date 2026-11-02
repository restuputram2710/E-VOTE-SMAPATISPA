/* ============================================================================
   E-VOTE SMAPATISPA — Aplikasi inti: tema, router, login, ganti sandi, shell
   ============================================================================ */
(function () {
  'use strict';
  const EV = window.EV;
  const { esc, ic, $, $$, fmt, toast, modal, sibuk } = EV.ui;
  const VERSI = '1.0.0';

  const state = EV.state = { cfg: null, status: null, pending: 0, ballot: null };
  const pembersih = [];
  function bersihkan() { while (pembersih.length) { try { pembersih.pop()(); } catch (e) { /* abaikan */ } } }
  function onCleanup(fn) { pembersih.push(fn); }
  function setiap(fn, ms) { const t = setInterval(fn, ms); onCleanup(() => clearInterval(t)); return t; }

  // ------------------------------------------------------------------ tema & identitas
  const BAWAAN = { nama_aplikasi: 'E-VOTE SMAPATISPA', nama_sekolah: 'SMAPATISPA', judul_acara: 'Pemilihan Ketua OSIS & MPK 2026/2027', warna_utama: '#1E1B5E', warna_aksen: '#6366E8', logo: '' };
  function terapkanTema(cfg) {
    cfg = Object.assign({}, BAWAAN, cfg || {});
    state.cfg = cfg;
    const r = document.documentElement.style;
    if (/^#[0-9a-f]{6}$/i.test(cfg.warna_utama)) r.setProperty('--c-primary', cfg.warna_utama);
    if (/^#[0-9a-f]{6}$/i.test(cfg.warna_aksen)) r.setProperty('--c-accent', cfg.warna_aksen);
    document.title = cfg.nama_aplikasi;
    const fav = document.querySelector('link[rel=icon]') || Object.assign(document.createElement('link'), { rel: 'icon' });
    fav.href = cfg.logo || 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="${cfg.warna_aksen}"/><path d="M18 34l9 9 19-21" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
    document.head.appendChild(fav);
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = cfg.warna_utama;
    return cfg;
  }
  function logoHtml(cls, cfg) {
    cfg = cfg || state.cfg || BAWAAN;
    return `<div class="${cls || 'brand-logo blob'}">${cfg.logo ? `<img src="${cfg.logo}" alt="Logo ${esc(cfg.nama_aplikasi)}">` : ic('vote')}</div>`;
  }
  async function muatKonfigurasi() {
    const cache = EV.simpan.get(EV.KUNCI.cfg);
    if (cache) terapkanTema(cache); else terapkanTema(null);
    const r = await EV.publicConfig();
    if (r && r.success) { EV.simpan.set(EV.KUNCI.cfg, r.data); terapkanTema(r.data); return true; }
    return false;
  }
  function temaGelap(on) {
    if (on === undefined) on = EV.simpan.get(EV.KUNCI.tema) === 'gelap';
    document.documentElement.dataset.theme = on ? 'dark' : '';
    if (!on) document.documentElement.removeAttribute('data-theme');
    EV.simpan.set(EV.KUNCI.tema, on ? 'gelap' : 'terang');
  }

  // ------------------------------------------------------------------ router
  const ROUTE_ADMIN = {
    dasbor: ['Dasbor', 'dasbor'], pemilihan: ['Pemilihan & Jadwal', 'kalender'], calon: ['Calon', 'userCek'], akun: ['Akun', 'pengguna'],
    pemilih: ['Pemilih & Kartu Suara', 'kartu'], cetak: ['Cetak Kartu', 'cetak'], hasil: ['Hasil & Rekap', 'grafik'],
    pengaturan: ['Pengaturan', 'pengaturan'], log: ['Log Aktivitas', 'log']
  };
  const ROUTE_PENCALON = { beranda: ['Beranda', 'rumah'], data: ['Data Pencalonan', 'file'], sandi: ['Ganti Sandi', 'kunci'] };

  function pergi(h) { if (location.hash !== '#/' + h) location.hash = '#/' + h; else route(); }
  function beranda(s) { return s.me.peran === 'admin' ? 'admin/dasbor' : 'pencalon/beranda'; }

  function route() {
    bersihkan();
    document.querySelectorAll('.modal-root').forEach(m => m.remove());
    const h = location.hash.replace(/^#\/?/, '');
    const dev = EV.Sesi.perangkat();
    if (dev) {
      document.querySelectorAll('.toasts').forEach(t => t.remove());
      if (dev.mode === 'bilik') { if (h !== 'bilik') return pergi('bilik'); return EV.bilik.render(); }
      if (dev.mode === 'monitor') { if (h !== 'monitor') return pergi('monitor'); return EV.monitor.render(); }
    }
    const s = EV.Sesi.get();
    if (!s) { if (h !== 'login') return pergi('login'); return halamanLogin(); }
    if (s.me.wajibGantiSandi) { if (h !== 'ganti-sandi') return pergi('ganti-sandi'); return halamanGantiSandi(true); }
    if (h === 'login' || h === 'ganti-sandi' || !h) return pergi(beranda(s));
    const [area, hal] = h.split('/');
    if (area === 'admin' && s.me.peran === 'admin') {
      const key = ROUTE_ADMIN[hal] ? hal : 'dasbor';
      return shellAdmin(key);
    }
    if (area === 'pencalon' && s.me.peran === 'pencalon') {
      const key = ROUTE_PENCALON[hal] ? hal : 'beranda';
      return shellPencalon(key);
    }
    return pergi(beranda(s));
  }

  function sesiHilang(pesan) {
    if (EV.Sesi.perangkat()) {
      EV.Sesi.clearPerangkat();
      toast(pesan || 'Sesi perangkat berakhir. Masuk kembali sebagai admin untuk memulai ulang.', 'warn');
    } else if (EV.Sesi.get()) {
      EV.Sesi.clear();
      toast(pesan || 'Sesi berakhir. Silakan masuk kembali.', 'warn');
    }
    pergi('login');
  }

  async function keluar() {
    const ok = await EV.ui.konfirmasi({ title: 'Keluar dari aplikasi?', message: 'Anda perlu masuk kembali untuk membuka dasbor.', ok: 'Keluar', icon: false });
    if (!ok) return;
    EV.api('logout', {}, { noAuthRedirect: true });
    EV.Sesi.clear();
    pergi('login');
  }

  // ------------------------------------------------------------------ ilustrasi
  function ilustrasiKotak() {
    return `<svg viewBox="0 0 440 330" role="img" aria-label="Ilustrasi kotak suara dan kartu suara barcode">
      <ellipse cx="220" cy="304" rx="170" ry="16" fill="rgba(0,0,0,.18)"/>
      <rect x="92" y="150" width="256" height="150" rx="22" fill="rgba(255,255,255,.95)"/>
      <rect x="92" y="150" width="256" height="40" rx="22" fill="rgba(255,255,255,.75)"/>
      <rect x="160" y="160" width="120" height="12" rx="6" fill="#0B0930" opacity=".85"/>
      <rect x="120" y="214" width="200" height="60" rx="14" style="fill:var(--c-tint)"/>
      <path d="M196 244l14 14 30-30" fill="none" style="stroke:var(--c-accent)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <g transform="translate(176 40) rotate(-8)"><rect width="92" height="118" rx="10" fill="#fff"/><rect x="12" y="16" width="52" height="8" rx="4" fill="#E4E6F7"/><rect x="12" y="32" width="68" height="8" rx="4" fill="#E4E6F7"/>
        <circle cx="46" cy="76" r="20" fill="none" style="stroke:var(--c-accent)" stroke-width="6"/><path d="M36 76l7 7 14-14" fill="none" style="stroke:var(--c-accent)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>
      <g transform="translate(300 74) rotate(10)"><rect width="122" height="78" rx="12" fill="#fff"/><rect width="122" height="20" rx="10" style="fill:var(--c-primary)"/><rect y="10" width="122" height="10" style="fill:var(--c-primary)"/>
        <rect x="10" y="32" width="48" height="7" rx="3.5" fill="#E4E6F7"/><rect x="10" y="46" width="34" height="7" rx="3.5" fill="#E4E6F7"/>
        <g fill="#14193A"><rect x="74" y="30" width="38" height="38" rx="4" fill="#fff" stroke="#14193A" stroke-width="2"/><rect x="79" y="35" width="10" height="10"/><rect x="97" y="35" width="10" height="10"/><rect x="79" y="53" width="10" height="10"/><rect x="95" y="51" width="5" height="5"/><rect x="102" y="58" width="5" height="5"/></g></g>
      <g fill="#FCD34D"><path d="M58 92l5 12 12 5-12 5-5 12-5-12-12-5 12-5z"/><path d="M372 222l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" opacity=".8"/></g>
      <circle cx="78" cy="214" r="6" fill="rgba(255,255,255,.5)"/><circle cx="388" cy="186" r="4" fill="rgba(255,255,255,.5)"/>
    </svg>`;
  }

  // ------------------------------------------------------------------ LOGIN
  function halamanLogin() {
    const cfg = state.cfg;
    document.body.className = '';
    $('#app').innerHTML = `
      <div class="auth">
        <section class="auth-art">
          <div class="row" style="position:relative;z-index:1">${logoHtml('brand-logo blob')}<div><b style="font-family:var(--f-head);font-size:16px">${esc(cfg.nama_sekolah)}</b><div class="small" style="opacity:.8">Sistem Pemilihan Digital</div></div></div>
          <div class="auth-ilus">${ilustrasiKotak()}</div>
          <div style="position:relative;z-index:1"><h1>${esc(cfg.nama_aplikasi)}</h1><p class="lead">${esc(cfg.judul_acara)}</p></div>
          <div class="auth-feat"><span>${ic('perisai')}Pilihan rahasia</span><span>${ic('qr')}Kartu suara barcode</span><span>${ic('radio')}Hasil langsung di monitor</span></div>
        </section>
        <section class="auth-form"><div class="auth-card">
          <div class="card">
            <div class="row" style="margin-bottom:18px">${logoHtml('brand-logo blob')}<div class="brand-text"><b>${esc(cfg.nama_aplikasi)}</b><span>Panitia & pencalon</span></div></div>
            <h2>Masuk ke Akun Anda</h2>
            <p class="muted" style="margin:6px 0 22px">Gunakan username dan kata sandi dari panitia.</p>
            ${EV.URL_OK ? '' : `<div class="alert alert-warn" style="margin-bottom:16px">${ic('peringatan')}<div><b>Konfigurasi belum lengkap.</b> Isi alamat server (GAS_URL) di berkas <code>js/config.js</code>.</div></div>`}
            <form id="f-login" class="form-stack" novalidate>
              <div class="field"><label for="u">Username</label><div class="input-wrap has-lead">${ic('user', 'ic-lead')}<input class="input" id="u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></div></div>
              <div class="field"><label for="p">Kata Sandi</label><div class="input-wrap has-lead">${ic('gembok', 'ic-lead')}<input class="input" id="p" name="password" type="password" autocomplete="current-password" required>
                <button type="button" class="btn btn-ghost btn-icon btn-sm trail" id="lihat" aria-label="Tampilkan kata sandi">${ic('mata')}</button></div></div>
              <div id="login-err"></div>
              <button class="btn btn-lg btn-block" type="submit" data-loading="Memeriksa…">${ic('panahKanan')}Masuk</button>
            </form>
            <p class="small muted center" style="margin-top:18px">Lupa kata sandi? Hubungi panitia pemilihan.</p>
          </div>
          <p class="xs muted center" style="margin-top:16px">${esc(cfg.nama_sekolah)} • ${esc(cfg.nama_aplikasi)} v${VERSI}</p>
        </div></section>
      </div>`;
    EV.warm('pub');
    $('#lihat').addEventListener('click', () => {
      const p = $('#p'), on = p.type === 'password';
      p.type = on ? 'text' : 'password';
      $('#lihat').innerHTML = ic(on ? 'mataTutup' : 'mata');
      $('#lihat').setAttribute('aria-label', on ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
    });
    $('#f-login').addEventListener('submit', async e => {
      e.preventDefault();
      const u = $('#u').value.trim(), p = $('#p').value;
      const err = $('#login-err');
      if (!u || !p) { err.innerHTML = `<div class="alert alert-bad">${ic('alertBulat')}<div>Username dan kata sandi wajib diisi.</div></div>`; return; }
      await sibuk(e.submitter || $('#f-login button[type=submit]'), async () => {
        const r = await EV.api('login', { username: u, password: p }, { token: '', noAuthRedirect: true });
        if (!r.success) { err.innerHTML = `<div class="alert alert-bad">${ic('alertBulat')}<div>${esc(r.message)}</div></div>`; $('#p').select(); return; }
        EV.Sesi.set({ token: r.data.token, me: r.data.me });
        toast(r.message, 'ok');
        pergi(r.data.me.wajibGantiSandi ? 'ganti-sandi' : beranda({ me: r.data.me }));
      });
    });
    setTimeout(() => $('#u') && $('#u').focus(), 50);
  }

  // ------------------------------------------------------------------ GANTI SANDI
  function formSandiHtml(wajib) {
    return `<form id="f-sandi" class="form-stack" novalidate>
      ${wajib ? '' : `<div class="field"><label for="s-lama">Kata Sandi Saat Ini</label><input class="input" id="s-lama" type="password" autocomplete="current-password" required></div>`}
      ${wajib ? `<div class="field"><label for="s-lama">Kata Sandi Awal (dari panitia)</label><input class="input" id="s-lama" type="password" autocomplete="current-password" required></div>` : ''}
      <div class="field"><label for="s-baru">Kata Sandi Baru</label><input class="input" id="s-baru" type="password" autocomplete="new-password" required>
        <div class="bar-track" style="height:8px;margin-top:4px"><div class="bar-fill" id="kuat" style="width:0"></div></div><span class="help" id="kuat-teks">Minimal 8 karakter, berisi huruf dan angka.</span></div>
      <div class="field"><label for="s-ulang">Ulangi Kata Sandi Baru</label><input class="input" id="s-ulang" type="password" autocomplete="new-password" required></div>
      <div id="sandi-err"></div>
      <button class="btn btn-lg btn-block" type="submit" data-loading="Menyimpan…">${ic('cek')}${wajib ? 'Simpan & Lanjutkan' : 'Simpan Kata Sandi'}</button>
    </form>`;
  }
  function pasangFormSandi(root, setelah) {
    const baru = $('#s-baru', root);
    baru.addEventListener('input', () => {
      const v = baru.value;
      let skor = 0;
      if (v.length >= 8) skor++; if (v.length >= 12) skor++; if (/[A-Za-z]/.test(v) && /\d/.test(v)) skor++; if (/[^A-Za-z0-9]/.test(v)) skor++;
      const bar = $('#kuat', root);
      bar.style.width = (skor * 25) + '%';
      bar.style.background = skor <= 1 ? 'var(--bad)' : skor === 2 ? 'var(--warn)' : 'var(--ok)';
      $('#kuat-teks', root).textContent = ['Terlalu lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat'][skor];
    });
    $('#f-sandi', root).addEventListener('submit', async e => {
      e.preventDefault();
      const lama = $('#s-lama', root).value, b = baru.value, u = $('#s-ulang', root).value, err = $('#sandi-err', root);
      const tulis = m => { err.innerHTML = `<div class="alert alert-bad">${ic('alertBulat')}<div>${esc(m)}</div></div>`; };
      if (b.length < 8 || !/[A-Za-z]/.test(b) || !/\d/.test(b)) return tulis('Kata sandi baru minimal 8 karakter dan memuat huruf serta angka.');
      if (b !== u) return tulis('Ulangi kata sandi tidak sama.');
      await sibuk(e.submitter || $('#f-sandi button[type=submit]', root), async () => {
        const r = await EV.api('changePassword', { lama, baru: b });
        if (!r.success) return tulis(r.message);
        EV.Sesi.set({ token: r.data.token, me: r.data.me });
        toast(r.message, 'ok');
        setelah(r.data.me);
      });
    });
  }
  function halamanGantiSandi(wajib) {
    const cfg = state.cfg;
    $('#app').innerHTML = `<div class="bg-blobs"></div><div class="auth-form" style="min-height:100vh"><div class="auth-card">
      <div class="card">
        <div class="row" style="margin-bottom:18px">${logoHtml('brand-logo blob')}<div class="brand-text"><b>${esc(cfg.nama_aplikasi)}</b><span>${esc(EV.Sesi.get().me.nama)}</span></div></div>
        <h2>Buat Kata Sandi Baru</h2>
        <div class="alert" style="margin:12px 0 20px">${ic('perisai')}<div>Demi keamanan, ganti kata sandi awal dari panitia sebelum melanjutkan.</div></div>
        ${formSandiHtml(wajib)}
        <div class="center" style="margin-top:16px"><button class="link-btn" id="batal-sandi">${ic('keluar', 'ic-sm')}Keluar</button></div>
      </div></div></div>`;
    pasangFormSandi($('#app'), me => pergi(beranda({ me })));
    $('#batal-sandi').addEventListener('click', () => { EV.Sesi.clear(); pergi('login'); });
  }

  // ------------------------------------------------------------------ SHELL ADMIN
  function shellAdmin(key) {
    const s = EV.Sesi.get(), cfg = state.cfg;
    let shell = $('.shell[data-area=admin]');
    if (!shell) {
      $('#app').innerHTML = `<div class="shell" data-area="admin">
        <aside class="sidebar" aria-label="Menu utama">
          <a class="brand" href="#/admin/dasbor">${logoHtml('brand-logo blob')}<div class="brand-text"><b>${esc(cfg.nama_aplikasi)}</b><span>${esc(cfg.nama_sekolah)}</span></div></a>
          <div class="profile">${EV.ui.avatar(s.me.nama)}<div style="min-width:0"><div class="p-name">${esc(s.me.nama)}</div><div class="p-role">Admin • @${esc(s.me.username)}</div></div></div>
          <nav class="nav">
            ${Object.keys(ROUTE_ADMIN).map(k => `<a href="#/admin/${k}" data-k="${k}">${ic(ROUTE_ADMIN[k][1])}<span>${ROUTE_ADMIN[k][0]}</span>${k === 'calon' ? '<span class="badge-count hidden" id="nav-pending">0</span>' : ''}</a>`).join('')}
            <div class="nav-sep"></div>
            <div class="nav-label">Mode Perangkat</div>
            <a href="#" data-dev="bilik">${ic('vote')}<span>Mode Bilik Suara</span></a>
            <a href="#" data-dev="monitor">${ic('tv')}<span>Mode Monitor</span></a>
          </nav>
          <div class="sidebar-foot"><div class="nav"><a href="#" id="nav-keluar">${ic('keluar')}<span>Keluar</span></a></div></div>
        </aside>
        <div class="scrim"></div>
        <div class="main">
          <header class="topbar">
            <button class="btn btn-ghost btn-icon burger" id="burger" aria-label="Buka menu">${ic('menu')}</button>
            <h1 id="tb-title"></h1><span class="spacer"></span>
            <span id="tb-status"></span>
            <button class="btn btn-ghost btn-icon" id="tb-tema" aria-label="Ganti tema terang/gelap">${ic(document.documentElement.dataset.theme === 'dark' ? 'matahari' : 'bulan')}</button>
            ${EV.ui.avatar(s.me.nama)}
          </header>
          <main class="content" id="page" tabindex="-1"></main>
        </div></div>`;
      shell = $('.shell');
      $('#burger').addEventListener('click', () => shell.classList.add('nav-open'));
      $('.scrim').addEventListener('click', () => shell.classList.remove('nav-open'));
      $('#nav-keluar').addEventListener('click', e => { e.preventDefault(); keluar(); });
      $$('[data-dev]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); shell.classList.remove('nav-open'); modalPerangkat(a.dataset.dev); }));
      $('#tb-tema').addEventListener('click', () => {
        temaGelap(document.documentElement.dataset.theme !== 'dark');
        $('#tb-tema').innerHTML = ic(document.documentElement.dataset.theme === 'dark' ? 'matahari' : 'bulan');
      });
      EV.warm('admin');
    }
    shell.classList.remove('nav-open');
    $$('.nav a[data-k]').forEach(a => a.classList.toggle('on', a.dataset.k === key));
    $('#tb-title').textContent = ROUTE_ADMIN[key][0];
    tampilkanStatus(state.status);
    tampilkanPending(state.pending);
    const page = $('#page');
    page.innerHTML = `<div class="grid g-4">${'<div class="card"><div class="skel" style="height:84px"></div></div>'.repeat(4)}</div>`;
    window.scrollTo(0, 0);
    EV.admin[key](page);
  }
  function tampilkanStatus(st) {
    state.status = st || state.status;
    const el = $('#tb-status');
    if (el && state.status) el.innerHTML = EV.ui.pillStatus(state.status.status) + (state.status.simulasi ? ' <span class="pill pill-warn">' + ic('tabung') + 'Simulasi</span>' : '');
  }
  function tampilkanPending(n) {
    state.pending = n || 0;
    const el = $('#nav-pending');
    if (el) { el.textContent = state.pending; el.classList.toggle('hidden', !state.pending); }
  }

  // ------------------------------------------------------------------ MODE PERANGKAT
  function modalPerangkat(mode) {
    let pilih = mode || 'bilik', pemindai = 'usb';
    const m = modal({
      title: 'Aktifkan Mode Perangkat',
      sub: 'Ubah perangkat ini menjadi bilik suara atau layar monitor hasil.',
      size: 'lg',
      body: `<div class="seg" style="margin-bottom:18px"><button data-m="bilik">${ic('vote')}Bilik Suara</button><button data-m="monitor">${ic('tv')}Monitor</button></div>
        <div id="dev-isi"></div>`,
      foot: `<button class="btn btn-ghost" data-close>Batal</button><button class="btn btn-lg" id="dev-mulai" data-loading="Memuat data calon…"></button>`
    });
    const isi = () => {
      $$('.seg [data-m]', m.el).forEach(b => b.classList.toggle('on', b.dataset.m === pilih));
      $('#dev-mulai', m.el).innerHTML = ic('play') + (pilih === 'bilik' ? 'Mulai Mode Bilik' : 'Mulai Mode Monitor');
      $('#dev-isi', m.el).innerHTML = pilih === 'bilik' ? `
        <div class="form-grid">
          <div class="field"><label for="dev-nama">Nama Bilik</label><input class="input" id="dev-nama" value="Bilik 1" maxlength="30"><span class="help">Tampil di layar bilik dan log aktivitas.</span></div>
          <div class="field"><span class="label">Pemindai</span><div class="seg" id="dev-scan"><button data-s="usb" class="${pemindai === 'usb' ? 'on' : ''}">${ic('scan')}Scanner USB</button><button data-s="kamera" class="${pemindai === 'kamera' ? 'on' : ''}">${ic('kamera')}Kamera</button></div><span class="help">Scanner USB paling cepat dan stabil.</span></div>
        </div>
        <div class="alert" style="margin-top:18px">${ic('info')}<div>Data calon & foto dimuat sekarang agar surat suara tampil instan. <b>Sesi admin di perangkat ini akan ditutup</b>; keluar dari mode bilik memerlukan <b>PIN petugas</b>.</div></div>` : `
        <div class="field"><label for="dev-nama">Nama Monitor</label><input class="input" id="dev-nama" value="Monitor Aula" maxlength="30"></div>
        <div class="alert" style="margin-top:18px">${ic('info')}<div>Tampilan, tema, interval pembaruan, dan teks berjalan mengikuti menu <b>Pengaturan → Tampilan Monitor</b>. Sambungkan perangkat ke TV/proyektor lalu tekan F11 untuk layar penuh. Keluar memerlukan PIN petugas.</div></div>`;
      $$('#dev-scan [data-s]', m.el).forEach(b => b.addEventListener('click', () => { pemindai = b.dataset.s; isi(); }));
    };
    $$('.seg [data-m]', m.el).forEach(b => b.addEventListener('click', () => { pilih = b.dataset.m; isi(); }));
    isi();
    $('#dev-mulai', m.el).addEventListener('click', e => sibuk(e.currentTarget, async () => {
      const nama = $('#dev-nama', m.el).value.trim() || (pilih === 'bilik' ? 'Bilik 1' : 'Monitor');
      const r = await EV.api('device.start', { mode: pilih, nama });
      if (!EV.ui.hasil(r, false)) return;
      EV.Sesi.setPerangkat({ token: r.data.token, mode: r.data.mode, nama: r.data.nama, pemindai, ballot: r.data.ballot, live: r.data.live, cfg: state.cfg });
      EV.api('logout', {}, { noAuthRedirect: true });
      EV.Sesi.clear();
      m.close();
      try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); } catch (err) { /* layar penuh ditolak */ }
      pergi(r.data.mode);
    }));
  }

  // ------------------------------------------------------------------ SHELL PENCALON
  function shellPencalon(key) {
    const s = EV.Sesi.get(), cfg = state.cfg;
    let shell = $('[data-area=pencalon]');
    if (!shell) {
      $('#app').innerHTML = `<div data-area="pencalon"><div class="bg-blobs"></div>
        <header class="topnav">
          <a class="brand" href="#/pencalon/beranda">${logoHtml('brand-logo blob')}<div class="brand-text"><b>${esc(cfg.nama_aplikasi)}</b><span>Portal Pencalon</span></div></a>
          <nav class="tn-links">${Object.keys(ROUTE_PENCALON).map(k => `<a href="#/pencalon/${k}" data-k="${k}">${ic(ROUTE_PENCALON[k][1], 'ic-sm')}${ROUTE_PENCALON[k][0]}</a>`).join('')}</nav>
          <span class="spacer"></span>
          <button class="btn btn-ghost btn-icon" id="tn-tema" aria-label="Ganti tema">${ic(document.documentElement.dataset.theme === 'dark' ? 'matahari' : 'bulan')}</button>
          <div class="row hide-sm">${EV.ui.avatar(s.me.nama)}<div><div class="bold small">${esc(s.me.nama)}</div><div class="xs muted">@${esc(s.me.username)}</div></div></div>
          <button class="btn btn-ghost btn-icon" id="tn-keluar" aria-label="Keluar">${ic('keluar')}</button>
        </header>
        <main class="portal" id="page" tabindex="-1"></main>
        <nav class="bottom-tabs">${Object.keys(ROUTE_PENCALON).map(k => `<a href="#/pencalon/${k}" data-k="${k}">${ic(ROUTE_PENCALON[k][1])}<span>${ROUTE_PENCALON[k][0]}</span></a>`).join('')}</nav></div>`;
      shell = $('[data-area=pencalon]');
      $('#tn-keluar').addEventListener('click', keluar);
      $('#tn-tema').addEventListener('click', () => { temaGelap(document.documentElement.dataset.theme !== 'dark'); $('#tn-tema').innerHTML = ic(document.documentElement.dataset.theme === 'dark' ? 'matahari' : 'bulan'); });
    }
    $$('[data-k]', shell).forEach(a => a.classList.toggle('on', a.dataset.k === key));
    window.scrollTo(0, 0);
    const page = $('#page');
    page.innerHTML = '<div class="card"><div class="skel" style="height:140px"></div></div>';
    EV.pencalon[key](page);
  }

  // ------------------------------------------------------------------ BOOT
  async function boot() {
    temaGelap();
    const dev = EV.Sesi.perangkat();
    if (dev && dev.cfg) terapkanTema(dev.cfg);
    await muatKonfigurasi();
    window.addEventListener('hashchange', route);
    route();
  }

  EV.app = { pergi, route, sesiHilang, onCleanup, setiap, terapkanTema, logoHtml, tampilkanStatus, tampilkanPending, modalPerangkat,
    formSandiHtml, pasangFormSandi, keluar, temaGelap, VERSI, BAWAAN, ilustrasiKotak };
  document.addEventListener('DOMContentLoaded', boot);
})();
