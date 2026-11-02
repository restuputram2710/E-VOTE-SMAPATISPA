/* ============================================================================
   E-VOTE SMAPATISPA — Panel Admin
   Dasbor • Pemilihan & Jadwal • Calon • Akun • Pemilih & Kartu (+Impor/Migrasi)
   Cetak Kartu • Hasil & Rekap • Pengaturan • Log Aktivitas
   ============================================================================ */
(function () {
  'use strict';
  const EV = window.EV;
  const { esc, ic, $, $$, fmt, toast, modal, konfirmasi, sibuk, ring, foto, avatar, pillCalon, pillStatus, hitungNaik } = EV.ui;
  const app = () => EV.app;
  const state = EV.state;

  // ------------------------------------------------------------------ util bersama
  function kepala(judul, desk, aksi) {
    return `<div class="page-head"><div><h2>${judul}</h2>${desk ? `<p>${desk}</p>` : ''}</div>${aksi ? `<div class="btn-row">${aksi}</div>` : ''}</div>`;
  }
  function gagalMuat(page, r, ulang) {
    page.innerHTML = `<div class="card"><div class="empty"><div class="e-ic">${ic('wifiOff', 'ic-xl')}</div><h3>Data belum bisa dimuat</h3><p>${esc((r && r.message) || 'Periksa koneksi internet.')}</p>
      <button class="btn" id="ulang">${ic('segarkan')}Coba Lagi</button></div></div>`;
    $('#ulang', page).addEventListener('click', ulang);
  }
  async function fotoCalon(paksa) {
    if (!paksa && state.ballot && Date.now() - state.ballot.at < 300000) return state.ballot.peta;
    const r = await EV.apiQ('ballot');
    const peta = {};
    if (r.success) r.data.ballot.pemilihan.forEach(p => p.calon.forEach(c => { peta[c.id] = c.foto; }));
    state.ballot = { at: Date.now(), peta };
    return peta;
  }
  function tglInput(ms) { if (!ms) return ''; const d = new Date(ms); const p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function jamInput(ms) { if (!ms) return ''; const d = new Date(ms); const p = n => String(n).padStart(2, '0'); return p(d.getHours()) + ':' + p(d.getMinutes()); }
  function keEpoch(tgl, jam) { if (!tgl || !jam) return 0; const t = new Date(tgl + 'T' + jam + ':00').getTime(); return isNaN(t) ? 0 : t; }
  function paginasi(total, hal, per) {
    const n = Math.max(1, Math.ceil(total / per));
    return `<div class="pager"><span>Menampilkan ${total ? fmt.angka((hal - 1) * per + 1) + '–' + fmt.angka(Math.min(total, hal * per)) : 0} dari ${fmt.angka(total)}</span>
      <div class="btn-row"><button class="btn btn-outline btn-sm btn-icon" data-hal="${hal - 1}" ${hal <= 1 ? 'disabled' : ''} aria-label="Halaman sebelumnya">${ic('kiri')}</button>
      <span class="small" style="padding:0 8px">Hal ${hal} / ${n}</span>
      <button class="btn btn-outline btn-sm btn-icon" data-hal="${hal + 1}" ${hal >= n ? 'disabled' : ''} aria-label="Halaman berikutnya">${ic('kanan')}</button></div></div>`;
  }

  // ------------------------------------------------------------------ ubah status pemungutan (dipakai dasbor & pemilihan)
  async function ubahStatus(target, sekarang, setelah) {
    const teks = {
      Dibuka: sekarang === 'Ditutup' ? ['Buka ulang pemungutan?', 'Pemungutan sudah ditutup. Membuka ulang akan mengizinkan kartu yang belum dipakai untuk memilih lagi.', 'Buka Ulang', true]
        : sekarang === 'Dijeda' ? ['Lanjutkan pemungutan?', 'Bilik suara kembali menerima kartu.', 'Lanjutkan', false]
          : ['Buka pemungutan suara?', 'Bilik suara mulai menerima kartu dan hasil tampil langsung di monitor. Pastikan Mode Simulasi sudah dimatikan dan data simulasi sudah dihapus.', 'Buka Pemungutan', false],
      Dijeda: ['Jeda pemungutan?', 'Bilik suara berhenti menerima kartu sampai dilanjutkan. Pemilih yang sedang memilih tidak bisa mengirim suara.', 'Jeda', false],
      Ditutup: ['Tutup pemungutan suara?', 'Bilik berhenti menerima kartu dan monitor menampilkan layar pemenang. Tindakan ini tercatat di log.', 'Tutup Pemungutan', true]
    }[target];
    const perluKetik = target === 'Dibuka' && sekarang === 'Ditutup';
    const ok = await konfirmasi({
      title: teks[0], message: teks[1], ok: teks[2], danger: teks[3],
      extra: perluKetik ? `<div class="field"><label for="k-ketik">Ketik <b>BUKA ULANG</b> untuk konfirmasi</label><input class="input" id="k-ketik" autocomplete="off"></div>` : '',
      validate: perluKetik ? el => ($('#k-ketik', el).value.trim().toUpperCase() === 'BUKA ULANG' ? true : (toast('Ketik BUKA ULANG untuk konfirmasi.', 'warn'), false)) : null
    });
    if (!ok) return;
    const r = await EV.api('election.status', { status: target, konfirmasi: perluKetik ? 'BUKA ULANG' : '' });
    if (EV.ui.hasil(r)) { app().tampilkanStatus(r.data.status); if (setelah) setelah(r.data); }
  }
  function tombolStatus(st) {
    if (st === 'Persiapan') return `<button class="btn btn-lg" data-status="Dibuka">${ic('play')}Buka Pemungutan</button>`;
    if (st === 'Dibuka') return `<button class="btn btn-outline btn-lg" data-status="Dijeda">${ic('pause')}Jeda</button><button class="btn btn-danger-soft btn-lg" data-status="Ditutup">${ic('stop')}Tutup Pemungutan</button>`;
    if (st === 'Dijeda') return `<button class="btn btn-lg" data-status="Dibuka">${ic('play')}Lanjutkan</button><button class="btn btn-danger-soft btn-lg" data-status="Ditutup">${ic('stop')}Tutup</button>`;
    return `<a class="btn btn-lg" href="#/admin/hasil">${ic('grafik')}Lihat Hasil</a><button class="btn btn-ghost" data-status="Dibuka">${ic('ulang')}Buka Ulang</button>`;
  }
  function stepperStatus(st) {
    const urut = ['Persiapan', 'Dibuka', 'Dijeda', 'Ditutup'], i = urut.indexOf(st);
    return `<div class="stepper" style="margin:18px 0">${urut.map((s, j) => `${j ? `<div class="step-line ${j <= i ? 'done' : ''}"></div>` : ''}<div class="step ${j < i ? 'done' : j === i ? 'now' : ''}"><span class="s-dot">${j < i ? ic('cek', 'ic-sm') : j + 1}</span><span class="lbl">${s}</span></div>`).join('')}</div>`;
  }
  function teksHitung(st) {
    if (!st) return '';
    const now = EV.sekarang();
    if (st.status === 'Dibuka' && st.selesai) return 'Sisa waktu <b class="num">' + fmt.durasi(st.selesai - now) + '</b>';
    if (st.status === 'Persiapan' && st.mulai && st.otomatis && st.mulai > now) return 'Dibuka otomatis dalam <b class="num">' + fmt.durasi(st.mulai - now) + '</b>';
    if (st.status === 'Dibuka') return 'Pemungutan berlangsung';
    if (st.status === 'Dijeda') return 'Bilik tidak menerima kartu sementara';
    if (st.status === 'Ditutup') return 'Pemungutan suara telah selesai';
    return 'Menunggu dibuka oleh panitia';
  }
  const WARNA_STATUS = { Persiapan: 'var(--c-primary-2)', Dibuka: 'var(--ok)', Dijeda: 'var(--warn)', Ditutup: 'var(--muted)' };

  function barisBatang(p, petaFoto, tutup) {
    if (!p || !p.calon.length) return '<div class="empty" style="padding:24px"><p>Belum ada calon yang disetujui.</p></div>';
    const maks = Math.max(1, ...p.calon.map(c => c.suara || 0));
    return `<div class="bars">${p.calon.map(c => {
      const lead = p.unggul === c.id;
      return `<div class="bar-row"><div class="b-who">${foto(petaFoto[c.id], 40, c.nama)}<div style="min-width:0"><div class="nm">${lead ? ic('mahkota', 'ic-sm') + ' ' : ''}No. ${c.nomor} · ${esc(c.nama)}</div><div class="kl">${esc(c.kelas)}${lead ? ` · <span style="color:#B45309;font-weight:700">${tutup ? 'Terpilih' : 'Unggul sementara'}</span>` : ''}</div></div></div>
        <div class="bar-track"><div class="bar-fill ${lead ? 'gold' : ''}" style="width:${(c.suara || 0) / maks * 100}%"></div></div>
        <div class="b-val"><b>${fmt.angka(c.suara)}</b> suara · ${fmt.persen(c.persen)}</div></div>`;
    }).join('')}</div>${p.seri ? `<div class="alert alert-warn" style="margin-top:14px">${ic('peringatan')}<div>Perolehan suara teratas <b>seri</b>. ${tutup ? 'Keputusan diserahkan kepada panitia.' : ''}</div></div>` : ''}`;
  }

  // ================================================================== DASBOR
  async function dasbor(page) {
    let data = null, tab = 0;
    const s = EV.Sesi.get();
    const render = petaFoto => {
      const d = data, st = d.status, live = d.liveSimulasi || d.live, tutup = st.status === 'Ditutup';
      const pem = live.pemilihan[tab] || live.pemilihan[0];
      page.innerHTML = `
        ${kepala('Halo, ' + esc(s.me.nama.split(' ')[0]) + '!', 'Ringkasan ' + esc(d.settings.judul_acara), `<button class="btn btn-outline" id="segarkan">${ic('segarkan')}Segarkan</button>`)}
        ${st.simulasi ? `<div class="alert alert-warn" style="margin-bottom:20px">${ic('tabung')}<div><b>Mode Simulasi aktif.</b> Monitor menampilkan hasil uji coba. Matikan mode simulasi di menu Pemilihan & Jadwal sebelum pemungutan asli.</div></div>` : ''}
        <div class="grid g-65">
          <div class="card">
            <div class="card-head"><h3>${ic('vote')}Status Pemungutan</h3>${pillStatus(st.status)}</div>
            <div class="row wrap between">
              <div><div class="num" style="font-size:40px;font-weight:800;color:${WARNA_STATUS[st.status]};letter-spacing:.02em">${st.status.toUpperCase()}</div>
              <div class="muted" id="hitung">${teksHitung(st)}</div></div>
              <div class="btn-row" id="aksi-status">${tombolStatus(st.status)}</div>
            </div>
            ${stepperStatus(st.status)}
          </div>
          <div class="card">
            <div class="card-head"><h3>${ic('kalender')}Jadwal</h3><a class="link-btn small" href="#/admin/pemilihan">Ubah Jadwal ${ic('kanan', 'ic-sm')}</a></div>
            ${st.mulai ? `<div class="bold" style="font-size:17px">${fmt.tanggal(st.mulai)}</div><div class="num" style="font-size:28px;font-weight:800;margin:4px 0 10px">${fmt.jam(st.mulai)}–${st.selesai ? fmt.jam(st.selesai) : '…'}</div>
              <span class="pill ${st.otomatis ? 'pill-info' : ''}">${ic(st.otomatis ? 'timer' : 'tangan')}${st.otomatis ? 'Buka & tutup otomatis' : 'Dibuka/ditutup manual'}</span>`
              : `<div class="empty" style="padding:12px 0"><p>Jadwal belum diatur.</p><a class="btn btn-outline btn-sm" href="#/admin/pemilihan">${ic('kalender')}Atur Jadwal</a></div>`}
          </div>
        </div>
        <div class="grid g-60" style="margin-top:20px">
          <div class="card">
            <div class="card-head"><h3>${ic('grafik')}${tutup ? 'Hasil Akhir' : 'Hasil Sementara'}${live.simulasi ? ' <span class="pill pill-warn">Simulasi</span>' : ''}</h3>
              <div class="seg">${live.pemilihan.map((p, i) => `<button data-tab="${i}" class="${i === tab ? 'on' : ''}">${esc(p.nama)}</button>`).join('')}</div></div>
            ${barisBatang(pem, petaFoto, tutup)}
            <p class="xs muted" style="margin-top:14px">Urutan sesuai nomor urut. Total ${fmt.angka(pem ? pem.total : 0)} suara.</p>
          </div>
          <div class="card">
            <div class="card-head"><h3>${ic('sinyal')}Proses Pemungutan</h3></div>
            <div class="stack" style="gap:18px">
              <div class="row">${ring(100, 84, 9, `<b style="font-size:18px">${fmt.angka(d.pemilih.total)}</b>`)}<div><div class="bold">Pemilih Terdaftar</div><div class="small muted">${fmt.angka(d.pemilih.siswa)} siswa · ${fmt.angka(d.pemilih.guru)} guru</div></div></div>
              <div class="row">${ring(live.partisipasi, 84, 9, `<b style="font-size:16px">${fmt.persen(live.partisipasi).replace(',0', '')}</b>`)}<div><div class="bold">${fmt.angka(live.suaraMasuk)} Suara Masuk</div><div class="small muted">Partisipasi ${fmt.persen(live.partisipasi)}</div></div></div>
              <div class="row">${ring(d.calon.total ? d.calon.disetujui / d.calon.total * 100 : 0, 84, 9, `<b style="font-size:18px">${d.calon.disetujui}</b>`)}<div><div class="bold">Calon Disetujui</div><div class="small muted">${d.calon.perStatus['Menunggu Verifikasi'] || 0} menunggu verifikasi</div></div></div>
            </div>
          </div>
        </div>
        <div class="grid g-3" style="margin-top:20px">
          <div class="card">
            <div class="card-head"><h3>${ic('sekolah')}Kehadiran per Kelas</h3><span class="xs muted">% sudah memilih</span></div>
            ${d.pemilih.perKelas.length ? `<div class="mini-bars">${d.pemilih.perKelas.map(k => { const p = k.total ? Math.round(k.sudah / k.total * 100) : 0; return `<div class="mini-bar" title="${esc(k.kelas)}: ${k.sudah} dari ${k.total} sudah memilih"><span class="mb-k">${esc(k.kelas)}</span><span class="mb-t"><i style="width:${p}%"></i></span><span class="mb-p">${p}%</span></div>`; }).join('')}</div>` : '<div class="empty" style="padding:20px"><p>Belum ada data pemilih.</p></div>'}
          </div>
          <div class="card">
            <div class="card-head"><h3>${ic('log')}Aktivitas Terbaru</h3><a class="link-btn small" href="#/admin/log">Semua ${ic('kanan', 'ic-sm')}</a></div>
            <div class="stack" style="gap:10px">${d.aktivitas.length ? d.aktivitas.slice(0, 6).map(a => `<div class="row" style="gap:10px;align-items:flex-start"><span class="num small muted" style="min-width:44px">${fmt.jam(a.waktu)}</span><div style="min-width:0"><div class="small bold">${esc(labelAksi(a.aksi))}</div><div class="xs muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.pengguna)}${a.detail ? ' · ' + esc(a.detail) : ''}</div></div></div>`).join('') : '<p class="muted small">Belum ada aktivitas.</p>'}</div>
          </div>
          <div class="card">
            <div class="card-head"><h3>${ic('perisai')}Konsistensi Data</h3></div>
            <div class="row" style="align-items:flex-start;gap:14px">
              <div class="stat-icon" style="background:${d.konsistensi.sesuai ? 'var(--ok-bg)' : 'var(--warn-bg)'};color:${d.konsistensi.sesuai ? 'var(--ok)' : 'var(--warn)'}">${ic(d.konsistensi.sesuai ? 'cekBulat' : 'peringatan', 'ic-lg')}</div>
              <div><div class="bold" style="font-size:18px">${d.konsistensi.sesuai ? 'Sesuai' : 'Periksa'}</div>
              <div class="small muted">${fmt.angka(d.konsistensi.sudah)} pemilih sudah memilih</div></div>
            </div>
            <div class="stack" style="margin-top:14px;gap:8px">${d.konsistensi.perPemilihan.map(p => `<div class="row between small"><span>${esc(p.nama)}</span><span class="num bold">${fmt.angka(p.total)} suara ${p.total === d.konsistensi.sudah ? ic('cek', 'ic-sm') : ic('peringatan', 'ic-sm')}</span></div>`).join('')}</div>
            <p class="xs muted" style="margin-top:12px">Jumlah pemilih berstatus "Sudah" harus sama dengan total suara tiap pemilihan.</p>
          </div>
        </div>
        <div class="grid g-2" style="margin-top:20px">
          <button class="card row" data-dev="bilik" style="cursor:pointer;text-align:left;border-style:dashed;gap:18px"><div class="stat-icon" style="width:56px;height:56px">${ic('vote', 'ic-lg')}</div><div><h3>Buka Mode Bilik</h3><p class="small muted">Ubah laptop ini menjadi bilik suara pemindai kartu.</p></div>${ic('kanan', 'muted')}</button>
          <button class="card row" data-dev="monitor" style="cursor:pointer;text-align:left;border-style:dashed;gap:18px"><div class="stat-icon" style="width:56px;height:56px">${ic('tv', 'ic-lg')}</div><div><h3>Buka Mode Monitor</h3><p class="small muted">Tampilkan hasil langsung di TV atau proyektor.</p></div>${ic('kanan', 'muted')}</button>
        </div>`;
      $('#segarkan', page).addEventListener('click', e => sibuk(e.currentTarget, () => muat(true)));
      $$('[data-tab]', page).forEach(b => b.addEventListener('click', () => { tab = Number(b.dataset.tab); render(petaFoto); }));
      $$('[data-status]', page).forEach(b => b.addEventListener('click', () => ubahStatus(b.dataset.status, st.status, () => muat(true))));
      $$('[data-dev]', page).forEach(b => b.addEventListener('click', () => app().modalPerangkat(b.dataset.dev)));
    };
    let petaFoto = {};
    const muat = async paksa => {
      const [r, f] = await Promise.all([EV.apiQ('dashboard'), fotoCalon(paksa)]);
      if (!r.success) { if (!data) gagalMuat(page, r, () => muat(true)); return; }
      data = r.data; petaFoto = f;
      app().tampilkanStatus(data.status);
      app().tampilkanPending(data.calon.perStatus['Menunggu Verifikasi'] || 0);
      if (page.isConnected) render(petaFoto);
    };
    await muat();
    app().setiap(() => { if (EV.ui.Activity.due('dasbor', 15000, 60000)) muat(); }, 5000);
    app().setiap(() => { const el = $('#hitung', page); if (el && data) el.innerHTML = teksHitung(data.status); }, 1000);
  }

  const LABEL_AKSI = {
    LOGIN: 'Masuk', LOGIN_GAGAL: 'Gagal masuk', GANTI_SANDI: 'Ganti kata sandi', SUARA_MASUK: 'Suara masuk', SUARA_UJI_MASUK: 'Suara uji masuk',
    BUKA_PEMUNGUTAN: 'Pemungutan dibuka', JEDA_PEMUNGUTAN: 'Pemungutan dijeda', TUTUP_PEMUNGUTAN: 'Pemungutan ditutup', STATUS_PERSIAPAN: 'Status persiapan',
    VERIFIKASI_CALON: 'Verifikasi calon', TAMBAH_CALON: 'Tambah calon', UBAH_CALON: 'Ubah calon', HAPUS_CALON: 'Hapus calon',
    AJUKAN_PENCALONAN: 'Pencalonan diajukan', SIMPAN_DRAF_PENCALONAN: 'Draf pencalonan', BUAT_AKUN: 'Buat akun', RESET_SANDI: 'Reset sandi',
    IMPOR_PEMILIH: 'Impor pemilih', IMPORT_RUN: 'Migrasi data', CETAK_KARTU: 'Cetak kartu', GANTI_KARTU: 'Ganti kartu',
    MULAI_MODE_BILIK: 'Mode bilik dimulai', MULAI_MODE_MONITOR: 'Mode monitor dimulai', KELUAR_MODE_BILIK: 'Keluar mode bilik', KELUAR_MODE_MONITOR: 'Keluar mode monitor',
    UBAH_PENGATURAN: 'Ubah pengaturan', UBAH_LOGO: 'Ubah logo', UBAH_PIN_PETUGAS: 'Ubah PIN petugas', RESET_SUARA: 'Reset suara', PIN_SALAH: 'PIN salah',
    SIMULASI_AKTIF: 'Simulasi aktif', SIMULASI_NONAKTIF: 'Simulasi nonaktif', BUAT_KARTU_UJI: 'Kartu uji dibuat', HAPUS_SIMULASI: 'Data simulasi dihapus',
    UBAH_JADWAL: 'Ubah jadwal', EKSPOR_HASIL: 'Ekspor hasil'
  };
  function labelAksi(a) { return LABEL_AKSI[a] || String(a || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()); }

  // ================================================================== PEMILIHAN & JADWAL
  async function pemilihan(page) {
    const r = await EV.apiQ('election.get');
    if (!r.success) return gagalMuat(page, r, () => pemilihan(page));
    const render = d => {
      const st = d.status;
      app().tampilkanStatus(st);
      page.innerHTML = `
        ${kepala('Pemilihan & Jadwal', 'Atur jenis pemilihan, jadwal, dan status pemungutan suara.')}
        <div class="grid g-2">
          <div class="card">
            <div class="card-head"><h3>${ic('vote')}Kontrol Pemungutan</h3>${pillStatus(st.status)}</div>
            <div class="num" style="font-size:36px;font-weight:800;color:${WARNA_STATUS[st.status]}">${st.status.toUpperCase()}</div>
            <div class="muted" id="hitung">${teksHitung(st)}</div>
            ${stepperStatus(st.status)}
            <div class="btn-row">${tombolStatus(st.status)}</div>
            ${d.pemilihan.some(p => p.aktif && p.disetujui < 2) ? `<div class="alert alert-warn" style="margin-top:16px">${ic('peringatan')}<div>Minimal <b>2 calon disetujui</b> per pemilihan sebelum pemungutan dibuka.</div></div>` : ''}
          </div>
          <div class="card">
            <div class="card-head"><h3>${ic('kalender')}Jadwal Pemungutan</h3></div>
            <form id="f-jadwal" class="form-stack">
              <div class="field"><label for="j-tgl">Tanggal</label><input class="input" type="date" id="j-tgl" value="${tglInput(d.jadwal.mulai)}"></div>
              <div class="form-grid">
                <div class="field"><label for="j-mulai">Jam Mulai</label><input class="input" type="time" id="j-mulai" value="${jamInput(d.jadwal.mulai)}"></div>
                <div class="field"><label for="j-selesai">Jam Selesai</label><input class="input" type="time" id="j-selesai" value="${jamInput(d.jadwal.selesai)}"></div>
              </div>
              <label class="switch"><input type="checkbox" id="j-oto" ${d.jadwal.otomatis ? 'checked' : ''}><span class="track"></span>Buka & tutup otomatis sesuai jadwal</label>
              <p class="xs muted">Jika otomatis, pemungutan dibuka dan ditutup sendiri pada jamnya. Panitia tetap bisa menjeda atau menutup secara manual.</p>
              <div class="btn-row end"><button class="btn" type="submit" data-loading="Menyimpan…">${ic('cek')}Simpan Jadwal</button></div>
            </form>
          </div>
        </div>
        <div class="card" style="margin-top:20px">
          <div class="card-head"><h3>${ic('award')}Daftar Pemilihan</h3><span class="small muted">Urutan menentukan urutan surat suara di bilik.</span></div>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:110px">Urutan</th><th>Nama Pemilihan</th><th>Kode</th><th>Calon Disetujui</th><th>Aktif</th></tr></thead>
            <tbody>${d.pemilihan.map(p => `<tr data-id="${esc(p.id)}"><td><input class="input" type="number" min="1" max="9" value="${p.urutan}" data-f="urutan" style="width:80px;height:40px" aria-label="Urutan ${esc(p.nama)}"></td>
              <td><input class="input" value="${esc(p.nama)}" data-f="nama" maxlength="40" style="height:40px;max-width:320px" aria-label="Nama pemilihan"></td>
              <td><span class="pill">${esc(p.id)}</span></td><td><span class="pill ${p.disetujui >= 2 ? 'pill-ok' : 'pill-warn'}">${p.disetujui} calon</span></td>
              <td><label class="switch"><input type="checkbox" data-f="aktif" ${p.aktif ? 'checked' : ''}><span class="track"></span></label></td></tr>`).join('')}</tbody></table></div>
          <div class="btn-row end" style="margin-top:16px"><button class="btn" id="simpan-pem" data-loading="Menyimpan…">${ic('cek')}Simpan Daftar Pemilihan</button></div>
        </div>
        <div class="grid g-2" style="margin-top:20px">
          <div class="card">
            <div class="card-head"><h3>${ic('kunci')}PIN Petugas Bilik</h3>${d.pinAda ? `<span class="pill pill-ok">${ic('cek')}Sudah diatur</span>` : `<span class="pill pill-bad">${ic('peringatan')}Belum diatur</span>`}</div>
            <p class="muted small">PIN 6 digit dipakai petugas untuk input kode manual dan keluar dari Mode Bilik / Monitor. PIN tidak pernah ditampilkan ulang.</p>
            <a class="btn btn-outline" href="#/admin/pengaturan" style="margin-top:14px">${ic('pengaturan')}Ubah di Pengaturan</a>
          </div>
          <div class="card danger-zone">
            <div class="card-head"><h3 style="color:var(--bad)">${ic('peringatan')}Zona Berbahaya</h3></div>
            <div class="stack" style="gap:16px">
              <div class="row between wrap"><div style="max-width:420px"><div class="bold">Mode Simulasi</div><div class="small muted">Untuk gladi resik. Hanya kartu uji yang diterima, monitor menampilkan watermark SIMULASI. ${d.simulasi.kartuUji} kartu uji tersedia.</div></div>
                <label class="switch"><input type="checkbox" id="sim" ${d.simulasi.aktif ? 'checked' : ''}><span class="track"></span></label></div>
              <div class="btn-row"><button class="btn btn-outline btn-sm" id="buat-uji" data-loading="Membuat…">${ic('plus')}Buat 10 Kartu Uji</button>
                <button class="btn btn-outline btn-sm" id="hapus-sim" data-loading="Menghapus…">${ic('hapus')}Hapus Data Simulasi</button></div>
              <div class="row between wrap" style="border-top:1px dashed #FCA5A5;padding-top:14px"><div style="max-width:420px"><div class="bold">Reset Semua Suara</div><div class="small muted">Mengosongkan hasil dan mengembalikan status semua pemilih menjadi "Belum". Saat ini ${fmt.angka(d.sudahMemilih)} pemilih sudah memberikan suara.</div></div>
                <button class="btn btn-danger-soft btn-sm" id="reset">${ic('ulang')}Reset Semua Suara</button></div>
            </div>
          </div>
        </div>`;
      $$('[data-status]', page).forEach(b => b.addEventListener('click', () => ubahStatus(b.dataset.status, st.status, render)));
      $('#f-jadwal', page).addEventListener('submit', e => {
        e.preventDefault();
        const tgl = $('#j-tgl', page).value, m = keEpoch(tgl, $('#j-mulai', page).value), s = keEpoch(tgl, $('#j-selesai', page).value);
        if ((tgl || $('#j-mulai', page).value || $('#j-selesai', page).value) && (!m || !s)) return toast('Lengkapi tanggal, jam mulai, dan jam selesai.', 'warn');
        sibuk(e.submitter, async () => { const x = await EV.api('election.schedule', { mulai: m, selesai: s, otomatis: $('#j-oto', page).checked }); if (EV.ui.hasil(x)) render(x.data); });
      });
      $('#simpan-pem', page).addEventListener('click', e => {
        const list = $$('tbody tr[data-id]', page).map(tr => ({ id: tr.dataset.id, nama: $('[data-f=nama]', tr).value, urutan: Number($('[data-f=urutan]', tr).value), aktif: $('[data-f=aktif]', tr).checked }));
        sibuk(e.currentTarget, async () => { const x = await EV.api('election.savePemilihan', { pemilihan: list }); if (EV.ui.hasil(x)) { state.ballot = null; render(x.data); } });
      });
      $('#sim', page).addEventListener('change', async e => {
        const on = e.target.checked;
        const ok = await konfirmasi({ title: on ? 'Nyalakan Mode Simulasi?' : 'Matikan Mode Simulasi?', message: on ? 'Hanya kartu uji yang bisa dipakai memilih. Monitor menampilkan hasil simulasi dengan watermark.' : 'Kartu uji tidak lagi diterima. Hapus data simulasi bila gladi resik sudah selesai.', ok: on ? 'Nyalakan' : 'Matikan', icon: false });
        if (!ok) { e.target.checked = !on; return; }
        const x = await EV.api('simulasi.toggle', { aktif: on });
        if (EV.ui.hasil(x)) render(x.data); else e.target.checked = !on;
      });
      $('#buat-uji', page).addEventListener('click', e => sibuk(e.currentTarget, async () => { const x = await EV.api('simulasi.buatKartu', { jumlah: 10 }); if (EV.ui.hasil(x)) { const y = await EV.api('election.get'); if (y.success) render(y.data); } }));
      $('#hapus-sim', page).addEventListener('click', async e => {
        const ok = await konfirmasi({ title: 'Hapus data simulasi?', message: 'Semua kartu uji dihapus dan suara simulasi dinolkan. Data pemilih asli tidak tersentuh.', ok: 'Hapus Data Simulasi', danger: true });
        if (ok) sibuk(e.target.closest('button'), async () => { const x = await EV.api('simulasi.hapus', {}); if (EV.ui.hasil(x)) { const y = await EV.api('election.get'); if (y.success) render(y.data); } });
      });
      $('#reset', page).addEventListener('click', async () => {
        let isian = null;
        const ok = await konfirmasi({
          title: 'Reset semua suara?', danger: true, ok: 'Reset Sekarang',
          message: 'Semua suara asli dihapus dan status pemilih kembali "Belum". Tindakan ini <b>tidak bisa dibatalkan</b> dan tercatat di log.',
          extra: `<div class="form-stack"><div class="field"><label for="r-ketik">Ketik <b>RESET</b> untuk konfirmasi</label><input class="input" id="r-ketik" autocomplete="off"></div>
            <div class="field"><label for="r-sandi">Kata Sandi Admin</label><input class="input" id="r-sandi" type="password" autocomplete="current-password"></div></div>`,
          validate: el => { const k = $('#r-ketik', el).value.trim(), p = $('#r-sandi', el).value; if (k !== 'RESET') { toast('Ketik RESET (huruf besar).', 'warn'); return false; } if (!p) { toast('Masukkan kata sandi admin.', 'warn'); return false; } isian = { konfirmasi: k, password: p }; return true; }
        });
        if (!ok || !isian) return;
        const x = await EV.api('votes.reset', isian);
        if (EV.ui.hasil(x)) render(x.data);
      });
    };
    render(r.data);
    app().setiap(() => { const el = $('#hitung', page); if (el) el.innerHTML = teksHitung(state.status); }, 1000);
  }

  // ================================================================== CALON
  async function calon(page) {
    let d = null, tab = null, filter = 'Semua', cari = '';
    const muat = async () => {
      const r = await EV.apiQ('calon.list');
      if (!r.success) return gagalMuat(page, r, muat);
      d = r.data;
      if (!tab || !d.pemilihan.some(p => p.id === tab)) tab = (d.pemilihan.filter(p => p.aktif)[0] || d.pemilihan[0] || {}).id;
      app().tampilkanPending(d.calon.filter(c => c.status === 'Menunggu Verifikasi').length);
      render();
    };
    const render = () => {
      const diTab = d.calon.filter(c => c.idPemilihan === tab);
      const hitung = s => diTab.filter(c => s === 'Semua' || c.status === s).length;
      const list = diTab.filter(c => (filter === 'Semua' || c.status === filter) && (!cari || (c.nama + ' ' + c.kelas).toLowerCase().includes(cari)))
        .sort((a, b) => (a.status === 'Disetujui' ? 0 : 1) - (b.status === 'Disetujui' ? 0 : 1) || (a.nomor || 99) - (b.nomor || 99) || a.nama.localeCompare(b.nama));
      page.innerHTML = `
        ${kepala('Calon', 'Verifikasi data pencalonan dan tetapkan nomor urut.', `<button class="btn" id="tambah" ${d.dikunci ? 'disabled' : ''}>${ic('plus')}Tambah Calon</button>`)}
        ${d.dikunci ? `<div class="alert alert-warn" style="margin-bottom:18px">${ic('gembok')}<div>${esc(d.dikunci)}</div></div>` : ''}
        <div class="tabs">${d.pemilihan.map(p => `<button class="tab ${p.id === tab ? 'on' : ''}" data-tab="${esc(p.id)}">${esc(p.nama)} <span class="pill">${d.calon.filter(c => c.idPemilihan === p.id).length}</span></button>`).join('')}</div>
        <div class="toolbar">
          <div class="chips">${['Semua', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Disetujui', 'Ditolak', 'Draf'].map(s => `<button class="chip ${filter === s ? 'on' : ''}" data-f="${s}">${s} <span class="cnt">${hitung(s)}</span></button>`).join('')}</div>
          <span class="spacer"></span>
          <div class="input-wrap has-lead">${ic('cari', 'ic-lead')}<input class="input" id="cari" placeholder="Cari nama calon" value="${esc(cari)}" aria-label="Cari nama calon"></div>
        </div>
        ${list.length ? `<div class="cgrid">${list.map(c => `<article class="ccard">
            ${c.nomor && c.status === 'Disetujui' ? `<span class="no-urut">${String(c.nomor).padStart(2, '0')}</span>` : ''}
            ${foto(c.foto, 104, c.nama)}
            <div class="cc-name">${esc(c.nama)}</div><div class="cc-kelas">${esc(c.kelas)}</div>
            ${pillCalon(c.status)}
            <div class="xs muted">${c.akun ? '@' + esc(c.akun) : 'Diinput panitia'}</div>
            <button class="btn btn-outline btn-sm btn-block" data-tinjau="${esc(c.id)}">${ic('mata')}Tinjau</button></article>`).join('')}</div>`
          : `<div class="card"><div class="empty"><div class="e-ic">${ic('userCek', 'ic-xl')}</div><h3>Belum ada calon</h3><p>${filter === 'Semua' ? 'Buat akun pencalon di menu Akun agar calon dapat mengisi datanya, atau tambahkan langsung.' : 'Tidak ada calon dengan status ini.'}</p></div></div>`}`;
      $$('[data-tab]', page).forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; filter = 'Semua'; render(); }));
      $$('[data-f]', page).forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; render(); }));
      $('#cari', page).addEventListener('input', EV.ui.debounce(e => { cari = e.target.value.toLowerCase().trim(); render(); $('#cari', page).focus(); const v = $('#cari', page); v.setSelectionRange(v.value.length, v.value.length); }, 250));
      $$('[data-tinjau]', page).forEach(b => b.addEventListener('click', () => tinjau(d.calon.find(c => c.id === b.dataset.tinjau))));
      $('#tambah', page).addEventListener('click', () => formCalon(null));
    };
    const pemNama = id => (d.pemilihan.find(p => p.id === id) || {}).nama || id;
    const nomorBebas = c => {
      const dipakai = d.calon.filter(x => x.id !== c.id && x.idPemilihan === c.idPemilihan && x.status === 'Disetujui').map(x => x.nomor);
      for (let i = 1; i <= 20; i++) if (!dipakai.includes(i)) return i;
      return 1;
    };
    function tinjau(c) {
      const dipakai = d.calon.filter(x => x.id !== c.id && x.idPemilihan === c.idPemilihan && x.status === 'Disetujui').map(x => x.nomor);
      const m = modal({
        title: 'Tinjau Calon', sub: pemNama(c.idPemilihan), size: 'xl',
        body: `<div class="grid g-60">
          <div>
            <div class="row" style="gap:20px;align-items:center;flex-wrap:wrap">${foto(c.foto, 150, c.nama)}<div><h2>${esc(c.nama)}</h2><p class="muted" style="font-size:16px">${esc(c.kelas)} · Calon ${esc(pemNama(c.idPemilihan))}</p>
              <div style="margin-top:10px">${pillCalon(c.status)}</div></div></div>
            <div class="form-section" style="margin-top:20px"><h3>${ic('bintang')}Visi</h3><p style="white-space:pre-line">${esc(c.visi)}</p></div>
            <div class="form-section"><h3>${ic('buku')}Misi</h3><ol style="margin:0;padding-left:20px;display:grid;gap:6px">${c.misi.split(/\n+/).filter(Boolean).map(x => `<li>${esc(x.replace(/^\s*(\d+[.)]|[-•*])\s*/, ''))}</li>`).join('')}</ol></div>
          </div>
          <div class="stack" style="gap:16px;align-content:start">
            <div class="card card-tint stack small" style="gap:6px">
              <div class="row between"><span class="muted">Diajukan</span><b>${c.diajukan ? fmt.waktu(c.diajukan) : '—'}</b></div>
              <div class="row between"><span class="muted">Akun</span><b>${c.akun ? '@' + esc(c.akun) : 'Diinput panitia'}</b></div>
              <div class="row between"><span class="muted">Data terkunci</span><b>${c.terkunci ? 'Ya' : 'Tidak'}</b></div>
            </div>
            ${c.catatan ? `<div class="alert alert-warn">${ic('info')}<div><b>Catatan panitia:</b> ${esc(c.catatan)}</div></div>` : ''}
            ${d.dikunci ? `<div class="alert alert-warn">${ic('gembok')}<div>${esc(d.dikunci)}</div></div>` : `
            <div class="field"><label for="v-no">Nomor Urut</label><select class="select" id="v-no">${Array.from({ length: 12 }, (_, i) => i + 1).map(i => `<option value="${i}" ${(c.nomor || nomorBebas(c)) === i ? 'selected' : ''} ${dipakai.includes(i) ? 'disabled' : ''}>${String(i).padStart(2, '0')}${dipakai.includes(i) ? ' (dipakai)' : ''}</option>`).join('')}</select></div>
            <button class="btn btn-ok btn-lg btn-block" id="v-setuju" data-loading="Menyimpan…">${ic('cekBulat')}${c.status === 'Disetujui' ? 'Simpan Nomor Urut' : 'Setujui'}</button>
            <button class="btn btn-outline btn-block" id="v-perbaikan">${ic('edit')}Minta Perbaikan</button>
            <button class="btn btn-danger-soft btn-block" id="v-tolak">${ic('xBulat')}Tolak</button>`}
            <div class="row between" style="padding-top:8px;border-top:1px solid var(--line)">
              <label class="switch small"><input type="checkbox" id="v-kunci" ${c.terkunci ? 'checked' : ''}><span class="track"></span>Kunci data</label>
              <div class="btn-row"><button class="btn btn-ghost btn-sm" id="v-edit" ${d.dikunci ? 'disabled' : ''}>${ic('edit')}Edit</button><button class="btn btn-ghost btn-sm" id="v-hapus" ${d.dikunci ? 'disabled' : ''} style="color:var(--bad)">${ic('hapus')}Hapus</button></div>
            </div>
            <div><div class="label" style="margin-bottom:8px">Pratinjau di surat suara</div>
              <div class="prev-card" style="transform:scale(.86);transform-origin:top center;margin-bottom:-40px">${c.nomor ? `<span class="no-urut">${String(c.nomor).padStart(2, '0')}</span>` : ''}${foto(c.foto, 120, c.nama)}<div class="pc-name">${esc(c.nama)}</div><div class="muted">${esc(c.kelas)}</div><span class="btn btn-sm btn-block">PILIH</span></div></div>
          </div></div>`
      });
      const selesai = async x => { if (EV.ui.hasil(x)) { m.close(); state.ballot = null; await muat(); } };
      if (!d.dikunci) {
        $('#v-setuju', m.el).addEventListener('click', e => sibuk(e.currentTarget, async () => selesai(await EV.api('calon.verify', { id: c.id, aksi: 'setujui', nomor: Number($('#v-no', m.el).value) }))));
        const catat = async aksi => {
          let catatan = '';
          const ok = await konfirmasi({ title: aksi === 'tolak' ? 'Tolak pencalonan' : 'Minta perbaikan', icon: false, danger: aksi === 'tolak', ok: aksi === 'tolak' ? 'Tolak' : 'Kirim Catatan',
            message: aksi === 'tolak' ? 'Pencalon akan melihat alasan penolakan di portalnya.' : 'Pencalon dapat memperbaiki data lalu mengajukan ulang.',
            extra: `<div class="field" style="margin-top:14px"><label for="c-cat">${aksi === 'tolak' ? 'Alasan penolakan' : 'Catatan untuk pencalon'}</label><textarea class="textarea" id="c-cat" maxlength="300" placeholder="Contoh: Foto kurang jelas, mohon ganti dengan foto berseragam."></textarea></div>`,
            validate: el => { catatan = $('#c-cat', el).value.trim(); if (!catatan) { toast('Catatan wajib diisi.', 'warn'); return false; } return true; } });
          if (ok) selesai(await EV.api('calon.verify', { id: c.id, aksi, catatan }));
        };
        $('#v-perbaikan', m.el).addEventListener('click', () => catat('perbaikan'));
        $('#v-tolak', m.el).addEventListener('click', () => catat('tolak'));
      }
      $('#v-kunci', m.el).addEventListener('change', async e => { const x = await EV.api('calon.lock', { id: c.id, terkunci: e.target.checked }); if (EV.ui.hasil(x)) { c.terkunci = e.target.checked; muat(); } else e.target.checked = !e.target.checked; });
      $('#v-edit', m.el).addEventListener('click', () => { m.close(); formCalon(c); });
      $('#v-hapus', m.el).addEventListener('click', async () => {
        const ok = await konfirmasi({ title: 'Hapus data calon?', message: `Data ${esc(c.nama)} dihapus permanen. Akun pencalonnya (jika ada) tetap ada.`, ok: 'Hapus', danger: true });
        if (ok) selesai(await EV.api('calon.delete', { id: c.id }));
      });
    }
    function formCalon(c) {
      let fotoBaru = null;
      const baru = !c;
      c = c || { idPemilihan: tab, nama: '', kelas: '', visi: '', misi: '', foto: '' };
      const m = modal({
        title: baru ? 'Tambah Calon' : 'Edit Data Calon', size: 'lg',
        body: `<form id="f-calon" class="form-stack" novalidate>
          <div class="field"><span class="label">Jenis Pemilihan</span><div class="radio-cards">${d.pemilihan.filter(p => p.aktif || p.id === c.idPemilihan).map(p => `<label class="radio-card"><input type="radio" name="pem" value="${esc(p.id)}" ${p.id === c.idPemilihan ? 'checked' : ''}><span class="rc-dot"></span><span class="bold">${esc(p.nama)}</span></label>`).join('')}</div></div>
          <div class="form-grid"><div class="field"><label for="fc-nama">Nama Lengkap</label><input class="input" id="fc-nama" maxlength="60" value="${esc(c.nama)}" required></div>
            <div class="field"><label for="fc-kelas">Kelas</label><input class="input" id="fc-kelas" maxlength="20" value="${esc(c.kelas)}" placeholder="XI MIPA 2" required></div></div>
          <div class="field"><label for="fc-visi">Visi</label><textarea class="textarea" id="fc-visi" maxlength="300" rows="3">${esc(c.visi)}</textarea><div class="counter" data-for="fc-visi"></div></div>
          <div class="field"><label for="fc-misi">Misi <span class="muted">(satu poin per baris)</span></label><textarea class="textarea" id="fc-misi" maxlength="1000" rows="5">${esc(c.misi)}</textarea><div class="counter" data-for="fc-misi"></div></div>
          <div class="field"><span class="label">Foto</span><div class="row" style="gap:18px;flex-wrap:wrap"><div id="fc-prev">${foto(c.foto, 96, c.nama)}</div>
            <label class="drop" style="flex:1;min-width:240px"><input type="file" accept="image/png,image/jpeg,image/webp" id="fc-file"><div class="d-ic">${ic('unggah')}</div><div><div class="bold">Pilih foto calon</div><div class="small muted">JPG/PNG/WEBP maks 5 MB, dipotong persegi</div></div></label></div></div>
          ${baru ? `<div class="card card-tint row wrap" style="gap:16px"><label class="check"><input type="checkbox" id="fc-setuju"> Langsung setujui</label>
            <div class="field" style="flex:1;min-width:160px"><label for="fc-no">Nomor urut</label><select class="select" id="fc-no">${Array.from({ length: 12 }, (_, i) => i + 1).map(i => `<option value="${i}" ${nomorBebas(c) === i ? 'selected' : ''}>${String(i).padStart(2, '0')}</option>`).join('')}</select></div></div>` : ''}
        </form>`,
        foot: `<button class="btn btn-ghost" data-close>Batal</button><button class="btn" id="fc-simpan" data-loading="Menyimpan…">${ic('cek')}Simpan</button>`
      });
      $$('.counter', m.el).forEach(cn => { const t = $('#' + cn.dataset.for, m.el), maks = Number(t.maxLength); const up = () => { cn.textContent = t.value.length + '/' + maks; cn.classList.toggle('over', t.value.length > maks); }; t.addEventListener('input', up); up(); });
      $('#fc-file', m.el).addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const data = await EV.ui.potongFoto(f); if (data) { fotoBaru = data; $('#fc-prev', m.el).innerHTML = foto(data, 96); } });
      $('#fc-simpan', m.el).addEventListener('click', e => sibuk(e.currentTarget, async () => {
        const pem = $('input[name=pem]:checked', m.el);
        const body = { id: baru ? '' : c.id, idPemilihan: pem ? pem.value : '', nama: $('#fc-nama', m.el).value, kelas: $('#fc-kelas', m.el).value, visi: $('#fc-visi', m.el).value, misi: $('#fc-misi', m.el).value, foto: fotoBaru || '' };
        if (baru && $('#fc-setuju', m.el).checked) { body.setujui = true; body.nomor = Number($('#fc-no', m.el).value); }
        if (baru && body.setujui && !fotoBaru) return toast('Unggah foto sebelum menyetujui calon.', 'warn');
        const x = await EV.api('calon.save', body);
        if (EV.ui.hasil(x)) { m.close(); state.ballot = null; muat(); }
      }));
    }
    await muat();
  }

  // ================================================================== AKUN
  async function akun(page) {
    let d = null, tab = 'pencalon';
    const muat = async () => { const r = await EV.apiQ('akun.list'); if (!r.success) return gagalMuat(page, r, muat); d = r.data; render(); };
    const render = () => {
      const list = d.akun.filter(a => a.peran === tab);
      const me = EV.Sesi.get().me;
      page.innerHTML = `
        ${kepala('Akun', 'Buat akun untuk pencalon dan panitia. Pemilih tidak memerlukan akun.', `<button class="btn" id="buat">${ic('userPlus')}Buat Akun</button>`)}
        <div class="tabs"><button class="tab ${tab === 'pencalon' ? 'on' : ''}" data-tab="pencalon">${ic('userCek', 'ic-sm')}Pencalon <span class="pill">${d.akun.filter(a => a.peran === 'pencalon').length}</span></button>
          <button class="tab ${tab === 'admin' ? 'on' : ''}" data-tab="admin">${ic('perisai', 'ic-sm')}Admin <span class="pill">${d.akun.filter(a => a.peran === 'admin').length}</span></button></div>
        ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Username</th><th>Status Akun</th>${tab === 'pencalon' ? '<th>Status Pencalonan</th>' : ''}<th>Login Terakhir</th><th class="t-act">Aksi</th></tr></thead>
          <tbody>${list.map(a => `<tr><td><div class="row" style="gap:10px">${avatar(a.nama)}<div><div class="bold">${esc(a.nama)}</div>${a.wajibGantiSandi ? '<div class="xs muted">Belum mengganti sandi awal</div>' : ''}</div></div></td>
            <td class="mono">@${esc(a.username)}</td>
            <td>${a.status === 'aktif' ? `<span class="pill pill-ok">${ic('cek')}Aktif</span>` : `<span class="pill">${ic('larang')}Nonaktif</span>`}${a.terkunci ? ` <span class="pill pill-warn">${ic('gembok')}Terkunci</span>` : ''}</td>
            ${tab === 'pencalon' ? `<td>${a.pencalonan ? pillCalon(a.pencalonan.status) + ` <span class="xs muted">${esc(a.pencalonan.pemilihan)}</span>` : '<span class="muted small">Belum mengisi</span>'}</td>` : ''}
            <td class="small">${a.loginTerakhir ? fmt.waktu(a.loginTerakhir) : '<span class="muted">Belum pernah</span>'}</td>
            <td class="t-act"><button class="btn btn-ghost btn-sm" data-reset="${a.id}">${ic('kunci')}Reset Sandi</button>
              ${a.id === me.id ? '' : `<button class="btn btn-ghost btn-sm" data-toggle="${a.id}" data-aktif="${a.status !== 'aktif'}">${ic(a.status === 'aktif' ? 'larang' : 'cek')}${a.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}</button>`}</td></tr>`).join('')}</tbody></table></div>`
          : `<div class="card"><div class="empty"><div class="e-ic">${ic('pengguna', 'ic-xl')}</div><h3>Belum ada akun ${tab}</h3><p>Klik "Buat Akun" untuk menambahkan.</p></div></div>`}`;
      $$('[data-tab]', page).forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
      $('#buat', page).addEventListener('click', buat);
      $$('[data-reset]', page).forEach(b => b.addEventListener('click', async () => {
        const a = d.akun.find(x => x.id === b.dataset.reset);
        const ok = await konfirmasi({ title: 'Reset sandi ' + a.nama + '?', message: 'Sandi lama tidak berlaku dan semua sesi akun ini dikeluarkan. Sandi baru wajib diganti saat login.', ok: 'Reset Sandi' });
        if (!ok) return;
        const x = await EV.api('akun.reset', { id: a.id });
        if (EV.ui.hasil(x)) { slip(x.data); muat(); }
      }));
      $$('[data-toggle]', page).forEach(b => b.addEventListener('click', async () => {
        const a = d.akun.find(x => x.id === b.dataset.toggle), aktif = b.dataset.aktif === 'true';
        if (!aktif) { const ok = await konfirmasi({ title: 'Nonaktifkan ' + a.nama + '?', message: 'Akun tidak bisa masuk dan sesi yang aktif dikeluarkan.', ok: 'Nonaktifkan', danger: true }); if (!ok) return; }
        const x = await EV.api('akun.toggle', { id: a.id, aktif });
        if (EV.ui.hasil(x)) muat();
      }));
    };
    function buat() {
      let peran = tab;
      const m = modal({
        title: 'Buat Akun Baru',
        body: `<form id="f-akun" class="form-stack" novalidate>
          <div class="field"><span class="label">Peran</span><div class="seg" id="a-peran"><button type="button" data-p="pencalon">${ic('userCek')}Pencalon</button><button type="button" data-p="admin">${ic('perisai')}Admin (Panitia)</button></div></div>
          <div class="field"><label for="a-nama">Nama Lengkap</label><input class="input" id="a-nama" maxlength="60" required></div>
          <div class="field"><label for="a-user">Username</label><input class="input" id="a-user" maxlength="30" autocapitalize="none" spellcheck="false" required><span class="help">Huruf kecil, angka, titik, garis bawah. Contoh: rina.agustina</span></div>
          <div class="field"><label for="a-sandi">Sandi Awal <span class="muted">(opsional)</span></label><input class="input" id="a-sandi" autocomplete="new-password" placeholder="Kosongkan untuk dibuat otomatis"><span class="help">Pemilik akun wajib mengganti sandi saat login pertama.</span></div>
        </form>`,
        foot: `<button class="btn btn-ghost" data-close>Batal</button><button class="btn" id="a-simpan" data-loading="Membuat…">${ic('userPlus')}Buat Akun</button>`
      });
      const setPeran = () => $$('#a-peran [data-p]', m.el).forEach(b => b.classList.toggle('on', b.dataset.p === peran));
      $$('#a-peran [data-p]', m.el).forEach(b => b.addEventListener('click', () => { peran = b.dataset.p; setPeran(); }));
      setPeran();
      let userDiubah = false;
      $('#a-user', m.el).addEventListener('input', () => { userDiubah = true; });
      $('#a-nama', m.el).addEventListener('input', e => { if (!userDiubah) $('#a-user', m.el).value = e.target.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 30); });
      $('#a-simpan', m.el).addEventListener('click', e => sibuk(e.currentTarget, async () => {
        const x = await EV.api('akun.create', { nama: $('#a-nama', m.el).value, username: $('#a-user', m.el).value, peran, sandi: $('#a-sandi', m.el).value });
        if (EV.ui.hasil(x)) { m.close(); slip(x.data); tab = peran; muat(); }
      }));
    }
    function slip(data) {
      const cfg = state.cfg, url = location.origin + location.pathname;
      const m = modal({
        title: 'Slip Akun', sub: 'Berikan slip ini langsung kepada pemilik akun. Sandi tidak bisa dilihat lagi setelah jendela ini ditutup.',
        body: `<div class="slip" id="slip-isi">
          <div class="row">${app().logoHtml('brand-logo blob')}<div class="brand-text"><b>${esc(cfg.nama_aplikasi)}</b><span>${esc(cfg.judul_acara)}</span></div></div>
          <div class="sl-row"><span class="muted">Nama</span><span class="bold">${esc(data.akun.nama)}</span></div>
          <div class="sl-row"><span class="muted">Peran</span><span class="bold">${data.akun.peran === 'admin' ? 'Admin (Panitia)' : 'Pencalon'}</span></div>
          <div class="sl-row"><span class="muted">Username</span><b>${esc(data.akun.username)}</b></div>
          <div class="sl-row"><span class="muted">Sandi awal</span><b>${esc(data.sandiAwal)}</b></div>
          <div class="xs muted">Masuk di: ${esc(url)} — wajib mengganti sandi saat login pertama.</div></div>`,
        foot: `<button class="btn btn-ghost" id="sl-salin">${ic('salin')}Salin</button><button class="btn btn-outline" id="sl-cetak">${ic('cetak')}Cetak Slip</button><button class="btn" data-close>Selesai</button>`,
        sticky: true
      });
      $('#sl-salin', m.el).addEventListener('click', () => EV.ui.salin(`${cfg.nama_aplikasi}\nNama: ${data.akun.nama}\nUsername: ${data.akun.username}\nSandi awal: ${data.sandiAwal}\nMasuk di: ${url}`));
      $('#sl-cetak', m.el).addEventListener('click', () => cetakHtml(`<div style="padding:16mm;max-width:120mm">${$('#slip-isi', m.el).outerHTML}</div>`));
    }
    await muat();
  }

  function cetakHtml(html) {
    let root = $('.print-root');
    if (!root) { root = document.createElement('div'); root.className = 'print-root'; document.body.appendChild(root); }
    root.innerHTML = html;
    setTimeout(() => { window.print(); }, 120);
  }

  // ================================================================== PEMILIH & KARTU SUARA
  async function pemilih(page, tabAwal) {
    let d = null, tab = tabAwal || 'daftar', hal = 1, f = { q: '', kelas: '', jenis: '', memilih: '', cetak: '' }, pilih = new Set();
    const PER = 25;
    const muat = async () => { const r = await EV.apiQ('pemilih.list'); if (!r.success) return gagalMuat(page, r, muat); d = r.data; render(); };
    const kelasList = () => Array.from(new Set(d.pemilih.filter(p => !p.simulasi).map(p => p.kelas))).sort((a, b) => a === 'Guru' ? 1 : b === 'Guru' ? -1 : a.localeCompare(b, 'id', { numeric: true }));
    const tersaring = () => d.pemilih.filter(p => {
      if (f.jenis === 'Uji') { if (!p.simulasi) return false; } else if (p.simulasi) return false;
      if (f.jenis && f.jenis !== 'Uji' && p.jenis !== f.jenis) return false;
      if (f.kelas && p.kelas !== f.kelas) return false;
      if (f.memilih && p.statusMemilih !== f.memilih) return false;
      if (f.cetak === 'belum' && p.dicetak) return false;
      if (f.cetak === 'sudah' && !p.dicetak) return false;
      if (f.q && !(p.nama + ' ' + p.nomorInduk + ' ' + p.kelas).toLowerCase().includes(f.q)) return false;
      return true;
    }).sort((a, b) => String(a.kelas).localeCompare(String(b.kelas), 'id', { numeric: true }) || a.nama.localeCompare(b.nama));
    const render = () => {
      const st = d.statistik;
      page.innerHTML = `
        ${kepala('Pemilih & Kartu Suara', 'Data siswa dan guru yang berhak memilih beserta kode kartu barcode-nya.', `<button class="btn btn-outline" id="tambah">${ic('userPlus')}Tambah</button><a class="btn" href="#/admin/cetak">${ic('cetak')}Cetak Kartu</a>`)}
        <div class="grid g-4">
          ${[['pengguna', 'Total Pemilih', st.total, `${fmt.angka(st.sudah)} sudah memilih`], ['sekolah', 'Siswa', st.siswa, ''], ['award', 'Guru', st.guru, ''], ['cetak', 'Kartu Belum Dicetak', st.belumDicetak, st.uji ? st.uji + ' kartu uji' : '']]
            .map(x => `<div class="card stat"><div class="row between"><span class="s-label">${x[1]}</span><span class="stat-icon">${ic(x[0])}</span></div><span class="s-val">${fmt.angka(x[2])}</span><span class="s-sub">${x[3] || '&nbsp;'}</span></div>`).join('')}
        </div>
        <div class="tabs" style="margin-top:24px">
          <button class="tab ${tab === 'daftar' ? 'on' : ''}" data-tab="daftar">${ic('kartu', 'ic-sm')}Daftar Pemilih</button>
          <button class="tab ${tab === 'hadir' ? 'on' : ''}" data-tab="hadir">${ic('userCek', 'ic-sm')}Daftar Hadir</button>
          <button class="tab ${tab === 'impor' ? 'on' : ''}" data-tab="impor">${ic('unggah', 'ic-sm')}Impor Data</button>
        </div>
        <div id="tab-isi"></div>`;
      $$('[data-tab]', page).forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
      $('#tambah', page).addEventListener('click', () => formPemilih(null));
      const isi = $('#tab-isi', page);
      if (tab === 'daftar') renderDaftar(isi);
      else if (tab === 'hadir') renderHadir(isi);
      else EV.adminImpor(isi, () => { tab = 'daftar'; muat(); });
    };
    const renderDaftar = isi => {
      const list = tersaring(), n = Math.max(1, Math.ceil(list.length / PER));
      hal = Math.min(hal, n);
      const potong = list.slice((hal - 1) * PER, hal * PER);
      isi.innerHTML = `
        <div class="toolbar">
          <div class="input-wrap has-lead">${ic('cari', 'ic-lead')}<input class="input" id="q" placeholder="Cari nama / NIS" value="${esc(f.q)}" aria-label="Cari pemilih"></div>
          <select class="select" id="fk" aria-label="Filter kelas"><option value="">Semua kelas</option>${kelasList().map(k => `<option ${f.kelas === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
          <select class="select" id="fj" aria-label="Filter jenis"><option value="">Siswa & guru</option><option value="Siswa" ${f.jenis === 'Siswa' ? 'selected' : ''}>Siswa</option><option value="Guru" ${f.jenis === 'Guru' ? 'selected' : ''}>Guru</option><option value="Uji" ${f.jenis === 'Uji' ? 'selected' : ''}>Kartu uji</option></select>
          <select class="select" id="fm" aria-label="Filter status memilih"><option value="">Status memilih</option><option value="Belum" ${f.memilih === 'Belum' ? 'selected' : ''}>Belum</option><option value="Sudah" ${f.memilih === 'Sudah' ? 'selected' : ''}>Sudah</option></select>
          <select class="select" id="fc" aria-label="Filter status cetak"><option value="">Status cetak</option><option value="belum" ${f.cetak === 'belum' ? 'selected' : ''}>Belum dicetak</option><option value="sudah" ${f.cetak === 'sudah' ? 'selected' : ''}>Sudah dicetak</option></select>
          ${pilih.size ? `<button class="btn btn-danger-soft btn-sm" id="hapus-pilih">${ic('hapus')}Hapus ${pilih.size} terpilih</button>` : ''}
        </div>
        ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="t-check"><input type="checkbox" id="semua" aria-label="Pilih semua di halaman ini"></th><th>Nama</th><th>Kelas</th><th>Jenis</th><th>Kode Kartu</th><th>Status Kartu</th><th>Memilih</th><th>Dicetak</th><th class="t-act">Aksi</th></tr></thead>
          <tbody>${potong.map(p => `<tr><td class="t-check"><input type="checkbox" data-pilih="${p.id}" ${pilih.has(p.id) ? 'checked' : ''} ${p.statusMemilih === 'Sudah' ? 'disabled' : ''} aria-label="Pilih ${esc(p.nama)}"></td>
            <td><div class="bold">${esc(p.nama)}</div>${p.nomorInduk ? `<div class="xs muted mono">${esc(p.nomorInduk)}</div>` : ''}</td>
            <td>${esc(p.kelas)}</td><td>${p.simulasi ? '<span class="pill pill-warn">Uji</span>' : esc(p.jenis)}</td>
            <td><button class="link-btn mono" data-kode="${p.id}" title="Tampilkan kode">${esc(p.kode.slice(0, 4))}••••</button></td>
            <td>${p.statusKartu === 'Aktif' ? '<span class="pill pill-ok">Aktif</span>' : '<span class="pill">Nonaktif</span>'}</td>
            <td>${p.statusMemilih === 'Sudah' ? `<span class="pill pill-ok">${ic('cek')}Sudah</span>` : '<span class="pill">Belum</span>'}</td>
            <td class="small">${p.dicetak ? fmt.tglPendek(p.dicetak) : '<span class="muted">—</span>'}</td>
            <td class="t-act"><button class="btn btn-ghost btn-sm btn-icon" data-edit="${p.id}" aria-label="Edit ${esc(p.nama)}" title="Edit">${ic('edit')}</button>
              <button class="btn btn-ghost btn-sm btn-icon" data-ganti="${p.id}" aria-label="Ganti kartu ${esc(p.nama)}" title="Ganti kartu (hilang/rusak)" ${p.statusMemilih === 'Sudah' ? 'disabled' : ''}>${ic('ulang')}</button></td></tr>`).join('')}</tbody></table></div>
          ${paginasi(list.length, hal, PER)}`
          : `<div class="card"><div class="empty"><div class="e-ic">${ic('kartu', 'ic-xl')}</div><h3>${d.pemilih.length ? 'Tidak ada data yang cocok' : 'Belum ada data pemilih'}</h3><p>${d.pemilih.length ? 'Ubah kata kunci atau filter.' : 'Impor data siswa & guru dari Excel atau Google Sheets.'}</p>${d.pemilih.length ? '' : `<button class="btn" id="ke-impor">${ic('unggah')}Impor Data</button>`}</div></div>`}`;
      const ulang = () => { renderDaftar(isi); };
      $('#q', isi).addEventListener('input', EV.ui.debounce(e => { f.q = e.target.value.toLowerCase().trim(); hal = 1; ulang(); const q = $('#q', isi); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250));
      [['#fk', 'kelas'], ['#fj', 'jenis'], ['#fm', 'memilih'], ['#fc', 'cetak']].forEach(([s, k]) => $(s, isi).addEventListener('change', e => { f[k] = e.target.value; hal = 1; ulang(); }));
      $$('[data-hal]', isi).forEach(b => b.addEventListener('click', () => { hal = Number(b.dataset.hal); ulang(); }));
      $$('[data-pilih]', isi).forEach(c => c.addEventListener('change', () => { c.checked ? pilih.add(c.dataset.pilih) : pilih.delete(c.dataset.pilih); ulang(); }));
      const semua = $('#semua', isi);
      if (semua) semua.addEventListener('change', () => { potong.filter(p => p.statusMemilih !== 'Sudah').forEach(p => semua.checked ? pilih.add(p.id) : pilih.delete(p.id)); ulang(); });
      $$('[data-kode]', isi).forEach(b => b.addEventListener('click', () => { const p = d.pemilih.find(x => x.id === b.dataset.kode); b.textContent = fmt.kode(p.kode); }));
      $$('[data-edit]', isi).forEach(b => b.addEventListener('click', () => formPemilih(d.pemilih.find(x => x.id === b.dataset.edit))));
      $$('[data-ganti]', isi).forEach(b => b.addEventListener('click', async () => {
        const p = d.pemilih.find(x => x.id === b.dataset.ganti);
        const ok = await konfirmasi({ title: 'Ganti kartu ' + p.nama + '?', message: 'Gunakan bila kartu hilang atau rusak. Kode lama langsung tidak berlaku dan kode baru perlu dicetak ulang.', ok: 'Ganti Kartu' });
        if (!ok) return;
        const x = await EV.api('pemilih.gantiKartu', { id: p.id });
        if (EV.ui.hasil(x)) { Object.assign(p, x.data.pemilih); ulang(); }
      }));
      const hp = $('#hapus-pilih', isi);
      if (hp) hp.addEventListener('click', async () => {
        const ok = await konfirmasi({ title: 'Hapus ' + pilih.size + ' data pemilih?', message: 'Kartu suara mereka tidak berlaku lagi. Pemilih yang sudah memberikan suara tidak bisa dihapus.', ok: 'Hapus', danger: true });
        if (!ok) return;
        const x = await EV.api('pemilih.delete', { ids: Array.from(pilih) });
        if (EV.ui.hasil(x)) { pilih.clear(); muat(); }
      });
      const ki = $('#ke-impor', isi);
      if (ki) ki.addEventListener('click', () => { tab = 'impor'; render(); });
    };
    const renderHadir = isi => {
      let q = '';
      const tampil = () => {
        const rows = d.statistik.perKelas.filter(k => !q || k.kelas.toLowerCase().includes(q));
        $('#hadir-list', isi).innerHTML = rows.length ? rows.map(k => { const p = k.total ? k.sudah / k.total * 100 : 0; return `<div class="bar-row" style="grid-template-columns:minmax(120px,1fr) minmax(0,3fr) 150px"><div class="bold">${esc(k.kelas)}</div><div class="bar-track"><div class="bar-fill" style="width:${p}%"></div></div><div class="b-val"><b>${k.sudah}/${k.total}</b> · ${Math.round(p)}%</div></div>`; }).join('') : '<p class="muted">Tidak ada kelas yang cocok.</p>';
      };
      isi.innerHTML = `<div class="card">
        <div class="card-head"><h3>${ic('userCek')}Kehadiran per Kelas</h3><div class="input-wrap has-lead" style="max-width:280px">${ic('cari', 'ic-lead')}<input class="input" id="hq" placeholder="Cari kelas" style="height:42px" aria-label="Cari kelas"></div></div>
        <div class="alert" style="margin-bottom:18px">${ic('perisai')}<div>Daftar ini hanya menunjukkan <b>siapa yang sudah memilih</b>. Pilihan setiap pemilih tidak pernah dicatat maupun ditampilkan.</div></div>
        <div class="bars" id="hadir-list"></div>
        <div class="btn-row end" style="margin-top:18px"><button class="btn btn-outline btn-sm" id="unduh-hadir">${ic('unduh')}Unduh Daftar Hadir (CSV)</button></div></div>`;
      $('#hq', isi).addEventListener('input', e => { q = e.target.value.toLowerCase().trim(); tampil(); });
      $('#unduh-hadir', isi).addEventListener('click', () => {
        const rows = [['Nama', 'Nomor Induk', 'Kelas', 'Jenis', 'Status Memilih', 'Waktu Memilih']].concat(d.pemilih.filter(p => !p.simulasi).map(p => [p.nama, p.nomorInduk, p.kelas, p.jenis, p.statusMemilih, p.waktuMemilih ? fmt.waktu(p.waktuMemilih) : '']));
        EV.ui.unduhTeks('daftar-hadir-' + new Date().toISOString().slice(0, 10) + '.csv', EV.ui.csv(rows), 'text/csv;charset=utf-8');
      });
      tampil();
    };
    function formPemilih(p) {
      const baru = !p;
      p = p || { nama: '', kelas: '', jenis: 'Siswa', nomorInduk: '', statusKartu: 'Aktif' };
      let jenis = p.jenis;
      const m = modal({
        title: baru ? 'Tambah Pemilih' : 'Edit Pemilih',
        body: `<form class="form-stack" novalidate>
          <div class="field"><span class="label">Jenis</span><div class="seg" id="p-jenis"><button type="button" data-j="Siswa">Siswa</button><button type="button" data-j="Guru">Guru</button></div></div>
          <div class="field"><label for="p-nama">Nama Lengkap</label><input class="input" id="p-nama" maxlength="80" value="${esc(p.nama)}"></div>
          <div class="form-grid"><div class="field"><label for="p-kelas">Kelas</label><input class="input" id="p-kelas" maxlength="20" value="${esc(p.kelas)}" placeholder="X-1 / Guru"></div>
            <div class="field"><label for="p-ni">NIS / NIP <span class="muted">(opsional)</span></label><input class="input" id="p-ni" maxlength="30" value="${esc(p.nomorInduk)}"></div></div>
          ${baru ? `<p class="small muted">${ic('info', 'ic-sm')} Kode kartu dibuat otomatis.</p>` : `<div class="field"><span class="label">Status Kartu</span><div class="seg" id="p-sk"><button type="button" data-s="Aktif">Aktif</button><button type="button" data-s="Nonaktif">Nonaktif</button></div><span class="help">Kode kartu: <b class="mono">${esc(fmt.kode(p.kode))}</b>. Kartu hilang? Gunakan tombol Ganti Kartu agar kode lama tidak berlaku.</span></div>`}
        </form>`,
        foot: `<button class="btn btn-ghost" data-close>Batal</button><button class="btn" id="p-simpan" data-loading="Menyimpan…">${ic('cek')}Simpan</button>`
      });
      let sk = p.statusKartu;
      const segJ = () => $$('#p-jenis [data-j]', m.el).forEach(b => b.classList.toggle('on', b.dataset.j === jenis));
      $$('#p-jenis [data-j]', m.el).forEach(b => b.addEventListener('click', () => { jenis = b.dataset.j; segJ(); if (jenis === 'Guru' && !$('#p-kelas', m.el).value) $('#p-kelas', m.el).value = 'Guru'; }));
      segJ();
      const segS = () => $$('#p-sk [data-s]', m.el).forEach(b => b.classList.toggle('on', b.dataset.s === sk));
      $$('#p-sk [data-s]', m.el).forEach(b => b.addEventListener('click', () => { sk = b.dataset.s; segS(); }));
      segS();
      $('#p-simpan', m.el).addEventListener('click', e => sibuk(e.currentTarget, async () => {
        const x = await EV.api('pemilih.save', { id: baru ? '' : p.id, nama: $('#p-nama', m.el).value, kelas: $('#p-kelas', m.el).value, nomorInduk: $('#p-ni', m.el).value, jenis, statusKartu: baru ? '' : sk });
        if (EV.ui.hasil(x)) { m.close(); muat(); }
      }));
    }
    await muat();
  }

  // ================================================================== CETAK KARTU
  async function cetak(page) {
    const r = await EV.apiQ('pemilih.list');
    if (!r.success) return gagalMuat(page, r, () => cetak(page));
    const semua = r.data.pemilih;
    let f = { kelas: '', jenis: '', belum: false }, hal = 1;
    try { await EV.ui.LIB.qr(); } catch (e) { page.innerHTML = `<div class="alert alert-bad">${ic('wifiOff')}<div>${esc(e.message)} (pustaka QR code)</div></div>`; return; }
    const kelasList = Array.from(new Set(semua.filter(p => !p.simulasi).map(p => p.kelas))).sort((a, b) => a === 'Guru' ? 1 : b === 'Guru' ? -1 : a.localeCompare(b, 'id', { numeric: true }));
    const daftar = () => semua.filter(p => {
      if (f.jenis === 'Uji') return p.simulasi;
      if (p.simulasi) return false;
      if (f.jenis && p.jenis !== f.jenis) return false;
      if (f.kelas && p.kelas !== f.kelas) return false;
      if (f.belum && p.dicetak) return false;
      return p.statusKartu === 'Aktif' && p.statusMemilih !== 'Sudah';
    }).sort((a, b) => String(a.kelas).localeCompare(String(b.kelas), 'id', { numeric: true }) || a.nama.localeCompare(b.nama));
    const cfg = state.cfg;
    const kartu = p => `<div class="ballot-card cut ${p.simulasi ? 'uji' : ''}">
      <div class="bc-head"><div class="bc-logo">${cfg.logo ? `<img src="${cfg.logo}" alt="">` : ic('vote')}</div><div><div class="bc-app">${esc(cfg.nama_aplikasi)}</div><div class="bc-ev">${esc(p.simulasi ? 'KARTU UJI — hanya untuk simulasi' : cfg.judul_acara)}</div></div></div>
      <div class="bc-body"><div><div class="bc-lbl">Kartu Suara</div><div class="bc-name">${esc(p.nama)}</div><div class="bc-kelas">${esc(p.jenis === 'Guru' ? 'Guru' : 'Kelas ' + p.kelas)}</div></div>
        <div><div class="bc-code">${esc(fmt.kode(p.kode))}</div><div class="bc-note">Berlaku 1 kali • jangan dipinjamkan</div></div></div>
      <div class="bc-qr">${EV.ui.qrSvg(p.kode)}</div></div>`;
    const halamanA4 = list => { const out = []; for (let i = 0; i < list.length; i += 10) out.push(`<div class="a4">${list.slice(i, i + 10).map(kartu).join('')}</div>`); return out; };
    const render = () => {
      const list = daftar(), nHal = Math.max(1, Math.ceil(list.length / 10));
      hal = Math.min(hal, nHal);
      page.innerHTML = `
        ${kepala('Cetak Kartu Suara', 'Kartu berisi QR code unik. Cetak di kertas A4 (10 kartu per lembar), lalu gunting sesuai garis.')}
        <div class="grid" style="grid-template-columns:minmax(260px,320px) minmax(0,1fr);align-items:start">
          <div class="card stack" style="gap:16px;position:sticky;top:96px">
            <div class="field"><label for="ck">Kelas</label><select class="select" id="ck"><option value="">Semua kelas</option>${kelasList.map(k => `<option ${f.kelas === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></div>
            <div class="field"><label for="cj">Jenis</label><select class="select" id="cj"><option value="">Siswa & guru</option><option value="Siswa" ${f.jenis === 'Siswa' ? 'selected' : ''}>Siswa</option><option value="Guru" ${f.jenis === 'Guru' ? 'selected' : ''}>Guru</option><option value="Uji" ${f.jenis === 'Uji' ? 'selected' : ''}>Kartu uji (simulasi)</option></select></div>
            <label class="check"><input type="checkbox" id="cb" ${f.belum ? 'checked' : ''}>Hanya yang belum dicetak</label>
            <div class="card card-tint" style="padding:14px"><div class="num" style="font-size:26px;font-weight:800">${fmt.angka(list.length)} kartu</div><div class="small muted">${nHal} lembar A4</div></div>
            <button class="btn btn-lg btn-block" id="cetak-btn" ${list.length ? '' : 'disabled'}>${ic('cetak')}Cetak</button>
            <button class="btn btn-outline btn-block" id="tandai" ${list.length ? '' : 'disabled'} data-loading="Menyimpan…">${ic('cek')}Tandai Sudah Dicetak</button>
            <p class="xs muted">Kartu yang sudah dipakai memilih atau nonaktif tidak ikut dicetak. Atur printer: kertas A4, skala 100% (Actual size), margin "None".</p>
          </div>
          <div>
            <div class="row between" style="margin-bottom:12px"><span class="small muted">Pratinjau lembar</span>
              <div class="btn-row"><button class="btn btn-outline btn-sm btn-icon" id="prev" ${hal <= 1 ? 'disabled' : ''} aria-label="Lembar sebelumnya">${ic('kiri')}</button><span class="small">Halaman ${hal} dari ${nHal}</span><button class="btn btn-outline btn-sm btn-icon" id="next" ${hal >= nHal ? 'disabled' : ''} aria-label="Lembar berikutnya">${ic('kanan')}</button></div></div>
            <div class="a4-wrap" id="a4-wrap">${list.length ? `<div class="a4-scale" id="a4-scale">${halamanA4(list.slice((hal - 1) * 10, hal * 10))[0]}</div>` : `<div class="empty"><div class="e-ic">${ic('kartu', 'ic-xl')}</div><h3>Tidak ada kartu</h3><p>Ubah filter atau impor data pemilih.</p></div>`}</div>
          </div></div>`;
      const skala = () => { const w = $('#a4-wrap', page), s = $('#a4-scale', page); if (!w || !s) return; s.style.zoom = Math.min(1, (w.clientWidth - 40) / (210 * 3.7795)); };
      skala();
      window.addEventListener('resize', skala);
      app().onCleanup(() => window.removeEventListener('resize', skala));
      $('#ck', page).addEventListener('change', e => { f.kelas = e.target.value; hal = 1; render(); });
      $('#cj', page).addEventListener('change', e => { f.jenis = e.target.value; hal = 1; render(); });
      $('#cb', page).addEventListener('change', e => { f.belum = e.target.checked; hal = 1; render(); });
      const pv = $('#prev', page), nx = $('#next', page);
      if (pv) pv.addEventListener('click', () => { hal--; render(); });
      if (nx) nx.addEventListener('click', () => { hal++; render(); });
      $('#cetak-btn', page).addEventListener('click', async () => {
        cetakHtml(halamanA4(list).join(''));
        setTimeout(async () => {
          const ok = await konfirmasi({ title: 'Tandai kartu sebagai sudah dicetak?', message: `${fmt.angka(list.length)} kartu akan ditandai sudah dicetak agar mudah difilter nanti.`, ok: 'Tandai', icon: false });
          if (ok) tandai(list);
        }, 800);
      });
      $('#tandai', page).addEventListener('click', e => sibuk(e.currentTarget, () => tandai(list)));
    };
    const tandai = async list => {
      const x = await EV.api('pemilih.tandaiCetak', { ids: list.map(p => p.id) });
      if (EV.ui.hasil(x)) { const now = Date.now(); list.forEach(p => { p.dicetak = now; }); render(); }
    };
    render();
  }

  // ================================================================== HASIL & REKAP
  async function hasil(page) {
    const [r, petaFoto] = await Promise.all([EV.apiQ('hasil.get'), fotoCalon()]);
    if (!r.success) return gagalMuat(page, r, () => hasil(page));
    const d = r.data, h = d.hasil, tutup = d.status.status === 'Ditutup';
    app().tampilkanStatus(d.status);
    page.innerHTML = `
      ${kepala('Hasil & Rekap', tutup ? 'Pemungutan suara telah ditutup. Berikut hasil akhir.' : 'Hasil sementara — diperbarui setiap kali halaman dibuka.',
        `<button class="btn btn-outline" id="unduh">${ic('unduh')}Unduh CSV</button><button class="btn btn-outline" id="ekspor" data-loading="Mengekspor…">${ic('sheet')}Ekspor ke Google Sheets</button><button class="btn" id="cetak">${ic('cetak')}Cetak Rekap</button>`)}
      <div class="grid g-4">
        <div class="card stat"><span class="s-label">Status</span><div style="margin-top:6px">${pillStatus(d.status.status, true)}</div><span class="s-sub">${d.status.selesai ? 'Jadwal selesai ' + fmt.jam(d.status.selesai) : '&nbsp;'}</span></div>
        <div class="card stat"><span class="s-label">Pemilih Terdaftar</span><span class="s-val">${fmt.angka(d.partisipasi.total)}</span><span class="s-sub">Siswa & guru</span></div>
        <div class="card stat"><span class="s-label">Sudah Memilih</span><span class="s-val">${fmt.angka(d.partisipasi.sudah)}</span><span class="s-sub">${fmt.angka(d.partisipasi.total - d.partisipasi.sudah)} belum memilih</span></div>
        <div class="card row">${ring(d.partisipasi.persen, 92, 10, `<b style="font-size:18px">${fmt.persen(d.partisipasi.persen)}</b>`)}<div><div class="s-label" style="font-size:12.5px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">Partisipasi</div><div class="small muted">dari pemilih terdaftar</div></div></div>
      </div>
      ${h.pemilihan.map(p => {
        const urut = p.calon.slice().sort((a, b) => b.suara - a.suara);
        return `<div class="card" style="margin-top:20px">
          <div class="card-head"><h3>${ic('award')}${esc(p.nama)}</h3><span class="pill">${fmt.angka(p.total)} suara</span></div>
          ${barisBatang(p, petaFoto, tutup)}
          <div class="tbl-wrap" style="margin-top:20px"><table class="tbl"><thead><tr><th>Peringkat</th><th>No. Urut</th><th>Calon</th><th>Kelas</th><th class="t-num">Suara</th><th class="t-num">Persentase</th></tr></thead>
            <tbody>${urut.map((c, i) => `<tr class="${p.unggul === c.id ? 'win' : ''}"><td class="num bold">${i + 1}</td><td><span class="no-urut">${String(c.nomor).padStart(2, '0')}</span></td>
              <td><div class="row" style="gap:10px">${foto(petaFoto[c.id], 36, c.nama)}<span class="bold">${esc(c.nama)}</span>${p.unggul === c.id ? `<span class="pill pill-gold">${ic('mahkota')}${tutup ? 'Terpilih' : 'Unggul Sementara'}</span>` : ''}</div></td>
              <td>${esc(c.kelas)}</td><td class="t-num">${fmt.angka(c.suara)}</td><td class="t-num">${fmt.persen(c.persen)}</td></tr>`).join('')}</tbody></table></div></div>`;
      }).join('')}`;
    const baris = [['Pemilihan', 'Peringkat', 'Nomor Urut', 'Nama', 'Kelas', 'Suara', 'Persentase']];
    h.pemilihan.forEach(p => p.calon.slice().sort((a, b) => b.suara - a.suara).forEach((c, i) => baris.push([p.nama, i + 1, c.nomor, c.nama, c.kelas, c.suara, c.persen])));
    $('#unduh', page).addEventListener('click', () => EV.ui.unduhTeks('rekap-hasil-' + new Date().toISOString().slice(0, 10) + '.csv', EV.ui.csv(baris), 'text/csv;charset=utf-8'));
    $('#ekspor', page).addEventListener('click', e => sibuk(e.currentTarget, async () => {
      const x = await EV.api('hasil.ekspor', {});
      if (EV.ui.hasil(x)) modal({ title: 'Rekap berhasil diekspor', body: `<p>File <b>${esc(x.data.nama)}</b> dibuat di folder Drive "Ekspor Hasil".</p>`, foot: `<button class="btn btn-ghost" data-close>Tutup</button><a class="btn" href="${esc(x.data.url)}" target="_blank" rel="noopener">${ic('tautan')}Buka Google Sheets</a>` });
    }));
    $('#cetak', page).addEventListener('click', () => {
      const cfg = state.cfg;
      cetakHtml(`<div class="rekap-print"><h1>Rekapitulasi Hasil — ${esc(cfg.judul_acara)}</h1><p>${esc(cfg.nama_sekolah)} • Dicetak ${fmt.waktu(Date.now())} • Status: ${esc(d.status.status)}</p>
        <table><tr><th>Pemilih terdaftar</th><td>${d.partisipasi.total}</td><th>Sudah memilih</th><td>${d.partisipasi.sudah}</td><th>Partisipasi</th><td>${fmt.persen(d.partisipasi.persen)}</td></tr></table>
        ${h.pemilihan.map(p => `<h2 style="font-size:16px;margin-top:18px">${esc(p.nama)}</h2><table><tr><th>Peringkat</th><th>No. Urut</th><th>Nama</th><th>Kelas</th><th>Suara</th><th>%</th></tr>
          ${p.calon.slice().sort((a, b) => b.suara - a.suara).map((c, i) => `<tr><td>${i + 1}</td><td>${c.nomor}</td><td>${esc(c.nama)}${p.unggul === c.id ? ' ★' : ''}</td><td>${esc(c.kelas)}</td><td>${c.suara}</td><td>${fmt.persen(c.persen)}</td></tr>`).join('')}</table>`).join('')}
        <table style="margin-top:40px;border:0"><tr>${['Ketua Panitia', 'Pembina OSIS', 'Kepala Sekolah'].map(t => `<td style="border:0;text-align:center;padding-top:10px">${t}<br><br><br><br>(..............................)</td>`).join('')}</tr></table></div>`);
    });
  }

  // ================================================================== PENGATURAN
  const PRESET = [['Indigo Voting', '#1E1B5E', '#6366E8'], ['Biru Samudra', '#0B3B66', '#2F80ED'], ['Hijau Sekolah', '#0F4C3A', '#16A34A'], ['Merah Marun', '#6B1020', '#E11D48'], ['Jingga Semangat', '#7C2D12', '#F97316']];
  async function pengaturan(page) {
    const r = await EV.apiQ('settings.get');
    if (!r.success) return gagalMuat(page, r, () => pengaturan(page));
    let s = Object.assign({}, r.data.settings), logo = r.data.logo, pinAda = r.data.pinAda, tabPrev = 'login';
    const tersimpan = Object.assign({}, s);
    app().onCleanup(() => app().terapkanTema(Object.assign({}, state.cfg)));
    const pratinjau = () => {
      const cfg = { nama_aplikasi: s.nama_aplikasi || 'E-VOTE', nama_sekolah: s.nama_sekolah, judul_acara: s.judul_acara, warna_utama: s.warna_utama, warna_aksen: s.warna_aksen, logo };
      const root = document.documentElement.style;
      if (/^#[0-9a-f]{6}$/i.test(s.warna_utama)) root.setProperty('--c-primary', s.warna_utama);
      if (/^#[0-9a-f]{6}$/i.test(s.warna_aksen)) root.setProperty('--c-accent', s.warna_aksen);
      const lg = cfg.logo ? `<img src="${cfg.logo}" alt="">` : ic('vote');
      const isi = {
        login: `<div class="mini-login"><div class="ml-art"><div class="brand-logo blob" style="width:34px;height:34px;border-radius:12px;background:rgba(255,255,255,.18)">${lg}</div><div><b>${esc(cfg.nama_aplikasi)}</b><br><span>${esc(cfg.judul_acara)}</span></div></div><div class="ml-form"><div class="ml-input"></div><div class="ml-input"></div><div class="ml-btn"></div></div></div>`,
        kartu: `<div style="display:grid;place-items:center;padding:10px 0;overflow:hidden"><div style="transform:scale(1.15);transform-origin:center"><div class="ballot-card"><div class="bc-head"><div class="bc-logo">${lg}</div><div><div class="bc-app">${esc(cfg.nama_aplikasi)}</div><div class="bc-ev">${esc(cfg.judul_acara)}</div></div></div><div class="bc-body"><div><div class="bc-lbl">Kartu Suara</div><div class="bc-name">Ahmad Fauzi</div><div class="bc-kelas">Kelas XI MIPA 2</div></div><div><div class="bc-code">K7QX M3PA</div><div class="bc-note">Berlaku 1 kali • jangan dipinjamkan</div></div></div><div class="bc-qr">${window.qrcode ? EV.ui.qrSvg('K7QXM3PA') : ''}</div></div></div></div>`,
        calon: `<div class="prev-card"><span class="no-urut">01</span>${foto('', 120)}<div class="pc-name">Nama Calon</div><div class="muted">XI MIPA 2</div><span class="btn btn-sm btn-block">PILIH</span></div>`,
        monitor: `<div style="border-radius:18px;padding:16px;display:grid;gap:10px;background:${s.tema_monitor === 'terang' ? 'linear-gradient(180deg,var(--bg-top),#fff)' : 'radial-gradient(120% 100% at 50% 0%, color-mix(in srgb, var(--c-primary) 70%, var(--c-accent)), color-mix(in srgb, var(--c-primary) 45%, #000))'};border:1px solid var(--line)">
          <div class="row" style="color:${s.tema_monitor === 'terang' ? 'var(--c-primary)' : '#fff'}"><div class="brand-logo" style="width:30px;height:30px;border-radius:10px">${lg}</div><b style="font-family:var(--f-head);font-size:13px">${esc(cfg.nama_aplikasi)}</b><span class="pill pill-live" style="margin-left:auto;height:22px;font-size:10px"><span class="dot dot-pulse"></span>LIVE</span></div>
          <div class="prev-mon" style="box-shadow:inset 0 0 0 2px var(--gold)"><span class="pm-no" style="color:var(--gold)">01</span>${foto('', 42)}<div><div class="pm-name">Calon Unggul</div><div class="pm-sub">XI MIPA 2</div></div><span class="pm-val" style="color:var(--gold)">168</span></div>
          <div class="prev-mon"><span class="pm-no">02</span>${foto('', 42)}<div><div class="pm-name">Calon Lain</div><div class="pm-sub">XI IPS 1</div></div><span class="pm-val">96</span></div>
          <div class="xs" style="color:${s.tema_monitor === 'terang' ? 'var(--muted)' : 'rgba(255,255,255,.75)'}">${s.tata_letak_monitor === 'bergantian' ? 'Bergantian' : 'Berdampingan'} • ${s.jeda_monitor_menit !== '0' ? 'hasil tayang tiap ' + s.jeda_monitor_menit + ' menit' : 'diperbarui tiap ' + s.interval_monitor_detik + ' detik'}${s.sembunyikan_angka_sampai_tutup === 'ya' ? ' • angka disembunyikan' : ''}</div></div>`
      };
      $('#prev-isi', page).innerHTML = isi[tabPrev];
      const ku = EV.ui.kontras(s.warna_utama, '#FFFFFF'), ka = EV.ui.kontras(s.warna_aksen, '#FFFFFF');
      $('#kontras', page).innerHTML = ku < 4.5 || ka < 3 ? `<div class="alert alert-warn">${ic('peringatan')}<div><b>Kontras teks rendah.</b> ${ku < 4.5 ? 'Warna utama terlalu terang untuk teks putih (rasio ' + ku.toFixed(1) + ':1, minimal 4,5:1). ' : ''}${ka < 3 ? 'Warna aksen terlalu terang (rasio ' + ka.toFixed(1) + ':1, minimal 3:1).' : ''}</div></div>` : `<div class="small" style="color:var(--ok)">${ic('cekBulat', 'ic-sm')} Kontras warna memenuhi standar keterbacaan.</div>`;
      $$('.swatch', page).forEach(b => b.classList.toggle('on', b.dataset.u.toUpperCase() === String(s.warna_utama).toUpperCase() && b.dataset.a.toUpperCase() === String(s.warna_aksen).toUpperCase()));
    };
    const field = (k, label, maks, tipe) => `<div class="field"><label for="s-${k}">${label}</label>${tipe === 'area' ? `<textarea class="textarea" id="s-${k}" data-k="${k}" maxlength="${maks}" rows="2">${esc(s[k])}</textarea>` : `<input class="input" id="s-${k}" data-k="${k}" maxlength="${maks}" value="${esc(s[k])}">`}<div class="counter" data-c="${k}">${String(s[k] || '').length}/${maks}</div></div>`;
    const seg = (k, opsi) => `<div class="seg" data-seg="${k}">${opsi.map(o => `<button type="button" data-v="${o[0]}" class="${s[k] === o[0] ? 'on' : ''}">${o[1]}</button>`).join('')}</div>`;
    page.innerHTML = `
      ${kepala('Pengaturan', 'Identitas aplikasi, warna desain, tampilan monitor, dan bilik suara.')}
      <div class="grid g-60" style="align-items:start">
        <div class="card">
          <div class="form-section"><h3>${ic('sekolah')}Identitas</h3>
            ${field('nama_aplikasi', 'Nama Aplikasi', 40)}${field('nama_sekolah', 'Nama Sekolah', 60)}${field('judul_acara', 'Judul Acara', 80)}</div>
          <div class="form-section"><h3>${ic('gambar')}Logo</h3>
            <div class="row wrap" style="gap:18px"><div class="thumb" id="logo-thumb">${logo ? `<img src="${logo}" alt="Logo">` : ic('gambar', 'ic-xl')}</div>
              <div class="stack" style="flex:1;min-width:240px;gap:10px"><label class="drop" id="logo-drop"><input type="file" id="logo-file" accept="image/png,image/jpeg,image/webp"><div class="d-ic">${ic('unggah')}</div><div><div class="bold">Seret logo ke sini atau klik untuk memilih</div><div class="small muted">PNG/JPG/WEBP, maks 2 MB. Disarankan PNG persegi transparan.</div></div></label>
              <div class="btn-row"><button class="btn btn-ghost btn-sm" id="logo-hapus" ${logo ? '' : 'disabled'}>${ic('hapus')}Hapus Logo</button><span class="xs muted">Logo tersimpan langsung, dipakai di header, kartu suara, monitor, dan ikon tab.</span></div></div></div></div>
          <div class="form-section"><h3>${ic('palet')}Warna</h3>
            <div class="swatches">${PRESET.map(p => `<button type="button" class="swatch" data-u="${p[1]}" data-a="${p[2]}"><span class="sw" style="background:linear-gradient(135deg,${p[1]} 50%,${p[2]} 50%)"></span>${p[0]}</button>`).join('')}</div>
            <div class="form-grid">
              <div class="field"><label for="s-warna_utama">Warna Utama</label><div class="color-input"><input type="color" id="c-utama" value="${s.warna_utama}" aria-label="Pilih warna utama"><input class="input" id="s-warna_utama" data-k="warna_utama" value="${esc(s.warna_utama)}" maxlength="7"></div><span class="help">Judul, tombol, header kartu suara.</span></div>
              <div class="field"><label for="s-warna_aksen">Warna Aksen</label><div class="color-input"><input type="color" id="c-aksen" value="${s.warna_aksen}" aria-label="Pilih warna aksen"><input class="input" id="s-warna_aksen" data-k="warna_aksen" value="${esc(s.warna_aksen)}" maxlength="7"></div><span class="help">Sorotan pilihan, cincin progres, latar.</span></div>
            </div><div id="kontras"></div></div>
          <div class="form-section"><h3>${ic('tv')}Tampilan Monitor</h3>
            <div class="form-grid"><div class="field"><span class="label">Tema</span>${seg('tema_monitor', [['gelap', ic('bulan') + 'Gelap'], ['terang', ic('matahari') + 'Terang']])}<span class="help">Gelap lebih kontras di proyektor.</span></div>
              <div class="field"><span class="label">Tata Letak</span>${seg('tata_letak_monitor', [['berdampingan', 'Berdampingan'], ['bergantian', 'Bergantian']])}</div>
              <div class="field"><label for="s-interval">Interval Pembaruan</label><select class="select" id="s-interval" data-k="interval_monitor_detik">${['5', '30', '60'].map(v => `<option value="${v}" ${s.interval_monitor_detik === v ? 'selected' : ''}>${v} detik</option>`).join('')}</select><span class="help">Seberapa sering monitor mengecek status (buka, jeda, tutup).</span></div>
              <div class="field"><span class="label">Angka Hasil</span><label class="switch" style="margin-top:8px"><input type="checkbox" id="s-sembunyi" ${s.sembunyikan_angka_sampai_tutup === 'ya' ? 'checked' : ''}><span class="track"></span>Sembunyikan sampai ditutup</label></div>
              <div class="field"><label for="s-jeda">Jeda Tayang Hasil</label><select class="select" id="s-jeda" data-k="jeda_monitor_menit">${[['0', 'Langsung (tanpa jeda)'], ['1', '1 menit'], ['2', '2 menit'], ['3', '3 menit'], ['5', '5 menit'], ['10', '10 menit']].map(v => `<option value="${v[0]}" ${s.jeda_monitor_menit === v[0] ? 'selected' : ''}>${v[1]}</option>`).join('')}</select><span class="help">Selama pemungutan, angka di monitor hanya berubah tiap jeda ini — pilihan orang yang baru keluar bilik tidak bisa ditebak. Admin tetap melihat angka terkini.</span></div>
              <div class="field"><label for="s-minsuara">Minimal Suara Baru per Pembaruan</label><select class="select" id="s-minsuara" data-k="jeda_monitor_min_suara">${['1', '2', '3', '5', '10'].map(v => `<option value="${v}" ${s.jeda_monitor_min_suara === v ? 'selected' : ''}>${v} suara</option>`).join('')}</select><span class="help">Monitor menunggu sampai suara baru terkumpul sebanyak ini, jadi satu suara tidak pernah tampil sendirian.</span></div>
              <div class="full">${field('teks_berjalan_monitor', 'Teks Berjalan', 200, 'area')}</div></div></div>
          <div class="form-section"><h3>${ic('vote')}Bilik Suara</h3>
            <div class="form-grid"><div class="field"><span class="label">Bunyi</span><label class="switch" style="margin-top:8px"><input type="checkbox" id="s-bip" ${s.bunyi_bip_bilik === 'ya' ? 'checked' : ''}><span class="track"></span>Bunyi bip saat kartu dipindai</label></div>
              <div class="field"><label for="s-idle">Batas Diam (detik)</label><input class="input" type="number" min="30" max="180" id="s-idle" data-k="batas_idle_bilik_detik" value="${esc(s.batas_idle_bilik_detik)}"><span class="help">Sesi memilih dibatalkan bila tidak ada sentuhan.</span></div>
              <div class="field full"><span class="label">Setelah Keluar Mode Bilik / Monitor</span>${seg('keluar_perangkat', [['dasbor', ic('dasbor') + 'Kembali ke Dasbor'], ['login', ic('kunci') + 'Ke Halaman Login']])}<span class="help">Keluar selalu memerlukan PIN petugas. Pilih <b>Ke Halaman Login</b> bila PIN juga dipegang petugas yang bukan admin.</span></div></div>
            <div class="card card-tint" style="padding:16px"><div class="row between wrap"><div><div class="bold">${ic('kunci', 'ic-sm')} PIN Petugas</div><div class="small muted">${pinAda ? 'PIN sudah diatur. Isi di bawah untuk menggantinya.' : 'PIN belum diatur — wajib sebelum Mode Bilik.'}</div></div></div>
              <div class="row wrap" style="margin-top:12px"><input class="input" type="password" id="pin" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="6 digit baru" style="max-width:200px" aria-label="PIN petugas baru"><button class="btn btn-outline" id="simpan-pin" data-loading="Menyimpan…">${ic('cek')}Simpan PIN</button></div></div></div>
          <div class="sticky-bar"><button class="btn btn-ghost" id="bawaan">${ic('ulang')}Kembalikan ke Bawaan</button><button class="btn btn-lg" id="simpan" data-loading="Menyimpan…">${ic('cek')}Simpan Perubahan</button></div>
        </div>
        <div class="sticky-col"><div class="card">
          <div class="card-head"><h3>${ic('mata')}Pratinjau Langsung</h3></div>
          <div class="seg" style="margin-bottom:16px">${[['login', 'Login'], ['kartu', 'Kartu Suara'], ['calon', 'Kartu Calon'], ['monitor', 'Monitor']].map(t => `<button data-prev="${t[0]}" class="${t[0] === tabPrev ? 'on' : ''}">${t[1]}</button>`).join('')}</div>
          <div id="prev-isi"></div></div></div>
      </div>`;
    EV.ui.LIB.qr().then(() => { if (tabPrev === 'kartu') pratinjau(); }).catch(() => {});
    $$('[data-k]', page).forEach(el => el.addEventListener('input', () => {
      s[el.dataset.k] = el.value;
      const c = $(`[data-c="${el.dataset.k}"]`, page); if (c) c.textContent = el.value.length + '/' + el.maxLength;
      if (el.dataset.k === 'warna_utama' && /^#[0-9a-f]{6}$/i.test(el.value)) $('#c-utama', page).value = el.value;
      if (el.dataset.k === 'warna_aksen' && /^#[0-9a-f]{6}$/i.test(el.value)) $('#c-aksen', page).value = el.value;
      pratinjau();
    }));
    $('#c-utama', page).addEventListener('input', e => { s.warna_utama = e.target.value.toUpperCase(); $('#s-warna_utama', page).value = s.warna_utama; pratinjau(); });
    $('#c-aksen', page).addEventListener('input', e => { s.warna_aksen = e.target.value.toUpperCase(); $('#s-warna_aksen', page).value = s.warna_aksen; pratinjau(); });
    $$('.swatch', page).forEach(b => b.addEventListener('click', () => { s.warna_utama = b.dataset.u; s.warna_aksen = b.dataset.a; $('#s-warna_utama', page).value = b.dataset.u; $('#s-warna_aksen', page).value = b.dataset.a; $('#c-utama', page).value = b.dataset.u; $('#c-aksen', page).value = b.dataset.a; pratinjau(); }));
    $$('[data-seg]', page).forEach(g => $$('button', g).forEach(b => b.addEventListener('click', () => { s[g.dataset.seg] = b.dataset.v; $$('button', g).forEach(x => x.classList.toggle('on', x === b)); pratinjau(); })));
    $('#s-sembunyi', page).addEventListener('change', e => { s.sembunyikan_angka_sampai_tutup = e.target.checked ? 'ya' : 'tidak'; pratinjau(); });
    $('#s-bip', page).addEventListener('change', e => { s.bunyi_bip_bilik = e.target.checked ? 'ya' : 'tidak'; });
    $$('[data-prev]', page).forEach(b => b.addEventListener('click', () => { tabPrev = b.dataset.prev; $$('[data-prev]', page).forEach(x => x.classList.toggle('on', x === b)); pratinjau(); }));
    const unggahLogo = async file => {
      try {
        const data = await EV.ui.perkecilLogo(file);
        $('#logo-thumb', page).innerHTML = `<img src="${data}" alt="Logo baru"><span class="spin"></span>`;
        const x = await EV.api('settings.logo', { gambar: data });
        if (EV.ui.hasil(x)) { logo = x.data.logo; state.cfg.logo = logo; EV.simpan.set(EV.KUNCI.cfg, state.cfg); app().terapkanTema(state.cfg); $$('.brand-logo').forEach(el => { el.innerHTML = `<img src="${logo}" alt="">`; }); $('#logo-hapus', page).disabled = false; }
        $('#logo-thumb', page).innerHTML = logo ? `<img src="${logo}" alt="Logo">` : ic('gambar', 'ic-xl');
        pratinjau();
      } catch (e) { toast(e.message, 'bad'); }
    };
    $('#logo-file', page).addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) unggahLogo(f); });
    const drop = $('#logo-drop', page);
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) unggahLogo(f); });
    $('#logo-hapus', page).addEventListener('click', async () => {
      const ok = await konfirmasi({ title: 'Hapus logo?', message: 'Logo bawaan (ikon kotak suara) akan dipakai kembali.', ok: 'Hapus Logo', icon: false });
      if (!ok) return;
      const x = await EV.api('settings.logo', { hapus: true });
      if (EV.ui.hasil(x)) { logo = ''; state.cfg.logo = ''; EV.simpan.set(EV.KUNCI.cfg, state.cfg); app().terapkanTema(state.cfg); $('#logo-thumb', page).innerHTML = ic('gambar', 'ic-xl'); $$('.sidebar .brand-logo').forEach(el => { el.innerHTML = ic('vote'); }); $('#logo-hapus', page).disabled = true; pratinjau(); }
    });
    $('#simpan-pin', page).addEventListener('click', e => {
      const pin = $('#pin', page).value.trim();
      if (!/^\d{6}$/.test(pin)) return toast('PIN harus 6 digit angka.', 'warn');
      sibuk(e.currentTarget, async () => { const x = await EV.api('settings.pin', { pin }); if (EV.ui.hasil(x)) { $('#pin', page).value = ''; pinAda = true; } });
    });
    $('#bawaan', page).addEventListener('click', () => {
      Object.assign(s, { warna_utama: '#1E1B5E', warna_aksen: '#6366E8', tema_monitor: 'gelap', tata_letak_monitor: 'berdampingan', interval_monitor_detik: '5', sembunyikan_angka_sampai_tutup: 'tidak', bunyi_bip_bilik: 'ya', batas_idle_bilik_detik: '60', jeda_monitor_menit: '3', jeda_monitor_min_suara: '3', keluar_perangkat: 'dasbor' });
      toast('Nilai bawaan dimuat. Klik "Simpan Perubahan" untuk menyimpan.', 'info');
      pengaturanIsiUlang();
    });
    const pengaturanIsiUlang = () => {
      ['warna_utama', 'warna_aksen'].forEach(k => { $('#s-' + k, page).value = s[k]; });
      $('#c-utama', page).value = s.warna_utama; $('#c-aksen', page).value = s.warna_aksen;
      $('#s-interval', page).value = s.interval_monitor_detik; $('#s-idle', page).value = s.batas_idle_bilik_detik;
      $('#s-jeda', page).value = s.jeda_monitor_menit; $('#s-minsuara', page).value = s.jeda_monitor_min_suara;
      $('#s-sembunyi', page).checked = s.sembunyikan_angka_sampai_tutup === 'ya'; $('#s-bip', page).checked = s.bunyi_bip_bilik === 'ya';
      $$('[data-seg]', page).forEach(g => $$('button', g).forEach(x => x.classList.toggle('on', x.dataset.v === s[g.dataset.seg])));
      pratinjau();
    };
    $('#simpan', page).addEventListener('click', e => sibuk(e.currentTarget, async () => {
      const ubah = {};
      Object.keys(s).forEach(k => { if (String(s[k]) !== String(tersimpan[k])) ubah[k] = s[k]; });
      if (!Object.keys(ubah).length) return toast('Tidak ada perubahan.', 'info');
      const x = await EV.api('settings.save', { settings: ubah });
      if (!EV.ui.hasil(x)) return;
      Object.assign(tersimpan, x.data.settings); Object.assign(s, x.data.settings);
      Object.assign(state.cfg, { nama_aplikasi: s.nama_aplikasi, nama_sekolah: s.nama_sekolah, judul_acara: s.judul_acara, warna_utama: s.warna_utama, warna_aksen: s.warna_aksen });
      EV.simpan.set(EV.KUNCI.cfg, state.cfg);
      app().terapkanTema(state.cfg);
      $$('.sidebar .brand-text b').forEach(el => { el.textContent = s.nama_aplikasi; });
      $$('.sidebar .brand-text span').forEach(el => { el.textContent = s.nama_sekolah; });
    }));
    pratinjau();
  }

  // ================================================================== LOG
  async function log(page) {
    let f = { halaman: 1, aksi: '', pengguna: '', q: '', dari: '', sampai: '' };
    const muat = async () => {
      const body = { halaman: f.halaman, aksi: f.aksi, pengguna: f.pengguna, q: f.q, dari: f.dari ? new Date(f.dari + 'T00:00').getTime() : 0, sampai: f.sampai ? new Date(f.sampai + 'T23:59:59').getTime() : 0 };
      const r = await EV.api('log.list', body);
      if (!r.success) return gagalMuat(page, r, muat);
      render(r.data);
    };
    const kelas = a => /GAGAL|SALAH|NONAKTIF/.test(a) ? 'pill-bad' : /RESET|HAPUS|TUTUP|JEDA/.test(a) ? 'pill-warn' : /SUARA/.test(a) ? 'pill-ok' : /LOGIN|MODE/.test(a) ? 'pill-info' : '';
    const render = d => {
      page.innerHTML = `
        ${kepala('Log Aktivitas', 'Catatan seluruh tindakan panitia dan sistem.')}
        <div class="alert" style="margin-bottom:18px">${ic('gembok')}<div>Log tidak dapat diubah atau dihapus dari aplikasi. Pilihan pemilih <b>tidak pernah</b> dicatat.</div></div>
        <div class="toolbar">
          <input class="input" type="date" id="l-dari" value="${f.dari}" style="width:auto" aria-label="Dari tanggal"><span class="muted">s/d</span><input class="input" type="date" id="l-sampai" value="${f.sampai}" style="width:auto" aria-label="Sampai tanggal">
          <select class="select" id="l-peng" aria-label="Filter pengguna"><option value="">Semua pengguna</option>${d.opsi.pengguna.map(x => `<option ${f.pengguna === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
          <select class="select" id="l-aksi" aria-label="Filter jenis aksi"><option value="">Semua aksi</option>${d.opsi.aksi.map(x => `<option value="${esc(x)}" ${f.aksi === x ? 'selected' : ''}>${esc(labelAksi(x))}</option>`).join('')}</select>
          <div class="input-wrap has-lead">${ic('cari', 'ic-lead')}<input class="input" id="l-q" placeholder="Cari detail" value="${esc(f.q)}" aria-label="Cari log"></div>
        </div>
        ${d.log.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Detail</th></tr></thead>
          <tbody>${d.log.map(l => `<tr><td class="num small" style="white-space:nowrap">${fmt.tglPendek(l.waktu)} ${l.waktu ? fmt.jamDetik(l.waktu) : ''}</td><td>${esc(l.pengguna)}</td><td><span class="pill ${kelas(l.aksi)}">${esc(labelAksi(l.aksi))}</span></td><td class="small">${esc(l.detail)}</td></tr>`).join('')}</tbody></table></div>
          ${paginasi(d.total, d.halaman, d.perHalaman)}` : `<div class="card"><div class="empty"><div class="e-ic">${ic('log', 'ic-xl')}</div><h3>Tidak ada log</h3><p>Belum ada aktivitas yang cocok dengan filter.</p></div></div>`}`;
      const ubah = (k, v) => { f[k] = v; f.halaman = 1; muat(); };
      $('#l-dari', page).addEventListener('change', e => ubah('dari', e.target.value));
      $('#l-sampai', page).addEventListener('change', e => ubah('sampai', e.target.value));
      $('#l-peng', page).addEventListener('change', e => ubah('pengguna', e.target.value));
      $('#l-aksi', page).addEventListener('change', e => ubah('aksi', e.target.value));
      $('#l-q', page).addEventListener('change', e => ubah('q', e.target.value.trim()));
      $$('[data-hal]', page).forEach(b => b.addEventListener('click', () => { f.halaman = Number(b.dataset.hal); muat(); }));
    };
    await muat();
  }

  EV.admin = { dasbor, pemilihan, calon, akun, pemilih, cetak, hasil, pengaturan, log };
  EV.adminUtil = { kepala, gagalMuat, cetakHtml, labelAksi };
})();
