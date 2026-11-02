/* ============================================================================
   E-VOTE SMAPATISPA — Mode Monitor (TV / proyektor 16:9)
   Hasil langsung • foto calon • angka berjalan • unggul sementara • layar pemenang
   ============================================================================ */
(function () {
  'use strict';
  const EV = window.EV;
  const { esc, ic, $, $$, fmt, foto, hitungNaik } = EV.ui;

  const M = {};

  function render() {
    const dev = EV.Sesi.perangkat();
    const awal = dev.live || null;
    Object.assign(M, {
      dev, foto: {}, live: awal ? awal.live : null, meta: awal ? awal.meta : null, status: awal ? awal.status : null, etag: '',
      terakhir: {}, masuk: null, rot: 0, rotAt: Date.now(), gagal: 0, update: Date.now(), kunciTata: '', menangDitampilkan: false, timer: null
    });
    petaFoto(dev.ballot);
    document.body.className = '';
    $('#app').innerHTML = `
      <div class="mon" id="mon" tabindex="-1">
        <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="gradRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A5A8F0"/><stop offset="1" stop-color="#FCD34D"/></linearGradient></defs></svg>
        <header class="mon-head">
          <div class="mon-logo">${EV.state.cfg.logo ? `<img src="${EV.state.cfg.logo}" alt="">` : ic('vote')}</div>
          <div class="mon-title"><b id="m-nama"></b><span id="m-judul"></span></div>
          <span class="mon-live" id="m-live"><span class="dot dot-pulse"></span><span>LIVE</span></span>
          <div class="mon-timer hidden" id="m-timer"><span id="m-timer-lbl">Sisa waktu</span><b id="m-timer-val">00:00:00</b></div>
          <div class="mon-clock"><b id="m-jam">--:--:--</b><span id="m-tgl"></span></div>
        </header>
        <section class="mon-stats" id="m-stats"></section>
        <main class="mon-body" id="mb"></main>
        <footer class="mon-ticker"><div class="mt-badge">${ic('radio')}<span id="m-sekolah"></span></div><div class="mt-track"><span class="mt-run" id="m-run"></span></div><span id="m-toast"></span></footer>
        <button class="btn btn-outline btn-sm mon-exit" id="m-exit" style="background:rgba(255,255,255,.9);color:#1E1B5E">${ic('gembok', 'ic-sm')}Menu Petugas</button>
      </div>`;
    $('#m-exit').addEventListener('click', menuPetugas);
    const onKey = e => { if (e.key === 'Escape' && !document.querySelector('.modal-root')) menuPetugas(); };
    document.addEventListener('keydown', onKey);
    let tPas = 0;
    const onUkur = () => { clearTimeout(tPas); tPas = setTimeout(pasPemenang, 150); };
    window.addEventListener('resize', onUkur);
    EV.app.onCleanup(() => { document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onUkur); clearTimeout(M.timer); clearTimeout(tPas); });
    EV.app.setiap(tikDetik, 1000);
    if (M.live) gambarSemua(true);
    tarik();
  }

  function petaFoto(ballot) {
    if (!ballot || !ballot.pemilihan) return;
    ballot.pemilihan.forEach(p => p.calon.forEach(c => { M.foto[c.id] = c.foto; }));
    M.ballotVer = ballot.versi;
  }

  // ------------------------------------------------------------------ polling
  async function tarik() {
    clearTimeout(M.timer);
    const r = await EV.api('live', { etag: M.etag }, { retry: 0 });
    if (r.success) {
      M.gagal = 0; M.update = Date.now();
      M.status = r.data.status;
      if (r.data.berubah) {
        const idCalon = r.data.live.pemilihan.flatMap(p => p.calon.map(c => c.id));
        if (idCalon.some(id => !(id in M.foto))) {
          const b = await EV.api('ballot', {}, { retry: 1 });
          if (b.success) { petaFoto(b.data.ballot); const dev = EV.Sesi.perangkat(); if (dev) { dev.ballot = b.data.ballot; EV.Sesi.setPerangkat(dev); } }
        }
        M.etag = r.data.etag; M.live = r.data.live; M.meta = r.data.meta;
        M.tayangPada = M.meta && M.meta.tayang ? Date.now() + M.meta.tayang.sisaMs : 0;
      }
      gambarSemua(false);
    } else if (r.code !== 'AUTH') {
      M.gagal++;
      tandaKoneksi();
    }
    const detik = M.meta ? M.meta.interval : 5;
    if (EV.Sesi.perangkat()) M.timer = setTimeout(tarik, Math.max(3, detik) * 1000);
  }

  function tandaKoneksi() {
    const mon = $('#mon'); if (!mon) return;
    const putus = M.gagal >= 2;
    mon.classList.toggle('faded', putus);
    let b = $('#m-conn');
    if (putus && !b) { b = document.createElement('div'); b.id = 'm-conn'; b.className = 'mon-conn'; b.innerHTML = '<span class="spin"></span>Menghubungkan ulang…'; mon.appendChild(b); }
    if (!putus && b) b.remove();
    pillLive();
  }

  // ------------------------------------------------------------------ gambar
  function gambarSemua(awal) {
    if (!M.live || !M.meta) return;
    const mon = $('#mon'); if (!mon) return;
    mon.classList.toggle('terang', M.meta.tema === 'terang');
    tandaKoneksi();
    $('#m-nama').textContent = M.meta.nama;
    $('#m-judul').textContent = M.meta.judul;
    $('#m-sekolah').textContent = (EV.state.cfg.nama_sekolah || 'E-VOTE').toUpperCase();
    const run = $('#m-run'), teks = (M.meta.teks || '').trim();
    const isiRun = teks ? (teks + '   •   ').repeat(3) : '';
    if (run.dataset.t !== isiRun) { run.dataset.t = isiRun; run.textContent = isiRun; run.style.setProperty('--dur', Math.max(20, isiRun.length / 5) + 's'); }
    let wm = $('.mon-wm', mon);
    if (M.live.simulasi && !wm) { wm = document.createElement('div'); wm.className = 'mon-wm'; wm.innerHTML = '<span>SIMULASI</span>'; mon.appendChild(wm); }
    if (!M.live.simulasi && wm) wm.remove();
    pillLive();
    statistik();
    const st = M.status ? M.status.status : 'Persiapan';
    mon.classList.toggle('mode-menang', st === 'Ditutup' && !M.meta.sembunyikan);
    if (st === 'Ditutup' && !M.meta.sembunyikan) return layarPemenang();
    M.menangDitampilkan = false;
    if (M.meta.sembunyikan) return layarTersembunyi();
    if (M.meta.tataLetak === 'bergantian' || M.live.pemilihan.length === 1) return layarBergantian(awal);
    return layarBerdampingan(awal);
  }

  function pillLive() {
    const el = $('#m-live'); if (!el || !M.status) return;
    const st = M.status.status, putus = M.gagal >= 2;
    el.className = 'mon-live' + (putus ? ' off' : st === 'Dibuka' ? '' : st === 'Ditutup' ? ' closed' : ' off');
    el.innerHTML = '<span class="dot ' + (st === 'Dibuka' && !putus ? 'dot-pulse' : '') + '"></span><span>' + (putus ? 'TERPUTUS' : st === 'Dibuka' ? 'LIVE' : st === 'Dijeda' ? 'DIJEDA' : st === 'Ditutup' ? 'HASIL AKHIR' : 'BELUM DIBUKA') + '</span>';
  }

  function statistik() {
    const L = M.live, box = $('#m-stats');
    if (!box.children.length) {
      box.innerHTML = `
        <div class="mstat"><div class="ms-ic">${ic('pengguna')}</div><div><div class="ms-lbl">Pemilih Terdaftar</div><div class="ms-val num" id="s-total">0</div></div></div>
        <div class="mstat"><div class="ms-ic">${ic('vote')}</div><div><div class="ms-lbl">Suara Masuk</div><div class="ms-val num"><span id="s-masuk">0</span><small id="s-belum"></small></div></div></div>
        <div class="mstat" id="s-ringbox"><div id="s-ring"></div><div><div class="ms-lbl">Partisipasi</div><div class="ms-val num" id="s-pct">0%</div></div></div>
        <div class="mstat"><div class="ms-ic">${ic('segarkan')}</div><div><div class="ms-lbl" id="s-upd-lbl">Pembaruan</div><div class="ms-val" style="font-size:calc(26 * var(--u))" id="s-upd">baru saja</div></div></div>`;
    }
    hitungNaik($('#s-total'), L.totalPemilih);
    const naik = M.masuk !== null && L.suaraMasuk > M.masuk ? L.suaraMasuk - M.masuk : 0;
    hitungNaik($('#s-masuk'), L.suaraMasuk);
    $('#s-belum').textContent = '/ ' + fmt.angka(L.totalPemilih);
    hitungNaik($('#s-pct'), L.partisipasi, 800, v => fmt.persen(v));
    const u = Math.min(window.innerWidth / 1920, window.innerHeight / 1080), sz = Math.round(70 * u);
    $('#s-ring').innerHTML = EV.ui.ring(L.partisipasi, sz, Math.max(4, Math.round(9 * u)), '');
    if (naik > 0) toastSuara(naik);
    M.masuk = L.suaraMasuk;
  }
  function toastSuara(n) {
    const box = $('#m-toast'); if (!box) return;
    box.innerHTML = `<span class="mt-toast">${ic('vote')}${n > 1 ? fmt.angka(n) + ' suara baru masuk' : 'Suara baru masuk'}</span>`;
  }

  function ukuranFoto(n) { return n <= 3 ? 104 : n === 4 ? 86 : n <= 6 ? 66 : 52; }
  function lencana(p, c) {
    const lead = p.unggul === c.id, plus = M.terakhir[c.id] !== undefined && c.suara > M.terakhir[c.id] ? c.suara - M.terakhir[c.id] : 0;
    return `${plus ? `<span class="mbadge plus">${ic('atasPanah')}+${plus} Baru Masuk</span>` : ''}${lead ? `<span class="mbadge gold">${ic('mahkota')}UNGGUL SEMENTARA</span>` : ''}`;
  }

  /** Tata letak berdampingan: OSIS kiri, MPK kanan. Struktur dibangun sekali, angka diperbarui di tempat. */
  function layarBerdampingan(awal) {
    const L = M.live, kunci = 'duo|' + L.pemilihan.map(p => p.id + ':' + p.calon.map(c => c.id).join(',')).join('|');
    const mb = $('#mb');
    if (M.kunciTata !== kunci) {
      M.kunciTata = kunci;
      mb.className = 'mon-body duo';
      mb.style.gridTemplateColumns = 'repeat(' + Math.min(L.pemilihan.length, 3) + ', minmax(0,1fr))';
      mb.innerHTML = L.pemilihan.map((p, i) => `<section class="mpanel" data-p="${esc(p.id)}">
        <div class="mp-head"><span class="mp-tag">PEMILIHAN ${String(i + 1).padStart(2, '0')}</span><h2>${esc(p.nama.toUpperCase())}</h2><div class="mp-total">Total masuk<b class="num" data-total>0</b></div></div>
        <div class="mp-list" style="--fs:${ukuranFoto(p.calon.length)}">${p.calon.map(c => `<div class="mrow" data-c="${esc(c.id)}">
          <div class="mr-badges"></div><span class="mr-no">${String(c.nomor).padStart(2, '0')}</span>${foto(M.foto[c.id], null, c.nama)}
          <div class="mr-mid"><div class="mr-name">${esc(c.nama)}<small>${esc(c.kelas)}</small></div><div class="mr-bar"><i></i></div></div>
          <div class="mr-val"><b class="num" data-v>0</b><span class="num" data-pct>0%</span></div></div>`).join('')}</div></section>`).join('') || kosong();
    }
    L.pemilihan.forEach(p => {
      const panel = $(`.mpanel[data-p="${CSS.escape(p.id)}"]`, mb); if (!panel) return;
      hitungNaik($('[data-total]', panel), p.total);
      const maks = Math.max(1, ...p.calon.map(c => c.suara || 0));
      p.calon.forEach(c => {
        const row = $(`.mrow[data-c="${CSS.escape(c.id)}"]`, panel); if (!row) return;
        const lead = p.unggul === c.id, naik = M.terakhir[c.id] !== undefined && c.suara > M.terakhir[c.id];
        row.classList.toggle('lead', lead);
        $('.mr-badges', row).innerHTML = lencana(p, c);
        hitungNaik($('[data-v]', row), c.suara);
        $('[data-pct]', row).textContent = fmt.persen(c.persen);
        $('.mr-bar i', row).style.width = (p.total ? (c.suara / maks) * 100 : 0) + '%';
        if (naik) { row.classList.remove('bump'); void row.offsetWidth; row.classList.add('bump'); }
      });
    });
    ingat();
  }

  /** Tata letak bergantian: satu pemilihan penuh layar, berganti tiap 15 detik. */
  function layarBergantian(awal) {
    const L = M.live, mb = $('#mb');
    if (!L.pemilihan.length) { mb.className = 'mon-body solo'; mb.innerHTML = kosong(); return; }
    if (M.rot >= L.pemilihan.length) M.rot = 0;
    const p = L.pemilihan[M.rot];
    const kunci = 'solo|' + M.rot + '|' + p.id + ':' + p.calon.map(c => c.id).join(',');
    if (M.kunciTata !== kunci) {
      M.kunciTata = kunci;
      mb.className = 'mon-body solo';
      mb.style.gridTemplateColumns = '';
      mb.innerHTML = `<section class="mpanel" data-p="${esc(p.id)}" style="animation:naik .5s ease">
        <div class="mp-head"><span class="mp-tag">PEMILIHAN ${String(M.rot + 1).padStart(2, '0')}</span><h2>${esc(p.nama.toUpperCase())}</h2><div class="mp-total">Total masuk<b class="num" data-total>0</b></div></div>
        <div class="vgrid">${p.calon.map(c => `<div class="vcard" data-c="${esc(c.id)}"><div class="mr-badges"></div><span class="vc-no">${String(c.nomor).padStart(2, '0')}</span>${foto(M.foto[c.id], null, c.nama)}
          <div class="vc-name">${esc(c.nama)}</div><div class="vc-kelas">${esc(c.kelas)}</div><div class="vc-val num" data-v>0</div><div class="vc-pct num" data-pct>0%</div><div class="vc-bar"><i></i></div></div>`).join('')}</div>
        ${L.pemilihan.length > 1 ? `<div class="rot-dots">${L.pemilihan.map((x, i) => `<i class="${i === M.rot ? 'on' : ''}"></i>`).join('')}<span id="rot-teks"></span></div>` : ''}</section>`;
    }
    const panel = $('.mpanel', mb);
    hitungNaik($('[data-total]', panel), p.total);
    const maks = Math.max(1, ...p.calon.map(c => c.suara || 0));
    p.calon.forEach(c => {
      const card = $(`.vcard[data-c="${CSS.escape(c.id)}"]`, panel); if (!card) return;
      card.classList.toggle('lead', p.unggul === c.id);
      $('.mr-badges', card).innerHTML = lencana(p, c);
      hitungNaik($('[data-v]', card), c.suara);
      $('[data-pct]', card).textContent = fmt.persen(c.persen);
      $('.vc-bar i', card).style.width = (p.total ? (c.suara / maks) * 100 : 0) + '%';
    });
    ingat();
  }

  function layarTersembunyi() {
    const L = M.live, mb = $('#mb');
    M.kunciTata = 'sembunyi';
    mb.className = 'mon-body duo';
    mb.style.gridTemplateColumns = 'repeat(' + Math.min(Math.max(1, L.pemilihan.length), 3) + ', minmax(0,1fr))';
    const u = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    mb.innerHTML = L.pemilihan.map(p => `<section class="mpanel"><div class="mp-head"><h2>${esc(p.nama.toUpperCase())}</h2></div>
      <div class="hide-grid" style="flex-direction:column;gap:calc(26 * var(--u))"><div class="hide-names">${p.calon.map(c => `<div class="hn">${foto(M.foto[c.id], null, c.nama)}<b>${String(c.nomor).padStart(2, '0')} · ${esc(c.nama)}</b><span>${esc(c.kelas)}</span></div>`).join('')}</div></div></section>`).join('');
    const tengah = document.createElement('div');
    tengah.style.cssText = 'position:absolute;left:50%;bottom:calc(30 * var(--u));transform:translateX(-50%);display:flex;align-items:center;gap:calc(20 * var(--u));padding:calc(14 * var(--u)) calc(30 * var(--u));border-radius:999px;background:var(--m-panel);border:1px solid var(--m-line);backdrop-filter:blur(16px);z-index:2';
    tengah.innerHTML = `${EV.ui.ring(L.partisipasi, Math.round(64 * u), Math.max(4, Math.round(8 * u)), '')}<div><div class="num" style="font-weight:800;font-size:calc(30 * var(--u))">${fmt.angka(L.suaraMasuk)} / ${fmt.angka(L.totalPemilih)} suara masuk</div><div style="font-size:calc(18 * var(--u));color:var(--m-muted)">Hasil akan diumumkan setelah pemungutan ditutup</div></div>`;
    mb.style.position = 'relative';
    mb.appendChild(tengah);
  }

  // kartu pemenang dikecilkan proporsional bila calonnya banyak / layar pendek, agar tidak tertutup teks berjalan
  function pasPemenang() {
    const g = document.querySelector('.win-grid');
    if (!g) return;
    const kartu = Array.from(g.children);
    kartu.forEach(k => { k.style.zoom = ''; });
    const tk = document.querySelector('.mon-ticker');
    const batas = tk ? tk.getBoundingClientRect().top : window.innerHeight;
    const perlu = Math.max(0, ...kartu.map(k => k.offsetHeight)), ada = batas - g.getBoundingClientRect().top - Math.round(window.innerHeight * 0.015);
    if (perlu > ada && ada > 0) { const r = Math.max(0.5, ada / perlu).toFixed(3); kartu.forEach(k => { k.style.zoom = r; }); }
  }

  function layarPemenang() {
    const L = M.live, mb = $('#mb');
    const kunci = 'menang|' + L.versi;
    if (M.kunciTata === kunci) return;
    M.kunciTata = kunci;
    mb.className = 'mon-body solo';
    mb.style.gridTemplateColumns = '';
    const kartu = (p, i) => {
      if (!p.total) return `<div class="wcard tie" style="animation-delay:${i * .15}s"><div class="wc-top"><span class="wc-role">${ic('award')}${esc(p.nama.toUpperCase())}</span></div><h2 style="margin:auto;color:var(--m-text);font-size:calc(34 * var(--u))">Belum ada suara</h2></div>`;
      if (p.seri) {
        const maks = Math.max(...p.calon.map(c => c.suara)), seri = p.calon.filter(c => c.suara === maks);
        return `<div class="wcard tie" style="animation-delay:${i * .15}s"><div class="wc-top"><span class="wc-role">${ic('award')}${esc(p.nama.toUpperCase())}</span></div>
          <div class="tie-photos">${seri.map(c => foto(M.foto[c.id], null, c.nama)).join('')}</div>
          <div class="wc-name">Hasil Seri</div><div class="wc-kelas">${seri.map(c => esc(c.nama)).join(' & ')} — masing-masing ${fmt.angka(maks)} suara</div>
          <div class="wc-stats" style="margin-top:calc(22 * var(--u))"><div><span>Status</span><b style="font-size:calc(28 * var(--u))">Menunggu keputusan panitia</b></div></div></div>`;
      }
      const w = p.calon.find(c => c.id === p.unggul);
      const lain = p.calon.filter(c => c.id !== w.id).sort((a, b) => b.suara - a.suara);
      return `<div class="wcard" style="animation-delay:${i * .15}s">
        <div class="wc-top"><span class="wc-role">${ic('award')}${esc(p.nama.toUpperCase())} TERPILIH</span><span class="wc-no">NOMOR URUT ${String(w.nomor).padStart(2, '0')}</span></div>
        <div class="wc-crown">${ic('mahkota')}</div>
        ${foto(M.foto[w.id], null, w.nama)}<span class="wc-rib">${ic('bintang', 'ic-sm')}TERPILIH${ic('bintang', 'ic-sm')}</span>
        <div class="wc-name">${esc(w.nama)}</div><div class="wc-kelas">${esc(w.kelas)}</div>
        <div class="wc-stats"><div><span>Perolehan Suara</span><b class="g num">${fmt.angka(w.suara)}</b></div><div><span>Persentase</span><b class="num">${fmt.persen(w.persen)}</b></div></div>
        <div class="wc-others">${lain.map(c => `<div><span>${String(c.nomor).padStart(2, '0')}. ${esc(c.nama)} <span style="color:var(--m-muted)">(${esc(c.kelas)})</span></span><b>${fmt.angka(c.suara)} suara (${fmt.persen(c.persen)})</b></div>`).join('')}</div></div>`;
    };
    const isi = () => {
      mb.innerHTML = `<div class="win"><span class="win-tag">${ic('pesta')}PENGUMUMAN HASIL PEMILIHAN</span>
        <h1>SELAMAT KEPADA <em>${L.pemilihan.length > 1 ? 'KETUA TERPILIH' : esc(L.pemilihan[0].nama.toUpperCase()) + ' TERPILIH'}</em>!</h1>
        <div class="win-sub">${esc(M.meta.judul)} · Partisipasi ${fmt.angka(L.suaraMasuk)} dari ${fmt.angka(L.totalPemilih)} pemilih (${fmt.persen(L.partisipasi)})</div>
        <div class="win-grid">${L.pemilihan.map(kartu).join('')}</div></div>`;
      requestAnimationFrame(pasPemenang);
      if (L.pemilihan.some(p => p.unggul)) EV.ui.konfeti(6000);
    };
    const kunciSesi = 'evs_menang_' + L.versi;
    let sudah = false;
    try { sudah = sessionStorage.getItem(kunciSesi) === '1'; sessionStorage.setItem(kunciSesi, '1'); } catch (e) { /* abaikan */ }
    if (sudah) return isi();
    const mon = $('#mon'), ov = document.createElement('div');
    ov.className = 'countdown-big'; mon.appendChild(ov);
    let n = 3;
    const langkah = () => {
      if (n === 0) { ov.remove(); isi(); return; }
      ov.innerHTML = `<b>${n}</b>`; n--;
      setTimeout(langkah, 1000);
    };
    mb.innerHTML = '';
    langkah();
  }

  function kosong() { return `<div class="mpanel" style="display:grid;place-items:center;text-align:center"><div><div style="color:var(--m-muted)">${ic('userCek', 'ic-xl')}</div><h2 style="color:var(--m-text);font-size:calc(36 * var(--u));margin-top:calc(14 * var(--u))">Belum ada calon yang disetujui</h2></div></div>`; }
  function ingat() { M.live.pemilihan.forEach(p => p.calon.forEach(c => { if (c.suara !== null) M.terakhir[c.id] = c.suara; })); }

  // ------------------------------------------------------------------ jam & hitung mundur
  function tikDetik() {
    const now = EV.sekarang();
    const jam = $('#m-jam'); if (!jam) return;
    jam.textContent = fmt.jamDetik(now);
    $('#m-tgl').textContent = new Date(now).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · WIB';
    const st = M.status, box = $('#m-timer');
    if (st && st.status === 'Dibuka' && st.selesai && st.selesai > now) { box.classList.remove('hidden'); $('#m-timer-lbl').textContent = 'Sisa waktu'; $('#m-timer-val').textContent = fmt.durasi(st.selesai - now); }
    else if (st && st.status === 'Persiapan' && st.mulai && st.otomatis && st.mulai > now) { box.classList.remove('hidden'); $('#m-timer-lbl').textContent = 'Dibuka dalam'; $('#m-timer-val').textContent = fmt.durasi(st.mulai - now); }
    else box.classList.add('hidden');
    const upd = $('#s-upd'), lbl = $('#s-upd-lbl'), tay = M.meta && M.meta.tayang;
    if (upd && tay && !(st && st.status === 'Ditutup')) {
      // hasil ditayangkan berkala (jeda kerahasiaan): tampilkan hitung mundur ke pembaruan berikutnya
      lbl.textContent = 'Hasil berikutnya';
      const sisa = M.tayangPada - Date.now();
      if (sisa > 0) { const d = Math.ceil(sisa / 1000); upd.innerHTML = String(Math.floor(d / 60)).padStart(2, '0') + ':' + String(d % 60).padStart(2, '0') + '<small>tiap ' + tay.menit + ' mnt</small>'; }
      else upd.textContent = sisa > -((M.meta.interval || 5) + 5) * 1000 ? 'memperbarui…' : 'menunggu suara baru';
    } else if (upd) {
      lbl.textContent = 'Pembaruan';
      const d = Math.round((Date.now() - M.update) / 1000); upd.textContent = d < 5 ? 'baru saja' : d + ' detik lalu';
    }
    if (M.live && M.meta && !M.meta.sembunyikan && (M.meta.tataLetak === 'bergantian') && M.live.pemilihan.length > 1 && !(st && st.status === 'Ditutup')) {
      const sisa = 15 - Math.floor((Date.now() - M.rotAt) / 1000);
      const t = $('#rot-teks'); if (t) t.textContent = 'Berganti ke ' + M.live.pemilihan[(M.rot + 1) % M.live.pemilihan.length].nama + ' dalam ' + Math.max(0, sisa) + ' dtk';
      if (sisa <= 0) { M.rot = (M.rot + 1) % M.live.pemilihan.length; M.rotAt = Date.now(); layarBergantian(); }
    }
  }

  function menuPetugas() {
    EV.bilik.pinModal('Menu Petugas Monitor', pin => {
      const m = EV.ui.modal({
        title: 'Menu Petugas', sub: M.dev.nama,
        body: `<div class="stack" style="gap:12px"><button class="btn btn-outline btn-lg btn-block" id="mm-segar">${ic('segarkan')}Muat Ulang Data</button>
          <button class="btn btn-outline btn-lg btn-block" id="mm-full">${ic('perbesar')}Layar Penuh</button>
          <button class="btn btn-danger-soft btn-lg btn-block" id="mm-keluar">${ic('keluar')}Keluar Mode Monitor</button></div>`,
        foot: `<button class="btn btn-ghost" data-close>Tutup</button>`
      });
      $('#mm-segar', m.el).addEventListener('click', () => { m.close(); M.etag = ''; M.kunciTata = ''; tarik(); });
      $('#mm-full', m.el).addEventListener('click', () => { m.close(); if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); });
      $('#mm-keluar', m.el).addEventListener('click', () => { m.close(); EV.bilik.keluarPerangkat(pin, 'monitor'); });
    });
  }

  EV.monitor = { render };
})();
