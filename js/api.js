/* ============================================================================
   E-VOTE SMAPATISPA — Lapisan API (fetch ke Google Apps Script)
   - POST wajib Content-Type text/plain (menghindari CORS preflight yang diblok GAS)
   - Token sesi dikirim di BODY, bukan di URL
   - Dedupe baca + epoch tulis, penggabung batch, warmup, pengukur waktu (gas-scale-turbo)
   ============================================================================ */
(function () {
  'use strict';
  const EV = window.EV = window.EV || {};
  const CFG = window.APP_CONFIG || {};
  const URL_OK = !!CFG.GAS_URL && !/GANTI|XXXX/i.test(CFG.GAS_URL);

  const KUNCI = { sesi: 'evs_sesi', perangkat: 'evs_perangkat', cfg: 'evs_cfg', tema: 'evs_tema' };
  const simpan = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* mode privat */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
  };

  const Sesi = {
    get() { return simpan.get(KUNCI.sesi); },
    set(s) { simpan.set(KUNCI.sesi, s); },
    clear() { simpan.del(KUNCI.sesi); },
    perangkat() { return simpan.get(KUNCI.perangkat); },
    setPerangkat(p) { simpan.set(KUNCI.perangkat, p); },
    clearPerangkat() { simpan.del(KUNCI.perangkat); },
    token() { const p = this.perangkat(); if (p && p.token) return p.token; const s = this.get(); return s ? s.token : ''; }
  };

  const Perf = {
    list: [],
    add(action, total, server) { this.list.push({ action, total: Math.round(total), server: server || 0, net: Math.round(total - (server || 0)), at: Date.now() }); if (this.list.length > 200) this.list.shift(); },
    table() { console.table(this.list.slice(-30)); },
    summary() {
      const g = {};
      this.list.forEach(x => { (g[x.action] = g[x.action] || []).push(x.total); });
      console.table(Object.keys(g).map(a => ({ aksi: a, n: g[a].length, rata_ms: Math.round(g[a].reduce((p, c) => p + c, 0) / g[a].length) })));
    }
  };

  const BACA = /^(publicConfig|me|dashboard|settings\.get|election\.get|calon\.list|akun\.list|pemilih\.list|hasil\.get|log\.list|pencalon\.get|ballot|live|device\.status)$/;
  const inflight = {};
  let epoch = 0;

  async function kirim(action, data, token) {
    const t0 = performance.now();
    const res = await fetch(CFG.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, data: data || {} }),
      redirect: 'follow'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    Perf.add(action, performance.now() - t0, json.ms);
    if (json.now) EV.serverOffset = json.now - Date.now();
    return json;
  }

  async function jalankan(action, data, opts) {
    opts = opts || {};
    if (!URL_OK) return { success: false, code: 'CONFIG', message: 'Alamat server belum diatur. Isi GAS_URL di file js/config.js.' };
    const token = opts.token !== undefined ? opts.token : Sesi.token();
    const ulang = opts.retry !== undefined ? opts.retry : (BACA.test(action) ? 2 : 0);
    let res = null;
    for (let i = 0; i <= ulang; i++) {
      try { res = await kirim(action, data, token); break; }
      catch (e) {
        res = { success: false, code: 'NETWORK', message: 'Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.' };
        if (i < ulang) await new Promise(r => setTimeout(r, 600 * (i + 1)));
      }
    }
    if (res.code === 'AUTH' && !opts.noAuthRedirect && EV.app && EV.app.sesiHilang) EV.app.sesiHilang(res.message);
    return res;
  }

  /** Panggil API. Aksi baca identik yang sedang berjalan akan menumpang (dedupe). */
  function api(action, data, opts) {
    if (!BACA.test(action)) { epoch++; return jalankan(action, data, opts); }
    const k = epoch + '|' + action + '|' + Sesi.token() + '|' + JSON.stringify(data || {});
    if (inflight[k]) return inflight[k];
    const p = jalankan(action, data, opts);
    inflight[k] = p;
    p.then(() => delete inflight[k], () => delete inflight[k]);
    return p;
  }

  /** Gabungkan beberapa aksi baca pada tik yang sama menjadi 1 eksekusi server. */
  const Batcher = {
    q: null,
    add(action, data) {
      return new Promise(res => {
        if (!this.q) { this.q = []; setTimeout(() => this.flush(), 0); }
        this.q.push({ action, data: data || {}, res });
      });
    },
    async flush() {
      const q = this.q; this.q = null;
      if (q.length === 1) { q[0].res(await api(q[0].action, q[0].data)); return; }
      for (let i = 0; i < q.length; i += 10) {
        const part = q.slice(i, i + 10);
        const r = await api('batch', { calls: part.map(x => ({ action: x.action, data: x.data })) });
        part.forEach((x, j) => x.res(r.success ? r.data.results[j] : r));
      }
    }
  };
  function apiQ(action, data) { return BACA.test(action) ? Batcher.add(action, data) : api(action, data); }

  /** Konfigurasi publik (nama, logo, warna) — GET tanpa token. */
  async function publicConfig() {
    if (!URL_OK) return { success: false, code: 'CONFIG' };
    try {
      const r = await fetch(CFG.GAS_URL + '?action=publicConfig', { redirect: 'follow' });
      return await r.json();
    } catch (e) { return { success: false, code: 'NETWORK' }; }
  }

  /** Panaskan server (cold start) — maks. 1× per 4 menit per lingkup. */
  function warm(scope) {
    if (!URL_OK) return;
    const k = 'evs_warm_' + scope;
    try { if (Date.now() - Number(sessionStorage.getItem(k) || 0) < 240000) return; sessionStorage.setItem(k, String(Date.now())); } catch (e) { /* abaikan */ }
    fetch(CFG.GAS_URL + '?w=' + scope, { mode: 'no-cors' }).catch(() => {});
  }

  EV.api = api;
  EV.apiQ = apiQ;
  EV.publicConfig = publicConfig;
  EV.warm = warm;
  EV.Sesi = Sesi;
  EV.simpan = simpan;
  EV.KUNCI = KUNCI;
  EV.Perf = Perf;
  EV.URL_OK = URL_OK;
  EV.serverOffset = 0;
  EV.sekarang = () => Date.now() + (EV.serverOffset || 0);
  window.Perf = Perf;
})();
