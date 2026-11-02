/* ============================================================================
   E-VOTE SMAPATISPA — Portal Pencalon: beranda, formulir pencalonan, ganti sandi
   ============================================================================ */
(function () {
  'use strict';
  const EV = window.EV;
  const { esc, ic, $, $$, fmt, toast, sibuk, foto, pillCalon, konfirmasi } = EV.ui;

  const LANGKAH = ['Isi Data', 'Diajukan', 'Diverifikasi', 'Disetujui'];
  function posisi(c) {
    if (!c || c.status === 'Draf') return 0;
    if (c.status === 'Menunggu Verifikasi') return 1;
    if (c.status === 'Perlu Perbaikan' || c.status === 'Ditolak') return 2;
    return 4;
  }
  function stepper(c) {
    const i = posisi(c);
    return `<div class="stepper" style="margin:18px 0 6px">${LANGKAH.map((s, j) => `${j ? `<div class="step-line ${j < i ? 'done' : ''}"></div>` : ''}<div class="step ${j < i ? 'done' : j === i ? 'now' : ''}"><span class="s-dot">${j < i ? ic('cek', 'ic-sm') : j + 1}</span><span class="lbl">${s}</span></div>`).join('')}</div>`;
  }
  function kartuPratinjau(c, fotoSrc) {
    return `<div class="prev-card">${c && c.nomor && c.status === 'Disetujui' ? `<span class="no-urut">${String(c.nomor).padStart(2, '0')}</span>` : ''}
      ${foto(fotoSrc !== undefined ? fotoSrc : (c && c.foto), 132, c && c.nama)}
      <div class="pc-name">${esc((c && c.nama) || 'Nama Anda')}</div><div class="muted">${esc((c && c.kelas) || 'Kelas')}</div>
      <span class="btn btn-outline btn-sm">${ic('buku', 'ic-sm')}Visi & Misi</span><span class="btn btn-block">PILIH</span></div>`;
  }
  function gagal(page, r, ulang) {
    page.innerHTML = `<div class="card"><div class="empty"><div class="e-ic">${ic('wifiOff', 'ic-xl')}</div><h3>Data belum bisa dimuat</h3><p>${esc(r.message || '')}</p><button class="btn" id="ulang">${ic('segarkan')}Coba Lagi</button></div></div>`;
    $('#ulang', page).addEventListener('click', ulang);
  }

  // ------------------------------------------------------------------ BERANDA
  async function beranda(page) {
    const r = await EV.api('pencalon.get');
    if (!r.success) return gagal(page, r, () => beranda(page));
    const d = r.data, c = d.calon, me = EV.Sesi.get().me, st = d.status;
    const pem = c ? (d.pemilihan.find(p => p.id === c.idPemilihan) || { nama: c.idPemilihan }).nama : '';
    const pesan = !c ? ['info', 'Anda belum mengisi data pencalonan. Lengkapi nama, kelas, visi, misi, dan foto, lalu ajukan untuk diverifikasi panitia.', 'Isi Data Pencalonan']
      : c.status === 'Draf' ? ['info', 'Data masih berupa draf. Periksa kembali lalu klik "Ajukan untuk Verifikasi".', 'Lanjutkan Mengisi']
        : c.status === 'Menunggu Verifikasi' ? ['info', 'Data Anda sedang diperiksa panitia. Anda masih bisa memperbaikinya sebelum disetujui.', 'Lihat Data']
          : c.status === 'Perlu Perbaikan' ? ['warn', 'Panitia meminta perbaikan data. Baca catatan di bawah, perbaiki, lalu ajukan ulang.', 'Perbaiki Data']
            : c.status === 'Ditolak' ? ['bad', 'Pencalonan Anda tidak disetujui. Hubungi panitia untuk informasi lebih lanjut.', 'Lihat Data']
              : ['ok', 'Selamat! Pencalonan Anda disetujui dengan nomor urut ' + String(c.nomor).padStart(2, '0') + '. Data Anda kini terkunci.', 'Lihat Data'];
    page.innerHTML = `
      <div class="hero-card"><div style="position:relative;z-index:1"><span class="pill" style="background:rgba(255,255,255,.16);color:#fff">${ic('userCek')}${c ? 'Calon ' + esc(pem) : 'Pencalon'}</span>
        <h2 style="margin-top:12px">Halo, ${esc(me.nama.split(' ')[0])}!</h2><p>${esc(EV.state.cfg.judul_acara)}</p></div></div>
      <div class="grid g-60" style="margin-top:20px;align-items:start">
        <div class="stack" style="gap:20px">
          <div class="card">
            <div class="card-head"><h3>${ic('sinyal')}Status Pencalonan</h3>${c ? pillCalon(c.status) : '<span class="pill">Belum mengisi</span>'}</div>
            ${stepper(c)}
            <div class="alert alert-${pesan[0] === 'info' ? '' : pesan[0]}" style="margin-top:16px">${ic(pesan[0] === 'ok' ? 'cekBulat' : pesan[0] === 'bad' ? 'xBulat' : pesan[0] === 'warn' ? 'peringatan' : 'info')}<div>${pesan[1]}</div></div>
            ${c && c.catatan && (c.status === 'Perlu Perbaikan' || c.status === 'Ditolak') ? `<div class="card card-tint" style="margin-top:14px;padding:16px"><div class="label">Catatan panitia</div><p style="margin-top:4px;font-weight:600">${esc(c.catatan)}</p></div>` : ''}
            ${d.dikunci && (!c || c.status !== 'Disetujui') ? `<div class="alert alert-warn" style="margin-top:14px">${ic('gembok')}<div>${esc(d.dikunci)}</div></div>` : ''}
            <div class="btn-row" style="margin-top:18px"><a class="btn btn-lg" href="#/pencalon/data">${ic(c && c.status === 'Perlu Perbaikan' ? 'edit' : 'file')}${pesan[2]}</a></div>
          </div>
          <div class="grid g-2">
            <div class="card"><div class="card-head"><h3>${ic('kalender')}Jadwal Pemungutan</h3></div>
              ${st.mulai ? `<div class="bold">${fmt.tanggal(st.mulai)}</div><div class="num" style="font-size:24px;font-weight:800;margin-top:4px">${fmt.jam(st.mulai)}–${st.selesai ? fmt.jam(st.selesai) : '…'}</div>` : '<p class="muted">Jadwal akan diumumkan panitia.</p>'}
              <div style="margin-top:12px">${EV.ui.pillStatus(st.status)}</div></div>
            <div class="card"><div class="card-head"><h3>${ic('grafik')}Hasil</h3></div>
              ${d.hasil ? '' : `<p class="muted">Hasil akan tampil di sini setelah pemungutan ditutup. Saksikan perkembangan langsung di monitor sekolah.</p>`}
              ${d.hasil ? `<p class="small muted">Pemungutan telah ditutup.</p>` : ''}</div>
          </div>
          ${d.hasil ? `<div class="card"><div class="card-head"><h3>${ic('award')}Hasil Akhir</h3><span class="pill">${fmt.angka(d.hasil.suaraMasuk)} suara</span></div>
            ${d.hasil.pemilihan.map(p => `<h4 style="margin:10px 0">${esc(p.nama)}</h4><div class="bars">${p.calon.map(x => { const maks = Math.max(1, ...p.calon.map(y => y.suara)); return `<div class="bar-row"><div class="b-who"><div style="min-width:0"><div class="nm">${p.unggul === x.id ? ic('mahkota', 'ic-sm') + ' ' : ''}No. ${x.nomor} · ${esc(x.nama)}</div><div class="kl">${esc(x.kelas)}</div></div></div><div class="bar-track"><div class="bar-fill ${p.unggul === x.id ? 'gold' : ''}" style="width:${x.suara / maks * 100}%"></div></div><div class="b-val"><b>${fmt.angka(x.suara)}</b> · ${fmt.persen(x.persen)}</div></div>`; }).join('')}</div>`).join('')}</div>` : ''}
        </div>
        <div class="card sticky-col"><div class="card-head"><h3>${ic('kartu')}Kartu Calon Anda</h3></div>
          ${kartuPratinjau(c)}<p class="xs muted center" style="margin-top:14px">Beginilah tampilan Anda di layar bilik suara.</p></div>
      </div>`;
  }

  // ------------------------------------------------------------------ FORMULIR PENCALONAN
  async function data(page) {
    const r = await EV.api('pencalon.get');
    if (!r.success) return gagal(page, r, () => data(page));
    const d = r.data, c = d.calon || {};
    const terkunci = !!d.dikunci || c.terkunci || c.status === 'Disetujui' || c.status === 'Ditolak';
    let fotoBaru = null;
    const isian = { idPemilihan: c.idPemilihan || (d.pemilihan[0] || {}).id, nama: c.nama || EV.Sesi.get().me.nama, kelas: c.kelas || '', visi: c.visi || '', misi: c.misi || '' };
    const pemNama = id => (d.pemilihan.find(p => p.id === id) || { nama: id }).nama;
    page.innerHTML = `
      <div class="page-head"><div><a class="link-btn small" href="#/pencalon/beranda">${ic('panahKiri', 'ic-sm')}Kembali</a><h2 style="margin-top:6px">Data Pencalonan</h2><p>Lengkapi data berikut. Panitia akan memeriksa sebelum Anda tampil di surat suara.</p></div>${d.calon ? pillCalon(c.status) : ''}</div>
      ${terkunci ? `<div class="alert alert-warn" style="margin-bottom:18px">${ic('gembok')}<div>${c.status === 'Disetujui' ? 'Data sudah disetujui dan dikunci. Hubungi panitia untuk perubahan.' : c.status === 'Ditolak' ? 'Pencalonan ditolak. Hubungi panitia untuk informasi lebih lanjut.' : esc(d.dikunci || 'Data terkunci.')}</div></div>` : ''}
      ${c.status === 'Perlu Perbaikan' && c.catatan ? `<div class="alert alert-warn" style="margin-bottom:18px">${ic('info')}<div><b>Catatan panitia:</b> ${esc(c.catatan)}</div></div>` : ''}
      <div class="card" style="margin-bottom:20px">${stepper(d.calon)}</div>
      <div class="grid g-60" style="align-items:start">
        <form class="card" id="f-calon" novalidate>
          <fieldset ${terkunci ? 'disabled' : ''} style="border:0;padding:0;margin:0;min-width:0">
          <div class="form-section"><h3>${ic('award')}Jenis Pemilihan</h3>
            <div class="radio-cards">${d.pemilihan.map(p => `<label class="radio-card"><input type="radio" name="pem" value="${esc(p.id)}" ${p.id === isian.idPemilihan ? 'checked' : ''}><span class="rc-dot"></span><div><div class="bold">${esc(p.nama)}</div><div class="xs muted">Calon ${esc(p.nama)}</div></div></label>`).join('')}</div></div>
          <div class="form-section"><h3>${ic('user')}Data Diri</h3>
            <div class="form-grid"><div class="field"><label for="c-nama">Nama Lengkap</label><input class="input" id="c-nama" data-k="nama" maxlength="60" value="${esc(isian.nama)}"></div>
              <div class="field"><label for="c-kelas">Kelas</label><input class="input" id="c-kelas" data-k="kelas" maxlength="20" placeholder="XI MIPA 2" value="${esc(isian.kelas)}"></div></div></div>
          <div class="form-section"><h3>${ic('bintang')}Visi</h3>
            <div class="field"><label for="c-visi" class="sr-only">Visi</label><textarea class="textarea" id="c-visi" data-k="visi" maxlength="300" rows="3" placeholder="Satu kalimat cita-cita Anda untuk sekolah.">${esc(isian.visi)}</textarea><div class="counter" data-c="visi"></div></div></div>
          <div class="form-section"><h3>${ic('buku')}Misi</h3>
            <div class="field"><label for="c-misi" class="sr-only">Misi</label><textarea class="textarea" id="c-misi" data-k="misi" maxlength="1000" rows="6" placeholder="Satu poin per baris, contoh:&#10;Mengadakan lomba kreativitas tiap semester&#10;Membuka kotak aspirasi digital">${esc(isian.misi)}</textarea><div class="counter" data-c="misi"></div><span class="help">Tulis satu poin misi per baris.</span></div></div>
          <div class="form-section"><h3>${ic('kamera')}Foto</h3>
            <div class="row wrap" style="gap:18px"><div id="c-foto">${foto(c.foto, 110, c.nama)}</div>
              <label class="drop" style="flex:1;min-width:240px"><input type="file" id="c-file" accept="image/png,image/jpeg,image/webp"><div class="d-ic">${ic('unggah')}</div><div><div class="bold">${c.foto ? 'Ganti foto' : 'Unggah foto'}</div><div class="small muted">Foto berseragam, wajah jelas. JPG/PNG/WEBP maks 5 MB.</div></div></label></div></div>
          </fieldset>
          ${terkunci ? '' : `<div class="sticky-bar"><button type="button" class="btn btn-outline btn-lg" id="c-draf" data-loading="Menyimpan…">${ic('file')}Simpan Draf</button><button type="button" class="btn btn-lg" id="c-ajukan" data-loading="Mengajukan…">${ic('panahKanan')}Ajukan untuk Verifikasi</button></div>`}
        </form>
        <div class="sticky-col stack" style="gap:20px">
          <div class="card"><div class="card-head"><h3>${ic('vote')}Pratinjau di Bilik Suara</h3></div><div id="prev-bilik"></div></div>
          <div class="card"><div class="card-head"><h3>${ic('tv')}Pratinjau di Monitor</h3></div><div id="prev-mon"></div></div>
        </div>
      </div>`;
    const prev = () => {
      const pc = { nama: isian.nama, kelas: isian.kelas, nomor: c.nomor, status: c.status };
      $('#prev-bilik', page).innerHTML = kartuPratinjau(pc, fotoBaru || c.foto || '');
      $('#prev-mon', page).innerHTML = `<div class="prev-mon"><span class="pm-no">${c.nomor && c.status === 'Disetujui' ? String(c.nomor).padStart(2, '0') : '—'}</span>${foto(fotoBaru || c.foto || '', 48)}<div style="min-width:0"><div class="pm-name">${esc(isian.nama || 'Nama Anda')}</div><div class="pm-sub">${esc(isian.kelas || 'Kelas')} · ${esc(pemNama(isian.idPemilihan))}</div></div><span class="pm-val">0</span></div>`;
    };
    $$('[data-k]', page).forEach(el => {
      const up = () => { isian[el.dataset.k] = el.value; const cn = $(`[data-c="${el.dataset.k}"]`, page); if (cn) { cn.textContent = el.value.length + '/' + el.maxLength; cn.classList.toggle('over', el.value.length > el.maxLength); } prev(); };
      el.addEventListener('input', up); up();
    });
    $$('input[name=pem]', page).forEach(x => x.addEventListener('change', () => { isian.idPemilihan = x.value; prev(); }));
    const file = $('#c-file', page);
    if (file) file.addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const hasil = await EV.ui.potongFoto(f); if (hasil) { fotoBaru = hasil; $('#c-foto', page).innerHTML = foto(hasil, 110); prev(); } });
    const kirim = async (ajukan, btn) => {
      if (ajukan) {
        const kurang = [];
        if (!isian.nama.trim()) kurang.push('nama'); if (!isian.kelas.trim()) kurang.push('kelas'); if (!isian.visi.trim()) kurang.push('visi'); if (!isian.misi.trim()) kurang.push('misi'); if (!fotoBaru && !c.foto) kurang.push('foto');
        if (kurang.length) return toast('Lengkapi: ' + kurang.join(', ') + '.', 'warn');
        const ok = await konfirmasi({ title: 'Ajukan data pencalonan?', message: 'Panitia akan memeriksa data Anda. Anda masih bisa mengubahnya sampai disetujui.', ok: 'Ajukan', icon: false });
        if (!ok) return;
      }
      await sibuk(btn, async () => {
        const x = await EV.api('pencalon.save', Object.assign({}, isian, { foto: fotoBaru || '', ajukan }));
        if (EV.ui.hasil(x)) { if (ajukan) EV.app.pergi('pencalon/beranda'); else { Object.assign(c, x.data.calon); fotoBaru = null; } }
      });
    };
    const draf = $('#c-draf', page), aj = $('#c-ajukan', page);
    if (draf) draf.addEventListener('click', e => kirim(false, e.currentTarget));
    if (aj) aj.addEventListener('click', e => kirim(true, e.currentTarget));
    prev();
  }

  // ------------------------------------------------------------------ GANTI SANDI
  function sandi(page) {
    page.innerHTML = `<div class="page-head"><div><h2>Ganti Kata Sandi</h2><p>Gunakan kata sandi yang mudah Anda ingat namun sulit ditebak orang lain.</p></div></div>
      <div class="card" style="max-width:520px">${EV.app.formSandiHtml(false)}</div>`;
    EV.app.pasangFormSandi(page, () => { $('#f-sandi', page).reset(); });
  }

  EV.pencalon = { beranda, data, sandi };
})();
