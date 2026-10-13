// จำลอง Google Apps Script สำหรับทดสอบในเครื่อง: รัน apps-script/Code.gs จริง โดยจำลอง SpreadsheetApp / DriveApp / ฯลฯ
// ใช้งาน: node mock_apps_script.js [port] [--no-setup]   แล้วตั้ง API_URL = http://127.0.0.1:<port>/exec
//   --no-setup         ไม่เรียก setup ตอนเริ่ม (จำลองชีตใหม่ที่ยังไม่ได้ติดตั้ง: คำขอแรกต้องสร้างแท็บให้เอง)
//   GET /__dump        ดูข้อมูลทุกแท็บ (JSON)
//   GET /__setup       เรียก setup ซ้ำ (ตรวจว่าเรียกซ้ำแล้วข้อมูลไม่ซ้ำ)
//   POST /__set        {sheet, row, col, value} แก้ค่าในแท็บ (จำลองแอดมินแก้ Sheet)
//   POST /__props      {key, value} ตั้งค่า Script Properties (เช่น ready = รุ่นเก่า เพื่อจำลองการขึ้นโค้ดรุ่นใหม่)
//   POST /__offline    {on: true|false} จำลองระบบหลังบ้านล่ม
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto'), vm = require('vm');
const ARGS = process.argv.slice(2), NO_SETUP = ARGS.includes('--no-setup');
const PORT = Number(ARGS.find(a => /^\d+$/.test(a)) || 8790);
const GS = process.env.MOCK_GS || path.join(__dirname, '..', 'apps-script', 'Code.gs');

// ---------------- Spreadsheet ----------------
class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh.get(this.r + i, this.c + j)); out.push(row); } return out; }
  getValue() { return this.sh.get(this.r, this.c); }
  setValues(v) {
    if (v.length !== this.nr || v.some(row => row.length !== this.nc)) throw new Error(`setValues: data ${v.length}x${v[0] && v[0].length} does not match range ${this.nr}x${this.nc}`);
    v.forEach((row, i) => row.forEach((x, j) => this.sh.set(this.r + i, this.c + j, x))); return this;
  }
  setValue(x) { this.sh.set(this.r, this.c, x); return this; }
  setFormula(f) { this.sh.set(this.r, this.c, f, true); return this; }
  setDataValidation(rule) { this.sh.validation.push({ r: this.r, c: this.c, nr: this.nr, list: rule.list }); return this; }
  setFontWeight() { return this; } setBackground() { return this; } setNumberFormat() { return this; } setWrap() { return this; }
}
class Sheet {
  constructor(name) { this.name = name; this.rows = []; this.validation = []; }
  get(r, c) { const row = this.rows[r - 1]; const v = row ? row[c - 1] : undefined; return v === undefined ? '' : v; }
  set(r, c, x, formula) {
    while (this.rows.length < r) this.rows.push([]);
    // เหมือน Sheets จริง: ข้อความขึ้นต้นด้วย ' เก็บเป็นข้อความ (ไม่มี ') / ขึ้นต้นด้วย = กลายเป็นสูตร (ทำเครื่องหมายไว้ตรวจ)
    if (typeof x === 'string' && !formula) { if (x.startsWith("'")) x = x.slice(1); else if (/^[=+\-@]/.test(x) && x.length > 1) x = '[[FORMULA]]' + x; }
    this.rows[r - 1][c - 1] = x;
  }
  getName() { return this.name; }
  getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); }
  getMaxRows() { return Math.max(1000, this.rows.length); } getMaxColumns() { return Math.max(26, this.getLastColumn()); }
  getLastRow() { for (let i = this.rows.length; i > 0; i--) if (this.rows[i - 1].some(v => v !== '' && v !== undefined)) return i; return 0; }
  getRange(r, c, nr = 1, nc = 1) { if (r < 1 || c < 1 || nr < 1 || nc < 1) throw new Error('bad range'); return new Range(this, r, c, nr, nc); }
  appendRow(v) { const r = this.getLastRow() + 1; v.forEach((x, j) => this.set(r, j + 1, x)); return this; }
  deleteRow(r) { this.rows.splice(r - 1, 1); return this; }
  setFrozenRows() {} hideColumns() {} setColumnWidth() {}
}
const sheets = [new Sheet('แผ่น1')];
const ss = {
  getSheetByName: n => sheets.find(s => s.name === n) || null,
  insertSheet: n => { const s = new Sheet(n); sheets.push(s); return s; },
  getSheets: () => sheets.slice(),
  getUrl: () => 'https://docs.google.com/spreadsheets/d/MOCK/edit',
  deleteSheet: s => { sheets.splice(sheets.indexOf(s), 1); },
  setSpreadsheetTimeZone() {},
};
// ---------------- Services ----------------
const props = {}, cache = {}, files = [];
let folderSeq = 0;
function mkFolder(name) {
  const f = { id: 'F' + (++folderSeq), name, children: [] };
  return {
    _f: f, getId: () => f.id, getName: () => f.name,
    getFoldersByName: n => { const list = f.children.filter(x => x.getName() === n); let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; },
    createFolder: n => { const c = mkFolder(n); f.children.push(c); folders[c.getId()] = c; return c; },
    createFile: blob => { const id = 'D' + (files.length + 1); files.push({ id, folder: f.name, name: blob.name, bytes: blob.bytes.length, mime: blob.mime });
                          return { getUrl: () => 'https://drive.google.com/file/d/' + id + '/view', getId: () => id, getName: () => blob.name }; },
  };
}
const folders = {};
const toSigned = buf => Array.from(buf, b => (b > 127 ? b - 256 : b));
const ctx = {
  console,
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ss, flush() {},
    newDataValidation: () => { const rule = { list: null }; const b = { requireValueInList: l => { rule.list = l; return b; }, setAllowInvalid: () => b, build: () => rule }; return b; },
  },
  PropertiesService: { getScriptProperties: () => ({
    getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => Object.assign({}, props) }) },
  CacheService: { getScriptCache: () => ({
    get: k => (cache[k] && cache[k].exp > Date.now() ? cache[k].v : null), put: (k, v, s) => { cache[k] = { v: String(v), exp: Date.now() + (s || 600) * 1000 }; }, remove: k => { delete cache[k]; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {}, tryLock: () => true }) },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (alg, s) => toSigned(crypto.createHash(alg).update(String(s), 'utf8').digest()),
    base64Encode: x => Buffer.from(typeof x === 'string' ? Buffer.from(x, 'utf8') : x.map(b => (b < 0 ? b + 256 : b))).toString('base64'),
    base64Decode: s => toSigned(Buffer.from(s, 'base64')),
    getUuid: () => crypto.randomUUID(),
    formatDate: (d, tz, f) => { const p = n => String(n).padStart(2, '0'); return f.replace('yyyy', d.getFullYear()).replace('MM', p(d.getMonth() + 1)).replace('dd', p(d.getDate())).replace('HH', p(d.getHours())).replace('mm', p(d.getMinutes())).replace('ss', p(d.getSeconds())); },
    newBlob: (bytes, mime, name) => ({ bytes, mime, name }),
  },
  DriveApp: {
    getFoldersByName: n => { const list = Object.values(folders).filter(x => x.getName() === n); let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; },
    createFolder: n => { const f = mkFolder(n); folders[f.getId()] = f; return f; },
    getFolderById: id => { if (!folders[id]) throw new Error('folder not found ' + id); return folders[id]; },
  },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ _s: s, setMimeType() { return this; }, getContent() { return this._s; } }) },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(GS, 'utf8') + '\n;this.__api = { setup, doGet, doPost };', ctx, { filename: 'Code.gs' });
console.log(NO_SETUP ? 'setup: ข้าม (--no-setup) คำขอแรกจะสร้างแท็บให้เอง' : 'setup: ' + ctx.__api.setup());

let offline = false;
// จำลองอาการของ Google: คำขอค้าง ms มิลลิวินาที แล้วตอบหน้า 404 (HTML ไม่มี CORS) · POST /__stall {n, ms}
let stall = { n: 0, ms: 0 };
const hits = [];   // GET /__hits ดูคำขอที่เข้ามา (action, เวลา, ค้างหรือไม่)
const dump = () => ({ sheets: Object.fromEntries(sheets.map(s => [s.name, s.rows.map(r => r.map(v => (v instanceof Date ? v.toISOString() : v)))])),
                      validation: Object.fromEntries(sheets.filter(s => s.validation.length).map(s => [s.name, s.validation])), files, sessions: Object.keys(props).length });
http.createServer((req, res) => {
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }); res.end(typeof obj === 'string' ? obj : JSON.stringify(obj)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }); return res.end(); }
  let body = '';
  req.on('data', d => { body += d; });
  req.on('end', () => {
    try {
      if (req.url === '/__dump') return send(200, dump());
      if (req.url === '/__setup') { const r = ctx.__api.setup(); return send(200, { result: r, rows: Object.fromEntries(sheets.map(s => [s.name, s.getLastRow()])), folders: Object.values(folders).map(f => f.getName()) }); }
      if (req.url === '/__clearcache') { Object.keys(cache).forEach(k => delete cache[k]); return send(200, { ok: true }); }
      if (req.url === '/__offline') { offline = !!JSON.parse(body).on; return send(200, { offline }); }
      if (req.url === '/__props') { const q = JSON.parse(body); props[q.key] = String(q.value); return send(200, { ok: true }); }
      if (req.url === '/__set') { const q = JSON.parse(body); ss.getSheetByName(q.sheet).set(q.row, q.col, q.value); return send(200, { ok: true }); }
      if (req.url === '/__stall') { stall = JSON.parse(body); return send(200, stall); }
      if (req.url === '/__hits') return send(200, hits);
      if (offline) { res.destroy(); return; }
      let action = 'GET'; try { action = JSON.parse(body).action; } catch (e) {}
      if (stall.n > 0) {
        stall.n--; hits.push({ action, t: Date.now(), stalled: true });
        return setTimeout(() => { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<html><title>ไม่พบเพจ</title></html>'); }, stall.ms);
      }
      hits.push({ action, t: Date.now() });
      // จำลองคำตอบที่เป็นของคำขออื่น (rid ไม่ตรง) · POST /__stall {wrong: n}
      if (stall.wrong > 0 && req.method === 'POST') {
        stall.wrong--; hits[hits.length - 1].wrong = true;
        const j = JSON.parse(ctx.__api.doPost({ postData: { contents: body } }).getContent()); j.rid = 'other-request';
        return send(200, j);
      }
      if (req.method === 'GET') return send(200, ctx.__api.doGet({}).getContent());
      if (req.headers['content-type'] && !/^text\/plain/.test(req.headers['content-type'])) return send(415, { ok: false, error: 'expected text/plain (simple CORS request)' });
      send(200, ctx.__api.doPost({ postData: { contents: body } }).getContent());
    } catch (e) { console.error(e); send(500, { ok: false, error: String(e) }); }
  });
}).listen(PORT, '127.0.0.1', () => console.log('mock Apps Script on http://127.0.0.1:' + PORT + '/exec'));
