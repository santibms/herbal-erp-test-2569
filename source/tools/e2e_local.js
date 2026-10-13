// ทดสอบระบบบันทึกผลในเครื่อง (ไม่แตะ Google / GitHub)
//   เปิดหลังบ้านจำลอง (mock_apps_script.js --no-setup) + เว็บ web/ บน localhost แล้วใช้ Playwright กดจริง:
//   สมัคร > เข้าระบบ > เปิดข้อ > บันทึกผล + ข้อความ + แนบภาพ > ออก/เข้าใหม่ผลยังอยู่ > สมัครผู้ดูแล > แดชบอร์ด > ตั้งรุ่น > พิมพ์สรุปผล (PDF)
//   และตรวจว่า setup เรียกซ้ำแล้วข้อมูลไม่ซ้ำ
// ใช้งาน: node tools/e2e_local.js        (ภาพหน้าจอเก็บที่ shots/)
//   ต้องมี Playwright: ตั้ง PLAYWRIGHT_PATH เป็นโฟลเดอร์ node_modules/playwright ถ้า require('playwright') ไม่เจอ
const fs = require('fs'), path = require('path'), http = require('http'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), WEB = path.join(ROOT, 'web'), SHOTS = path.join(ROOT, 'shots');
const API_PORT = 8790, WEB_PORT = 8791, API = `http://127.0.0.1:${API_PORT}/exec`;
const INVITE = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, '.local-settings.json'), 'utf8')).invite || ''; } catch (e) { return ''; } })();
function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_PATH, 'playwright', 'C:/Herbal ERP/herbal-medicine-erp/node_modules/playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) {} }
  throw new Error('ไม่พบ Playwright (ตั้ง PLAYWRIGHT_PATH)');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = p => new Promise((ok, bad) => http.get(`http://127.0.0.1:${API_PORT}${p}`, r => { let b = ''; r.on('data', d => { b += d; }); r.on('end', () => { try { ok(JSON.parse(b)); } catch (e) { bad(e); } }); }).on('error', bad));
const results = [];
function check(name, ok, info) { results.push({ name, ok: !!ok, info: info || '' }); console.log((ok ? 'ผ่าน   ' : 'ไม่ผ่าน ') + name + (info ? ' · ' + info : '')); }

// เว็บแบบไฟล์นิ่ง (เหมือน GitHub Pages)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain' };
const web = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(WEB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let mock = null;
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  mock = spawn(process.execPath, [path.join(__dirname, 'mock_apps_script.js'), String(API_PORT), '--no-setup'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let mockOut = ''; mock.stdout.on('data', d => { mockOut += d; }); mock.stderr.on('data', d => { mockOut += d; });
  await new Promise(r => web.listen(WEB_PORT, '127.0.0.1', r));
  for (let i = 0; i < 50 && !/mock Apps Script on/.test(mockOut); i++) await sleep(100);
  if (!/mock Apps Script on/.test(mockOut)) throw new Error('หลังบ้านจำลองไม่เริ่ม: ' + mockOut);
  const before = await get('/__dump');
  check('ชีตใหม่ยังไม่มีแท็บของระบบ (ก่อนคำขอแรก)', !before.sheets['ผลทดสอบ'], Object.keys(before.sheets).join(', '));

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'th-TH' });
  const errors = [];
  page.on('dialog', d => { errors.push('dialog: ' + d.message().split(String.fromCharCode(10))[0]); d.dismiss(); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push('console: ' + m.text()); });
  // ใช้หลังบ้านจำลองแทน config.js จริง (config.js ในโฟลเดอร์ไม่ถูกแก้)
  await page.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.SA_CONFIG = { API_URL: '${API}' };` }));
  await page.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });

  // ---------- หน้าเข้าสู่ระบบ / คำขอแรกสร้างแท็บ ----------
  await page.goto(`http://127.0.0.1:${WEB_PORT}/`);
  await page.waitForSelector('#loginForm:not([hidden])');
  await sleep(600);
  const afterGet = await get('/__dump');
  const tabs = Object.keys(afterGet.sheets);
  check('คำขอแรก (GET ปลุกระบบ) สร้างแท็บครบ', ['ผลทดสอบ', 'ประวัติการบันทึก', 'สรุป', 'ผู้ทดสอบ', 'ข้อทดสอบ', 'ตั้งค่า'].every(t => tabs.includes(t)), tabs.join(', '));
  const settings = afterGet.sheets['ตั้งค่า'] || [];
  const setv = k => ((settings.find(r => r[0] === k) || [])[1] || '');
  check('รหัสเชิญตั้งต้น = ค่าใน .local-settings.json', INVITE && setv('รหัสเชิญ') === INVITE);
  check('รุ่นโปรแกรมตั้งต้น v1.6.84', setv('รุ่นโปรแกรมปัจจุบัน') === 'v1.6.84', setv('รุ่นโปรแกรมปัจจุบัน'));
  const nCases = (afterGet.sheets['ข้อทดสอบ'] || []).length - 1;
  const DATA = await page.evaluate(() => window.SA_DATA);
  check('แท็บข้อทดสอบ = ข้อใน cases.js', nCases === DATA.cases.length, `${nCases} / ${DATA.cases.length} (${DATA.source})`);
  await page.screenshot({ path: path.join(SHOTS, '01-เข้าสู่ระบบ.png') });

  // ---------- สมัครสมาชิก (รหัสเชิญผิด แล้วถูก) ----------
  await page.click('#toReg');
  await page.fill('#rn', 'นางสาวทดสอบ ระบบหนึ่ง'); await page.fill('#ro', 'ฝ่ายควบคุมคุณภาพ');
  await page.fill('#ru', 'tester01'); await page.fill('#ri', 'wrong-code');
  await page.fill('#rp', 'test1234'); await page.fill('#rp2', 'test1234');
  await page.click('#regBtn');
  await page.waitForFunction(() => document.getElementById('rerr').textContent.length > 0);
  check('รหัสเชิญผิดถูกปฏิเสธ', /รหัสเชิญไม่ถูกต้อง/.test(await page.textContent('#rerr')), await page.textContent('#rerr'));
  await page.fill('#ri', INVITE); await page.fill('#rp', 'test1234'); await page.fill('#rp2', 'test1234');
  await page.click('#regBtn');
  await page.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  await page.waitForFunction(() => /ข้อ \d+ \/ \d+/.test(document.getElementById('pos').textContent));
  check('สมัครแล้วเข้าหน้าบันทึกผล', true, await page.textContent('.brand b'));
  check('แสดงรุ่น Herbal ERP v1.6.84', /v1\.6\.84/.test(await page.textContent('#curVer')));
  await sleep(400);
  await page.screenshot({ path: path.join(SHOTS, '02-หน้าบันทึกผล.png') });

  // ---------- เปิดข้อที่ 2 แล้วบันทึกผล ----------
  const ROUNDS = DATA.rounds || DATA.days || [], multi = ROUNDS.length > 1;
  const vis = DATA.cases.filter(c => !c.slot || c.slot.indexOf(ROUNDS[0]) >= 0);   // ผู้ทดสอบเห็นเฉพาะรอบแรกจนกว่าผู้ดูแลจะเปิดรอบอื่น
  const nList = await page.evaluate(() => window.SA_DEBUG.list.length);
  check('ผู้ทดสอบเห็นเฉพาะข้อของรอบที่เปิด (' + ROUNDS[0] + ')', nList === vis.length, `${nList} จาก ${DATA.cases.length} ข้อ`);
  const code = vis[Math.min(1, vis.length - 1)].code;
  await page.click('#openAll');
  await page.click(`#toc .it[data-code="${code}"]`);
  await page.waitForFunction(c => document.querySelector('#sheet h1 .code').textContent === c, code);
  check('เปิดข้อ ' + code, true, (await page.textContent('#sheet h1')).trim());
  await page.click('#sheet label.ck.fail');
  await page.fill('#note', 'ทดสอบในเครื่อง: ระบบยอมให้บันทึกค่าเกินเกณฑ์ (ข้อความตัวอย่าง)');
  await page.press('#note', 'Tab');   // ออกจากช่องข้อความ = ส่งทันที (ไม่ต้องรอ 3 วินาที)
  await page.waitForFunction(() => !window.SA_DEBUG.outbox.length && /บันทึกเข้าระบบแล้ว/.test(document.getElementById('saved').textContent), null, { timeout: 15000 });
  check('บันทึกผล "ไม่ผ่าน" + ข้อความ', true, await page.textContent('#saved'));
  // แนบภาพ (ใช้ภาพหน้าจอปัจจุบันเป็นไฟล์ PNG)
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 400, height: 240 } });
  await page.setInputFiles('#file', { name: 'shot.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('#atts a', { timeout: 15000 });
  check('แนบภาพแล้วได้ลิงก์ Google Drive (จำลอง)', true, await page.textContent('#atts a'));
  await sleep(300);
  await page.screenshot({ path: path.join(SHOTS, '03-บันทึกผลแล้ว.png'), fullPage: false });
  let dump = await get('/__dump');
  const row = (dump.sheets['ผลทดสอบ'] || []).find(r => r[1] === 'tester01' && r[3] === code) || [];
  check('แถวในแท็บ ผลทดสอบ ถูกต้อง', row[7] === 'ไม่ผ่าน' && /ทดสอบในเครื่อง/.test(row[8]) && /drive\.google\.com/.test(row[9]) && row[10] === '14 ต.ค. 2569' && row[11] === 'v1.6.84', JSON.stringify(row.slice(3, 12)));
  check('ภาพเก็บในโฟลเดอร์ภาพแนบของผู้ทดสอบ', dump.files.length === 1 && dump.files[0].folder.indexOf('tester01') === 0, JSON.stringify(dump.files));

  // ---------- ออกแล้วเข้าใหม่: ผลยังอยู่ ----------
  await page.click('#logout');
  await page.waitForSelector('#loginForm:not([hidden])');
  await page.evaluate(() => { try { Object.keys(localStorage).filter(k => /^renu-(state|outbox)/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {} });
  await page.fill('#lu', 'tester01'); await page.fill('#lp', 'test1234');
  await page.click('#loginBtn');
  await page.waitForSelector('#app:not([hidden])');
  await page.waitForFunction(c => ((window.SA_DEBUG.state || {}).res || {})[c] && window.SA_DEBUG.state.res[c].v === 'fail', code, { timeout: 15000 }).catch(() => {});
  await page.click('#openAll');
  await page.waitForFunction(c => { const d = document.querySelector(`#toc .it[data-code="${c}"] .dot`); return d && d.classList.contains('fail'); }, code, { timeout: 15000 }).catch(() => {});
  const dotFail = await page.$eval(`#toc .it[data-code="${code}"] .dot`, d => d.classList.contains('fail')).catch(() => false);
  check('เข้าระบบใหม่ (ล้างข้อมูลในเครื่อง) ผลยังอยู่', dotFail);
  await page.click('#logout');

  // ---------- ผู้ดูแล: แดชบอร์ด ----------
  dump = await get('/__dump');
  const adminCode = ((dump.sheets['ตั้งค่า'] || []).find(r => r[0] === 'รหัสผู้ดูแล') || [])[1];
  await page.waitForSelector('#loginForm:not([hidden])');
  await page.click('#toReg');
  await page.fill('#rn', 'ผู้ดูแล ทีมทดสอบ'); await page.fill('#ro', 'ทีม BMS'); await page.fill('#ru', 'admin01');
  await page.fill('#ri', INVITE); await page.fill('#rp', 'adm-pass-99'); await page.fill('#rp2', 'adm-pass-99');
  await page.check('#radm'); await page.fill('#rac', adminCode);
  await page.click('#regBtn');
  await page.waitForSelector('#dashBtn:not([hidden])', { timeout: 15000 });
  await page.click('#dashBtn');
  await page.waitForFunction(() => document.querySelectorAll('#dKpi .kpi').length === 5 && /ข้อมูลล่าสุด/.test(document.getElementById('dTime').textContent), null, { timeout: 15000 });
  const kpi = await page.textContent('#dKpi');
  check('แดชบอร์ดนับผู้ทดสอบ 1 ท่าน และไม่ผ่าน 1', /1 ท่าน/.test(kpi) && /ไม่ผ่าน\s*1/.test(kpi), kpi.replace(/\s+/g, ' '));
  check('ตารางข้อที่ไม่ผ่านมีข้อ ' + code, (await page.textContent('#dIssues')).indexOf(code) >= 0);
  check(multi ? 'แสดงตัวเลือกรอบที่เปิดให้ทดสอบ' : 'ไม่แสดงตัวเลือกรอบ (มีรอบเดียว)', (await page.$eval('#dDays', e => e.hidden)) === !multi);
  await page.fill('#dVer', 'v1.6.85'); await page.click('#dVerSave');
  await page.waitForFunction(() => /v1\.6\.85/.test(document.getElementById('toast').textContent), null, { timeout: 15000 });
  dump = await get('/__dump');
  check('ตั้งรุ่นโปรแกรมจากแดชบอร์ด', ((dump.sheets['ตั้งค่า'] || []).find(r => r[0] === 'รุ่นโปรแกรมปัจจุบัน') || [])[1] === 'v1.6.85');
  if (multi) {   // ผู้ดูแลเปิดทุกรอบ
    await page.$$eval('#dDays input[type=checkbox]', els => els.forEach(e => { e.checked = true; }));
    await page.click('#dDaysSave');
    await page.waitForFunction(() => /เปิดให้ทดสอบ:/.test(document.getElementById('toast').textContent), null, { timeout: 15000 });
    await page.waitForFunction(n => /บันทึกผลแล้ว/.test(document.getElementById('dKpi').textContent) && document.getElementById('dKpi').textContent.indexOf('/ ' + n) >= 0, DATA.cases.length, { timeout: 15000 });
    dump = await get('/__dump');
    const od = String(((dump.sheets['ตั้งค่า'] || []).find(r => r[0] === 'วันที่เปิดให้ทดสอบ') || [])[1] || '');
    check('ผู้ดูแลเปิดทุกรอบจากแดชบอร์ด', ROUNDS.every(r => od.indexOf(r) >= 0), od);
  }
  await sleep(500);
  await page.screenshot({ path: path.join(SHOTS, '04-แดชบอร์ด.png'), fullPage: true });

  // ---------- พิมพ์สรุปผลของผู้ทดสอบ (จากแดชบอร์ด) เป็น PDF ----------
  await page.selectOption('#dPrintWho', 'tester01');
  await page.click('#dPrintSum');
  await page.waitForFunction(() => window.__printed >= 1);
  const pa = await page.textContent('#print-area');
  check('ฉบับพิมพ์สรุปผลมีหัวเรื่องและข้อ ' + code, /สรุปผลการทดสอบระบบ Herbal ERP — โรงงานผลิตยาสมุนไพรเรณูนคร/.test(pa) && pa.indexOf(code) >= 0 && /ไม่ผ่าน/.test(pa));
  await page.emulateMedia({ media: 'print' });
  const pdf = path.join(SHOTS, '05-พิมพ์สรุปผล.pdf');
  await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.emulateMedia({ media: 'screen' });
  const pages = (fs.readFileSync(pdf, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  check('PDF สรุปผลสร้างได้', pages >= 1, pages + ' หน้า');

  // ทั้งเล่ม (ทุกข้อของผู้ทดสอบ 1 หน้าขึ้นไปต่อข้อ + หน้าสรุป)
  await page.click('#dPrintAll');
  await page.waitForFunction(() => window.__printed >= 2);
  const nBook = await page.evaluate(() => document.querySelectorAll('#print-area .p-page').length);
  await page.emulateMedia({ media: 'print' });
  const pdfAll = path.join(SHOTS, '05-พิมพ์ทั้งเล่ม.pdf');
  await page.pdf({ path: pdfAll, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.emulateMedia({ media: 'screen' });
  const nAll = (fs.readFileSync(pdfAll, 'latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  check('PDF ทั้งเล่มสร้างได้', nAll >= nBook && nBook >= 2, `${nBook} ส่วน · ${nAll} หน้า`);

  // ---------- setup เรียกซ้ำ: ข้อมูลไม่ซ้ำ ----------
  const s1 = await get('/__setup'), s2 = await get('/__setup');
  check('setup เรียกซ้ำ 2 ครั้ง จำนวนแถวไม่เปลี่ยน และโฟลเดอร์ภาพแนบมี 1 โฟลเดอร์',
    JSON.stringify(s1.rows) === JSON.stringify(s2.rows) && s2.rows['ข้อทดสอบ'] === nCases + 1 && s2.rows['ผู้ทดสอบ'] === 3
      && s2.folders.filter(n => /^ภาพแนบ/.test(n)).length === 1, JSON.stringify(s2.rows));

  // ---------- มือถือ (กว้าง 390 px): ไม่มีแถบเลื่อนแนวนอน ----------
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'th-TH', isMobile: true, hasTouch: true });
  phone.on('pageerror', e => errors.push('pageerror(มือถือ): ' + e.message));
  await phone.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.SA_CONFIG = { API_URL: '${API}' };` }));
  await phone.goto(`http://127.0.0.1:${WEB_PORT}/`);
  await phone.waitForSelector('#loginForm:not([hidden])');
  const wideLogin = await phone.evaluate(() => document.documentElement.scrollWidth - 390);
  await phone.fill('#lu', 'tester01'); await phone.fill('#lp', 'test1234'); await phone.click('#loginBtn');
  await phone.waitForSelector('#app:not([hidden])');
  await phone.waitForFunction(() => /ข้อ \d+ \/ \d+/.test(document.getElementById('pos').textContent));
  await sleep(400);
  if (multi) { const n = await phone.evaluate(() => window.SA_DEBUG.list.length); check('หลังเปิดทุกรอบ ผู้ทดสอบเห็นครบทุกข้อ', n === DATA.cases.length, `${n} / ${DATA.cases.length}`); }
  const wideApp = await phone.evaluate(() => {
    const els = [...document.querySelectorAll('.bar .in > *')].filter(e => e.offsetParent);
    const right = Math.max(...els.map(e => e.getBoundingClientRect().right));
    return Math.max(document.documentElement.scrollWidth, right) - 390;
  });
  const barInfo = await phone.evaluate(() => [...document.querySelectorAll('.bar .in > *')].filter(e => e.offsetParent).map(e => (e.id || e.className) + ':' + Math.round(e.getBoundingClientRect().left) + '-' + Math.round(e.getBoundingClientRect().right)).join(' '));
  await phone.screenshot({ path: path.join(SHOTS, '06-มือถือ.png') });
  check('มือถือ 390 px ไม่มีแถบเลื่อนแนวนอน (เข้าสู่ระบบ / บันทึกผล)', wideLogin <= 0 && wideApp <= 0, `เกิน ${wideLogin} / ${wideApp} px · ${barInfo}`);

  check('ไม่มีข้อผิดพลาดในหน้าเว็บ', !errors.length, errors.slice(0, 3).join(' | '));
  await browser.close(); web.close(); mock.kill();
  const bad = results.filter(r => !r.ok);
  console.log(`\nสรุป: ผ่าน ${results.length - bad.length} / ${results.length}` + (bad.length ? ' · ไม่ผ่าน: ' + bad.map(r => r.name).join('; ') : ''));
  fs.writeFileSync(path.join(SHOTS, 'e2e-result.json'), JSON.stringify({ at: new Date().toISOString(), source: DATA.source, cases: DATA.cases.length, results }, null, 1));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('หยุด:', e); try { web.close(); } catch (x) {} try { mock && mock.kill(); } catch (x) {} process.exit(2); });
