/* ============================================================================
   E-VOTE SMAPATISPA — Helper UI: ikon, toast, modal, format, grafik, gambar, QR, konfeti
   ============================================================================ */
(function () {
  'use strict';
  const EV = window.EV = window.EV || {};

  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (name, cls) => `<svg class="ic ${cls || ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  // ------------------------------------------------------------------ format
  const nf = new Intl.NumberFormat('id-ID');
  const fmt = {
    angka: n => n === null || n === undefined ? '—' : nf.format(n),
    persen: n => n === null || n === undefined ? '—' : new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n) + '%',
    tanggal: ms => ms ? new Date(ms).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—',
    tglPendek: ms => ms ? new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
    jam: ms => ms ? new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':') : '—',
    jamDetik: ms => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':'),
    waktu: ms => ms ? fmt.tglPendek(ms) + ', ' + fmt.jam(ms) : '—',
    durasi: ms => {
      if (ms === null || ms === undefined) return '—';
      const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), d = s % 60;
      const p = n => String(n).padStart(2, '0');
      return (h ? p(h) + ':' : '00:') + p(m) + ':' + p(d);
    },
    relatif: ms => {
      if (!ms) return '—';
      const d = Math.round((Date.now() - ms) / 1000);
      if (d < 60) return 'baru saja';
      if (d < 3600) return Math.floor(d / 60) + ' menit lalu';
      if (d < 86400) return Math.floor(d / 3600) + ' jam lalu';
      return fmt.tglPendek(ms);
    },
    inisial: n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase(),
    kode: k => k ? String(k).slice(0, 4) + ' ' + String(k).slice(4) : ''
  };

  // ------------------------------------------------------------------ toast
  function toast(msg, type) {
    type = type || 'ok';
    let root = $('.toasts');
    if (!root) { root = document.createElement('div'); root.className = 'toasts'; root.setAttribute('role', 'status'); root.setAttribute('aria-live', 'polite'); document.body.appendChild(root); }
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = ic(type === 'ok' ? 'cekBulat' : type === 'bad' ? 'xBulat' : type === 'warn' ? 'peringatan' : 'info') + '<div>' + esc(msg) + '</div>';
    root.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, type === 'bad' ? 5200 : 3400);
  }
  function hasil(res, okMsg) {
    if (res && res.success) { if (okMsg !== false) toast(okMsg || res.message || 'Berhasil.', 'ok'); return true; }
    if (res && res.code === 'AUTH') return false;
    toast((res && res.message) || 'Terjadi kesalahan.', 'bad');
    return false;
  }

  // ------------------------------------------------------------------ modal
  const stackModal = [];
  function modal(opts) {
    const root = document.createElement('div');
    root.className = 'modal-root';
    root.innerHTML = `<div class="modal ${opts.size || ''}" role="dialog" aria-modal="true" aria-labelledby="mt-${stackModal.length}">
      ${opts.title !== undefined ? `<div class="modal-head"><div><h2 id="mt-${stackModal.length}">${opts.title}</h2>${opts.sub ? `<p class="muted small" style="margin-top:4px">${opts.sub}</p>` : ''}</div>
      ${opts.noClose ? '' : `<button class="btn btn-ghost btn-icon" data-close aria-label="Tutup">${ic('x')}</button>`}</div>` : ''}
      <div class="modal-body">${opts.body || ''}</div>
      ${opts.foot ? `<div class="modal-foot">${opts.foot}</div>` : ''}</div>`;
    document.body.appendChild(root);
    const prevFocus = document.activeElement;
    const api = {
      el: root, box: root.querySelector('.modal'),
      close(v) {
        if (!root.isConnected) return;
        root.remove();
        stackModal.splice(stackModal.indexOf(api), 1);
        if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { /* abaikan */ }
        if (opts.onClose) opts.onClose(v);
      }
    };
    stackModal.push(api);
    root.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) api.close();
      else if (e.target === root && !opts.noClose && !opts.sticky) api.close();
    });
    setTimeout(() => { const f = root.querySelector('[autofocus], .modal-body input:not([type=hidden]), .modal-body select, .modal-body textarea, .modal-foot .btn'); if (f) f.focus(); }, 30);
    if (opts.onOpen) opts.onOpen(api);
    return api;
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && stackModal.length) {
      const m = stackModal[stackModal.length - 1];
      if (!m.el.querySelector('[data-close]')) return;
      m.close();
    }
  });

  function konfirmasi(o) {
    return new Promise(resolve => {
      let jawab = false;
      const m = modal({
        title: o.title, size: o.size,
        body: `${o.icon !== false ? `<div class="alert ${o.danger ? 'alert-bad' : 'alert-warn'}" style="margin-bottom:${o.extra ? '16px' : '0'}">${ic(o.danger ? 'peringatan' : 'info')}<div>${o.message}</div></div>` : `<p>${o.message}</p>`}${o.extra || ''}`,
        foot: `<button class="btn btn-ghost" data-close>${o.batal || 'Batal'}</button><button class="btn ${o.danger ? 'btn-danger' : ''}" data-ok>${o.ok || 'Lanjutkan'}</button>`,
        onClose: () => resolve(jawab)
      });
      const okBtn = m.el.querySelector('[data-ok]');
      okBtn.addEventListener('click', async () => {
        if (o.validate) { const v = o.validate(m.el); if (v === false) return; jawab = v === true ? true : v; }
        else jawab = true;
        m.close();
      });
      if (o.onOpen) o.onOpen(m);
    });
  }

  // ------------------------------------------------------------------ tombol memuat
  async function sibuk(btn, fn) {
    if (!btn || btn.classList.contains('is-loading')) return;
    const asli = btn.innerHTML, lebar = btn.offsetWidth;
    btn.classList.add('is-loading'); btn.disabled = true; btn.style.minWidth = lebar + 'px';
    btn.innerHTML = '<span class="spin"></span>' + (btn.dataset.loading ? '<span>' + esc(btn.dataset.loading) + '</span>' : '');
    try { return await fn(); }
    finally { if (btn.isConnected) { btn.classList.remove('is-loading'); btn.disabled = false; btn.innerHTML = asli; btn.style.minWidth = ''; } }
  }

  // ------------------------------------------------------------------ grafik
  function ring(persen, size, stroke, isi) {
    size = size || 96; stroke = stroke || 10;
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, persen || 0));
    return `<div class="ring" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}"><circle class="r-track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
      <circle class="r-val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}"/></svg>
      <div class="r-mid">${isi || ''}</div></div>`;
  }
  function foto(src, size, nama) {
    const s = size ? `width:${size}px;height:${size}px` : '';
    return `<div class="foto" style="${s}">${src ? `<img src="${src}" alt="Foto ${esc(nama || '')}" loading="lazy">` : `<div class="ph">${ic('user')}</div>`}</div>`;
  }
  function avatar(nama, src) { return `<div class="avatar">${src ? `<img src="${src}" alt="">` : esc(fmt.inisial(nama))}</div>`; }

  const STATUS_CALON = {
    'Draf': ['pill', 'file'], 'Menunggu Verifikasi': ['pill-warn', 'jamPasir'], 'Perlu Perbaikan': ['pill-warn', 'alertBulat'],
    'Disetujui': ['pill-ok', 'cekBulat'], 'Ditolak': ['pill-bad', 'xBulat']
  };
  function pillCalon(st) { const s = STATUS_CALON[st] || ['pill', 'info']; return `<span class="pill ${s[0]}">${ic(s[1])}${esc(st)}</span>`; }
  const STATUS_PEMUNGUTAN = { Persiapan: ['pill-info', 'jamPasir'], Dibuka: ['pill-ok', 'play'], Dijeda: ['pill-warn', 'pause'], Ditutup: ['pill', 'gembok'] };
  function pillStatus(st, lg) { const s = STATUS_PEMUNGUTAN[st] || ['pill', 'info']; return `<span class="pill ${s[0]} ${lg ? 'pill-lg' : ''}">${st === 'Dibuka' ? '<span class="dot dot-pulse"></span>' : ic(s[1])}${esc(st)}</span>`; }

  // ------------------------------------------------------------------ angka berjalan
  function hitungNaik(el, ke, ms, formatFn) {
    if (!el) return;
    formatFn = formatFn || fmt.angka;
    const dari = Number(el.dataset.v || 0);
    el.dataset.v = ke;
    if (ke === null || ke === undefined) { el.textContent = '—'; return; }
    if (dari === ke || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = formatFn(ke); return; }
    const t0 = performance.now(); ms = ms || 700;
    const langkah = t => {
      const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3);
      const v = dari + (ke - dari) * e;
      el.textContent = formatFn(Number.isInteger(ke) ? Math.round(v) : Math.round(v * 10) / 10);
      if (p < 1) requestAnimationFrame(langkah);
    };
    requestAnimationFrame(langkah);
  }

  // ------------------------------------------------------------------ gambar
  function bacaFile(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Gagal membaca berkas')); r.readAsDataURL(file); });
  }
  function muatGambar(src) {
    return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('Gambar tidak bisa dibuka')); img.src = src; });
  }
  /** Perkecil logo (pertahankan rasio & transparansi). */
  async function perkecilLogo(file) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Gunakan berkas PNG, JPG, atau WEBP.');
    if (file.size > 2 * 1024 * 1024) throw new Error('Ukuran logo maksimal 2 MB.');
    const img = await muatGambar(await bacaFile(file));
    const sk = Math.min(1, 512 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * sk); c.height = Math.round(img.height * sk);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let out = c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', .9);
    if (out.length > 400000) out = c.toDataURL('image/webp', .9);
    return out;
  }
  /** Alat potong foto persegi (geser + zoom), hasil JPEG 480×480. */
  function potongFoto(file) {
    return new Promise(async (resolve) => {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast('Gunakan berkas JPG, PNG, atau WEBP.', 'bad'); return resolve(null); }
      if (file.size > 5 * 1024 * 1024) { toast('Ukuran foto maksimal 5 MB.', 'bad'); return resolve(null); }
      let img;
      try { img = await muatGambar(await bacaFile(file)); } catch (e) { toast(e.message, 'bad'); return resolve(null); }
      let hasilData = null;
      const m = modal({
        title: 'Atur Foto', sub: 'Geser foto dan atur zoom agar wajah berada di tengah lingkaran.',
        body: `<div class="crop" id="crop"><canvas width="560" height="560"></canvas><div class="c-ring"></div></div>
          <div class="row" style="margin-top:16px">${ic('minus', 'muted')}<input type="range" id="zoom" min="1" max="3" step="0.01" value="1" aria-label="Zoom">${ic('plus', 'muted')}</div>`,
        foot: `<button class="btn btn-ghost" data-close>Batal</button><button class="btn" data-ok>${ic('cek')}Gunakan Foto</button>`,
        onClose: () => resolve(hasilData)
      });
      const cv = m.el.querySelector('canvas'), ctx = cv.getContext('2d'), zoom = m.el.querySelector('#zoom'), box = m.el.querySelector('#crop');
      const S = 560, dasar = S / Math.min(img.width, img.height);
      let z = 1, ox = 0, oy = 0;
      const gambar = () => {
        const sk = dasar * z, w = img.width * sk, h = img.height * sk;
        ox = Math.min(0, Math.max(S - w, ox)); oy = Math.min(0, Math.max(S - h, oy));
        ctx.fillStyle = '#0E1030'; ctx.fillRect(0, 0, S, S); ctx.drawImage(img, ox, oy, w, h);
      };
      ox = (S - img.width * dasar) / 2; oy = (S - img.height * dasar) / 2; gambar();
      zoom.addEventListener('input', () => {
        const zl = z; z = Number(zoom.value);
        const cx = S / 2, cy = S / 2; ox = cx - (cx - ox) * (z / zl); oy = cy - (cy - oy) * (z / zl); gambar();
      });
      let drag = null;
      box.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, ox, oy }; box.setPointerCapture(e.pointerId); box.style.cursor = 'grabbing'; });
      box.addEventListener('pointermove', e => {
        if (!drag) return;
        const r = S / box.clientWidth;
        ox = drag.ox + (e.clientX - drag.x) * r; oy = drag.oy + (e.clientY - drag.y) * r; gambar();
      });
      box.addEventListener('pointerup', () => { drag = null; box.style.cursor = ''; });
      box.addEventListener('wheel', e => { e.preventDefault(); zoom.value = Math.min(3, Math.max(1, z - e.deltaY / 500)); zoom.dispatchEvent(new Event('input')); }, { passive: false });
      m.el.querySelector('[data-ok]').addEventListener('click', () => {
        const out = document.createElement('canvas'); out.width = 480; out.height = 480;
        out.getContext('2d').drawImage(cv, 0, 0, S, S, 0, 0, 480, 480);
        hasilData = out.toDataURL('image/jpeg', .85);
        m.close(hasilData);
      });
    });
  }

  // ------------------------------------------------------------------ pustaka eksternal (dimuat saat perlu)
  const pustaka = {};
  function muatSkrip(url, cekGlobal) {
    if (cekGlobal && window[cekGlobal]) return Promise.resolve(window[cekGlobal]);
    if (pustaka[url]) return pustaka[url];
    pustaka[url] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = url; s.async = true;
      s.onload = () => res(cekGlobal ? window[cekGlobal] : true);
      s.onerror = () => { delete pustaka[url]; rej(new Error('Gagal memuat pustaka. Periksa koneksi internet.')); };
      document.head.appendChild(s);
    });
    return pustaka[url];
  }
  const LIB = {
    qr: () => muatSkrip('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js', 'qrcode'),
    xlsx: () => muatSkrip('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX'),
    kamera: () => muatSkrip('https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js', 'Html5Qrcode')
  };
  function qrSvg(teks) {
    const q = window.qrcode(0, 'M');
    q.addData(String(teks)); q.make();
    const n = q.getModuleCount(), m = 2;
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m},${r + m}h1v1h-1z`;
    return `<svg viewBox="0 0 ${n + m * 2} ${n + m * 2}" shape-rendering="crispEdges" role="img" aria-label="QR kode kartu"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }

  // ------------------------------------------------------------------ konfeti
  function konfeti(durasi) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = document.createElement('canvas'); cv.className = 'confetti'; document.body.appendChild(cv);
    const ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
    const ukur = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
    ukur();
    const warna = ['#F5B83D', '#FCD34D', '#6366E8', '#A5A8F0', '#22C55E', '#FFFFFF', '#FF6B85'];
    const P = [];
    for (let i = 0; i < 220; i++) P.push({ x: Math.random() * cv.width, y: -Math.random() * cv.height * .6, w: (6 + Math.random() * 8) * dpr, h: (8 + Math.random() * 10) * dpr,
      vx: (Math.random() - .5) * 3 * dpr, vy: (2 + Math.random() * 4) * dpr, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: warna[i % warna.length] });
    const t0 = performance.now(); durasi = durasi || 4500;
    const loop = t => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      P.forEach(p => { p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vy += .03 * dpr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - (t - t0) / durasi); ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); });
      if (t - t0 < durasi) requestAnimationFrame(loop); else cv.remove();
    };
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------ bunyi (tanpa berkas audio)
  let audioCtx = null;
  function bunyi(jenis) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const nada = jenis === 'gagal' ? [[220, .18], [180, .22]] : jenis === 'sukses' ? [[660, .1], [880, .16]] : [[1046, .09]];
      let t = audioCtx.currentTime;
      nada.forEach(([f, d]) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
        o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + d); t += d * .9;
      });
    } catch (e) { /* audio tidak tersedia */ }
  }

  // ------------------------------------------------------------------ aktivitas & util
  const Activity = {
    at: Date.now(), last: {},
    init() { ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focus'].forEach(ev => addEventListener(ev, () => { this.at = Date.now(); }, { passive: true })); },
    idle() { return Date.now() - this.at > 120000; },
    due(key, aktifMs, diamMs) {
      if (document.visibilityState !== 'visible') return false;
      if (Date.now() - (this.last[key] || 0) < (this.idle() ? diamMs : aktifMs) - 500) return false;
      this.last[key] = Date.now(); return true;
    }
  };
  Activity.init();
  const debounce = (fn, ms) => { let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(this, a), ms || 250); }; };
  function unduhTeks(nama, isi, tipe) {
    const blob = new Blob([isi], { type: tipe || 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csv(rows) { return '﻿' + rows.map(r => r.map(v => { const s = String(v === null || v === undefined ? '' : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n'); }
  function salin(teks) {
    if (navigator.clipboard) return navigator.clipboard.writeText(teks).then(() => toast('Disalin ke papan klip.', 'ok'), () => toast('Gagal menyalin.', 'bad'));
    const t = document.createElement('textarea'); t.value = teks; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); toast('Disalin ke papan klip.', 'ok');
  }
  /** Rasio kontras WCAG antara dua warna hex */
  function kontras(a, b) {
    const lum = h => { const v = h.replace('#', '').match(/../g).map(x => { let c = parseInt(x, 16) / 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
  }
  function uuid() { return (crypto.randomUUID && crypto.randomUUID()) || ('id-' + Date.now() + '-' + Math.random().toString(16).slice(2)); }

  EV.ui = { esc, ic, $, $$, fmt, toast, hasil, modal, konfirmasi, sibuk, ring, foto, avatar, pillCalon, pillStatus, hitungNaik,
    bacaFile, perkecilLogo, potongFoto, LIB, qrSvg, konfeti, bunyi, Activity, debounce, unduhTeks, csv, salin, kontras, uuid };
})();
