/* ============================================================================
   E-VOTE SMAPATISPA — Impor data pemilih & migrasi dari spreadsheet lain
   Semua impor: pratinjau (dry-run) dulu → jalankan. Aman diulang (tanpa data ganda).
   ============================================================================ */
(function () {
  'use strict';
  const EV = window.EV;
  const { esc, ic, $, $$, fmt, toast, sibuk, konfirmasi } = EV.ui;

  const SINONIM = {
    nama: ['nama', 'nama siswa', 'nama_siswa', 'nama lengkap', 'nama_lengkap', 'name', 'nama pemilih', 'nama guru'],
    kelas: ['kelas', 'rombel', 'kelas/rombel', 'class', 'rombongan belajar'],
    nomor_induk: ['nomor_induk', 'nomor induk', 'nis', 'nisn', 'nip', 'no induk', 'no. induk', 'nuptk'],
    jenis: ['jenis', 'jenis pemilih', 'status', 'peran', 'kategori']
  };
  const LABEL = { nama: 'Nama', kelas: 'Kelas', nomor_induk: 'NIS/NIP', jenis: 'Jenis' };

  function parseCsv(teks) {
    teks = String(teks || '').replace(/^﻿/, '');
    const baris1 = teks.split(/\r?\n/)[0] || '';
    const pemisah = ['\t', ';', ','].map(p => [p, baris1.split(p).length]).sort((a, b) => b[1] - a[1])[0][0];
    const out = []; let row = [], sel = '', kutip = false;
    for (let i = 0; i < teks.length; i++) {
      const c = teks[i];
      if (kutip) {
        if (c === '"' && teks[i + 1] === '"') { sel += '"'; i++; }
        else if (c === '"') kutip = false;
        else sel += c;
      } else if (c === '"') kutip = true;
      else if (c === pemisah) { row.push(sel); sel = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && teks[i + 1] === '\n') i++; row.push(sel); out.push(row); row = []; sel = ''; }
      else sel += c;
    }
    if (sel !== '' || row.length) { row.push(sel); out.push(row); }
    return out.filter(r => r.some(x => String(x).trim() !== ''));
  }
  function petakan(baris) {
    if (!baris.length) return { rows: [], peta: {}, adaHeader: false };
    const head = baris[0].map(h => String(h).trim().toLowerCase());
    const peta = {};
    Object.keys(SINONIM).forEach(f => { const i = head.findIndex(h => SINONIM[f].includes(h)); if (i > -1) peta[f] = i; });
    let adaHeader = peta.nama !== undefined, data = baris.slice(1);
    if (!adaHeader) { data = baris; ['nama', 'kelas', 'nomor_induk', 'jenis'].forEach((f, i) => { if (baris[0].length > i) peta[f] = i; }); }
    const rows = data.map((r, i) => ({
      _baris: i + (adaHeader ? 2 : 1),
      nama: peta.nama !== undefined ? String(r[peta.nama] || '').trim() : '',
      kelas: peta.kelas !== undefined ? String(r[peta.kelas] || '').trim() : '',
      nomor_induk: peta.nomor_induk !== undefined ? String(r[peta.nomor_induk] || '').trim() : '',
      jenis: peta.jenis !== undefined ? String(r[peta.jenis] || '').trim() : ''
    }));
    return { rows, peta, adaHeader, judul: adaHeader ? baris[0] : null };
  }

  function kotakAngka(res) {
    return `<div class="grid g-4" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px">
      ${[['Di sumber', res.sumber, ''], ['Ditambah', res.ditambah, 'var(--ok)'], ['Diperbarui', res.diperbarui, 'var(--c-primary-2)'], ['Dilewati', res.dilewati, 'var(--muted)'], ['Bermasalah', (res.bermasalah || []).length, (res.bermasalah || []).length ? 'var(--bad)' : 'var(--muted)']]
        .map(x => `<div class="card card-flat stat" style="padding:14px"><span class="s-label">${x[0]}</span><span class="s-val" style="font-size:26px;color:${x[2] || 'var(--text)'}">${fmt.angka(x[1] || 0)}</span></div>`).join('')}</div>
      ${(res.bermasalah || []).length ? `<details style="margin-top:14px"><summary class="link-btn">Lihat ${res.bermasalah.length} baris bermasalah</summary>
        <div class="tbl-wrap" style="margin-top:10px;max-height:240px;overflow:auto"><table class="tbl"><thead><tr><th>Baris</th><th>Nama</th><th>Alasan</th></tr></thead><tbody>${res.bermasalah.slice(0, 100).map(b => `<tr><td class="num">${b.baris}</td><td>${esc(b.nama || '—')}</td><td>${esc(b.alasan)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}`;
  }

  EV.adminImpor = function (isi, selesai) {
    let metode = 'file', data = null;
    const render = () => {
      isi.innerHTML = `<div class="card">
        <div class="card-head"><h3>${ic('unggah')}Impor Data Pemilih</h3><span class="small muted">Aman diulang — data yang sama tidak akan dobel.</span></div>
        <div class="seg" style="margin-bottom:20px">
          <button data-m="file" class="${metode === 'file' ? 'on' : ''}">${ic('sheet')}File Excel / CSV</button>
          <button data-m="tempel" class="${metode === 'tempel' ? 'on' : ''}">${ic('tempel')}Tempel dari Spreadsheet</button>
          <button data-m="migrasi" class="${metode === 'migrasi' ? 'on' : ''}">${ic('database')}Google Sheets Lain (Migrasi)</button>
        </div>
        <div id="m-isi"></div></div>
        <div id="m-hasil" style="margin-top:20px"></div>`;
      $$('[data-m]', isi).forEach(b => b.addEventListener('click', () => { metode = b.dataset.m; data = null; render(); }));
      const box = $('#m-isi', isi);
      if (metode === 'file') {
        box.innerHTML = `<div class="grid g-2" style="align-items:center">
          <label class="drop" id="m-drop"><input type="file" id="m-file" accept=".xlsx,.xls,.csv,text/csv"><div class="d-ic">${ic('unggah')}</div><div><div class="bold">Seret file ke sini atau klik untuk memilih</div><div class="small muted">Excel (.xlsx) atau CSV. Baris pertama berisi judul kolom.</div></div></label>
          <div class="stack small"><div><b>Kolom yang dikenali:</b> Nama / Nama Siswa, Kelas / Rombel, NIS / NISN / NIP, Jenis (Siswa/Guru).</div><div class="muted">Guru boleh dikosongkan kelasnya — otomatis diisi "Guru".</div>
            <div><button class="btn btn-outline btn-sm" id="m-template">${ic('unduh')}Unduh Template</button></div></div></div>`;
        $('#m-template', box).addEventListener('click', () => EV.ui.unduhTeks('template-pemilih.csv', EV.ui.csv([['NIS', 'Nama', 'Kelas', 'Jenis'], ['0012345', 'Ahmad Fauzi', 'XI MIPA 2', 'Siswa'], ['0012346', 'Rina Agustina', 'XI MIPA 2', 'Siswa'], ['198703012010011001', 'Budi Santoso, S.Pd.', 'Guru', 'Guru']]), 'text/csv;charset=utf-8'));
        const baca = async file => {
          try {
            let baris;
            if (/\.csv$/i.test(file.name) || file.type === 'text/csv') baris = parseCsv(await file.text());
            else {
              const XLSX = await EV.ui.LIB.xlsx();
              const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
              baris = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
            }
            data = petakan(baris); data.sumber = file.name;
            pratinjauLokal();
          } catch (e) { toast('File tidak bisa dibaca: ' + e.message, 'bad'); }
        };
        $('#m-file', box).addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) baca(f); });
        const drop = $('#m-drop', box);
        ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
        ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
        drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) baca(f); });
      } else if (metode === 'tempel') {
        box.innerHTML = `<div class="field"><label for="m-teks">Salin baris dari Excel / Google Sheets (termasuk baris judul), lalu tempel di sini</label>
          <textarea class="textarea mono" id="m-teks" rows="8" placeholder="NIS&#9;Nama&#9;Kelas&#9;Jenis&#10;0012345&#9;Ahmad Fauzi&#9;XI MIPA 2&#9;Siswa"></textarea></div>
          <div class="btn-row end" style="margin-top:12px"><button class="btn" id="m-baca">${ic('cari')}Baca Data</button></div>`;
        $('#m-baca', box).addEventListener('click', () => { const t = $('#m-teks', box).value; if (!t.trim()) return toast('Tempel data terlebih dahulu.', 'warn'); data = petakan(parseCsv(t)); data.sumber = 'tempelan'; pratinjauLokal(); });
      } else {
        box.innerHTML = `<div class="alert" style="margin-bottom:18px">${ic('perisai')}<div>Spreadsheet sumber <b>hanya dibaca</b>, tidak pernah diubah. Gunakan spreadsheet milik akun Google yang sama dengan pemilik aplikasi (misalnya data siswa sekolah atau database E-VOTE tahun lalu).</div></div>
          <div class="form-stack">
            <div class="field"><label for="g-src">URL atau ID Google Sheets sumber</label><input class="input" id="g-src" placeholder="https://docs.google.com/spreadsheets/d/…/edit"></div>
            <div class="form-grid">
              <div class="field"><span class="label">Data yang diambil</span><div class="stack" style="gap:8px;margin-top:4px">
                <label class="check"><input type="checkbox" value="Pemilih" checked data-sh>Pemilih / data siswa & guru</label>
                <label class="check"><input type="checkbox" value="Calon" data-sh>Calon (dari database E-VOTE lama)</label>
                <label class="check"><input type="checkbox" value="Pengaturan" data-sh>Identitas & warna (dari E-VOTE lama)</label></div></div>
              <div class="field"><label for="g-sheet">Nama sheet data pemilih <span class="muted">(opsional)</span></label><input class="input" id="g-sheet" placeholder="Otomatis: Pemilih / Data Siswa / Siswa"><span class="help">Isi bila nama sheet di sumber berbeda.</span></div>
            </div>
            <div class="stack" style="gap:8px"><label class="check"><input type="checkbox" id="g-timpa">Perbarui data yang sudah ada (nama/kelas) bila berbeda</label>
              <label class="check"><input type="checkbox" id="g-kode">Pakai kode kartu lama (hanya bila kartu tahun lalu masih dipakai)</label></div>
            <div class="btn-row end"><button class="btn btn-outline" id="g-scan" data-loading="Memindai…">${ic('cari')}Pindai (Dry-run)</button><button class="btn" id="g-run" data-loading="Mengimpor…">${ic('play')}Jalankan Impor</button></div>
          </div>`;
        const kumpul = () => ({ source: $('#g-src', box).value.trim(), sheets: $$('[data-sh]:checked', box).map(c => c.value), sheetPemilih: $('#g-sheet', box).value.trim(), timpa: $('#g-timpa', box).checked, pakaiKodeLama: $('#g-kode', box).checked });
        $('#g-scan', box).addEventListener('click', e => { const b = kumpul(); if (!b.source) return toast('Tempel URL atau ID spreadsheet sumber.', 'warn'); sibuk(e.currentTarget, async () => { const r = await EV.api('migrasi.scan', b); if (EV.ui.hasil(r, false)) hasilMigrasi(r.data); }); });
        $('#g-run', box).addEventListener('click', async e => {
          const b = kumpul(); if (!b.source) return toast('Tempel URL atau ID spreadsheet sumber.', 'warn');
          const btn = e.currentTarget;
          const ok = await konfirmasi({ title: 'Jalankan impor?', message: 'Data baru ditambahkan ke database aplikasi. Data yang sudah ada tidak digandakan. Disarankan menjalankan <b>Pindai</b> lebih dulu.', ok: 'Jalankan Impor' });
          if (ok) sibuk(btn, async () => { const r = await EV.api('migrasi.run', b); if (EV.ui.hasil(r)) { hasilMigrasi(r.data); setTimeout(selesai, 2500); } });
        });
      }
    };
    const pratinjauLokal = () => {
      const h = $('#m-hasil', isi);
      if (!data.rows.length) { h.innerHTML = `<div class="alert alert-warn">${ic('peringatan')}<div>Tidak ada baris data yang terbaca.</div></div>`; return; }
      h.innerHTML = `<div class="card">
        <div class="card-head"><h3>${ic('mata')}Pratinjau — ${fmt.angka(data.rows.length)} baris</h3><span class="small muted">${esc(data.sumber)}</span></div>
        <div class="chips" style="margin-bottom:14px">${Object.keys(LABEL).map(f => `<span class="pill ${data.peta[f] !== undefined ? 'pill-ok' : ''}">${ic(data.peta[f] !== undefined ? 'cek' : 'minus')}${LABEL[f]}${data.peta[f] !== undefined && data.judul ? ' ← "' + esc(data.judul[data.peta[f]]) + '"' : data.peta[f] === undefined ? ' (tidak ada)' : ''}</span>`).join('')}</div>
        ${!data.adaHeader ? `<div class="alert alert-warn" style="margin-bottom:14px">${ic('info')}<div>Judul kolom tidak dikenali. Kolom dibaca berurutan: <b>Nama, Kelas, NIS, Jenis</b>.</div></div>` : ''}
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Baris</th><th>Nama</th><th>Kelas</th><th>NIS/NIP</th><th>Jenis</th></tr></thead><tbody>
          ${data.rows.slice(0, 8).map(r => `<tr><td class="num muted">${r._baris}</td><td>${esc(r.nama) || '<span class="pill pill-bad">kosong</span>'}</td><td>${esc(r.kelas) || '<span class="muted">—</span>'}</td><td class="mono">${esc(r.nomor_induk)}</td><td>${esc(r.jenis)}</td></tr>`).join('')}</tbody></table></div>
        ${data.rows.length > 8 ? `<p class="xs muted" style="margin-top:8px">… dan ${fmt.angka(data.rows.length - 8)} baris lainnya.</p>` : ''}
        <div class="row wrap between" style="margin-top:18px"><label class="check"><input type="checkbox" id="m-timpa">Perbarui data yang sudah ada bila berbeda</label>
          <div class="btn-row"><button class="btn btn-outline" id="m-dry" data-loading="Memeriksa…">${ic('cari')}Periksa di Server</button><button class="btn" id="m-run" data-loading="Mengimpor…">${ic('play')}Jalankan Impor</button></div></div>
        <div id="m-res" style="margin-top:18px"></div></div>`;
      const kirim = async (dry, btn) => sibuk(btn, async () => {
        const r = await EV.api('pemilih.import', { rows: data.rows, dryRun: dry, timpa: $('#m-timpa', h).checked });
        if (!EV.ui.hasil(r, dry ? false : undefined)) return;
        $('#m-res', h).innerHTML = `<div class="alert ${dry ? '' : 'alert-ok'}" style="margin-bottom:14px">${ic(dry ? 'info' : 'cekBulat')}<div>${esc(r.message)}</div></div>${kotakAngka(r.data)}`;
        if (!dry) setTimeout(selesai, 2200);
      });
      $('#m-dry', h).addEventListener('click', e => kirim(true, e.currentTarget));
      $('#m-run', h).addEventListener('click', async e => {
        const btn = e.currentTarget;
        const ok = await konfirmasi({ title: 'Impor ' + fmt.angka(data.rows.length) + ' baris?', message: 'Setiap pemilih baru otomatis mendapat kode kartu unik. Data yang sudah ada tidak digandakan.', ok: 'Jalankan Impor' });
        if (ok) kirim(false, btn);
      });
    };
    const hasilMigrasi = d => {
      const h = $('#m-hasil', isi);
      h.innerHTML = `<div class="card">
        <div class="card-head"><h3>${ic(d.dryRun ? 'cari' : 'cekBulat')}${d.dryRun ? 'Hasil Pemindaian (belum ditulis)' : 'Impor Selesai'}</h3><span class="small muted">${ic('sheet', 'ic-sm')} ${esc(d.source.nama)}</span></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th class="t-num">Di sumber</th><th class="t-num">Ditambah</th><th class="t-num">Diperbarui</th><th class="t-num">Dilewati</th><th class="t-num">Bermasalah</th></tr></thead>
          <tbody>${Object.keys(d.report).map(k => { const x = d.report[k]; return `<tr><td class="bold">${esc(k)}${x.sheet ? ` <span class="xs muted">(sheet "${esc(x.sheet)}")</span>` : ''}</td><td class="t-num">${fmt.angka(x.sumber)}</td><td class="t-num" style="color:var(--ok)">${fmt.angka(x.ditambah)}</td><td class="t-num">${fmt.angka(x.diperbarui)}</td><td class="t-num">${fmt.angka(x.dilewati)}</td><td class="t-num">${fmt.angka((x.bermasalah || []).length)}</td></tr>`; }).join('') || '<tr><td colspan="6" class="muted">Tidak ada data yang diproses.</td></tr>'}</tbody></table></div>
        ${d.report.Pemilih && d.report.Pemilih.kolom ? `<div class="chips" style="margin-top:14px">${Object.keys(d.report.Pemilih.kolom).map(k => `<span class="pill pill-ok">${ic('cek')}${LABEL[k] || k} ← "${esc(d.report.Pemilih.kolom[k])}"</span>`).join('')}</div>` : ''}
        ${d.warnings.length ? `<div class="stack" style="margin-top:14px;gap:8px">${d.warnings.map(w => `<div class="alert alert-warn">${ic('peringatan')}<div>${esc(w)}</div></div>`).join('')}</div>` : ''}
        ${d.report.Pemilih ? '<div style="margin-top:14px">' + kotakAngka(d.report.Pemilih) + '</div>' : ''}
        <details style="margin-top:14px"><summary class="link-btn">Sheet di spreadsheet sumber (${d.source.sheets.length})</summary><div class="chips" style="margin-top:10px">${d.source.sheets.map(s => `<span class="pill">${esc(s.nama)} · ${fmt.angka(s.baris)} baris</span>`).join('')}</div></details></div>`;
    };
    render();
  };
})();
