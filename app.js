/* ระบบบันทึกผลการทดสอบ Herbal ERP (UAT) · หน้าเว็บ · ใช้ได้กับหลายโรงงาน (ผู้ทดสอบระบุโรงงาน / บริษัทของตัวเอง)
 * ข้อมูลข้อทดสอบมาจาก cases.js (สร้างจาก tools/build_web_app.py) + ข้อที่แอดมินเพิ่มในแท็บ "ข้อทดสอบ" ของ Google Sheet
 * ผลการทดสอบส่งไป Google Apps Script (config.js) ทุกครั้งที่เลือกผลหรือพิมพ์ ถ้าเน็ตหลุดจะเก็บไว้ในเครื่องแล้วส่งให้เองภายหลัง
 */
(function () {
  'use strict';
  const API = String((window.SA_CONFIG || {}).API_URL || '').trim();
  const DATA = window.SA_DATA;
  const BUILTIN = DATA.cases;
  const LABEL = { pass: 'ผ่าน', fail: 'ไม่ผ่าน', block: 'ติดปัญหา (ทดสอบต่อไม่ได้)' };
  const SHORT = { pass: 'ผ่าน', fail: 'ไม่ผ่าน', block: 'ติดปัญหา' };
  const PRODUCT = 'Herbal ERP';
  // วันที่ทดสอบจริง (ช่องวันที่ทดสอบ) และรอบทดสอบ (ผู้ดูแลเปิด/ปิดให้ผู้ทดสอบเห็น) จาก cases.js
  // รอบ = ข้อความที่อยู่ในช่วงเวลาของข้อ เช่น '14 ต.ค. 2569' (โจทย์หลักใน Zoom) / 'ทดสอบต่อเอง 16–21 ต.ค. 2569'
  const DAYS = (DATA.days && DATA.days.length) ? DATA.days.slice() : ['14 ต.ค. 2569'];
  const TEST_DAYS = (DATA.rounds && DATA.rounds.length) ? DATA.rounds.slice() : DAYS.slice(0, 1);
  // 16 ต.ค. 2569 ผู้ใช้สั่ง "ไม่แบ่งวันแล้ว": ทุกคนเห็นทุกข้อ ไม่มีตัวกรอง/การเปิดรอบ ข้อไหนจะแสดงให้ตั้งในแท็บ ข้อทดสอบ ช่อง แสดง ของ Google Sheet
  const MULTI_DATE = DAYS.length > 1, MULTI_DAY = false;
  const roundLabel = r => String(r).replace(/ \d{4}$/, '');
  const inRound = (c, r) => (c.slot || '').indexOf(r) >= 0;
  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  // คำอธิบายประเภทโจทย์ และเกณฑ์ตัดสินผล
  const TYPE_INFO = {
    Positive: { what: 'ใช้งานปกติ ระบบต้องทำได้และให้ผลตามที่คาดหวัง',
                pass: 'ทำได้ครบทุกขั้น และผลบนหน้าจอตรงกับผลที่คาดหวัง',
                fail: 'ทำไม่ได้ หรือผลไม่ตรงกับที่คาดหวัง' },
    Negative: { what: 'ลองทำผิดหรือทำซ้ำ ระบบต้องป้องกันหรือแจ้งเตือน',
                pass: 'ระบบป้องกันได้ (ไม่ให้ทำ หรือแจ้งเตือน) ตามที่คาดหวัง',
                fail: 'ระบบยอมให้ทำรายการที่ผิด/ซ้ำได้ โดยไม่ป้องกันหรือไม่แจ้งเตือน' },
    E2E:      { what: 'ทำต่อเนื่องทั้งวงจร ข้อมูลต้องเชื่อมถึงกันทุกขั้น',
                pass: 'ทุกขั้นทำได้ ข้อมูลส่งต่อถูกต้อง และยอดสุดท้ายตรงกับที่คาดหวัง',
                fail: 'มีขั้นใดขั้นหนึ่งผิด (ระบุขั้นที่ผิดในช่องผลที่ได้จริง)' },
  };
  const BLOCK_INFO = 'ทดสอบต่อไม่ได้ด้วยเหตุอื่นที่ไม่ใช่ผลของข้อนี้ เช่น ไม่มีข้อมูลตั้งต้น ระบบเข้าไม่ได้ หรือข้อก่อนหน้ายังไม่ผ่าน';
  const ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    clip: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.3 3.3 0 0 1 4.7 4.7L10.2 17a1.7 1.7 0 0 1-2.4-2.4L15 7.5"/></svg>',
    book: '<svg class="ic" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>',
    zoom: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/></svg>',
  };
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // ชื่อปุ่ม/ช่องบนหน้าจอที่อยู่ในเครื่องหมายคำพูด แสดงเป็นป้ายที่ไม่ตัดกลางบรรทัด (16 ต.ค. 2569: "ผู้ / ขายที่ได้รับ…" ตกบรรทัดแล้วอ่านยาก)
  const ui = s => esc(s).replace(/&quot;(.{1,80}?)&quot;/g, '<span class="ui">$1</span>');
  // ขั้นตอนที่มีหลายการกระทำ: แยกบรรทัดละ 1 การกระทำ ก่อนคำสั่งที่ตามด้วยชื่อปุ่ม/ช่อง เช่น กด "…" / กรอก "…" / แล้วกด "…"
  // (16 ต.ค. 2569: ประโยคยาวตกบรรทัดกลางคำสั่ง อ่านยาก) ข้อความในเครื่องหมายคำพูดไม่ถูกแยก
  const ACT = /(\s|^)((?:แล้ว|และ)?(?:กด|กรอก|เลือก|ติ๊ก|ใส่|พิมพ์|ลอง(?:กด|เลือก|กรอก)?)\s*)$/;
  function stepHtml(t) {
    const parts = String(t || '').split(/("[^"]*")/), lines = [''];
    parts.forEach((x, i) => {
      if (i % 2) { lines[lines.length - 1] += x; return; }
      const m = ACT.exec(x), before = m ? x.slice(0, m.index) : '';
      if (m && (lines[lines.length - 1] + before).trim()) { lines[lines.length - 1] += before; lines.push(m[2]); }
      else lines[lines.length - 1] += x;
    });
    const ls = lines.map(x => x.trim()).filter(Boolean);
    return ls.length > 1 ? ls.map(x => `<span class="sl">${ui(x)}</span>`).join('') : ui(t);
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  // ชื่อที่เก็บในเครื่องแยกจากระบบบันทึกผลชุดอื่นบนโดเมนเดียวกัน (GitHub Pages ใช้ที่เก็บร่วมกันทุก repository)
  const KEY = { session: 'renu-session', state: u => 'renu-state:' + u, outbox: u => 'renu-outbox:' + u };
  const fmtTime = t => new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const fmtDT = t => new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  let session = store.get(KEY.session, null);   // { token, user: { username, full, org } }
  let state = null;                             // { code, res: { [code]: { v, note, t, img: [], day, ver } }, current: { ver }, serverCases }
  let myAnswers = {};                          // คำชี้แจง / แนวทางแก้ไขของผู้ดูแลต่อผลของผู้ใช้นี้ { [code]: { text, by, t } }
  let outbox = [];                              // ผลที่ยังไม่ได้ส่ง (ล่าสุดของแต่ละข้อ)
  let LIST = BUILTIN.slice();                   // ข้อทดสอบที่แสดง (ข้อตั้งต้น + ข้อที่แอดมินเพิ่ม)
  const localShots = {};                        // ภาพที่แนบในรอบนี้ (ใช้แสดงและพิมพ์)
  let netDown = false, sending = null, retryMs = 0, retryTimer = 0, noteTimer = 0, query = '';

  // ======================================================================= ติดต่อหลังบ้าน
  // Google Apps Script บางครั้งค้าง 10–50 วินาทีแล้วตอบเป็นหน้า 404 และบางครั้งส่งคำตอบของคำขออื่นมาให้
  // (วัดแล้ว: โค้ดของเราทำงานเสร็จในไม่กี่มิลลิวินาที ความช้าอยู่ที่ระบบส่งคำตอบ script.googleusercontent.com ของ Google)
  // คำขอที่ส่งซ้ำได้อย่างปลอดภัย: ถ้ายังไม่ตอบภายในเวลาที่กำหนด ส่งคำขอสำรองคู่ขนาน แล้วใช้คำตอบที่มาถึงก่อน
  // (สมัครสมาชิก และแนบภาพ ไม่ส่งซ้ำ เพราะจะได้บัญชีหรือไฟล์ภาพซ้ำ)
  const HEDGE = { login: 1, me: 1, save: 1, dashboard: 1, logout: 1, setCurrent: 1, setOpenDays: 1, diag: 1, answer: 1, setProfile: 1 };
  const HEDGE_AT = [0, 7000, 16000];            // เวลาที่เริ่มคำขอที่ 1, 2, 3 (มิลลิวินาที)
  const MAX_TRY = 4;                            // รวมการส่งใหม่ทันทีเมื่อคำขอก่อนหน้าล้มเหลว
  const TIMEOUT = { upload: 120000, register: 60000 };
  function attempt(action, body, ctl) {
    const tm = setTimeout(() => ctl.abort(), TIMEOUT[action] || 45000);
    const rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);   // ระบบหลังบ้านส่งรหัสนี้กลับมา
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action, rid }, body)), signal: ctl.signal })
      .then(res => res.json())
      .then(j => {
        if (!j || typeof j.ok !== 'boolean') throw new Error('bad response');
        if (j.rid !== rid) throw new Error('response of another request');   // คำตอบไม่ใช่ของคำขอนี้: ไม่ใช้ แล้วส่งใหม่
        return j;
      })
      .finally(() => clearTimeout(tm));
  }
  function send(action, body) {
    if (!HEDGE[action]) return attempt(action, body, new AbortController());
    return new Promise((resolve, reject) => {
      let started = 0, failed = 0, done = false, lastJson = null;
      const ctls = [], timers = [];
      const finish = (fn, v) => { if (done) return; done = true; timers.forEach(clearTimeout); ctls.forEach(c => c.abort()); fn(v); };
      const launch = () => {
        if (done || started >= MAX_TRY || started - failed >= HEDGE_AT.length) return;
        started++;
        const ctl = new AbortController(); ctls.push(ctl);
        attempt(action, body, ctl).then(j => {
          // ระบบขัดข้องชั่วคราว (เช่น Google Sheet ตอบช้า) ถือเป็นความล้มเหลวที่ลองใหม่ได้
          if (!j.ok && j.code === 'SERVER') throw Object.assign(new Error('server'), { json: j });
          finish(resolve, j);
        }).catch(e => {
          if (e && e.json) lastJson = e.json;
          failed++;
          if (done) return;
          if (failed < started) return;                                   // ยังมีคำขออื่นค้างอยู่ รอคำตอบ
          // ไม่มีคำขอค้างอยู่: ส่งใหม่เกือบทันที (การบันทึกผลมีคิวส่งใหม่ของตัวเอง จึงแจ้ง "รอส่ง" ทันที)
          if (failed >= MAX_TRY || action === 'save') return lastJson ? finish(resolve, lastJson) : finish(reject, e);
          timers.push(setTimeout(launch, 1200));
        });
      };
      HEDGE_AT.forEach(t => timers.push(setTimeout(launch, t)));
    });
  }
  async function call(action, body) {
    if (!API) throw Object.assign(new Error('ยังไม่ได้ตั้งค่าที่อยู่ระบบหลังบ้าน (config.js)'), { code: 'CONFIG' });
    let j;
    try { j = await send(action, body); }
    catch (e) { throw Object.assign(new Error('ระบบตอบช้าหรือเชื่อมต่อไม่ได้'), { code: 'NET' }); }
    if (!j.ok) throw Object.assign(new Error(j.error || 'เกิดข้อผิดพลาด'), { code: j.code || 'SERVER' });
    if (j.current && state) applyCurrent(j.current);
    return j;
  }

  // ======================================================================= ข้อทดสอบ
  const SYS_ORDER = DATA.systems.map(s => s.n);
  const EXI = DATA.extraImg || {};   // ภาพประกอบของข้อที่เพิ่มผ่านแท็บข้อทดสอบ
  function buildList(serverCases) {
    const builtin = {}; BUILTIN.forEach(c => { builtin[c.code] = c; });
    const hidden = {}, extras = [];
    NO_TRAIN = {}; (serverCases || []).forEach(s => { if (s && s.code && s.tb === false) NO_TRAIN[s.code] = true; });   // แท็บข้อทดสอบ ช่อง ปุ่มตัวอย่าง = ปิด
    (serverCases || []).forEach(s => {
      if (builtin[s.code]) { if (!s.show) hidden[s.code] = true; return; }
      if (!s.show || !s.code) return;
      const info = TYPE_INFO[s.type] ? s.type : 'Positive';
      extras.push({ sys: 'X', sysName: s.sysName || 'ข้อทดสอบเพิ่มเติม', sec: 'ข้อทดสอบ', code: s.code, task: s.task, type: info,
                    typeNote: '', slot: s.slot, menu: s.menu, pre: '', steps: String(s.steps || '').split('\n').map(x => x.trim()).filter(Boolean),
                    data: s.data, sample: [], items: null, jes: [], expect: s.expect, note: '', img: (EXI[s.code] || [])[0] || '', shotCap: (EXI[s.code] || [])[1] || '', extra: true });
    });
    const out = [];
    const groups = SYS_ORDER.concat(extras.map(e => e.sysName).filter(n => SYS_ORDER.indexOf(n) < 0));
    groups.filter((g, i) => groups.indexOf(g) === i).forEach(g => {
      BUILTIN.forEach(c => { if (c.sysName === g && !hidden[c.code]) out.push(c); });
      extras.forEach(c => { if (c.sysName === g) out.push(c); });
    });
    // ทุกคนเห็นทุกข้อที่แท็บ ข้อทดสอบ ตั้งเป็น "แสดง" (ไม่แบ่งรอบ/วันแล้ว)
    LIST = out;
    if (state && state.current) showVers();
    const ps = $('printSys'), pk = ps.value, sy = LIST.map(c => c.sysName).filter((g, i, a) => a.indexOf(g) === i);
    ps.innerHTML = '<option value="">พิมพ์ทุกระบบ</option>' + sy.map(g => `<option value="${esc(g)}" ${g === pk ? 'selected' : ''}>${esc(g)}</option>`).join('');
  }
  function openDays() { const d = state && state.current && state.current.days; return d && d.length ? d : TEST_DAYS.slice(0, 1); }
  const idxOf = code => LIST.findIndex(c => c.code === code);
  const cur = () => LIST[Math.max(0, idxOf(state.code))] || LIST[0];
  const res = code => state.res[code] || (state.res[code] = {});
  const pending = code => outbox.some(o => o.code === code);
  function counts() {
    const n = { pass: 0, fail: 0, block: 0, todo: 0 };
    LIST.forEach(c => { n[(state.res[c.code] || {}).v || 'todo']++; });
    return n;
  }
  // วันที่ทดสอบเริ่มต้น: วันนี้ (ถ้าเป็นวันทดสอบ) > วันในช่วงเวลาของข้อ > วันทดสอบวันแรก
  function defaultDay(c) {
    const d = new Date(), today = d.getDate() + ' ' + TH_M[d.getMonth()] + ' ' + (d.getFullYear() + 543);
    if (DAYS.indexOf(today) >= 0) return today;
    const m = /(\d{1,2})(?:\s*[–-]\s*\d{1,2})?\s+(\S+)\s+(\d{4})/.exec((c && c.slot) || '');   // วันแรกในช่วงเวลาของข้อ
    const first = m ? m[1] + ' ' + m[2] + ' ' + m[3] : '';
    return DAYS.indexOf(first) >= 0 ? first : DAYS[0];
  }
  function curVerOf() { return ((state && state.current && state.current.ver) || '').trim(); }
  function showVers() { $('curVer').textContent = curVerOf() || '-'; }
  function applyCurrent(cu) {
    if (cu && cu.days && JSON.stringify(cu.days) !== JSON.stringify(state.current.days || [])) {
      state.current.days = cu.days; persist();
      if (session) { buildList(state.serverCases); if (!$('app').hidden) render(); }
    }
    if (!cu) return;
    if (cu.train) setTrain(cu.train);
    const vb = (cu.ver || '').trim();
    if (!vb || vb === state.current.ver) return;
    state.current.ver = vb; persist(); showVers();
    const c = cur(), r = state.res[c.code] || {};
    if (!r.ver && $('ver') && document.activeElement !== $('ver')) $('ver').value = curVerOf(c);
  }
  function persist() {
    if (!session) return;
    store.set(KEY.state(session.user.username), state);
    store.set(KEY.outbox(session.user.username), outbox);
  }

  // ======================================================================= เข้าสู่ระบบ / สมัคร
  function showAuth(view, msg) {
    $('app').hidden = true; $('auth').hidden = false;
    $('loginForm').hidden = view !== 'login'; $('regForm').hidden = view !== 'reg';
    $('lerr').textContent = view === 'login' ? (msg || '') : ''; $('rerr').textContent = '';
    $('cfgWarn').hidden = !!API;
    applyTrain(); refreshTrain();
    setTimeout(() => { const f = view === 'login' ? $('lu') : $('rn'); if (f && !('ontouchstart' in window)) f.focus(); }, 60);
  }
  document.querySelectorAll('.eye').forEach(b => b.onclick = () => { const i = $(b.dataset.for); i.type = i.type === 'password' ? 'text' : 'password'; });
  $('toReg').onclick = () => showAuth('reg');
  $('radm').onchange = e => { $('radmBox').hidden = !e.target.checked; };
  $('toLogin').onclick = () => showAuth('login');
  async function busy(btn, label, fn) {
    const old = btn.textContent; btn.disabled = true; btn.textContent = label;
    const slow = setTimeout(() => { btn.textContent = 'ระบบตอบช้า กำลังรอผล…'; }, 8000);
    try { await fn(); } finally { clearTimeout(slow); btn.disabled = false; btn.textContent = old; }
  }
  // ปลุกระบบหลังบ้านตั้งแต่เปิดหน้าเข้าสู่ระบบ ให้กดเข้าสู่ระบบแล้วตอบเร็วขึ้น
  // (ถ้าเข้าระบบค้างไว้แล้ว หน้าเว็บโหลดผลทันทีอยู่แล้ว ไม่ต้องส่งคำขอเพิ่ม)
  // ======================================================================= ปุ่มวิธีการบันทึก
  // ลิงก์ไปเว็บตัวอย่างทีละขั้น · เปิด/ปิดและลิงก์ตั้งที่แท็บ ตั้งค่า (มาพร้อม current ทุกคำตอบ และ GET ที่ไม่ต้องเข้าระบบ)
  // หน้าข้อทดสอบลิงก์ไปที่ <ลิงก์>#<รหัสข้อ> เช่น #ACC-02
  const TRAIN_KEY = 'renu-train', TRAIN_LABEL = 'วิธีการบันทึก (ตัวอย่างทีละขั้น)';
  let TRAIN = store.get(TRAIN_KEY, null), trainAt = 0;
  const trainOn = () => !!(TRAIN && TRAIN.on && /^https?:\/\//.test(TRAIN.url || ''));
  const trainHref = code => String(TRAIN.url).replace(/#.*$/, '') + (code ? '#' + encodeURIComponent(code) : '');
  // ข้อที่มีตัวอย่าง = codes.json ของเว็บตัวอย่าง · ปุ่มในหน้าข้อขึ้นเฉพาะข้อที่มี และรายการข้อมีไอคอน 📖
  let TRAIN_CODES = null, NO_TRAIN = {};
  const hasEx = code => trainOn() && !!TRAIN_CODES && TRAIN_CODES.has(code) && !NO_TRAIN[code];
  function loadTrainCodes() {
    if (!trainOn() || TRAIN_CODES) return;
    fetch(trainHref('') + 'codes.json', { cache: 'no-store' }).then(r => r.json())
      .then(a => { TRAIN_CODES = new Set(a); applyTrain(); if (state && session) renderToc(); }).catch(() => {});
  }
  function applyTrain() {
    const on = trainOn();
    loadTrainCodes();
    ['trainTop', 'trainLogin', 'trainCase'].forEach(id => {
      const a = $(id); if (!a) return;
      a.hidden = id === 'trainLogin' || !on || (id === 'trainCase' && !hasEx(a.dataset.code));   // หน้าเข้าระบบไม่มีปุ่มตัวอย่าง
      if (on) a.href = trainHref(a.dataset.code || ''); else a.removeAttribute('href');
    });
  }
  function setTrain(t) {
    if (!t || typeof t.on !== 'boolean') return;
    const nt = { on: t.on, url: String(t.url || '').trim() };
    if (!TRAIN || TRAIN.on !== nt.on || TRAIN.url !== nt.url) { TRAIN = nt; store.set(TRAIN_KEY, TRAIN); }
    applyTrain();
  }
  // GET ปลุกระบบหลังบ้าน และอ่านค่าปุ่ม (ไม่ต้องเข้าระบบ) · ไม่ส่งซ้ำภายใน 30 วินาที
  function refreshTrain() {
    if (!API || Date.now() - trainAt < 30000) return;
    trainAt = Date.now();
    fetch(API, { method: 'GET' }).then(r => r.json()).then(j => setTrain(j && j.train)).catch(() => {});
  }
  applyTrain();
  if (API && !(session && session.token)) refreshTrain();
  const errText = e => e.code === 'NET' ? 'ระบบตอบช้าหรือเชื่อมต่อไม่ได้ กรุณาลองใหม่อีกครั้ง' : e.message;
  $('loginForm').onsubmit = e => {
    e.preventDefault();
    const u = $('lu').value.trim().toLowerCase(), p = $('lp').value;
    if (!u || !p) { $('lerr').textContent = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'; return; }
    busy($('loginBtn'), 'กำลังเข้าสู่ระบบ…', async () => {
      try { const j = await call('login', { username: u, password: p }); $('lp').value = ''; start(j); }
      catch (err) { $('lerr').textContent = errText(err); }
    });
  };
  $('regForm').onsubmit = e => {
    e.preventDefault();
    const v = id => $(id).value.trim();
    const full = v('rn'), factory = v('rf'), org = v('ro'), u = v('ru').toLowerCase(), inv = v('ri'), p = $('rp').value, p2 = $('rp2').value;
    const admin = $('radm').checked, adminCode = v('rac');
    const err = m => { $('rerr').textContent = m; };
    if (!full || !factory || !u || !p || !inv) return err('กรุณากรอกช่องที่มีเครื่องหมาย * ให้ครบ');
    if (!/^[a-z0-9._-]{3,40}$/.test(u)) return err('ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - อย่างน้อย 3 ตัว');
    if (p.length < 6) return err('รหัสผ่านต้องมีอย่างน้อย 6 ตัว');
    if (p !== p2) return err('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
    if (admin && !adminCode) return err('กรุณากรอกรหัสผู้ดูแล');
    busy($('regBtn'), 'กำลังสมัคร…', async () => {
      try {
        const j = await call('register', { full, factory, org, username: u, invite: inv, password: p, admin, adminCode });
        ['rn', 'rf', 'ro', 'ru', 'ri', 'rp', 'rp2', 'rac'].forEach(id => { $(id).value = ''; });
        $('radm').checked = false; $('radmBox').hidden = true;
        start(j, true);
      } catch (e2) { err(errText(e2)); }
    });
  };
  function start(j, fresh) {
    session = { token: j.token, user: j.user };
    store.set(KEY.session, session);
    enterApp(fresh, j.current, j.results ? j : null);
  }
  function expire(msg) {
    session = null; store.del(KEY.session); hideDash();
    showAuth('login', msg || 'หมดเวลาเข้าระบบ กรุณาเข้าสู่ระบบใหม่ (ผลที่ยังไม่ได้ส่งจะส่งต่อให้หลังเข้าระบบ)');
  }
  $('logout').onclick = () => {
    if (outbox.length && !confirm(`ยังมีผลที่ยังไม่ได้ส่งเข้าระบบ ${outbox.length} ข้อ\nถ้าออกจากระบบตอนนี้ ผลจะยังเก็บไว้ในเครื่องนี้ และส่งให้เมื่อเข้าระบบอีกครั้ง\n\nออกจากระบบ?`)) return;
    if (session) call('logout', { token: session.token }).catch(() => {});
    session = null; store.del(KEY.session); closeSide(); hideDash(); $('profile').hidden = true; $('toast').hidden = true;
    showAuth('login');
  };

  // ======================================================================= เข้าหน้าบันทึกผล
  // เงื่อนไขก่อนเริ่ม: 1 บรรทัดต่อ 1 ข้อ · บรรทัดที่ไม่ขึ้นต้นด้วย • เป็นหัวข้อ (ตัวหนา)
  function preHtml(t) { return String(t).split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => /^[•\d]/.test(l) ? `<div class="pre-li">${esc(l)}</div>` : `<div class="pre-h">${esc(l)}</div>`).join(''); }
  // ข้อความยาวที่คั่นด้วย " · " แสดง 1 เรื่องต่อ 1 บรรทัด อ่านง่ายกว่าย่อหน้ายาว
  function dotLines(t) { const parts = String(t || '').split(/\s+·\s+/).map(x => x.trim()).filter(Boolean); return parts.length > 1 ? parts.map(x => `<div class="pre-li">• ${ui(x)}</div>`).join('') : ui(t); }
  // ชุดข้อมูลทดสอบที่เลือกได้ในหน้าบันทึกผล (เก็บลงคอลัมน์ ชุดทดสอบที่ใช้ ในแท็บ ผลทดสอบ)
  const DSET_OPTS = [''].concat([1, 2, 3, 4, 5, 6, 7, 8].map(n => 'ชุดที่ ' + n), ['ไม่ได้ใช้ชุดทดสอบ (สร้างข้อมูลใหม่เอง)']);
  function hashCode() { return decodeURIComponent(location.hash.slice(1)); }
  window.addEventListener('hashchange', () => {
    if (state && session && idxOf(hashCode()) >= 0) { state.code = hashCode(); render(); }
  });
  async function enterApp(fresh, current, pre) {
    const u = session.user;
    state = Object.assign({ code: '', res: {}, current: { ver: '' }, serverCases: null }, store.get(KEY.state(u.username), {}));
    if (current && current.ver) state.current.ver = current.ver;
    if (current && current.train) setTrain(current.train);
    if (current && current.days && current.days.length) state.current.days = current.days;   // วันที่เปิดให้ทดสอบจากการเข้าระบบ (ไม่ใช่ค่าเก่าในเครื่อง)
    outbox = store.get(KEY.outbox(u.username), []);
    buildList(state.serverCases);
    if (idxOf(state.code) < 0) state.code = LIST[0].code;
    if (idxOf(hashCode()) >= 0) state.code = hashCode();   // กลับมาจากหน้าวิธีการบันทึก: เปิดข้อนั้นเลย
    $('auth').hidden = true; $('app').hidden = false;
    $('uname').textContent = u.full; showWho(u);
    $('av').textContent = (u.full.replace(/^(นาย|นางสาว|นาง|ดร\.|ผศ\.|รศ\.)\s*/, '').trim().charAt(0) || '?');
    showVers();
    $('dashBtn').hidden = u.role !== 'admin';
    showWelcome(fresh, true);
    render();
    try {
      const j = pre || await call('me', { token: session.token });
      session.user = j.user; store.set(KEY.session, session); showWho(j.user);
      $('dashBtn').hidden = j.user.role !== 'admin';
      if (!j.user.factory) openProfile(true);   // บัญชีเดิมที่ยังไม่มีชื่อโรงงาน: ขอให้กรอกครั้งเดียว
      state.serverCases = j.cases || null;
      myAnswers = {}; (j.answers || []).forEach(a => { myAnswers[a.code] = a; });
      if (j.current) { if (j.current.days && j.current.days.length) state.current.days = j.current.days; if (j.current.ver) state.current.ver = j.current.ver; showVers(); setTrain(j.current.train); }
      const pend = {}; outbox.forEach(o => { pend[o.code] = true; });
      const merged = {};
      Object.keys(j.results || {}).forEach(code => { merged[code] = j.results[code]; });
      Object.keys(state.res).forEach(code => { if (pend[code]) merged[code] = state.res[code]; });
      state.res = merged;
      buildList(state.serverCases);
      if (idxOf(state.code) < 0) state.code = LIST[0].code;
      if (idxOf(hashCode()) >= 0) state.code = hashCode();   // กลับมาจากหน้าวิธีการบันทึก: เปิดข้อนั้นเลย
      persist(); $('notice').hidden = true;
      showWelcome(fresh, false); render();
    } catch (e) {
      if (e.code === 'AUTH') return expire(e.message);
      notice('โหลดผลจากระบบไม่ได้ (' + errText(e) + ') กำลังแสดงผลที่เก็บในเครื่องนี้ ระบบจะลองส่งให้อัตโนมัติ');
      showWelcome(fresh, false);
    }
    flush();
  }
  function showWho(u) {
    $('whoName').textContent = u.full; $('whoFactory').textContent = u.factory || ''; $('whoOrg').textContent = u.org || '';
  }
  // ข้อมูลผู้ทดสอบ: โรงงาน / บริษัท (บังคับ) และหน่วยงาน · required = ยังไม่มีชื่อโรงงาน (ปิดไม่ได้ ต้องกรอกหรือออกจากระบบ)
  let profRequired = false;
  function openProfile(required) {
    const u = session.user; profRequired = !!required;
    $('pf').value = u.factory || ''; $('po').value = u.org || ''; $('perr').textContent = '';
    $('profLead').textContent = required ? 'กรุณาระบุโรงงาน / บริษัทของท่านก่อนเริ่มบันทึกผล (กรอกครั้งเดียว ใช้ในหัวเอกสารสรุปผลการทดสอบ)'
      : 'แก้ไขโรงงาน / บริษัท และหน่วยงานของท่าน';
    $('profCancel').textContent = required ? 'ออกจากระบบ' : 'ยกเลิก';
    $('profile').hidden = false;
    setTimeout(() => { if (!('ontouchstart' in window)) $(u.factory ? 'po' : 'pf').focus(); }, 60);
  }
  $('profBtn').onclick = () => openProfile(false);
  $('profCancel').onclick = () => { if (profRequired) { $('profile').hidden = true; $('logout').click(); } else $('profile').hidden = true; };
  $('profForm').onsubmit = e => {
    e.preventDefault();
    const factory = $('pf').value.trim(), org = $('po').value.trim();
    if (!factory) { $('perr').textContent = 'กรุณากรอกชื่อโรงงาน / บริษัท'; return; }
    busy($('profSave'), 'กำลังบันทึก…', async () => {
      try {
        const j = await call('setProfile', { token: session.token, factory, org });
        session.user = j.user; store.set(KEY.session, session); showWho(j.user);
        $('profile').hidden = true; profRequired = false; toast('บันทึกข้อมูลผู้ทดสอบแล้ว');
      } catch (er) { if (er.code === 'AUTH') { $('profile').hidden = true; return expire(er.message); } $('perr').textContent = errText(er); }
    });
  };
  function notice(msg) { $('notice').textContent = msg; $('notice').hidden = false; }
  function nextTodo() { const i = LIST.findIndex(c => !(state.res[c.code] || {}).v); return i < 0 ? null : LIST[i]; }
  function showWelcome(fresh, loading) {
    const w = $('welcome'), u = session.user, n = counts(), done = LIST.length - n.todo;
    const last = Math.max(0, ...Object.values(state.res).map(r => r.t || 0));
    const nx = nextTodo();
    const go = loading ? '' : nx ? `<button class="btn primary" id="resume">ทำต่อที่ ${esc(nx.code)} ›</button>` : '<span class="muted">บันทึกผลครบทุกข้อแล้ว กดพิมพ์สรุปผลได้ที่แถบด้านซ้าย</span>';
    const txt = loading ? `<div class="txt">กำลังโหลดผลที่บันทึกไว้…<small>${esc(u.full)}</small></div>`
      : done === 0 ? `<div class="txt">สวัสดี · ${esc(u.full)}<small>ยังไม่มีผลที่บันทึก เริ่มที่ข้อแรกได้เลย ผลจะบันทึกเข้าระบบอัตโนมัติทุกครั้งที่เลือกผลหรือพิมพ์ข้อความ</small></div>`
      : `<div class="txt">ยินดีต้อนรับกลับ · ${esc(u.full)}<small>บันทึกแล้ว ${done} / ${LIST.length} ข้อ${last ? ' · บันทึกล่าสุด ' + fmtDT(last) + ' น.' : ''}</small></div>`;
    w.innerHTML = txt + go + '<button class="x" id="wx" aria-label="ปิด">×</button>';
    w.hidden = false;
    $('wx').onclick = () => { w.hidden = true; };
    if ($('resume')) $('resume').onclick = () => goTo(nx.code);
  }

  // ======================================================================= แสดงผล
  function goTo(code) { state.code = code; const g = (LIST[idxOf(code)] || {}).sysName; if (state.fold && g) state.fold[g] = false; persist(); closeSide(); render(); window.scrollTo({ top: 0 }); }
  function renderTop() {
    const n = counts(), done = LIST.length - n.todo;
    $('progText').textContent = `บันทึกผลแล้ว ${done} / ${LIST.length} ข้อ`;
    $('menuCount').textContent = `${done}/${LIST.length}`;
    $('meter').style.width = (done / LIST.length * 100) + '%';
    renderNet();
  }
  function renderNet() {
    const el = $('net');
    const anySaved = state && Object.keys(state.res).some(k => state.res[k].t);
    if (!outbox.length) { el.className = 'net ok'; el.hidden = !anySaved; el.innerHTML = '✓ <span class="txt">บันทึกเข้าระบบแล้ว</span>'; return; }
    el.hidden = false;
    if (netDown) { el.className = 'net down'; el.innerHTML = `⚠ <span class="txt">ออฟไลน์ · </span>รอส่ง ${outbox.length}`; }
    else { el.className = 'net wait'; el.innerHTML = `⏳ <span class="txt">กำลังส่ง </span>${outbox.length}`; }
  }
  // แถบรายการข้อ: ย่อ/ขยายตามระบบ และกรองตามวันหรือสถานะ
  const CHEV = '<svg class="chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  function matches(x) {
    const q = query.trim().toLowerCase(), r = state.res[x.code] || {}, f = state.filter || {};
    if (q && (x.code + ' ' + x.task + ' ' + x.menu).toLowerCase().indexOf(q) < 0) return false;
    if (f.st === 'todo' && r.v) return false;
    if (f.st === 'done' && !r.v) return false;
    if (f.st === 'bad' && r.v !== 'fail' && r.v !== 'block') return false;
    return true;
  }
  function renderToc() {
    const c = cur(), f = state.filter || {}, filtering = !!(query.trim() || f.st);
    if (!state.fold) {                            // ครั้งแรก: ขยายเฉพาะระบบของข้อที่กำลังทำ
      state.fold = {}; LIST.forEach(x => { if (x.sysName !== c.sysName) state.fold[x.sysName] = true; });
    }
    const groups = LIST.map(x => x.sysName).filter((g, i, a) => a.indexOf(g) === i);
    const html = groups.map(g => {
      const items = LIST.filter(x => x.sysName === g), shown = items.filter(matches);
      if (filtering && !shown.length) return '';
      const done = items.filter(x => (state.res[x.code] || {}).v).length;
      const open = filtering || !state.fold[g];
      return `<button class="grp" data-g="${esc(g)}" aria-expanded="${open}">${CHEV}<span class="gn">${esc(g)}</span>`
        + (filtering ? `<span class="gm">${shown.length} ข้อ</span>` : '') + `<span class="gc">${done}/${items.length}</span></button>`
        + (open ? shown.map(x => {
          const r = state.res[x.code] || {};
          return `<button class="it" data-code="${esc(x.code)}" aria-current="${x === c}" title="${esc(x.task)}"><span class="dot ${r.v || ''} ${pending(x.code) ? 'pend' : ''}"></span><span class="c">${esc(x.code)}</span><span class="tk"><span class="tt">${esc(x.short || x.task)}${hasEx(x.code) ? ' <span class="ex" title="มีตัวอย่างวิธีการบันทึก">📖</span>' : ''}</span>${r.v ? `<small class="rs ${r.v}">${SHORT[r.v]}${r.day ? ' · ' + esc(r.day) : ''}${r.ver ? ' · ' + esc(r.ver) : ''}</small>` : ''}</span></button>`;
        }).join('') : '');
    }).join('');
    $('toc').innerHTML = html || '<div class="muted" style="padding:10px 14px">ไม่พบข้อที่ตรงกับเงื่อนไข</div>';
    $('toc').querySelectorAll('.it').forEach(b => b.onclick = () => goTo(b.dataset.code));
    $('toc').querySelectorAll('.grp').forEach(b => b.onclick = () => {
      if (filtering) return;
      state.fold[b.dataset.g] = b.getAttribute('aria-expanded') === 'true'; persist(); renderToc();
    });
    const admin = session.user.role === 'admin', days = admin ? TEST_DAYS : openDays();
    $('fDay').innerHTML = '<option value="">' + (admin || days.length > 1 ? 'ทุกรอบทดสอบ' : 'รอบที่เปิดทดสอบ') + '</option>' + days.map(d => `<option value="${esc(d)}">${esc(roundLabel(d))}</option>`).join('');
    $('fDay').value = days.indexOf(f.day) >= 0 ? f.day : ''; $('fSt').value = f.st || '';
    $('fDay').hidden = !MULTI_DAY; $('fDay').parentNode.classList.toggle('one', !MULTI_DAY);   // มีรอบเดียว: ไม่ต้องกรองตามรอบ
    const closed = TEST_DAYS.filter(d => openDays().indexOf(d) < 0);
    $('closedNote').hidden = true;
    $('closedNote').textContent = 'ข้อของรอบ ' + closed.map(roundLabel).join(' และ ') + ' จะเปิดให้ทดสอบตามกำหนดการ';
    const a = $('toc').querySelector('[aria-current=true]');
    if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' });
  }
  const itemsT = it => `<div class="scroll"><table><thead><tr>${it.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
    ${it.rows.map(r => `<tr>${r.map((v, i) => `<td class="${i >= 2 ? 'n' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}
    ${it.foot.map(([k, v]) => `<tr class="foot"><td colspan="${it.head.length - 1}">${esc(k)}</td><td class="n">${esc(v)}</td></tr>`).join('')}</tbody></table></div>`;
  const jeT = j => `<div class="scroll"><table><thead><tr><th>บัญชี</th><th class="n" style="width:18%">เดบิต (บาท)</th><th class="n" style="width:18%">เครดิต (บาท)</th></tr></thead><tbody>
    ${j.lines.map(([a, d, c]) => `<tr><td>${c ? '<span class="cr">' + esc(a) + '</span>' : esc(a)}</td><td class="n">${d}</td><td class="n">${c}</td></tr>`).join('')}
    <tr class="foot"><td style="text-align:right">รวม (เดบิต = เครดิต)</td><td class="n">${j.total}</td><td class="n">${j.total}</td></tr></tbody></table></div>`;
  const sampleHead = c => c.type === 'Negative' ? 'สิ่งที่ต้องลองทำ' : 'ตัวอย่างข้อมูลที่บันทึก';

  function render() {
    renderTop(); renderToc();
    const c = cur(), r = state.res[c.code] || {}, i = idxOf(c.code), ti = TYPE_INFO[c.type] || TYPE_INFO.Positive;
    const row = (k, v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
    const day = r.day || defaultDay(c), ver = r.ver || curVerOf(c) || '';
    $('sheet').innerHTML = `
      <div class="sh-hd"><span>${esc(c.sysName)} · ${esc(c.sec)}${c.core ? ' <b class="core">โจทย์หลัก (ทำใน Zoom)</b>' : ''}</span><span>${esc(c.slot)}</span></div>
      <div class="h1row"><h1><span class="code">${esc(c.code)}</span>${esc(c.short || c.task)}</h1>
        <a class="btn train-case" id="trainCase" data-code="${esc(c.code)}" target="_blank" rel="noopener" title="${TRAIN_LABEL} ของข้อ ${esc(c.code)} · เปิดในแท็บใหม่" hidden>${ICON.book}ดูตัวอย่าง</a></div>
      ${c.img ? `<figure><img src="${esc(c.img)}" alt="${esc(c.shotCap)}" data-zoom="1" loading="lazy"><figcaption>${ICON.zoom} ${esc(c.shotCap)} · คลิกที่ภาพเพื่อขยาย</figcaption></figure>` : ''}
      <table class="doc"><tbody>
        ${c.short ? row('สิ่งที่ต้องทำ', dotLines(c.task)) : ''}
        ${row('ประเภทโจทย์', `<div class="typ"><span class="tag ${c.type}">${esc(c.type)}</span><span>${esc(ti.what)}</span></div>`)}
        ${c.dept || c.role ? row('ฝ่าย / ผู้ทำรายการ', dotLines([c.dept, c.role].filter(Boolean).join(' · '))) : ''}
        ${c.dependsOn ? row('ทำต่อจากข้อ', esc(c.dependsOn)) : ''}
        ${row('เมนู', esc(c.menu))}
        ${c.pre ? row('เงื่อนไขก่อนเริ่ม', preHtml(c.pre)) : ''}
        ${row(c.type === 'E2E' ? 'ขั้นตอนทดสอบ (ทำต่อเนื่องทั้งวงจร)' : 'ขั้นตอนทดสอบ', `<ol>${c.steps.map(s => `<li>${stepHtml(s)}</li>`).join('')}</ol>`)}
        ${c.data && c.data !== '-' ? row('ข้อมูลทดสอบ (ตามโจทย์)', dotLines(c.data)) : ''}
        ${c.sample.length ? row(sampleHead(c), c.sample.map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`).join('<br>')) : ''}
        ${row('ผลที่คาดหวัง', dotLines(c.expect))}
        ${c.note ? row('ข้อควรทราบ', dotLines(c.note)) : ''}
      </tbody></table>
      ${c.items ? `<div class="cap">รายการในเอกสาร (${esc(c.code)})</div>${itemsT(c.items)}` : ''}
      ${c.jes.map(j => `<div class="cap">ตัวอย่างการบันทึกบัญชี: ${esc(j.title)}</div>${jeT(j)}`).join('')}
      <section class="form" id="form"><div class="cap">บันทึกผลการทดสอบ ${esc(c.code)}</div>
        <table class="rt"><tbody>
          ${row('ชุดข้อมูลทดสอบที่ใช้', `<select id="dset" aria-label="ชุดข้อมูลทดสอบที่ใช้">${DSET_OPTS.map(o => `<option value="${esc(o)}"${(res(c.code).dset || '') === o ? ' selected' : ''}>${esc(o || '— ยังไม่ได้เลือก —')}</option>`).join('')}</select>`)}
          ${row('ผลทดสอบ', `<div class="checks" role="radiogroup" aria-label="ผลทดสอบ">${['pass', 'fail', 'block'].map(v =>
            `<label class="ck ${v} ${r.v === v ? 'on' : ''}"><input type="radio" name="res" value="${v}" ${r.v === v ? 'checked' : ''}><span class="box">${ICON.check}</span>${LABEL[v]}</label>`).join('')}</div>
            <div class="hint" style="margin-top:4px"><b>ผ่าน</b> = ${esc(ti.pass)} · <b>ไม่ผ่าน</b> = ${esc(ti.fail)} · <b>ติดปัญหา</b> = ${esc(BLOCK_INFO)}</div>`)}
          ${row('ผลที่ได้จริง / ปัญหาที่พบ', `<textarea id="note" placeholder="${c.type === 'Negative' ? 'เช่น ระบบแจ้งเตือนว่ารายการนี้บันทึกไปแล้ว และไม่ให้บันทึกซ้ำ' : 'เช่น บันทึกได้ เลขที่เอกสาร ... ยอดตรงตามที่คาด'}">${esc(r.note)}</textarea>`)}
          ${row('ภาพหน้าจอประกอบ', `<label class="att">${ICON.clip} แนบภาพ<input type="file" accept="image/*" id="file"></label>
            <span class="hint">· ถ้าใช้คอมพิวเตอร์ กด Print Screen แล้วกด Ctrl+V ในหน้านี้ได้เลย</span><div class="atts" id="atts"></div>`)}
          ${row('ผู้ทดสอบ', 'ลงชื่อ ' + esc(session.user.full))}
          ${row('วันที่ทดสอบ / รุ่นโปรแกรม', `<div class="dv">${MULTI_DATE ? `<select id="day" aria-label="วันที่ทดสอบ">${DAYS.map(d => `<option ${d === day ? 'selected' : ''}>${d}</option>`).join('')}</select>` : `<span class="dayfix">${esc(day)}</span>`}
            <input id="ver" value="${esc(ver)}" placeholder="เช่น ${esc(curVerOf() || 'v1.6.84')}" aria-label="รุ่นโปรแกรม ${PRODUCT}"></div>
            <div class="hint">บันทึกแยกทุกข้อ ค่าเริ่มต้นคือรุ่นที่ผู้ดูแลระบบกำหนด ถ้าหน้าจอ ${PRODUCT} แสดงรุ่นอื่น (มุมซ้ายล่าง) ให้แก้ตามหน้าจอ</div>`)}
        </tbody></table>
        <div class="saved" id="saved"></div>
      </section>`;
    applyTrain();
    $('pos').textContent = `ข้อ ${i + 1} / ${LIST.length}`;
    $('prev').disabled = i <= 0; $('next').disabled = i >= LIST.length - 1;
    renderAtts(c.code); paintStatus(c.code);
    $('sheet').querySelectorAll('.ck').forEach(l => l.onclick = e => {
      e.preventDefault();
      const rr = res(c.code), v = l.querySelector('input').value;
      rr.v = rr.v === v ? '' : v;                  // กดซ้ำเพื่อยกเลิก
      stamp(c.code); queueSave(c.code);
      $('sheet').querySelectorAll('.ck').forEach(x => x.classList.toggle('on', rr.v === x.querySelector('input').value));
      renderTop(); renderToc();
    });
    $('note').oninput = e => {
      res(c.code).note = e.target.value; stamp(c.code); persist();
      setSaved('wait', '… กำลังพิมพ์ (จะบันทึกเมื่อหยุดพิมพ์)');
      clearTimeout(noteTimer); noteTimer = setTimeout(() => { noteTimer = 0; queueSave(c.code); }, 3000);
    };
    $('note').onblur = () => { if (noteTimer) { clearTimeout(noteTimer); noteTimer = 0; const rr = state.res[c.code]; if (rr && !pending(c.code) && rr._dirty) queueSave(c.code); } };
    if ($('day')) $('day').onchange = e => { res(c.code).day = e.target.value; queueSave(c.code); };
    if ($('dset')) $('dset').onchange = e => { res(c.code).dset = e.target.value; stamp(c.code); queueSave(c.code); };
    $('ver').onchange = e => { res(c.code).ver = e.target.value.trim(); queueSave(c.code); };
    $('file').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) attach(c.code, f); };
  }
  // ข้อที่เริ่มบันทึก: เก็บวันที่และรุ่นโปรแกรม ณ ตอนที่ทดสอบ
  function stamp(code) {
    const rr = res(code), c = LIST[idxOf(code)];
    if (!rr.day) rr.day = $('day') ? $('day').value : defaultDay(c);
    if (!rr.ver) rr.ver = ($('ver') && $('ver').value.trim()) || curVerOf(c) || '';
    rr._dirty = true;
  }
  function setSaved(cls, txt) { const el = $('saved'); if (el) { el.className = 'saved ' + cls; el.textContent = txt; } }
  function paintStatus(code) {
    if (cur().code !== code) return;
    const r = state.res[code] || {};
    if (pending(code)) setSaved('wait', netDown ? '⏳ รอส่ง · ยังเชื่อมต่อระบบไม่ได้ ผลเก็บไว้ในเครื่องแล้ว จะส่งให้อัตโนมัติ' : '⏳ กำลังบันทึกเข้าระบบ…');
    else if (r.t) setSaved('ok', '✓ บันทึกเข้าระบบแล้ว ' + fmtTime(r.t) + ' น. · วันที่ ' + (r.day || '-') + ' · รุ่น ' + (r.ver || '-'));
    else setSaved('', 'ผลจะบันทึกเข้าระบบอัตโนมัติเมื่อเลือกผลหรือพิมพ์ข้อความ');
  }
  // ภาพแนบ: ภาพย่อเรียงกัน มีหมายเลขและปุ่ม ✕ ที่มุม (16 ต.ค. 2569: ลิงก์ยาว "ภาพที่ 1 (Google Drive) ✕ ลบ" ตกบรรทัด เปลืองที่)
  // ภาพที่แนบในรอบนี้ใช้ภาพในเครื่อง ภาพเก่าใช้ภาพย่อจาก Google Drive ถ้าโหลดไม่ได้แสดงไอคอนแทน
  const driveId = u => (/[-\w]{25,}/.exec(u) || [])[0] || '';
  function renderAtts(code) {
    const el = $('atts'); if (!el) return;
    const r = state.res[code] || {}, loc = localShots[code] || [];
    const card = (u, k) => {
      const mine = loc.find(s => s.url === u), id = driveId(u);
      const src = mine ? mine.src : (id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w240' : '');
      return `<span class="shot"><a href="${esc(u)}" target="_blank" rel="noopener" title="เปิดภาพที่ ${k + 1}">`
        + (src ? `<img src="${esc(src)}" alt="ภาพที่ ${k + 1}" onerror="this.replaceWith(Object.assign(document.createElement('i'),{className:'noimg',textContent:'🖼'}))">` : '<i class="noimg">🖼</i>')
        + `</a><small>ภาพ ${k + 1}</small><button type="button" class="delimg" data-u="${esc(u)}" title="ลบภาพที่ ${k + 1}" aria-label="ลบภาพที่ ${k + 1}">✕</button></span>`;
    };
    el.innerHTML = (r.img || []).map(card).join('')
      + loc.filter(s => s.state !== 'ok').map(s => `<span class="shot up"><img src="${s.src}" alt=""><small>${esc(s.state)}</small></span>`).join('');
    el.querySelectorAll('.delimg').forEach(b => b.onclick = () => delImg(code, b.dataset.u, b));
  }
  // ลบภาพที่แนบผิด: ลบออกจากผลของข้อนี้ ไฟล์ใน Google Drive ย้ายไปถังขยะ
  async function delImg(code, url, btn) {
    const r = state.res[code] || {}, k = (r.img || []).indexOf(url);
    if (k < 0 || !confirm('ลบภาพที่ ' + (k + 1) + ' ของข้อ ' + code + ' ?')) return;
    btn.disabled = true;
    try {
      const j = await call('delImg', { token: session.token, code, url });
      res(code).img = j.img || []; persist();
      if (localShots[code]) localShots[code] = localShots[code].filter(s => s.url !== url);
      toast('ลบภาพที่ ' + (k + 1) + ' ของข้อ ' + code + ' แล้ว');
    } catch (e) {
      if (e.code === 'AUTH') return expire(e.message);
      toast('ลบภาพไม่สำเร็จ: ' + errText(e));
    }
    if (cur().code === code) renderAtts(code);
  }

  // ======================================================================= บันทึกผล (คิวส่ง)
  function queueSave(code) {
    const r = res(code); delete r._dirty;
    outbox = outbox.filter(o => o.code !== code);
    outbox.push({ code, v: r.v || '', note: r.note || '', day: r.day || '', ver: r.ver || '', dset: r.dset || '', seq: Date.now() });
    persist(); paintStatus(code); renderNet(); renderToc();
    flush();
  }
  async function flush() {
    if (sending || !outbox.length || !session) return;
    const item = sending = outbox[0];
    try {
      const j = await call('save', Object.assign({ token: session.token }, item));
      outbox = outbox.filter(o => o !== item);
      if (!pending(item.code)) res(item.code).t = j.t;
      netDown = false; retryMs = 0; sending = null;
      persist(); paintStatus(item.code); renderNet(); renderToc();
      flush();
    } catch (e) {
      sending = null;
      if (e.code === 'AUTH') { persist(); return expire(e.message); }
      if (e.code === 'INPUT') {                   // ข้อมูลไม่ถูกต้อง ส่งซ้ำก็ไม่ผ่าน
        outbox = outbox.filter(o => o !== item); persist();
        toast('บันทึก ' + item.code + ' ไม่สำเร็จ: ' + e.message); paintStatus(item.code); renderNet(); flush(); return;
      }
      netDown = true; retryMs = Math.min(retryMs ? retryMs * 2 : 3000, 30000);
      paintStatus(item.code); renderNet(); renderToc();
      clearTimeout(retryTimer); retryTimer = setTimeout(flush, retryMs);
    }
  }
  window.addEventListener('online', () => { retryMs = 0; flush(); });
  window.addEventListener('beforeunload', e => {
    if (noteTimer && state) { clearTimeout(noteTimer); const c = cur(); queueSave(c.code); }
    if (outbox.length) { e.preventDefault(); e.returnValue = ''; }
  });

  // ======================================================================= แนบภาพ
  function shrink(file) {
    return new Promise((ok, bad) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url); ok(cv.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); bad(new Error('เปิดไฟล์ภาพไม่ได้')); };
      img.src = url;
    });
  }
  async function attach(code, file) {
    if (!/^image\//.test(file.type)) return toast('แนบได้เฉพาะไฟล์ภาพ');
    let data;
    try { data = await shrink(file); } catch (e) { return toast(e.message); }
    const shot = { src: data, state: 'กำลังอัปโหลดภาพ…' };
    (localShots[code] = localShots[code] || []).push(shot);
    renderAtts(code);
    try {
      const j = await call('upload', { token: session.token, code, data });
      shot.state = 'ok'; shot.url = j.url;
      const r = res(code); r.img = (r.img || []).concat([j.url]); persist();
      toast('แนบภาพ ' + code + ' แล้ว');
    } catch (e) {
      if (e.code === 'AUTH') return expire(e.message);
      shot.state = 'อัปโหลดภาพไม่สำเร็จ (' + errText(e) + ') กรุณาแนบใหม่';
    }
    if (cur().code === code) renderAtts(code);
  }
  document.addEventListener('paste', e => {
    if ($('app').hidden || !session) return;
    const item = [...(e.clipboardData || {}).items || []].find(x => x.kind === 'file' && /^image\//.test(x.type));
    if (!item) return;
    e.preventDefault(); attach(cur().code, item.getAsFile());
  });

  // ======================================================================= ขยายภาพ / แถบข้อทดสอบ / อื่น ๆ
  document.addEventListener('click', e => {
    const img = e.target.closest && e.target.closest('img[data-zoom]');
    if (!img) return;
    const z = $('zoom'); z.querySelector('img').src = img.src; z.hidden = false; z.classList.remove('full');
  });
  $('zoom').onclick = e => {
    // ภาพขยายพอดีจอ · คลิกที่ภาพสลับเป็นขนาดจริง (เลื่อนดูได้) · คลิกพื้นหลังหรือปุ่ม × เพื่อปิด
    const z = $('zoom');
    if (e.target.tagName === 'IMG') { z.classList.toggle('full'); return; }
    z.hidden = true;
  };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { $('zoom').hidden = true; closeSide(); }
    if ($('app').hidden || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    if (e.key === 'ArrowRight' && !$('next').disabled) $('next').click();
    if (e.key === 'ArrowLeft' && !$('prev').disabled) $('prev').click();
  });
  function openSide() { $('side').classList.add('open'); $('scrim').classList.add('open'); $('menuBtn').setAttribute('aria-expanded', 'true'); }
  function closeSide() { $('side').classList.remove('open'); $('scrim').classList.remove('open'); $('menuBtn').setAttribute('aria-expanded', 'false'); }
  $('menuBtn').onclick = () => ($('side').classList.contains('open') ? closeSide() : openSide());
  $('scrim').onclick = closeSide;
  $('q').oninput = e => { query = e.target.value; renderToc(); };
  $('fDay').onchange = e => { state.filter = Object.assign({}, state.filter, { day: e.target.value }); persist(); renderToc(); };
  $('fSt').onchange = e => { state.filter = Object.assign({}, state.filter, { st: e.target.value }); persist(); renderToc(); };
  $('foldAll').onclick = () => { state.fold = {}; LIST.forEach(x => { state.fold[x.sysName] = true; }); persist(); renderToc(); };
  $('openAll').onclick = () => { state.fold = {}; LIST.forEach(x => { state.fold[x.sysName] = false; }); persist(); renderToc(); };
  $('prev').onclick = () => { const i = idxOf(cur().code); if (i > 0) goTo(LIST[i - 1].code); };
  $('next').onclick = () => { const i = idxOf(cur().code); if (i < LIST.length - 1) goTo(LIST[i + 1].code); };
  let toastTimer = 0;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3500); }

  // ======================================================================= แดชบอร์ด (ผู้ดูแล)
  let dash = null, dashTimer = 0;
  async function showDash() {
    closeSide();
    document.querySelector('.layout').hidden = true; $('dash').hidden = false; $('dashBtn').classList.add('on');
    window.scrollTo({ top: 0 });
    await loadDash();
    clearInterval(dashTimer); dashTimer = setInterval(() => { if (!$('dash').hidden && !document.hidden) loadDash(); }, 60000);
  }
  function hideDash() {
    clearInterval(dashTimer);
    $('dash').hidden = true; document.querySelector('.layout').hidden = false; $('dashBtn').classList.remove('on');
  }
  let dashLoading = false;
  async function loadDash() {
    if (dashLoading) return;            // กำลังโหลดอยู่: ไม่ส่งคำขอซ้อน (กันระบบหลังบ้านรับคำขอเกิน)
    dashLoading = true;
    try { await loadDashOnce(); } finally { dashLoading = false; }
  }
  async function loadDashOnce() {
    $('dTime').textContent = dash ? 'กำลังโหลดข้อมูลล่าสุด…' : 'กำลังโหลด…';
    try {
      dash = await call('dashboard', { token: session.token });
      $('dErr').hidden = true; if (!ansEdit) renderDash(); else $('dTime').textContent = 'ข้อมูลล่าสุด ' + fmtDT(dash.time) + ' น.';
    } catch (e) {
      if (e.code === 'AUTH') return expire(e.message);
      $('dErr').textContent = 'โหลดข้อมูลไม่ได้: ' + errText(e); $('dErr').hidden = false;
      $('dTime').textContent = dash ? 'ข้อมูลล่าสุด ' + fmtDT(dash.time) + ' น.' : '';
    }
  }
  // สถานะการแก้ไขที่ผู้ดูแลกำหนดให้แต่ละประเด็น (ผลของผู้ทดสอบคงเดิม) · 2 แบบแรกนับเป็น "ปิดประเด็นแล้ว"
  const AST = { fixed: ['แก้ไขแล้ว', 'pass'], works: ['ระบบทำได้ (ตามคำชี้แจง)', 'pass'], wip: ['อยู่ระหว่างแก้ไข', 'block'], suggest: ['ข้อเสนอแนะ (พัฒนาต่อ)', 'sug'] };
  const AST_DONE = { fixed: 1, works: 1 };
  function renderDash() {
    const d = dash, od = (d.current.days && d.current.days.length) ? d.current.days : TEST_DAYS.slice(0, 1);
    const cases = d.cases.filter(c => c.show), codes = {}, names = {};
    cases.forEach(c => { codes[c.code] = c; });
    d.testers.forEach(t => { names[t.username] = t.full; });
    const results = d.results.filter(r => codes[r.code]);
    const has = {}; results.forEach(r => { if (r.v) has[r.user] = true; });
    let people = d.testers.filter(t => t.role === 'tester' || has[t.username]);
    // เลือกดูทีละโรงงาน (แสดงเมื่อมีผู้ทดสอบมากกว่า 1 โรงงาน)
    const facs = people.map(t => t.factory || '').filter((g, i, a) => a.indexOf(g) === i).sort();
    const fsel = $('dFactory'), fkeep = fsel.value, NONE = '__none__';
    fsel.hidden = facs.length < 2;
    fsel.innerHTML = '<option value="">ทุกโรงงาน / บริษัท</option>' + facs.map(f => `<option value="${esc(f || NONE)}">${esc(f || '(ยังไม่ระบุโรงงาน)')} (${people.filter(t => (t.factory || '') === f).length} ท่าน)</option>`).join('');
    fsel.value = facs.some(f => (f || NONE) === fkeep) ? fkeep : '';
    const fsv = fsel.hidden ? '' : fsel.value;
    if (fsv) people = people.filter(t => (t.factory || NONE) === fsv);
    const facOf = {}; d.testers.forEach(t => { facOf[t.username] = t.factory || ''; });
    const R = {}; results.forEach(r => { (R[r.user] = R[r.user] || {})[r.code] = r; });
    const cnt = (list, v) => list.filter(r => r.v === v).length;
    const all = results.filter(r => r.v && people.some(p => p.username === r.user));
    const total = people.length * cases.length;
    $('dTime').textContent = 'ข้อมูลล่าสุด ' + fmtDT(d.time) + ' น. · รีเฟรชอัตโนมัติทุก 1 นาที'
      + '';
    $('dSheet').href = d.sheetUrl;
    if (document.activeElement !== $('dVer')) $('dVer').value = (d.current.ver || '').trim();
    // เปิด/ปิดวันที่ให้ทดสอบ: แสดงเฉพาะเมื่อมีวันทดสอบมากกว่า 1 วัน
    $('dDays').hidden = !MULTI_DAY;
    if (MULTI_DAY) {
      $('dDays').innerHTML = 'เปิดให้ทดสอบ ' + TEST_DAYS.map(x => `<label class="dck"><input type="checkbox" value="${esc(x)}" ${od.indexOf(x) >= 0 ? 'checked' : ''}>${esc(roundLabel(x))}</label>`).join('')
        + '<button class="btn" id="dDaysSave">บันทึกรอบ</button>';
      $('dDaysSave').onclick = saveDays;
    }
    $('dKpi').innerHTML = [['ผู้ทดสอบ', people.length + ' ท่าน', ''], ['บันทึกผลแล้ว', `${all.length} / ${total}` + (total ? ` (${Math.round(all.length / total * 100)}%)` : ''), ''],
      ['ผ่าน', cnt(all, 'pass'), 'pass'], ['ไม่ผ่าน', cnt(all, 'fail'), 'fail'], ['ติดปัญหา', cnt(all, 'block'), 'block']]
      .map(([k, v, c]) => `<div class="kpi ${c}"><small>${k}</small><b>${v}</b></div>`).join('');
    const bar = (p, f, b, n) => `<div class="bar2" title="ผ่าน ${p} · ไม่ผ่าน ${f} · ติดปัญหา ${b} · จาก ${n}"><i class="p" style="width:${p / n * 100}%"></i><i class="f" style="width:${f / n * 100}%"></i><i class="b" style="width:${b / n * 100}%"></i></div>`;
    $('dTesters').innerHTML = people.length ? `<table><thead><tr><th class="n">ลำดับ</th><th>ผู้ทดสอบ</th><th>ความคืบหน้า</th><th class="n">ทำแล้ว</th><th class="n">ผ่าน</th><th class="n">ไม่ผ่าน</th><th class="n">ติดปัญหา</th><th>บันทึกล่าสุด</th></tr></thead><tbody>`
      + people.map((t, ti) => {
        const mine = Object.values(R[t.username] || {}).filter(r => r.v), last = Math.max(0, ...Object.values(R[t.username] || {}).map(r => r.t));
        return `<tr><td class="n">${ti + 1}</td><td><b>${esc(t.full)}</b>${t.role === 'admin' ? ' <span class="muted">(ผู้ดูแล)</span>' : ''}<br><span class="muted">${esc([t.factory, t.org].filter(Boolean).join(' · ') || t.username)}</span></td>
          <td>${bar(cnt(mine, 'pass'), cnt(mine, 'fail'), cnt(mine, 'block'), cases.length)}</td><td class="n">${mine.length}/${cases.length}</td>
          <td class="n">${cnt(mine, 'pass')}</td><td class="n">${cnt(mine, 'fail')}</td><td class="n">${cnt(mine, 'block')}</td><td>${last ? fmtDT(last) : '-'}</td></tr>`;
      }).join('') + '</tbody></table>' : '<span class="muted">ยังไม่มีผู้ทดสอบสมัครสมาชิก</span>';
    const sysNames = cases.map(c => c.sysName).filter((g, i, a) => a.indexOf(g) === i);
    $('dSys').innerHTML = `<table><thead><tr><th>ระบบ</th><th class="n">ข้อ</th><th class="n">ผ่าน</th><th class="n">ไม่ผ่าน</th><th class="n">ติดปัญหา</th><th class="n">ยังไม่ทำ</th></tr></thead><tbody>`
      + sysNames.map(g => {
        const cs = cases.filter(c => c.sysName === g), rs = all.filter(r => codes[r.code].sysName === g);
        return `<tr><td>${esc(g)}</td><td class="n">${cs.length}</td><td class="n">${cnt(rs, 'pass')}</td><td class="n">${cnt(rs, 'fail')}</td><td class="n">${cnt(rs, 'block')}</td><td class="n">${people.length * cs.length - rs.length}</td></tr>`;
      }).join('') + '</tbody></table>';
    const issues = all.filter(r => r.v === 'fail' || r.v === 'block').sort((a, b) => b.t - a.t);
    // แยกตามระบบ (เรียงตามลำดับระบบในข้อทดสอบ) และเลือกดูทีละระบบได้
    const sysOrder = d.cases.map(c => c.sysName).filter((g, i, a) => a.indexOf(g) === i);
    const isys = sysOrder.filter(g => issues.some(r => codes[r.code].sysName === g));
    const pw = $('dPrintWho'), pwk = pw.value;   // แถบพิมพ์ผลรายบุคคล: ผู้ทดสอบ + ระบบ
    pw.innerHTML = people.map(t => `<option value="${esc(t.username)}" ${t.username === pwk ? 'selected' : ''}>${esc(t.full)}</option>`).join('');
    const psel = $('dPrintSys'), pkeep = psel.value;
    psel.innerHTML = '<option value="">พิมพ์ทุกระบบ</option>' + sysOrder.map(g => `<option value="${esc(g)}" ${g === pkeep ? 'selected' : ''}>${esc(g)}</option>`).join('');
    const isel = $('dIssueSys'), ikeep = isel.value;
    isel.innerHTML = '<option value="">ทุกระบบ</option>' + isys.map(g => `<option value="${esc(g)}" ${g === ikeep ? 'selected' : ''}>${esc(g)} (${issues.filter(r => codes[r.code].sysName === g).length})</option>`).join('');
    const AK = {}; (d.answers || []).forEach(a => { AK[a.user + '|' + a.code] = a; });
    const dr = $('ansTxt'); if (dr) ansDraft = dr.value;   // เก็บข้อความที่กำลังพิมพ์ไว้ ถ้ามีการวาดใหม่
    const ds = $('ansSt'); if (ds) ansDraftSt = ds.value;
    const stOf = r => (AK[r.user + '|' + r.code] || {}).st || '', hasA = r => !!AK[r.user + '|' + r.code];
    const stF = $('dIssueSt').value;
    const stOk = r => !stF || (stF === 'none' ? !hasA(r) : stF === 'done' ? !!AST_DONE[stOf(r)] : stOf(r) === stF);
    const stPill = r => { const s = stOf(r); return s ? `<span class="pill st ${AST[s][1]}">${AST[s][0]}</span>` : ''; };
    const ansCell = r => {
      const k = r.user + '|' + r.code, a = AK[k];
      if (ansEdit === k) return `<div class="ans-ed"><select id="ansSt" aria-label="สถานะการแก้ไข"><option value="">— สถานะการแก้ไข —</option>${Object.keys(AST).map(s => `<option value="${s}" ${s === ansDraftSt ? 'selected' : ''}>${AST[s][0]}</option>`).join('')}</select><textarea id="ansTxt" rows="3" placeholder="เช่น ระบบทำได้ โดยเข้าเมนู … / วิธีดูข้อมูลที่ถูกต้องคือ … / แก้ไขแล้วในรุ่น …">${esc(ansDraft)}</textarea>
        <div><button class="btn primary sm" data-ans-save="${esc(k)}">บันทึกคำชี้แจง</button> <button class="btn sm" data-ans-cancel="1">ยกเลิก</button></div></div>`;
      return a ? `<div class="ans"><b>คำชี้แจงผู้ดูแล:</b> ${esc(a.text || '-').replace(/\n/g, '<br>')}<small>${esc(a.by)} · ${fmtDT(a.t)} น. <button class="ans-btn" data-ans="${esc(k)}">แก้ไข</button></small></div>`
               : `<div><button class="ans-btn" data-ans="${esc(k)}">+ เพิ่มคำชี้แจง / วิธีที่ถูกต้อง</button></div>`;
    };
    let ino = 0;
    const nDone = issues.filter(r => AST_DONE[stOf(r)]).length, nWip = issues.filter(r => stOf(r) === 'wip').length,
          nSug = issues.filter(r => stOf(r) === 'suggest').length, nNone = issues.filter(r => !hasA(r)).length;
    $('dIssueN').textContent = issues.length ? `(${issues.length} รายการ · ปิดประเด็นแล้ว ${nDone} · อยู่ระหว่างแก้ไข ${nWip} · ข้อเสนอแนะ ${nSug} · ยังไม่ชี้แจง ${nNone})` : '';
    $('dIssues').innerHTML = issues.length ? `<table><thead><tr><th class="n">ลำดับ</th><th>เวลา</th><th>ผู้ทดสอบ</th><th>ข้อ</th><th>โจทย์</th><th>ผล</th><th>ผลที่ได้จริง / ปัญหาที่พบ</th><th>วันที่ / รุ่น</th><th>ภาพ</th></tr></thead><tbody>`
      + (isel.value ? [isel.value] : isys).map(g => {
        const rs = issues.filter(r => codes[r.code].sysName === g && stOk(r));
        return !rs.length ? '' : `<tr class="igrp"><td colspan="9">${esc(g)} · ${rs.length} รายการ</td></tr>` + rs.map(r => `<tr><td class="n">${++ino}</td><td>${fmtDT(r.t)}</td><td>${esc(names[r.user] || r.user)}${facs.length > 1 && facOf[r.user] ? `<br><span class="muted">${esc(facOf[r.user])}</span>` : ''}</td><td><b>${esc(r.code)}</b></td><td>${esc(codes[r.code].task)}</td>
          <td><span class="pill ${r.v}">${SHORT[r.v]}</span>${stPill(r)}</td><td>${esc(r.note) || '<span class="muted">-</span>'}${ansCell(r)}</td><td>${esc(r.day)}<br>${esc(r.ver)}</td>
          <td>${r.img.map((u, k) => `<a href="${esc(u)}" target="_blank" rel="noopener">${k + 1}</a>`).join(' ') || '-'}</td></tr>`).join('');
      }).join('') + '</tbody></table>'
      : '<span class="muted">ยังไม่มีข้อที่ไม่ผ่านหรือติดปัญหา</span>';
    const sel = $('dSysF'), keep = sel.value;
    // ตัวเลือกระบบแสดงทุกระบบ รวมระบบที่ยังไม่ถึงวันเปิดทดสอบ (เมื่อมีวันทดสอบมากกว่า 1 วัน)
    const allCases = d.cases.filter(c => c.show), allSys = allCases.map(c => c.sysName).filter((g, i, a) => a.indexOf(g) === i);
    sel.innerHTML = '<option value="">ทุกระบบ</option>' + allSys.map(g => `<option value="${esc(g)}" ${g === keep ? 'selected' : ''}>${esc(g)}${sysNames.indexOf(g) < 0 ? ' (ยังไม่เปิดให้ทดสอบ)' : ''}</option>`).join('');
    const mcases = sel.value ? allCases.filter(c => c.sysName === sel.value) : cases;
    const sym = { pass: '✓', fail: '✗', block: '!' };
    $('dMatrix').innerHTML = people.length ? `<table class="mx"><thead><tr><th class="n">ลำดับ</th><th class="l">ข้อทดสอบ</th>${people.map(t => `<th class="u">${esc(t.full)}</th>`).join('')}</tr></thead><tbody>`
      + mcases.map((c, ci) => `<tr><td class="n">${ci + 1}</td><td class="l"><b>${esc(c.code)}</b> ${esc(c.task)}</td>` + people.map(t => {
        const r = (R[t.username] || {})[c.code] || {};
        const tip = r.v ? `${SHORT[r.v]} · ${r.day || ''} · ${r.ver || ''}${r.note ? '\n' + r.note : ''}` : 'ยังไม่ทำ';
        return `<td title="${esc(tip)}"><b class="m ${r.v || ''}">${sym[r.v] || '·'}</b></td>`;
      }).join('') + '</tr>').join('') + '</tbody>'
      // แถวสรุปของแต่ละผู้ทดสอบ นับเฉพาะข้อที่แสดงในตาราง (ตามระบบที่เลือก)
      + `<tfoot><tr><td class="l" colspan="2">สรุป</td>` + people.map(t => {
        const mine = mcases.map(c => ((R[t.username] || {})[c.code] || {}).v).filter(Boolean), k = v => mine.filter(x => x === v).length;
        return `<td><span class="ms done">ทำแล้ว ${mine.length}/${mcases.length}</span><span class="ms pass">ผ่าน ${k('pass')}</span>`
          + `<span class="ms fail">ไม่ผ่าน ${k('fail')}</span><span class="ms block">ติดปัญหา ${k('block')}</span><span class="ms todo">ยังไม่ทำ ${mcases.length - mine.length}</span></td>`;
      }).join('') + '</tr></tfoot></table>' : '';
    $('dLog').innerHTML = d.log.length ? `<table><thead><tr><th class="n">ลำดับ</th><th>เวลา</th><th>ผู้ใช้</th><th>รายการ</th><th>ข้อ</th><th>ผล</th><th>ข้อความ</th></tr></thead><tbody>`
      + d.log.map((l, li) => `<tr><td class="n">${li + 1}</td><td>${fmtDT(l.t)}</td><td>${esc(l.full || l.user)}</td><td>${esc(l.what)}</td><td>${esc(l.code)}</td><td>${l.from || l.to ? esc(l.from || '-') + ' → ' + esc(l.to || '-') : ''}</td><td>${esc(l.note)}</td></tr>`).join('') + '</tbody></table>'
      : '<span class="muted">ยังไม่มีกิจกรรม</span>';
  }
  $('dashBtn').onclick = () => ($('dash').hidden ? showDash() : hideDash());
  $('dBack').onclick = hideDash;
  $('dRefresh').onclick = loadDash;
  const stamp8 = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear() + 543}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
  $('dPdf').onclick = () => {
    if (!dash) return toast('ยังไม่มีข้อมูล');
    document.body.classList.add('print-dash');
    const title = document.title; document.title = 'แดชบอร์ดสรุปผลการทดสอบ-' + stamp8();
    const done = () => { document.body.classList.remove('print-dash'); document.title = title; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print(); setTimeout(done, 1500);
  };
  function loadScript(src) {
    return new Promise((ok, bad) => { if (window.htmlToImage) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('โหลดเครื่องมือสร้างรูปไม่ได้')); document.head.appendChild(s); });
  }
  $('dImg').onclick = async () => {
    if (!dash) return toast('ยังไม่มีข้อมูล');
    const btn = $('dImg'); btn.disabled = true; toast('กำลังสร้างรูปภาพ…');
    try {
      // html-to-image วาดผ่านเบราว์เซอร์เอง (รองรับฟอนต์ไทยและสีแบบ color-mix)
      await loadScript('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js');
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const el = $('dash');
      document.body.classList.add('snap-dash'); await new Promise(r => requestAnimationFrame(() => setTimeout(r, 50)));
      const url = await window.htmlToImage.toPng(el, { pixelRatio: 2, backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff', style: { margin: '0' }, width: el.offsetWidth,
        filter: n => !(n.classList && (n.classList.contains('dash-act') || n.id === 'dErr')) });
      const a = document.createElement('a'); a.download = 'แดชบอร์ดสรุปผลการทดสอบ-' + stamp8() + '.png';
      document.body.classList.remove('snap-dash');
      a.href = url; document.body.appendChild(a); a.click(); a.remove();
      toast('บันทึกรูปภาพแล้ว (ดูในโฟลเดอร์ดาวน์โหลด)');
    } catch (e) { document.body.classList.remove('snap-dash'); toast('สร้างรูปภาพไม่สำเร็จ: ' + e.message); }
    btn.disabled = false;
  };
  async function saveDays() {
    const days = [...document.querySelectorAll('#dDays input:checked')].map(i => i.value);
    if (!days.length) return toast('เลือกอย่างน้อย 1 รอบ');
    try {
      await call('setOpenDays', { token: session.token, days });
      toast('เปิดให้ทดสอบ: ' + days.map(roundLabel).join(', ') + ' ผู้ทดสอบเห็นเมื่อรีเฟรชหน้าเว็บ');
      await loadDash();
    } catch (e) { if (e.code === 'AUTH') return expire(e.message); toast('บันทึกไม่สำเร็จ: ' + errText(e)); }
  }
  async function saveVer() {
    const ver = $('dVer').value.trim(), btn = $('dVerSave');
    if (!ver) return toast('กรุณากรอกรุ่นโปรแกรม');
    btn.disabled = true;
    try {
      await call('setCurrent', { token: session.token, ver });
      toast('ตั้งรุ่น ' + PRODUCT + ' เป็น ' + ver + ' แล้ว ข้อที่ทดสอบหลังจากนี้จะใช้รุ่นนี้');
      await loadDash();
    } catch (e) { if (e.code === 'AUTH') return expire(e.message); toast('บันทึกรุ่นไม่สำเร็จ: ' + errText(e)); }
    btn.disabled = false;
  }
  $('dVerSave').onclick = saveVer;
  $('dSysF').onchange = () => { if (dash) renderDash(); };
  $('dFactory').onchange = () => { if (dash) renderDash(); };
  $('dIssueSys').onchange = () => { if (dash) renderDash(); };
  $('dIssueSt').onchange = () => { if (dash) renderDash(); };
  // คำชี้แจงของผู้ดูแลต่อข้อที่ไม่ผ่าน/ติดปัญหา (ผู้ทดสอบอาจไม่ทราบวิธีดูข้อมูลที่ถูกต้อง)
  let ansEdit = null, ansDraft = '', ansDraftSt = '';
  $('dIssues').onclick = async e => {
    const b = e.target.closest('button');
    if (!b || !dash) return;
    if (b.dataset.ans) {
      const a = (dash.answers || []).find(x => x.user + '|' + x.code === b.dataset.ans);
      ansEdit = b.dataset.ans; ansDraft = a ? a.text : ''; ansDraftSt = a ? (a.st || '') : ''; renderDash();
      const t = $('ansTxt'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
    } else if (b.dataset.ansCancel) {
      ansEdit = null; ansDraft = ''; ansDraftSt = ''; renderDash();
    } else if (b.dataset.ansSave) {
      const k = b.dataset.ansSave, i = k.indexOf('|'), user = k.slice(0, i), code = k.slice(i + 1), text = ($('ansTxt').value || '').trim(), status = $('ansSt').value;
      b.disabled = true;
      try {
        const j = await call('answer', { token: session.token, user, code, text, status });
        dash.answers = (dash.answers || []).filter(x => !(x.user === user && x.code === code));
        if (text || status) dash.answers.push(j.answer);
        ansEdit = null; ansDraft = ''; ansDraftSt = ''; renderDash();
        toast(text || status ? 'บันทึกคำชี้แจงแล้ว' : 'ลบคำชี้แจงแล้ว');
      } catch (er) { if (er.code === 'AUTH') return expire(er.message); b.disabled = false; toast('บันทึกไม่สำเร็จ: ' + errText(er)); }
    }
  };
  // ผู้ดูแลพิมพ์สรุปผล / ทั้งเล่มของผู้ทดสอบแต่ละท่าน (ใช้ผลจากแดชบอร์ด)
  function printTester(mode) {
    const t = dash && dash.testers.find(x => x.username === $('dPrintWho').value);
    if (!t) return toast('เลือกผู้ทดสอบก่อน');
    const res = {}; dash.results.filter(r => r.user === t.username).forEach(r => { res[r.code] = r; });
    const list = LIST.slice();
    const answers = {}; (dash.answers || []).filter(x => x.user === t.username).forEach(x => { answers[x.code] = x; });
    doPrint(mode, { u: t, res, list, shots: {}, answers, sys: $('dPrintSys').value });
  }
  $('dPrintSum').onclick = () => printTester('summary');
  $('dPrintAll').onclick = () => printTester('full');

  // ======================================================================= ฉบับพิมพ์
  // who = ผลของผู้ทดสอบที่จะพิมพ์ (ค่าเริ่มต้น = ผู้ใช้ที่เข้าระบบ) · who.sys = พิมพ์เฉพาะระบบ (ว่าง = ทุกระบบ)
  // who.answers = คำชี้แจง / แนวทางแก้ไขของผู้ดูแลระบบ แยกตามรหัสข้อ
  function buildPrint(mode, who) {
    who = who || { u: session.user, res: state.res, list: LIST, shots: localShots, answers: myAnswers, sys: $('printSys').value };
    const u = who.u, RES = who.res, ANS = who.answers || {}, PL = who.sys ? who.list.filter(c => c.sysName === who.sys) : who.list;
    const fac = (u.factory || '').trim();
    const hd = s => `<div class="p-hd"><span>เอกสารประกอบการทดสอบระบบ ${PRODUCT}${fac ? ' · ' + esc(fac) : ''} · ${esc(s)}</span><span>ผู้ทดสอบ: ${esc(u.full)}</span></div>`;
    const mark = (r, v) => `<span class="mark">${r.v === v ? '☑' : '☐'} ${LABEL[v]}</span>`;
    const row = (k, html) => `<tr><th class="l">${k}</th><td>${html}</td></tr>`;
    const blk = (cap, inner) => `<div class="blk"><div class="cap">${cap}</div>${inner}</div>`;
    const ans = code => { const a = ANS[code]; if (!a || !(a.text || a.st)) return ''; return (a.st && AST[a.st] ? '[' + AST[a.st][0] + '] ' : '') + esc(a.text || '').replace(/\n/g, '<br>'); };
    const pages = mode !== 'full' ? [] : PL.map((c, k) => {
      const r = RES[c.code] || {}, ti = TYPE_INFO[c.type] || TYPE_INFO.Positive;
      return `<div class="p-page p">${hd(c.sysName)}
        <div class="p-title">${esc(c.code)} &nbsp;${esc(c.task)}</div>
        ${c.img ? `<figure><img src="${esc(c.img)}" alt=""><figcaption>ภาพที่ ${k + 1} ${esc(c.shotCap)}</figcaption></figure>` : ''}
        <table>
          ${row('ประเภทโจทย์', `<span class="tag ${c.type}">${esc(c.type)}</span> ${esc(ti.what)}${c.core ? ' · โจทย์หลัก (ทำใน Zoom)' : ''}`)}
          ${row('ช่วงเวลา', esc(c.slot))}${row('เมนู', esc(c.menu))}
          ${c.dept || c.role ? row('ฝ่าย / ผู้ทำรายการ', dotLines([c.dept, c.role].filter(Boolean).join(' · '))) : ''}
          ${c.dependsOn ? row('ทำต่อจากข้อ', esc(c.dependsOn)) : ''}
          ${c.pre ? row('เงื่อนไขก่อนเริ่ม', preHtml(c.pre)) : ''}
          ${row('ขั้นตอนทดสอบ', `<ol>${c.steps.map(s => `<li>${stepHtml(s)}</li>`).join('')}</ol>`)}
          ${c.data && c.data !== '-' ? row('ข้อมูลทดสอบ (ตามโจทย์)', dotLines(c.data)) : ''}
          ${c.sample.length ? row(sampleHead(c), c.sample.map(([kk, v]) => `<b>${esc(kk)}:</b> ${esc(v)}`).join('<br>')) : ''}
          ${row('ผลที่คาดหวัง', dotLines(c.expect))}${c.note ? row('ข้อควรทราบ', dotLines(c.note)) : ''}
        </table>
        ${c.items ? blk(`รายการในเอกสาร (${esc(c.code)})`, itemsT(c.items).replace(/<\/?div[^>]*>/g, '')) : ''}
        ${c.jes.map(j => blk(`ตัวอย่างการบันทึกบัญชี ${esc(c.code)}: ${esc(j.title)}`, jeT(j).replace(/<\/?div[^>]*>/g, ''))).join('')}
        <div class="box"><div class="cap">บันทึกผลการทดสอบ ${esc(c.code)}</div><table>
          ${row('ผลทดสอบ', mark(r, 'pass') + mark(r, 'fail') + mark(r, 'block'))}
          <tr><th class="l">ผลที่ได้จริง / ปัญหาที่พบ</th><td style="height:16mm">${esc(r.note).replace(/\n/g, '<br>')}</td></tr>
          ${ans(c.code) ? row('คำชี้แจง / แนวทางแก้ไข (ผู้ดูแลระบบ)', ans(c.code)) : ''}
          ${(r.img || []).length ? row('ภาพหน้าจอประกอบ', `${r.img.length} ภาพ (เก็บใน Google Drive ของทีม BMS)`) : ''}
          ${row('ผู้ทดสอบ', 'ลงชื่อ ' + esc(u.full))}
          ${row('วันที่ / รุ่นโปรแกรม', r.v || r.note ? `วันที่ ${esc(r.day || '-')} &emsp;&emsp; รุ่นโปรแกรม ${esc(r.ver || '-')}` : '<span class="dots">&nbsp;</span>')}
        </table></div>
        ${(who.shots[c.code] || []).map(s => `<figure><img src="${s.src}" alt=""><figcaption>ภาพหน้าจอที่ผู้ทดสอบแนบ</figcaption></figure>`).join('')}
      </div>`;
    });
    const n = { pass: 0, fail: 0, block: 0, todo: 0 }; PL.forEach(c => { n[(RES[c.code] || {}).v || 'todo']++; });
    const bySys = PL.map(c => c.sysName).filter((g, i, a) => a.indexOf(g) === i).map(g => {
      const items = PL.filter(c => c.sysName === g), k = v => items.filter(c => ((RES[c.code] || {}).v || 'todo') === v).length;
      return `<tr><td>${esc(g)}</td><td class="n">${items.length}</td><td class="n">${k('pass')}</td><td class="n">${k('fail')}</td><td class="n">${k('block')}</td><td class="n">${k('todo')}</td></tr>`;
    }).join('');
    const summary = `<div class="p-page p">${hd(who.sys || 'สรุปผล')}
      <div class="p-title">สรุปผลการทดสอบระบบ ${PRODUCT}${fac ? ' — ' + esc(fac) : ''}${who.sys ? ' · ' + esc(who.sys) : ''}</div>
      <table><tr><th class="l">โรงงาน / บริษัท</th><td>${esc(fac) || '-'}</td></tr>
        <tr><th class="l">ผู้ทดสอบ</th><td>${esc(u.full)}${u.org ? ' · ' + esc(u.org) : ''}</td></tr>
        <tr><th class="l">ระบบที่พิมพ์</th><td>${who.sys ? esc(who.sys) : 'ทุกระบบ'}</td></tr>
        <tr><th class="l">พิมพ์เมื่อ</th><td>${esc(new Date().toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' }))} น.</td></tr></table>
      <table><thead><tr><th>ระบบ</th><th class="n">จำนวนข้อ</th><th class="n">ผ่าน</th><th class="n">ไม่ผ่าน</th><th class="n">ติดปัญหา</th><th class="n">ยังไม่ทดสอบ</th></tr></thead>
        ${bySys}<tr class="foot"><td>รวม</td><td class="n">${PL.length}</td><td class="n">${n.pass}</td><td class="n">${n.fail}</td><td class="n">${n.block}</td><td class="n">${n.todo}</td></tr></table>
      <table class="sum"><thead><tr><th style="width:5%">#</th><th style="width:10%">ข้อ</th><th>โจทย์</th><th style="width:9%">ประเภท</th><th style="width:10%">ผล</th><th style="width:16%">วันที่ / รุ่น</th><th style="width:28%">ผลที่ได้จริง / ปัญหาที่พบ</th></tr></thead>
        ${PL.map((c, k) => { const r = RES[c.code] || {}; return `<tr><td>${k + 1}</td><td>${esc(c.code)}</td><td>${esc(c.task)}</td><td>${esc(c.type)}</td><td>${r.v ? SHORT[r.v] : '-'}</td><td>${r.v ? esc((r.day || '') + ' · ' + (r.ver || '')) : ''}</td><td>${esc(r.note)}${ans(c.code) ? `<div class="p-ans"><b>แนวทางแก้ไข (ผู้ดูแลระบบ):</b> ${ans(c.code)}</div>` : ''}</td></tr>`; }).join('')}
      </table>
      <div class="sign">
        <div>ลงชื่อ <span class="dots">&nbsp;</span><br>(${esc(u.full)})<br>ผู้ทดสอบ<br>วันที่ <span class="dots" style="min-width:35%">&nbsp;</span></div>
        <div>ลงชื่อ <span class="dots">&nbsp;</span><br>(<span class="dots">&nbsp;</span>)<br>ผู้รับรองผลการทดสอบ<br>วันที่ <span class="dots" style="min-width:35%">&nbsp;</span></div>
      </div></div>`;
    $('print-area').innerHTML = pages.join('') + summary;
    return who;
  }
  async function doPrint(mode, who) {
    who = buildPrint(mode, who);
    const title = document.title;   // ชื่อไฟล์ PDF ตามผู้ทดสอบและระบบ
    document.title = (mode === 'full' ? 'ผลการทดสอบทั้งเล่ม-' : 'สรุปผลการทดสอบ-') + (who.u.factory ? who.u.factory + '-' : '') + who.u.full + (who.sys ? '-' + who.sys : '');
    window.addEventListener('afterprint', function back() { document.title = title; window.removeEventListener('afterprint', back); });
    const imgs = [...$('print-area').querySelectorAll('img')];
    if (imgs.length) {
      toast('กำลังเตรียมเอกสาร…');
      await Promise.all(imgs.map(i => (i.complete ? Promise.resolve() : new Promise(r => { i.onload = i.onerror = r; }))));
    }
    window.print();
  }
  $('printSum').onclick = () => doPrint('summary');
  $('printAll').onclick = () => doPrint('full');
  window.addEventListener('beforeprint', () => { if (session && !$('print-area').innerHTML) buildPrint('summary'); });
  window.addEventListener('afterprint', () => { $('print-area').innerHTML = ''; });

  // ======================================================================= สีธีม
  const THEMES = [['', 'ไม่มีสี (โทนเทา)', '#4b5563'], ['teal', 'เขียวน้ำทะเล', '#0f766e'], ['navy', 'น้ำเงิน', '#1f4e8c'],
                  ['green', 'เขียว', '#2e7d4f'], ['plum', 'ม่วง', '#6b4f8a'], ['bronze', 'น้ำตาลทอง', '#8a6a3d'], ['pink', 'ชมพู', '#b0457a']];
  const THEME_KEY = 'renu-theme-pick';   // เก็บเฉพาะสีที่ผู้ใช้เลือกเอง (ไม่เลือก = ใช้ค่าเริ่มต้นใน index.html)
  function setTheme(t, picked) {
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    if (picked) store.set(THEME_KEY, t || '');
    const th = THEMES.find(x => x[0] === (t || '')) || THEMES[0];
    $('themeColor').setAttribute('content', th[2]);
    paintThemes();
  }
  function paintThemes() {
    const curT = document.documentElement.dataset.theme || '';
    $('themeList').innerHTML = THEMES.map(([k, n, c]) => `<button class="sw" data-t="${k}" aria-pressed="${k === curT}"><i style="background:${c}"></i>${n}</button>`).join('');
    $('authTheme').innerHTML = 'สีธีม: ' + THEMES.map(([k, n, c]) => `<button class="dot2" data-t="${k}" title="${n}" aria-label="สีธีม ${n}" aria-pressed="${k === curT}" style="background:${c}"></button>`).join('');
    document.querySelectorAll('#themeList .sw, #authTheme .dot2').forEach(b => b.onclick = e => { e.stopPropagation(); setTheme(b.dataset.t, true); });
  }
  $('themeBtn').onclick = e => { e.stopPropagation(); const pop = $('themePop'); pop.hidden = !pop.hidden; $('themeBtn').setAttribute('aria-expanded', String(!pop.hidden)); };
  document.addEventListener('click', e => { if (!$('themePop').hidden && !e.target.closest('.theme')) { $('themePop').hidden = true; $('themeBtn').setAttribute('aria-expanded', 'false'); } });
  setTheme(store.get(THEME_KEY, window.SA_THEME_DEFAULT || ''));

  // ======================================================================= เริ่มต้น
  if (session && session.token && session.user) enterApp(false); else showAuth('login');
  window.SA_DEBUG = { get state() { return state; }, get outbox() { return outbox; }, get list() { return LIST; } };
})();
