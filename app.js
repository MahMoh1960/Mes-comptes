(() => {
'use strict';

/* =====================================================================
   Mes Comptes — gestion financière personnelle en dirham marocain
   Données stockées sur l'appareil (IndexedDB). Aucune connexion requise.
   ===================================================================== */

const T = window.I18N;
let S = null;                 // état de l'application
let camp = 'all';             // filtre global : campagne agricole
let view = { name: 'home' };  // écran courant
let sheetOpen = false;
let locked = false;
let lockBuf = '';
let hiddenAt = 0;
let pendingPhoto = null;      // { id, data } photo choisie dans le formulaire
let photoRemoved = false;

/* ---------- Outils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
let seq = 0;
const stamp = () => Date.now() * 1000 + (seq++ % 1000);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = n => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const fd = iso => iso ? iso.split('-').reverse().join('/') : '';
const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
const r3 = x => Math.round((x + Number.EPSILON) * 1000) / 1000;
const num = v => { const x = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; };
const daysTo = iso => Math.round((new Date(iso + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
const campagneOf = iso => { const [y, m] = iso.split('-').map(Number); return m >= 9 ? `${y}/${y + 1}` : `${y - 1}/${y}`; };

const t = (k, v) => {
  let s = (T[S ? S.lang : 'fr'][k] ?? T.fr[k] ?? k);
  if (v) for (const x in v) s = s.replace('{' + x + '}', v[x]);
  return s;
};

const nf = (x, min = 0, max = 2) => {
  x = Math.abs(x) < 1e-9 ? 0 : x;
  return x.toLocaleString('fr-FR', { minimumFractionDigits: min, maximumFractionDigits: max }).replace('-', '−');
};
const Mtxt = x => `${nf(x, 2, 2)} ${t('cur')}`;
const M = x => `<bdi class="num">${nf(x, 2, 2)}</bdi> <small>${t('cur')}</small>`;
const cls = x => x > 0 ? 'pos' : x < 0 ? 'neg' : '';
const lbl = x => x > 0 ? t('owes_you') : x < 0 ? t('you_owe') : t('settled_acc');

/* ---------- Icônes ---------- */
const ICON = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14c2.2.7 3.5 2.5 3.5 6"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  gear: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="M7 17L17 7M8 7h9v9"/>',
  down: '<path d="M17 7L7 17M16 17H7V8"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  print: '<path d="M7 9V4h10v5M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2"/><rect x="7" y="14" width="10" height="6"/>',
  wa: '<path d="M21 12a8 8 0 01-11.8 7L3 21l2-6.2A8 8 0 1121 12z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  clip: '<path d="M20 11l-8.5 8.5a5 5 0 01-7-7L13 4a3.3 3.3 0 014.7 4.7L9.2 17.2a1.7 1.7 0 01-2.4-2.4L14 7.6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  leaf: '<path d="M12 21V9M12 9c-3 0-5-2-5-5 3 0 5 2 5 5zm0 0c3 0 5-2 5-5-3 0-5 2-5 5zM12 15c-3 0-5-2-5-5M12 15c3 0 5-2 5-5"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M9 9.5c0-1 1.2-1.7 3-1.7s3 .7 3 1.9-1.3 1.6-3 2-3 .8-3 2.1 1.3 1.9 3 1.9 3-.8 3-1.8M12 6.5v1.3M12 16v1.5"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  book: '<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h11"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'
};
const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ''}</svg>`;

/* ---------- Stockage (IndexedDB) ---------- */
const idb = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('mescomptes', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('photos'); };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const tr = this.db.transaction(store, mode);
      const out = fn(tr.objectStore(store));
      tr.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      tr.onerror = () => rej(tr.error);
    });
  },
  get(store, key) { return this.tx(store, 'readonly', s => s.get(key)); },
  set(store, key, val) { return this.tx(store, 'readwrite', s => { s.put(val, key); }); },
  del(store, key) { return this.tx(store, 'readwrite', s => { s.delete(key); }); },
  clear(store) { return this.tx(store, 'readwrite', s => { s.clear(); }); },
  all(store) {
    return new Promise((res, rej) => {
      const out = {};
      const r = this.db.transaction(store, 'readonly').objectStore(store).openCursor();
      r.onsuccess = () => { const c = r.result; if (c) { out[c.key] = c.value; c.continue(); } else res(out); };
      r.onerror = () => rej(r.error);
    });
  }
};

let savePending = false;
function save() {
  // écriture groupée à la fin du tour d'événements : rapide et sans perte au rechargement
  if (savePending) return;
  savePending = true;
  queueMicrotask(() => { savePending = false; if (idb.db) idb.set('kv', 'state', S).catch(console.error); });
}
const flushSave = () => (idb.db ? idb.set('kv', 'state', S) : Promise.resolve());
window.addEventListener('pagehide', () => { if (S) flushSave().catch(() => {}); });

function defaultState() {
  return {
    v: 1, lang: 'fr', comptes: [], ops: [], journal: [], pin: null, pinLen: 4, salt: null, lastBackup: 0,
    produits: [
      { id: 'p_orge', nom: 'Orge', nomAr: 'شعير', base: 'kg', sacKg: 50 },
      { id: 'p_ble', nom: 'Blé', nomAr: 'قمح', base: 'kg', sacKg: 50 },
      { id: 'p_lentilles', nom: 'Lentilles', nomAr: 'عدس', base: 'kg', sacKg: 50 },
      { id: 'p_paille', nom: 'Paille', nomAr: 'تبن', base: 'botte', sacKg: 0 }
    ]
  };
}

/* ---------- Accès aux données ---------- */
const compte = id => S.comptes.find(c => c.id === id);
const produit = id => S.produits.find(p => p.id === id);
const pname = p => p ? (S.lang === 'ar' && p.nomAr ? p.nomAr : p.nom) : '?';
const sign = o => o.sens === 'donne' ? 1 : -1;
const baseUnit = p => p && p.base === 'botte' ? 'botte' : 'kg';
const cmpAsc = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.cree - b.cree;
const cmpDesc = (a, b) => cmpAsc(b, a);
const inCamp = o => camp === 'all' || o.campagne === camp;
const opsOf = (cid, withVoid = false) => S.ops.filter(o => o.compte === cid && (withVoid || !o.annule) && inCamp(o));

const UNIT_F = { kg: 1, qx: 100, t: 1000 };
const unitsFor = p => p && p.base === 'botte' ? ['botte'] : ['kg', 'qx', 't', 'sac'];
function toBase(p, qte, unite) {
  if (p.base === 'botte') return qte;
  if (unite === 'sac') return qte * (p.sacKg || 50);
  return qte * (UNIT_F[unite] || 1);
}
function qtyPlain(p, base) {
  if (!p) return nf(base, 0, 3);
  if (p.base === 'botte') return `${nf(base, 0, 2)} ${t('u_botte')}`;
  const a = Math.abs(base);
  return a >= 100 ? `${nf(base, 0, 3)} ${t('u_kg')} (${nf(base / 100, 0, 2)} ${t('u_qx_short')})` : `${nf(base, 0, 3)} ${t('u_kg')}`;
}
const qh = (p, base) => `<bdi>${esc(qtyPlain(p, base))}</bdi>`;

function bilan(ops) {
  const b = { donne: 0, recu: 0, solde: 0, nat: {}, valeur: 0, n: 0, mode: {}, camp: {}, first: null, last: null };
  for (const o of ops) {
    if (o.annule) continue;
    b.n++;
    if (!b.first || o.date < b.first) b.first = o.date;
    if (!b.last || o.date > b.last) b.last = o.date;
    if (o.kind === 'argent') {
      if (o.sens === 'donne') b.donne += o.montant; else b.recu += o.montant;
      const m = b.mode[o.mode] || (b.mode[o.mode] = { donne: 0, recu: 0 });
      m[o.sens === 'donne' ? 'donne' : 'recu'] += o.montant;
      const c = b.camp[o.campagne] || (b.camp[o.campagne] = { donne: 0, recu: 0 });
      c[o.sens === 'donne' ? 'donne' : 'recu'] += o.montant;
    } else {
      const m = b.nat[o.produit] || (b.nat[o.produit] = { donne: 0, recu: 0, solde: 0 });
      if (o.sens === 'donne') m.donne += o.qteBase; else m.recu += o.qteBase;
      b.valeur += sign(o) * (o.valeur || 0);
    }
  }
  b.donne = r2(b.donne); b.recu = r2(b.recu); b.solde = r2(b.donne - b.recu); b.valeur = r2(b.valeur);
  for (const k in b.nat) { const m = b.nat[k]; m.donne = r3(m.donne); m.recu = r3(m.recu); m.solde = r3(m.donne - m.recu); }
  return b;
}

function runMap(ops) {
  const asc = [...ops].sort(cmpAsc);
  const m = {}; let r = 0; const rp = {};
  for (const o of asc) {
    if (o.annule) continue;
    if (o.kind === 'argent') { r = r2(r + sign(o) * o.montant); m[o.id] = r; }
    else { rp[o.produit] = r3((rp[o.produit] || 0) + sign(o) * o.qteBase); m[o.id] = rp[o.produit]; }
  }
  return m;
}

function campOptions() {
  const set = new Set(S.ops.map(o => o.campagne).filter(Boolean));
  set.add(campagneOf(todayISO()));
  return [...set].sort().reverse();
}
const dueOps = () => S.ops.filter(o => !o.annule && !o.regle && o.echeance).sort((a, b) => a.echeance < b.echeance ? -1 : a.echeance > b.echeance ? 1 : 0);
const overdueCount = () => dueOps().filter(o => o.echeance < todayISO()).length;

function opSummary(o) {
  const c = compte(o.compte);
  if (o.kind === 'argent') return `${Mtxt(o.montant)} — ${c ? c.nom : ''}`;
  return `${pname(produit(o.produit))} ${nf(o.qte, 0, 3)} ${t('u_' + o.unite)} — ${c ? c.nom : ''}`;
}
function logJ(a, o, extra = {}) {
  S.journal.push({ id: uid(), ts: Date.now(), a, op: o ? o.id : null, compte: o ? o.compte : extra.compte || null, txt: extra.txt || (o ? opSummary(o) : ''), d: extra.d || null });
  if (S.journal.length > 1500) S.journal.splice(0, S.journal.length - 1500);
}

/* ---------- Langue ---------- */
function applyLang() {
  const ar = S.lang === 'ar';
  document.documentElement.lang = S.lang;
  document.documentElement.dir = ar ? 'rtl' : 'ltr';
  document.title = t('app_name');
}

/* ---------- Navigation ---------- */
function go(v, replace = false) {
  view = v;
  if (replace) history.replaceState(v, ''); else history.pushState(v, '');
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('popstate', e => {
  if (sheetOpen) closeSheet(true);
  view = e.state || { name: 'home' };
  render();
});

function toast(msg) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>`;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.innerHTML = ''; }, 2400);
}

function openSheet(html) {
  $('#sheet-root').innerHTML = `<div class="backdrop" data-a="sheet-x"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  sheetOpen = true;
  document.body.classList.add('noscroll');
}
function closeSheet(silent) {
  $('#sheet-root').innerHTML = '';
  sheetOpen = false;
  document.body.classList.remove('noscroll');
  pendingPhoto = null; photoRemoved = false;
  if (!silent) render();
}
const formErr = msg => { const e = $('#f-err'); if (e) { e.textContent = msg; e.scrollIntoView({ block: 'nearest' }); } return false; };
const shHead = title => `<div class="sh-h"><h2>${esc(title)}</h2><button class="ib ghost" data-a="sheet-x" aria-label="${t('dismiss')}">${ic('x')}</button></div>`;

/* =====================================================================
   ÉCRANS
   ===================================================================== */
function head({ title, sub, back, right = '', hero = '' }) {
  return `<header class="hdr"><div class="hdr-row">${back ? `<button class="ib" data-a="back" aria-label="${t('back')}">${ic('back', 'flip')}</button>` : ''}<div class="hdr-t"><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${right}</div>${hero}</header>`;
}
const campSelect = () => `<label class="camp"><span class="sr">${t('campaign')}</span><select data-change="camp">
  <option value="all">${t('all_campaigns')}</option>${campOptions().map(c => `<option value="${c}" ${c === camp ? 'selected' : ''}>${t('campaign')} ${c}</option>`).join('')}</select></label>`;

function opRow(o, run, showAcc) {
  const c = compte(o.compte);
  const g = o.sens === 'donne';
  let title, val;
  if (o.kind === 'argent') {
    title = `${t('m_' + o.mode)}${o.cheque ? ' ' + esc(o.cheque) : ''}`;
    val = `<b class="${g ? 'pos' : 'neg'}">${g ? '+' : '−'}${M(o.montant)}</b>`;
  } else {
    const p = produit(o.produit);
    title = esc(pname(p));
    val = `<b class="${g ? 'pos' : 'neg'}">${g ? '+' : '−'}<bdi>${esc(nf(o.qte, 0, 3))} ${t('u_' + o.unite)}</bdi></b>`;
  }
  const meta = [fd(o.date)];
  if (showAcc && c) meta.push(esc(c.nom));
  if (o.note) meta.push(esc(o.note));
  let tags = '';
  if (o.annule) tags += `<span class="tag">${t('voided')}</span>`;
  if (o.echeance && !o.annule) {
    if (o.regle) tags += `<span class="tag ok">${t('settled')}</span>`;
    else tags += `<span class="tag ${o.echeance < todayISO() ? 'late' : ''}">${fd(o.echeance)}</span>`;
  }
  let runTxt = '';
  if (run !== undefined && !o.annule) {
    runTxt = o.kind === 'argent' ? `<span class="run ${cls(run)}">${M(run)}</span>` : `<span class="run ${cls(run)}">${qh(produit(o.produit), run)}</span>`;
  }
  return `<button class="row op ${o.annule ? 'void' : ''}" data-a="show-op" data-id="${o.id}">
    <span class="ico ${g ? 'g' : 'r'}">${ic(g ? 'up' : 'down')}</span>
    <span class="grow"><span class="t">${title}</span><span class="m" style="display:block">${tags}${meta.join(' — ')}</span></span>
    <span class="v">${val}${runTxt}</span></button>`;
}

/* ----- Accueil ----- */
function viewHome() {
  const rows = S.comptes.map(c => ({ c, b: bilan(opsOf(c.id)) }));
  let rec = 0, pay = 0; const natTot = {};
  rows.forEach(({ b }) => {
    if (b.solde > 0) rec += b.solde; else pay -= b.solde;
    for (const pid in b.nat) {
      const n = b.nat[pid];
      const x = natTot[pid] || (natTot[pid] = { rec: 0, pay: 0 });
      if (n.solde > 0) x.rec += n.solde; else x.pay -= n.solde;
    }
  });
  rec = r2(rec); pay = r2(pay);
  const net = r2(rec - pay);
  const tot = rec + pay;
  const hero = `<div class="hero"><div class="hero-l">${t('net_position')}</div>
    <div class="hero-n ${cls(net)}">${net > 0 ? '+' : ''}${M(net)}</div>
    <div class="split" aria-hidden="true"><i class="a" style="width:${tot ? rec / tot * 100 : 0}%"></i><i class="b" style="width:${tot ? pay / tot * 100 : 0}%"></i></div>
    <div class="hero-sub"><span><b>${M(rec)}</b>${t('they_owe_me')}</span><span><b>${M(pay)}</b>${t('i_owe_them')}</span></div></div>`;
  let body = '';
  const od = overdueCount();
  if (od) body += `<button class="banner warn" data-a="nav" data-v="echeances">${ic('alert')}<b>${t('overdue_n', { n: od })}</b></button>`;
  if (S.ops.length) {
    const days = S.lastBackup ? Math.floor((Date.now() - S.lastBackup) / 86400000) : null;
    if (days === null || days >= 14) {
      body += `<div class="banner info">${ic('download')}<span>${days === null ? t('backup_never') : t('backup_old', { n: days })}</span><button class="btn sm" data-a="export-json">${t('backup_now')}</button></div>`;
    }
  }
  if (!S.comptes.length) {
    body += `<div class="empty"><h3>${t('empty_start')}</h3><p>${t('empty_start_txt')}</p><button class="btn" data-a="new-account">${ic('plus')}${t('new_account')}</button></div>`;
  } else {
    const nat = S.produits.filter(p => natTot[p.id] && (natTot[p.id].rec || natTot[p.id].pay));
    if (nat.length) {
      body += `<div class="sec">${t('nature_position')}</div><div class="list">${nat.map(p => {
        const x = natTot[p.id];
        return `<div class="row"><span class="av">${ic('leaf')}</span><span class="grow"><b class="nm">${esc(pname(p))}</b></span>
          <span class="bal" style="font-size:14px">${x.rec ? `<span class="pos">${qh(p, r3(x.rec))}<small>${t('to_receive')}</small></span>` : ''}${x.pay ? `<span class="neg">${qh(p, r3(-x.pay))}<small>${t('to_deliver')}</small></span>` : ''}</span></div>`;
      }).join('')}</div>`;
    }
    const recent = S.ops.filter(o => !o.annule && inCamp(o)).sort(cmpDesc).slice(0, 8);
    body += `<div class="sec">${t('recent_ops')}</div>`;
    body += recent.length ? `<div class="list">${recent.map(o => opRow(o, undefined, true)).join('')}</div>` : `<div class="empty">${t('no_ops')}</div>`;
  }
  return head({ title: t('app_name'), right: campSelect(), hero }) + `<main class="main">${body}</main>`;
}

/* ----- Liste des comptes ----- */
function accRow(c) {
  const b = bilan(opsOf(c.id));
  const nat = Object.entries(b.nat).filter(([, n]) => n.solde !== 0)
    .map(([pid, n]) => `<span class="nt ${cls(n.solde)}">${esc(pname(produit(pid)))} ${qh(produit(pid), n.solde)}</span>`).join('');
  return `<button class="row acc" data-a="open-acc" data-id="${c.id}">
    <span class="av av-${c.type}">${esc([...c.nom.trim()][0] || '?')}</span>
    <span class="grow"><b class="nm">${esc(c.nom)}</b><small>${t('t_' + c.type)}</small>${nat ? `<span class="nts">${nat}</span>` : ''}</span>
    <span class="bal ${cls(b.solde)}">${M(b.solde)}<small style="display:block">${lbl(b.solde)}</small></span></button>`;
}
function accListHTML() {
  const q = (view.q || '').toLowerCase().trim();
  const f = view.f || 'all';
  const list = S.comptes.filter(c => (f === 'all' || c.type === f) && (!q || c.nom.toLowerCase().includes(q) || (c.tel || '').includes(q)))
    .sort((a, b) => a.nom.localeCompare(b.nom, S.lang === 'ar' ? 'ar' : 'fr'));
  if (!list.length) return `<div class="empty">${S.comptes.length ? t('no_results') : t('no_accounts')}</div>`;
  return `<div class="list">${list.map(accRow).join('')}</div>`;
}
function viewAccounts() {
  const f = view.f || 'all';
  const chips = [['all', t('all')], ['personne', t('tp_personne')], ['societe', t('tp_societe')], ['banque', t('tp_banque')]]
    .map(([v, l]) => `<button class="chip ${f === v ? 'on' : ''}" data-a="filter" data-v="${v}">${l}</button>`).join('');
  return head({ title: t('accounts'), right: campSelect() }) +
    `<main class="main"><div class="search">${ic('search')}<input id="q" type="search" placeholder="${t('search_ph')}" value="${esc(view.q || '')}" autocomplete="off"></div>
    <div class="chips">${chips}</div><div id="acc-list">${accListHTML()}</div></main>`;
}

/* ----- Détail d'un compte ----- */
function viewAccount() {
  const c = compte(view.id);
  const tab = view.tab || 'argent';
  const ops = opsOf(c.id, true);
  const b = bilan(ops);
  const natChips = Object.entries(b.nat).filter(([, n]) => n.solde !== 0)
    .map(([pid, n]) => `<span class="${cls(n.solde)}">${esc(pname(produit(pid)))} ${qh(produit(pid), n.solde)}</span>`).join('');
  const waNum = waNumber(c.tel);
  const hero = `<div class="sum-main ${cls(b.solde)}">${M(b.solde)}</div><div class="sum-lbl">${lbl(b.solde)}${camp !== 'all' ? ` — ${t('campaign')} ${camp}` : ''}</div>
    <div class="sum-sub"><div><span>${t('total_gave')}</span><b>${M(b.donne)}</b></div><div><span>${t('total_recv')}</span><b>${M(b.recu)}</b></div></div>
    ${natChips ? `<div class="nts-h">${natChips}</div>` : ''}
    <div class="hdr-acts">
      <button class="pill" data-a="statement" data-id="${c.id}">${ic('print')}${t('statement')}</button>
      <button class="pill" data-a="wa" data-id="${c.id}">${ic('wa')}${t('whatsapp')}</button>
      ${c.tel ? `<a class="pill" href="tel:${esc(c.tel.replace(/\s/g, ''))}">${ic('phone')}${t('call')}</a>` : ''}
      <button class="pill" data-a="edit-account" data-id="${c.id}">${ic('edit')}${t('edit')}</button></div>`;
  const tabs = `<div class="tabs" role="tablist">${[['argent', 'tab_money'], ['nature', 'tab_nature'], ['bilan', 'tab_balance']]
    .map(([v, k]) => `<button role="tab" aria-selected="${tab === v}" class="${tab === v ? 'on' : ''}" data-a="tab" data-v="${v}">${t(k)}</button>`).join('')}</div>`;
  let body = '';
  const run = runMap(ops);
  if (tab === 'bilan') body = bilanHTML(b);
  else {
    const kind = tab === 'nature' ? 'nature' : 'argent';
    const list = ops.filter(o => o.kind === kind).sort(cmpDesc);
    body = list.length ? `<div class="list">${list.map(o => opRow(o, run[o.id], false)).join('')}</div>` : `<div class="empty"><p>${t('no_ops')}</p><button class="btn" data-a="new-op" data-kind="${kind}" data-c="${c.id}">${ic('plus')}${kind === 'nature' ? t('add_nature') : t('add_money')}</button></div>`;
  }
  return head({ title: c.nom, sub: t('t_' + c.type), back: true, hero }) + tabs + `<main class="main">${body}</main>`;
}

function bilanHTML(b) {
  let h = `<div class="card scroll-x"><table class="tbl"><thead><tr><th>${t('b_money')}</th><th>${t('gave_short')}</th><th>${t('recv_short')}</th><th>${t('balance')}</th></tr></thead><tbody>
    <tr><td><b>${t('tab_money')}</b></td><td class="pos">${M(b.donne)}</td><td class="neg">${M(b.recu)}</td><td class="${cls(b.solde)}"><b>${M(b.solde)}</b></td></tr></tbody></table></div>`;
  const prods = Object.entries(b.nat);
  if (prods.length) {
    h += `<div class="card scroll-x"><table class="tbl"><thead><tr><th>${t('b_nature')}</th><th>${t('gave_short')}</th><th>${t('recv_short')}</th><th>${t('balance')}</th></tr></thead><tbody>${prods.map(([pid, n]) => {
      const p = produit(pid);
      return `<tr><td><b>${esc(pname(p))}</b></td><td>${qh(p, n.donne)}</td><td>${qh(p, n.recu)}</td><td class="${cls(n.solde)}"><b>${qh(p, n.solde)}</b></td></tr>`;
    }).join('')}</tbody></table></div>`;
    if (b.valeur) h += `<div class="card"><div class="row" style="border:0"><span class="grow">${t('b_value')}</span><b class="${cls(b.valeur)}">${M(b.valeur)}</b></div></div>`;
  }
  const camps = Object.entries(b.camp).sort().reverse();
  if (camps.length > 0 && camp === 'all') {
    h += `<div class="sec">${t('b_by_campaign')}</div><div class="card scroll-x"><table class="tbl"><thead><tr><th>${t('campaign')}</th><th>${t('gave_short')}</th><th>${t('recv_short')}</th><th>${t('balance')}</th></tr></thead><tbody>${camps.map(([k, v]) =>
      `<tr><td>${esc(k)}</td><td>${M(r2(v.donne))}</td><td>${M(r2(v.recu))}</td><td class="${cls(r2(v.donne - v.recu))}">${M(r2(v.donne - v.recu))}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const modes = Object.entries(b.mode);
  if (modes.length) {
    h += `<div class="sec">${t('b_by_mode')}</div><div class="card scroll-x"><table class="tbl"><thead><tr><th>${t('mode')}</th><th>${t('gave_short')}</th><th>${t('recv_short')}</th></tr></thead><tbody>${modes.map(([k, v]) =>
      `<tr><td>${t('m_' + k)}</td><td>${M(r2(v.donne))}</td><td>${M(r2(v.recu))}</td></tr>`).join('')}</tbody></table></div>`;
  }
  h += `<div class="card"><div class="row"><span class="grow">${t('b_ops')}</span><b class="num">${b.n}</b></div>
    ${b.first ? `<div class="row"><span class="grow">${t('b_first')}</span><b class="num">${fd(b.first)}</b></div><div class="row" style="border:0"><span class="grow">${t('b_last')}</span><b class="num">${fd(b.last)}</b></div>` : ''}</div>`;
  return h;
}

/* ----- Échéances ----- */
function viewDue() {
  const list = dueOps();
  const today = todayISO();
  const groups = [[t('due_overdue'), list.filter(o => o.echeance < today)], [t('due_week'), list.filter(o => o.echeance >= today && daysTo(o.echeance) <= 7)], [t('due_later'), list.filter(o => daysTo(o.echeance) > 7)]];
  let body = '';
  for (const [title, arr] of groups) {
    if (!arr.length) continue;
    body += `<div class="sec">${title}</div><div class="list">${arr.map(o => {
      const d = daysTo(o.echeance);
      const when = d < 0 ? t('days_late', { n: -d }) : d === 0 ? t('today') : t('in_days', { n: d });
      const c = compte(o.compte);
      const what = o.kind === 'argent' ? M(o.montant) : `<bdi>${esc(pname(produit(o.produit)))} ${esc(nf(o.qte, 0, 3))} ${t('u_' + o.unite)}</bdi>`;
      return `<div class="row op"><span class="ico ${o.sens === 'donne' ? 'g' : 'r'}">${ic(o.sens === 'donne' ? 'up' : 'down')}</span>
        <button class="grow" style="all:unset;cursor:pointer;display:block;flex:1;min-width:0" data-a="show-op" data-id="${o.id}"><span class="t">${esc(c ? c.nom : '')}</span><span class="m" style="display:block"><span class="tag ${d < 0 ? 'late' : ''}">${when}</span>${fd(o.echeance)}</span></button>
        <span class="v"><b class="${o.sens === 'donne' ? 'pos' : 'neg'}">${what}</b><br><button class="btn sm sec" style="margin-top:6px" data-a="settle" data-id="${o.id}">${t('settled')}</button></span></div>`;
    }).join('')}</div>`;
  }
  if (!body) body = `<div class="empty"><h3>${t('due_none')}</h3><p>${t('due_none_txt')}</p></div>`;
  return head({ title: t('due_title') }) + `<main class="main">${body}</main>`;
}

/* ----- Réglages ----- */
function viewSettings() {
  const lb = S.lastBackup ? fd(new Date(S.lastBackup).toISOString().slice(0, 10)) : t('never');
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] }));
  const row = (icn, label, action, sub = '', extra = '') => `<button class="row" data-a="${action}" ${extra}><span class="av">${ic(icn)}</span><span class="grow"><b class="nm">${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>${ic('chev', 'flip')}</button>`;
  return head({ title: t('settings') }) + `<main class="main">
    <div class="sec">${t('language')}</div>
    <div class="chips"><button class="chip ${S.lang === 'fr' ? 'on' : ''}" data-a="lang" data-v="fr">Français</button><button class="chip ${S.lang === 'ar' ? 'on' : ''}" data-a="lang" data-v="ar">العربية</button></div>
    <div class="sec">${t('products')}</div><div class="list">${S.produits.map(p => `<button class="row" data-a="edit-product" data-id="${p.id}"><span class="av">${ic('leaf')}</span><span class="grow"><b class="nm">${esc(pname(p))}</b><small>${p.base === 'kg' ? t('u_kg') : t('u_botte')}</small></span>${ic('chev', 'flip')}</button>`).join('')}
      ${row('plus', t('new_product'), 'new-product')}</div>
    <div class="sec">${t('security')}</div><div class="list">${row('lock', t('pin_title'), 'pin', S.pin ? t('pin_on') : t('pin_off'))}</div>
    <div class="sec">${t('backup')}</div><div class="list">
      ${row('download', t('export_json'), 'export-json', `${t('last_backup')} : ${lb}`)}
      ${canShare ? row('share', t('share_json'), 'share-json') : ''}
      ${row('upload', t('import_json'), 'import-json')}
      ${row('book', t('export_csv'), 'export-csv')}</div>
    <div class="sec">${t('journal')}</div><div class="list">${row('cal', t('journal'), 'journal')}</div>
    <div class="card" style="padding:14px 18px"><b>${t('about')}</b><p style="margin-top:6px;color:var(--muted);font-size:14px">${t('about_txt')}</p></div>
    <div class="card" style="padding:14px 18px"><b>${t('install')}</b><p style="margin-top:6px;color:var(--muted);font-size:14px">${t('install_txt')}</p><p style="margin-top:8px;color:var(--muted);font-size:14px">${t('data_note')}</p></div>
    <div style="padding:8px 18px 24px"><button class="btn danger block" data-a="reset-all">${ic('trash')}${t('reset_all')}</button></div>
    <input type="file" id="import-file" accept="application/json,.json" hidden></main>`;
}

/* ----- Rendu général ----- */
function render() {
  if (!S) return;
  if (camp !== 'all' && !campOptions().includes(camp)) camp = 'all';
  let html;
  switch (view.name) {
    case 'comptes': html = viewAccounts(); break;
    case 'compte': if (compte(view.id)) { html = viewAccount(); break; } view = { name: 'home' }; html = viewHome(); break;
    case 'echeances': html = viewDue(); break;
    case 'reglages': html = viewSettings(); break;
    default: html = viewHome();
  }
  $('#app').innerHTML = html;
  renderNav();
  renderFab();
}
function renderNav() {
  const act = { home: 'home', comptes: 'comptes', compte: 'comptes', echeances: 'echeances', reglages: 'reglages' }[view.name] || 'home';
  const od = overdueCount();
  $('#nav').innerHTML = [['home', 'home', 'nav_home'], ['comptes', 'users', 'nav_accounts'], ['echeances', 'cal', 'nav_due'], ['reglages', 'gear', 'nav_settings']]
    .map(([v, i, k]) => `<button class="${act === v ? 'on' : ''}" data-a="nav" data-v="${v}" ${act === v ? 'aria-current="page"' : ''}>${ic(i)}<span>${t(k)}</span>${v === 'echeances' && od ? `<em>${od}</em>` : ''}</button>`).join('');
}
function renderFab() {
  const f = $('#fab');
  const show = ['home', 'comptes', 'compte'].includes(view.name) && !(view.name === 'home' && !S.comptes.length);
  f.hidden = !show;
  f.innerHTML = ic('plus');
  f.setAttribute('aria-label', view.name === 'comptes' ? t('new_account') : t('new_op'));
}

/* =====================================================================
   FORMULAIRES
   ===================================================================== */
function accountSheet(id) {
  const c = id ? compte(id) : null;
  const type = c ? c.type : 'personne';
  openSheet(`${shHead(c ? t('edit_account') : t('new_account'))}
    <div class="sh-b">
      <div class="fld"><label for="a-nom">${t('name')}</label><input id="a-nom" value="${esc(c ? c.nom : '')}" autocomplete="off"></div>
      <div class="fld"><label>${t('type')}</label><div class="chips" id="a-type" style="padding:0">${['personne', 'societe', 'banque'].map(k => `<button type="button" class="chip ${type === k ? 'on' : ''}" data-a="pick" data-g="a-type" data-v="${k}">${t('t_' + k)}</button>`).join('')}</div></div>
      <div class="fld"><label for="a-tel">${t('phone')}</label><input id="a-tel" type="tel" inputmode="tel" value="${esc(c ? c.tel : '')}"></div>
      <div class="fld"><label for="a-note">${t('note')}</label><textarea id="a-note">${esc(c ? c.note : '')}</textarea></div>
    </div>
    <div class="sh-f"><p class="err" id="f-err" role="alert"></p><button class="btn block" data-a="save-account" data-id="${c ? c.id : ''}">${t('save')}</button>
    ${c ? `<button class="btn danger block" data-a="delete-account" data-id="${c.id}">${ic('trash')}${t('delete_account')}</button>` : ''}</div>`);
  if (!c) setTimeout(() => { const e = $('#a-nom'); e && e.focus(); }, 60);
}

const picked = id => { const e = $(`#${id} .on`); return e ? e.dataset.v : ''; };
const unitOpts = (p, sel) => unitsFor(p).map(u => `<option value="${u}" ${u === sel ? 'selected' : ''}>${t('u_' + u)}</option>`).join('');
const prodOpts = sel => S.produits.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(pname(p))}</option>`).join('');
const MODES = ['cash', 'cheque', 'transfer', 'effet', 'other'];
const modeOpts = sel => MODES.map(m => `<option value="${m}" ${m === sel ? 'selected' : ''}>${t('m_' + m)}</option>`).join('');
const campChoices = sel => { const set = new Set(campOptions()); set.add(sel); const y = new Date().getFullYear(); set.add(`${y}/${y + 1}`); return [...set].sort().reverse().map(c => `<option value="${c}" ${c === sel ? 'selected' : ''}>${c}</option>`).join(''); };

function opSheet(kind, o = {}) {
  if (!S.comptes.length) { toast(t('need_account')); return accountSheet(); }
  const ed = o.id ? S.ops.find(x => x.id === o.id) : null;
  const d = ed || { kind, compte: o.compte || (view.name === 'compte' ? view.id : ''), date: todayISO(), sens: 'donne', mode: 'cash', produit: S.produits[0] && S.produits[0].id, unite: 'kg' };
  const p = produit(d.produit) || S.produits[0];
  const camp0 = ed ? ed.campagne : campagneOf(d.date);
  const g = d.sens === 'donne';
  const title = kind === 'argent' ? (ed ? t('op_money_edit') : t('op_money_new')) : (ed ? t('op_nature_edit') : t('op_nature_new'));
  const specific = kind === 'argent' ? `
      <div class="fld"><label for="f-montant">${t('amount')}</label><input id="f-montant" inputmode="decimal" autocomplete="off" value="${ed ? esc(String(ed.montant).replace('.', ',')) : ''}"></div>
      <div class="fld"><label for="f-mode">${t('mode')}</label><select id="f-mode" data-change="mode">${modeOpts(d.mode)}</select></div>
      <div class="two" id="f-chq" ${['cheque', 'effet'].includes(d.mode) ? '' : 'hidden'}>
        <div class="fld"><label for="f-cheque">${t('cheque_no')}</label><input id="f-cheque" value="${esc(ed ? ed.cheque : '')}"></div>
        <div class="fld"><label for="f-banque">${t('bank')}</label><input id="f-banque" value="${esc(ed ? ed.banque : '')}"></div></div>` : `
      <div class="fld"><label for="f-prod">${t('product')}</label><select id="f-prod" data-change="prod">${prodOpts(d.produit)}</select></div>
      <div class="two"><div class="fld"><label for="f-qte">${t('qty')}</label><input id="f-qte" inputmode="decimal" autocomplete="off" value="${ed ? esc(String(ed.qte).replace('.', ',')) : ''}"></div>
      <div class="fld"><label for="f-unite">${t('unit')}</label><select id="f-unite">${unitOpts(p, d.unite)}</select></div></div>
      <div class="fld"><label for="f-valeur">${t('value_dh')}</label><input id="f-valeur" inputmode="decimal" autocomplete="off" value="${ed && ed.valeur ? esc(String(ed.valeur).replace('.', ',')) : ''}"></div>`;
  const troc = (kind === 'nature' && !ed) ? `
    <div class="troc"><div class="lbl">${t('exchange')}</div>
      <div class="chips" id="f-ex">${[['none', 'ex_none'], ['product', 'ex_product'], ['money', 'ex_money']].map(([v, k]) => `<button type="button" class="chip ${v === 'none' ? 'on' : ''}" data-a="pick" data-g="f-ex" data-v="${v}">${t(k)}</button>`).join('')}</div>
      <div id="ex-product" hidden>
        <div class="fld"><label for="f-prod2">${t('product')}</label><select id="f-prod2" data-change="prod2">${prodOpts((S.produits[1] || S.produits[0]).id)}</select></div>
        <div class="two"><div class="fld"><label for="f-qte2">${t('qty')}</label><input id="f-qte2" inputmode="decimal" autocomplete="off"></div>
        <div class="fld"><label for="f-unite2">${t('unit')}</label><select id="f-unite2">${unitOpts(S.produits[1] || S.produits[0], 'kg')}</select></div></div></div>
      <div id="ex-money" hidden>
        <div class="fld"><label for="f-montant2">${t('amount')}</label><input id="f-montant2" inputmode="decimal" autocomplete="off"></div>
        <div class="two"><div class="fld"><label for="f-sens2">${t('ex_direction')}</label><select id="f-sens2"><option value="donne">${t('gave')}</option><option value="recu" selected>${t('received')}</option></select></div>
        <div class="fld"><label for="f-mode2">${t('mode')}</label><select id="f-mode2">${modeOpts('cash')}</select></div></div></div></div>` : '';
  openSheet(`${shHead(title)}<div class="sh-b">
      <div class="fld"><label for="f-compte">${t('account')}</label><select id="f-compte"><option value="">${t('choose')}</option>${S.comptes.map(c => `<option value="${c.id}" ${c.id === d.compte ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></div>
      <div class="fld"><label>${t('direction')}</label><div class="seg" id="f-sens">
        <button type="button" class="s-gave ${g ? 'on' : ''}" data-a="pick" data-g="f-sens" data-v="donne"><b>${ic('up')}${t('gave')}</b><small>${t('gave_hint')}</small></button>
        <button type="button" class="s-recv ${g ? '' : 'on'}" data-a="pick" data-g="f-sens" data-v="recu"><b>${ic('down')}${t('received')}</b><small>${t('recv_hint')}</small></button></div></div>
      <div class="fld"><label for="f-date">${t('date')}</label><input id="f-date" type="date" value="${d.date}" data-change="date"></div>
      ${specific}${troc}
      <div class="two"><div class="fld"><label for="f-echeance">${t('due_date')}</label><input id="f-echeance" type="date" value="${ed && ed.echeance ? ed.echeance : ''}"></div>
      <div class="fld"><label for="f-camp">${t('campaign_f')}</label><select id="f-camp" data-change="campf">${campChoices(camp0)}</select></div></div>
      <div class="fld"><label for="f-note">${t('note')}</label><textarea id="f-note">${esc(ed ? ed.note : '')}</textarea></div>
      <div class="fld"><label>${t('photo')}</label><div class="photo-box"><button type="button" class="btn sec sm" data-a="pick-photo">${ic('clip')}${t('add_photo')}</button><button type="button" class="btn danger sm" id="photo-rm" data-a="rm-photo" hidden>${t('remove_photo')}</button><img id="photo-prev" alt="" hidden></div><input type="file" id="f-photo" accept="image/*" hidden></div>
    </div>
    <div class="sh-f"><p class="err" id="f-err" role="alert"></p><button class="btn block" data-a="save-op" data-kind="${kind}" data-id="${ed ? ed.id : ''}">${t('save')}</button></div>`);
  if (ed && ed.photo) showPhotoPrev(ed.photo);
}

async function showPhotoPrev(id) {
  try {
    const data = pendingPhoto && pendingPhoto.id === id ? pendingPhoto.data : await idb.get('photos', id);
    if (data && $('#photo-prev')) { $('#photo-prev').src = data; $('#photo-prev').hidden = false; $('#photo-rm') && ($('#photo-rm').hidden = false); }
  } catch (e) { console.error(e); }
}
function compressImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1100; const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url); res(cv.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image')); };
    img.src = url;
  });
}

async function saveOp(kind, editId) {
  const cid = $('#f-compte').value;
  const date = $('#f-date').value;
  const sens = picked('f-sens') || 'donne';
  if (!cid) return formErr(t('err_required') + ' : ' + t('account'));
  if (!date) return formErr(t('err_required') + ' : ' + t('date'));
  const f = {
    compte: cid, date, sens, echeance: $('#f-echeance').value || null,
    campagne: $('#f-camp').value || campagneOf(date), note: $('#f-note').value.trim()
  };
  let extra;
  if (kind === 'argent') {
    const m = num($('#f-montant').value);
    if (!(m > 0)) return formErr(t('err_amount'));
    const mode = $('#f-mode').value;
    extra = { kind: 'argent', montant: r2(m), mode, cheque: ['cheque', 'effet'].includes(mode) ? $('#f-cheque').value.trim() : '', banque: ['cheque', 'effet'].includes(mode) ? $('#f-banque').value.trim() : '' };
  } else {
    const p = produit($('#f-prod').value);
    const q = num($('#f-qte').value);
    if (!(q > 0)) return formErr(t('err_qty'));
    const unite = $('#f-unite').value;
    const v = num($('#f-valeur').value);
    extra = { kind: 'nature', produit: p.id, qte: r3(q), unite, qteBase: r3(toBase(p, q, unite)), valeur: v > 0 ? r2(v) : 0 };
  }
  // photo
  let photo = null;
  const old = editId ? S.ops.find(x => x.id === editId) : null;
  photo = old ? old.photo || null : null;
  if (photoRemoved && photo) { await idb.del('photos', photo).catch(() => {}); photo = null; }
  if (pendingPhoto) { if (photo && photo !== pendingPhoto.id) await idb.del('photos', photo).catch(() => {}); await idb.set('photos', pendingPhoto.id, pendingPhoto.data); photo = pendingPhoto.id; }

  if (old) {
    const nw = { ...old, ...f, ...extra, photo, modifie: Date.now() };
    if (nw.echeance !== old.echeance) nw.regle = false;
    const d = {};
    ['compte', 'date', 'sens', 'montant', 'mode', 'cheque', 'banque', 'produit', 'qte', 'unite', 'valeur', 'echeance', 'campagne', 'note'].forEach(k => {
      if ((old[k] ?? '') !== (nw[k] ?? '')) d[k] = [old[k] ?? '', nw[k] ?? ''];
    });
    Object.assign(old, nw);
    logJ('edit', old, { d });
  } else {
    const o = { id: uid(), ...f, ...extra, regle: false, photo, lien: null, annule: false, cree: stamp() };
    const created = [o];
    if (kind === 'nature') {
      const ex = picked('f-ex');
      if (ex === 'product') {
        const p2 = produit($('#f-prod2').value); const q2 = num($('#f-qte2').value);
        if (!(q2 > 0)) return formErr(t('err_qty'));
        const u2 = $('#f-unite2').value;
        const lien = uid(); o.lien = lien;
        created.push({ id: uid(), compte: cid, date, sens: sens === 'donne' ? 'recu' : 'donne', echeance: null, campagne: f.campagne, note: f.note, kind: 'nature', produit: p2.id, qte: r3(q2), unite: u2, qteBase: r3(toBase(p2, q2, u2)), valeur: o.valeur || 0, regle: false, photo: null, lien, annule: false, cree: stamp() });
      } else if (ex === 'money') {
        const m2 = num($('#f-montant2').value);
        if (!(m2 > 0)) return formErr(t('err_amount'));
        const lien = uid(); o.lien = lien;
        created.push({ id: uid(), compte: cid, date, sens: $('#f-sens2').value, echeance: null, campagne: f.campagne, note: f.note, kind: 'argent', montant: r2(m2), mode: $('#f-mode2').value, cheque: '', banque: '', regle: false, photo: null, lien, annule: false, cree: stamp() });
      }
    }
    created.forEach(x => { S.ops.push(x); logJ('create', x); });
  }
  save();
  closeSheet();
  toast(t('saved'));
}

/* ----- Détail d'une opération ----- */
function showOp(id) {
  const o = S.ops.find(x => x.id === id); if (!o) return;
  const c = compte(o.compte);
  const kv = (k, v) => `<div class="kv"><span>${k}</span><span>${v}</span></div>`;
  let h = kv(t('account'), esc(c ? c.nom : '')) + kv(t('date'), `<bdi class="num">${fd(o.date)}</bdi>`) + kv(t('direction'), `<span class="${o.sens === 'donne' ? 'pos' : 'neg'}">${o.sens === 'donne' ? t('gave') : t('received')}</span>`);
  if (o.kind === 'argent') {
    h += kv(t('amount'), M(o.montant)) + kv(t('mode'), t('m_' + o.mode));
    if (o.cheque) h += kv(t('cheque_no'), esc(o.cheque));
    if (o.banque) h += kv(t('bank'), esc(o.banque));
  } else {
    const p = produit(o.produit);
    h += kv(t('product'), esc(pname(p))) + kv(t('qty'), `<bdi>${esc(nf(o.qte, 0, 3))} ${t('u_' + o.unite)}</bdi>${o.unite !== baseUnit(p) ? ` <small>(${qh(p, o.qteBase)})</small>` : ''}`);
    if (o.valeur) h += kv(t('value_dh'), M(o.valeur));
  }
  if (o.echeance) h += kv(t('due_date'), `<bdi class="num">${fd(o.echeance)}</bdi>${o.regle ? ` — ${t('settled')}` : ''}`);
  h += kv(t('campaign_f'), `<bdi class="num">${esc(o.campagne)}</bdi>`);
  if (o.note) h += kv(t('note'), esc(o.note));
  if (o.annule) h += kv('', `<span class="tag">${t('voided')}</span>`);
  if (o.photo) h += `<div class="fld" style="margin-top:12px"><img id="op-photo" alt="" style="max-width:100%;border-radius:12px;display:none"></div>`;
  const linked = o.lien ? S.ops.filter(x => x.lien === o.lien && x.id !== o.id) : [];
  if (linked.length) h += `<div class="sec" style="padding-inline:0">${t('linked')}</div>` + linked.map(x => `<button class="row" style="padding-inline:0" data-a="show-op" data-id="${x.id}"><span class="grow">${esc(opSummary(x))}</span>${ic('chev', 'flip')}</button>`).join('');
  const hist = S.journal.filter(j => j.op === o.id).reverse();
  if (hist.length) h += `<div class="sec" style="padding-inline:0">${t('history')}</div>` + hist.map(jHTML).join('');
  openSheet(`${shHead(o.kind === 'argent' ? t('tab_money') : t('tab_nature'))}<div class="sh-b">${h}</div>
    <div class="sh-f">
      ${o.echeance && !o.regle && !o.annule ? `<button class="btn block" data-a="settle" data-id="${o.id}">${ic('check')}${t('mark_settled')}</button>` : ''}
      ${!o.annule ? `<button class="btn sec block" data-a="edit-op" data-id="${o.id}">${ic('edit')}${t('edit')}</button><button class="btn danger block" data-a="void-op" data-id="${o.id}">${t('void_op')}</button>`
        : `<button class="btn block" data-a="restore-op" data-id="${o.id}">${t('restore_op')}</button>`}</div>`);
  if (o.photo) idb.get('photos', o.photo).then(d => { const im = $('#op-photo'); if (im && d) { im.src = d; im.style.display = 'block'; } }).catch(() => {});
}

const JKEY = { compte: 'account', date: 'date', sens: 'direction', montant: 'amount', mode: 'mode', cheque: 'cheque_no', banque: 'bank', produit: 'product', qte: 'qty', unite: 'unit', valeur: 'value_dh', echeance: 'due_date', campagne: 'campaign_f', note: 'note' };
function jVal(k, v) {
  if (v === '' || v === null || v === undefined) return '—';
  if (k === 'sens') return v === 'donne' ? t('gave') : t('received');
  if (k === 'compte') return esc((compte(v) || {}).nom || '?');
  if (k === 'produit') return esc(pname(produit(v)));
  if (k === 'mode') return t('m_' + v);
  if (k === 'unite') return t('u_' + v);
  if (k === 'date' || k === 'echeance') return fd(v);
  return esc(v);
}
function jHTML(j) {
  const dt = new Date(j.ts);
  const when = `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
  const diffs = j.d ? Object.entries(j.d).map(([k, [a, b]]) => `<small>${t(JKEY[k] || k)} : ${jVal(k, a)} → ${jVal(k, b)}</small>`).join('') : '';
  return `<div class="j"><b>${t('j_' + j.a)}</b> <span class="d num">${when}</span><small>${esc(j.txt || '')}</small>${diffs}</div>`;
}

/* ----- Produits ----- */
function productSheet(id) {
  const p = id ? produit(id) : null;
  const base = p ? p.base : 'kg';
  openSheet(`${shHead(p ? t('edit_product') : t('new_product'))}<div class="sh-b">
    <div class="fld"><label for="p-nom">${t('product_name')}</label><input id="p-nom" value="${esc(p ? p.nom : '')}" autocomplete="off"></div>
    <div class="fld"><label for="p-ar">${t('product_name_ar')}</label><input id="p-ar" dir="rtl" value="${esc(p ? p.nomAr || '' : '')}" autocomplete="off"></div>
    <div class="fld"><label for="p-base">${t('base_unit')}</label><select id="p-base" data-change="pbase"><option value="kg" ${base === 'kg' ? 'selected' : ''}>${t('u_kg')} (${t('u_qx')}, ${t('u_t')}, ${t('u_sac')})</option><option value="botte" ${base === 'botte' ? 'selected' : ''}>${t('u_botte')}</option></select></div>
    <div class="fld" id="p-sacbox" ${base === 'kg' ? '' : 'hidden'}><label for="p-sac">${t('sac_kg')}</label><input id="p-sac" inputmode="decimal" value="${p && p.sacKg ? p.sacKg : 50}"></div>
  </div><div class="sh-f"><p class="err" id="f-err" role="alert"></p><button class="btn block" data-a="save-product" data-id="${p ? p.id : ''}">${t('save')}</button>
  ${p ? `<button class="btn danger block" data-a="delete-product" data-id="${p.id}">${ic('trash')}${t('delete')}</button>` : ''}</div>`);
}

/* ----- PIN ----- */
async function hashPin(pin) {
  const data = new TextEncoder().encode(`${S.salt}:${pin}`);
  if (window.crypto && crypto.subtle) {
    const h = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 5381; for (const b of data) h = ((h << 5) + h + b) | 0;
  return 'x' + h;
}
function pinSheet() {
  openSheet(`${shHead(t('pin_title'))}<div class="sh-b">
    ${S.pin ? `<div class="fld"><label for="pin-cur">${t('pin_current')}</label><input id="pin-cur" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></div>` : ''}
    <div class="fld"><label for="pin-new">${t('pin_new')}</label><input id="pin-new" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></div>
    <div class="fld"><label for="pin-conf">${t('pin_confirm')}</label><input id="pin-conf" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></div>
  </div><div class="sh-f"><p class="err" id="f-err" role="alert"></p><button class="btn block" data-a="save-pin">${t('save')}</button>
  ${S.pin ? `<button class="btn danger block" data-a="remove-pin">${t('pin_remove')}</button>` : ''}</div>`);
}
function showLock() {
  locked = true; lockBuf = '';
  const el = $('#lock'); el.hidden = false;
  el.innerHTML = `<h2>${t('app_name')}</h2><p>${t('pin_enter')}</p><div class="dots" id="dots"></div><div class="lock-msg" id="lock-msg" role="alert"></div>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-a="key" data-v="${n}">${n}</button>`).join('')}<span></span><button data-a="key" data-v="0">0</button><button data-a="key" data-v="del" aria-label="⌫">⌫</button></div>`;
  paintDots();
}
function paintDots() {
  const n = S.pinLen || 4;
  $('#dots').innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < lockBuf.length ? 'f' : ''}"></i>`).join('');
}
async function pressKey(v) {
  if (!locked) return;
  if (v === 'del') lockBuf = lockBuf.slice(0, -1); else if (lockBuf.length < (S.pinLen || 4)) lockBuf += v;
  paintDots();
  if (lockBuf.length === (S.pinLen || 4)) {
    const h = await hashPin(lockBuf);
    if (h === S.pin) { locked = false; $('#lock').hidden = true; $('#lock').innerHTML = ''; }
    else {
      const d = $('#dots'); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake');
      $('#lock-msg').textContent = t('pin_wrong'); lockBuf = ''; setTimeout(paintDots, 350);
    }
  } else { const m = $('#lock-msg'); if (m) m.textContent = ''; }
}
document.addEventListener('keydown', e => { if (locked && /^\d$/.test(e.key)) pressKey(e.key); else if (locked && e.key === 'Backspace') pressKey('del'); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (S && S.pin && !locked && hiddenAt && Date.now() - hiddenAt > 60000) showLock();
});

/* =====================================================================
   SAUVEGARDE, EXPORT, RELEVÉ
   ===================================================================== */
function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function backupBlob() {
  const photos = await idb.all('photos').catch(() => ({}));
  return new Blob([JSON.stringify({ app: 'mescomptes', v: 1, exporte: new Date().toISOString(), state: S, photos })], { type: 'application/json' });
}
const bkName = () => `mes-comptes-${todayISO()}.json`;
async function exportJSON() {
  download(bkName(), await backupBlob());
  S.lastBackup = Date.now(); save(); render(); toast(t('saved'));
}
async function shareJSON() {
  const file = new File([await backupBlob()], bkName(), { type: 'application/json' });
  try { await navigator.share({ files: [file], title: t('app_name') }); S.lastBackup = Date.now(); save(); render(); } catch (e) { /* annulé */ }
}
async function importJSON(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'mescomptes' || !data.state || !Array.isArray(data.state.comptes) || !Array.isArray(data.state.ops)) throw new Error('bad');
    if (!confirm(t('import_confirm'))) return;
    S = Object.assign(defaultState(), data.state);
    await idb.clear('photos');
    for (const k in (data.photos || {})) await idb.set('photos', k, data.photos[k]);
    await flushSave();
    applyLang(); view = { name: 'reglages' }; render(); toast(t('import_ok'));
  } catch (e) { console.error(e); alert(t('import_bad')); }
}
function exportCSV() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['date', 'compte', 'type_compte', 'nature_operation', 'sens', 'montant_MAD', 'mode', 'n_cheque', 'banque', 'produit', 'quantite', 'unite', 'quantite_kg_ou_botte', 'valeur_MAD', 'echeance', 'regle', 'campagne', 'note', 'annulee'];
  const lines = [head.join(';')];
  [...S.ops].sort(cmpAsc).forEach(o => {
    const c = compte(o.compte) || {}; const p = produit(o.produit);
    lines.push([o.date, q(c.nom), c.type, o.kind, o.sens === 'donne' ? 'donne' : 'recu', o.kind === 'argent' ? String(o.montant).replace('.', ',') : '', o.mode || '', q(o.cheque), q(o.banque),
      p ? q(p.nom) : '', o.kind === 'nature' ? String(o.qte).replace('.', ',') : '', o.unite || '', o.kind === 'nature' ? String(o.qteBase).replace('.', ',') : '',
      o.valeur ? String(o.valeur).replace('.', ',') : '', o.echeance || '', o.regle ? 'oui' : '', o.campagne, q(o.note), o.annule ? 'oui' : ''].join(';'));
  });
  download(`mes-comptes-${todayISO()}.csv`, new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
}

function statementHTML(c) {
  const ops = opsOf(c.id).sort(cmpAsc);
  const b = bilan(ops);
  const money = ops.filter(o => o.kind === 'argent');
  const nat = ops.filter(o => o.kind === 'nature');
  let r = 0; const rp = {};
  const label = o => `${t('m_' + o.mode)}${o.cheque ? ' ' + esc(o.cheque) : ''}${o.note ? ' — ' + esc(o.note) : ''}`;
  let h = `<h1>${t('st_title')} — ${esc(c.nom)}</h1><div class="meta">${t('st_issued')} ${fd(todayISO())}${camp !== 'all' ? ` — ${t('campaign')} ${camp}` : ''}${c.tel ? ` — ${esc(c.tel)}` : ''}</div>`;
  if (money.length) {
    h += `<h2>${t('tab_money')}</h2><table><thead><tr><th>${t('date')}</th><th class="l">${t('st_label')}</th><th>${t('gave_short')}</th><th>${t('recv_short')}</th><th>${t('balance')}</th></tr></thead><tbody>${money.map(o => {
      r = r2(r + sign(o) * o.montant);
      return `<tr><td class="num">${fd(o.date)}</td><td class="l">${label(o)}</td><td class="num">${o.sens === 'donne' ? nf(o.montant, 2, 2) : ''}</td><td class="num">${o.sens === 'recu' ? nf(o.montant, 2, 2) : ''}</td><td class="num">${nf(r, 2, 2)}</td></tr>`;
    }).join('')}</tbody><tfoot><tr><td colspan="2">${t('st_final')} (${t('cur')})</td><td class="num">${nf(b.donne, 2, 2)}</td><td class="num">${nf(b.recu, 2, 2)}</td><td class="num ${cls(b.solde)}">${nf(b.solde, 2, 2)}</td></tr></tfoot></table>
      <div class="big ${cls(b.solde)}">${lbl(b.solde)} : ${Mtxt(b.solde)}</div>`;
  }
  if (nat.length) {
    h += `<h2>${t('tab_nature')}</h2><table><thead><tr><th>${t('date')}</th><th class="l">${t('product')}</th><th>${t('gave_short')}</th><th>${t('recv_short')}</th><th>${t('balance')}</th></tr></thead><tbody>${nat.map(o => {
      const p = produit(o.produit); rp[o.produit] = r3((rp[o.produit] || 0) + sign(o) * o.qteBase);
      const q = `${nf(o.qte, 0, 3)} ${t('u_' + o.unite)}`;
      return `<tr><td class="num">${fd(o.date)}</td><td class="l">${esc(pname(p))}${o.note ? ' — ' + esc(o.note) : ''}</td><td>${o.sens === 'donne' ? esc(q) : ''}</td><td>${o.sens === 'recu' ? esc(q) : ''}</td><td>${esc(qtyPlain(p, rp[o.produit]))}</td></tr>`;
    }).join('')}</tbody><tfoot>${Object.entries(b.nat).map(([pid, n]) => `<tr><td colspan="4">${esc(pname(produit(pid)))} — ${t('st_final')}</td><td class="${cls(n.solde)}">${esc(qtyPlain(produit(pid), n.solde))}</td></tr>`).join('')}</tfoot></table>`;
    if (b.valeur) h += `<div class="big">${t('b_value')} : ${Mtxt(b.valeur)}</div>`;
  }
  h += `<div class="foot">${t('st_footer')}</div>`;
  return h;
}
function printStatement(id) {
  const c = compte(id); if (!c) return;
  $('#print').innerHTML = statementHTML(c);
  const old = document.title; document.title = `${t('st_title')} ${c.nom}`;
  setTimeout(() => { window.print(); document.title = old; }, 60);
}
window.addEventListener('afterprint', () => { $('#print').innerHTML = ''; });

function waNumber(tel) {
  let d = String(tel || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '212' + d.slice(1);
  return d.replace(/\D/g, '');
}
function waText(c) {
  const b = bilan(opsOf(c.id));
  const L = [`*${t('st_title')} — ${c.nom}*`, `${t('st_issued')} ${fd(todayISO())}${camp !== 'all' ? ` (${t('campaign')} ${camp})` : ''}`, ''];
  L.push(`${t('tab_money')} : ${Mtxt(b.solde)} — ${lbl(b.solde)}`);
  Object.entries(b.nat).filter(([, n]) => n.solde !== 0).forEach(([pid, n]) => L.push(`${pname(produit(pid))} : ${qtyPlain(produit(pid), n.solde)} — ${lbl(n.solde)}`));
  return L.join('\n');
}

/* =====================================================================
   ACTIONS (clics)
   ===================================================================== */
const A = {
  back() { if (history.length > 1) history.back(); else go({ name: 'home' }, true); },
  nav(el) { if (sheetOpen) closeSheet(true); go({ name: el.dataset.v }); },
  'open-acc'(el) { go({ name: 'compte', id: el.dataset.id, tab: 'argent' }); },
  tab(el) { view = { ...view, tab: el.dataset.v }; history.replaceState(view, ''); render(); },
  filter(el) { view = { ...view, f: el.dataset.v }; history.replaceState(view, ''); render(); },
  'sheet-x'() { closeSheet(); },
  pick(el) {
    const g = el.dataset.g;
    $$(`#${g} > *`).forEach(b => b.classList.toggle('on', b === el));
    if (g === 'f-ex') { $('#ex-product').hidden = el.dataset.v !== 'product'; $('#ex-money').hidden = el.dataset.v !== 'money'; }
    if (g === 'f-sens' && $('#f-sens2') && !$('#f-sens2').dataset.touched) $('#f-sens2').value = el.dataset.v === 'donne' ? 'recu' : 'donne';
  },
  fab() {
    if (view.name === 'comptes') return accountSheet();
    if (view.name === 'compte') return opSheet(view.tab === 'nature' ? 'nature' : 'argent', { compte: view.id });
    openSheet(`${shHead(t('new_op'))}<div class="sh-b">
      <button class="choice" data-a="new-op" data-kind="argent">${ic('coin')}${t('add_money')}</button>
      <button class="choice" data-a="new-op" data-kind="nature">${ic('leaf')}${t('add_nature')}</button>
      <button class="choice" data-a="new-account">${ic('users')}${t('new_account')}</button></div>`);
  },
  'new-op'(el) { closeSheet(true); opSheet(el.dataset.kind, { compte: el.dataset.c || undefined }); },
  'new-account'() { closeSheet(true); accountSheet(); },
  'edit-account'(el) { accountSheet(el.dataset.id); },
  'save-account'(el) {
    const nom = $('#a-nom').value.trim();
    if (!nom) return formErr(t('err_required') + ' : ' + t('name'));
    const data = { nom, type: picked('a-type') || 'personne', tel: $('#a-tel').value.trim(), note: $('#a-note').value.trim() };
    if (el.dataset.id) { Object.assign(compte(el.dataset.id), data); logJ('acc_edit', null, { compte: el.dataset.id, txt: nom }); }
    else { const c = { id: uid(), ...data, cree: Date.now() }; S.comptes.push(c); logJ('acc_create', null, { compte: c.id, txt: nom }); if (view.name === 'comptes' || view.name === 'home') { /* reste sur l'écran */ } }
    save(); closeSheet(); toast(t('saved'));
  },
  'delete-account'(el) {
    const id = el.dataset.id;
    if (S.ops.some(o => o.compte === id)) return formErr(t('delete_account_blocked'));
    if (!confirm(t('confirm_delete_account'))) return;
    logJ('acc_delete', null, { compte: id, txt: (compte(id) || {}).nom });
    S.comptes = S.comptes.filter(c => c.id !== id);
    save(); closeSheet(true); go({ name: 'comptes' }, true);
  },
  'show-op'(el) { closeSheet(true); showOp(el.dataset.id); },
  'edit-op'(el) { const o = S.ops.find(x => x.id === el.dataset.id); closeSheet(true); opSheet(o.kind, { id: o.id }); },
  'save-op'(el) { saveOp(el.dataset.kind, el.dataset.id || null); },
  'void-op'(el) {
    if (!confirm(t('confirm_void'))) return;
    const o = S.ops.find(x => x.id === el.dataset.id); o.annule = true; logJ('void', o); save(); closeSheet();
  },
  'restore-op'(el) { const o = S.ops.find(x => x.id === el.dataset.id); o.annule = false; logJ('restore', o); save(); closeSheet(); },
  settle(el) { const o = S.ops.find(x => x.id === el.dataset.id); o.regle = true; logJ('settle', o); save(); if (sheetOpen) closeSheet(); else render(); toast(t('saved')); },
  'pick-photo'() { $('#f-photo').click(); },
  'rm-photo'() { photoRemoved = true; pendingPhoto = null; $('#photo-prev').hidden = true; $('#photo-rm').hidden = true; },
  statement(el) { printStatement(el.dataset.id); },
  wa(el) {
    const c = compte(el.dataset.id); const n = waNumber(c.tel);
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(waText(c))}`, '_blank');
  },
  lang(el) { S.lang = el.dataset.v; save(); applyLang(); render(); },
  'new-product'() { productSheet(); },
  'edit-product'(el) { productSheet(el.dataset.id); },
  'save-product'(el) {
    const nom = $('#p-nom').value.trim();
    if (!nom) return formErr(t('err_required') + ' : ' + t('product_name'));
    const base = $('#p-base').value;
    const data = { nom, nomAr: $('#p-ar').value.trim(), base, sacKg: base === 'kg' ? (num($('#p-sac').value) > 0 ? num($('#p-sac').value) : 50) : 0 };
    if (el.dataset.id) {
      const p = produit(el.dataset.id);
      if (p.base !== base && S.ops.some(o => o.produit === p.id)) return formErr(t('product_used'));
      Object.assign(p, data);
      if (data.base === 'kg') S.ops.filter(o => o.produit === p.id && o.unite === 'sac').forEach(o => { o.qteBase = r3(o.qte * data.sacKg); });
    } else S.produits.push({ id: 'p_' + uid(), ...data });
    save(); closeSheet(); toast(t('saved'));
  },
  'delete-product'(el) {
    if (S.ops.some(o => o.produit === el.dataset.id)) return formErr(t('product_used'));
    S.produits = S.produits.filter(p => p.id !== el.dataset.id); save(); closeSheet();
  },
  pin() { pinSheet(); },
  async 'save-pin'() {
    const cur = $('#pin-cur') ? $('#pin-cur').value : '';
    const n = $('#pin-new').value, c = $('#pin-conf').value;
    if (S.pin && await hashPin(cur) !== S.pin) return formErr(t('pin_wrong'));
    if (!/^\d{4,6}$/.test(n)) return formErr(t('pin_format'));
    if (n !== c) return formErr(t('pin_mismatch'));
    S.salt = S.salt || uid(); S.pin = await hashPin(n); S.pinLen = n.length;
    await flushSave(); closeSheet(); toast(t('pin_saved'));
  },
  async 'remove-pin'() {
    const cur = $('#pin-cur') ? $('#pin-cur').value : '';
    if (await hashPin(cur) !== S.pin) return formErr(t('pin_wrong'));
    S.pin = null; await flushSave(); closeSheet(); toast(t('pin_removed'));
  },
  key(el) { pressKey(el.dataset.v); },
  'export-json'() { exportJSON(); },
  'share-json'() { shareJSON(); },
  'import-json'() { $('#import-file').click(); },
  'export-csv'() { exportCSV(); },
  journal() {
    const list = [...S.journal].reverse().slice(0, 150);
    openSheet(`${shHead(t('journal'))}<div class="sh-b">${list.length ? list.map(jHTML).join('') : `<div class="empty">${t('journal_empty')}</div>`}</div>`);
  },
  async 'reset-all'() {
    if (!confirm(t('reset_confirm'))) return;
    const lang = S.lang; S = defaultState(); S.lang = lang;
    await idb.clear('photos').catch(() => {}); await flushSave();
    camp = 'all'; applyLang(); go({ name: 'home' }, true);
  }
};

const CH = {
  camp(el) { camp = el.value; render(); },
  mode(el) { $('#f-chq').hidden = !['cheque', 'effet'].includes(el.value); },
  date(el) { const c = $('#f-camp'); if (!c.dataset.touched && el.value) { const v = campagneOf(el.value); if (![...c.options].some(o => o.value === v)) c.add(new Option(v, v)); c.value = v; } },
  campf(el) { el.dataset.touched = '1'; },
  prod(el) { const p = produit(el.value); $('#f-unite').innerHTML = unitOpts(p, 'kg'); },
  prod2(el) { const p = produit(el.value); $('#f-unite2').innerHTML = unitOpts(p, 'kg'); },
  pbase(el) { $('#p-sacbox').hidden = el.value !== 'kg'; }
};

document.addEventListener('click', e => {
  if (e.target.closest('#fab')) return A.fab();
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const fn = A[el.dataset.a];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('change', async e => {
  const k = e.target.dataset && e.target.dataset.change;
  if (k && CH[k]) CH[k](e.target);
  if (e.target.id === 'f-sens2') e.target.dataset.touched = '1';
  if (e.target.id === 'f-photo' && e.target.files[0]) {
    try {
      const data = await compressImage(e.target.files[0]);
      pendingPhoto = { id: 'ph_' + uid(), data }; photoRemoved = false;
      $('#photo-prev').src = data; $('#photo-prev').hidden = false; $('#photo-rm').hidden = false;
    } catch (err) { console.error(err); }
    e.target.value = '';
  }
  if (e.target.id === 'import-file' && e.target.files[0]) { await importJSON(e.target.files[0]); e.target.value = ''; }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { view.q = e.target.value; $('#acc-list').innerHTML = accListHTML(); }
});

/* =====================================================================
   DÉMARRAGE
   ===================================================================== */
async function boot() {
  let stored = null;
  try { await idb.open(); stored = await idb.get('kv', 'state'); }
  catch (e) { console.error(e); }
  S = Object.assign(defaultState(), stored || {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  history.replaceState({ name: 'home' }, '');
  applyLang();
  render();
  if (S.pin) showLock();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(console.error);
}
window.__app = { get S() { return S; } };   // pour les tests
boot();
})();
