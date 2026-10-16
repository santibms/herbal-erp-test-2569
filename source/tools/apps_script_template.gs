/**
 * ระบบบันทึกผลการทดสอบ Herbal ERP (UAT) · ส่วนหลังบ้าน (Google Apps Script) · ใช้ได้กับหลายโรงงาน (ผู้ทดสอบระบุโรงงาน / บริษัทของตัวเอง)
 * ไฟล์ apps-script/Code.gs สร้างจาก tools/apps_script_template.gs ด้วย tools/build_web_app.py ห้ามแก้ Code.gs โดยตรง
 *
 * ติดตั้ง
 *   แบบอัตโนมัติ: publish.ps1 (clasp) สร้าง Google Sheet + สคริปต์ที่ผูกกับชีต + ทำให้ใช้งานได้เป็นเว็บแอป
 *   แบบทำเอง:
 *   1. สร้าง Google Sheet ใหม่ > เมนู ส่วนขยาย > Apps Script > ลบโค้ดเดิม แล้ววางโค้ดในไฟล์ apps-script/Code.gs ทั้งหมด > บันทึก
 *   2. เลือกฟังก์ชัน setup ที่แถบด้านบน > เรียกใช้ > อนุญาตสิทธิ์ (ครั้งแรก Google จะถามสิทธิ์ Sheet และ Drive)
 *   3. ทำให้ใช้งานได้ > การทำให้ใช้งานได้รายการใหม่ > ประเภท: เว็บแอป
 *      เรียกใช้ในฐานะ: ฉัน · ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน > ทำให้ใช้งานได้ > คัดลอก URL ของเว็บแอป
 *   4. นำ URL ไปใส่ใน web/config.js
 *   ถ้าแก้โค้ดภายหลัง: ทำให้ใช้งานได้ > จัดการการทำให้ใช้งานได้ > แก้ไข (รูปดินสอ) > เวอร์ชัน: เวอร์ชันใหม่ (URL เดิม)
 *
 *   setup เรียกซ้ำได้ ไม่สร้างข้อมูลซ้ำ: สร้างเฉพาะแท็บ/ค่าตั้งค่าที่ยังไม่มี และปรับแท็บ "ข้อทดสอบ" ตามรายการในไฟล์นี้
 *   ถ้ายังไม่ได้เรียก setup (หรือแท็บหายไป) คำขอแรกจากหน้าเว็บจะเรียก setup ให้เอง
 *   (เจ้าของสคริปต์ต้องอนุญาตสิทธิ์ 1 ครั้งก่อน: เรียก setup ในหน้า Apps Script หรือเปิด URL /exec ด้วยบัญชีเจ้าของ)
 *
 * ข้อมูลใน Sheet
 *   ผลทดสอบ          1 แถว ต่อ ผู้ทดสอบ 1 ท่าน × ข้อทดสอบ 1 ข้อ (แก้ผลข้อเดิมจะแก้แถวเดิม)
 *   ประวัติการบันทึก  ทุกครั้งที่สมัคร เข้าระบบ บันทึก แก้ไข หรือแนบภาพ
 *   สรุป             สูตรสรุปผลตามผู้ทดสอบ / ระบบ และรายการข้อที่ไม่ผ่านหรือติดปัญหา
 *   ผู้ทดสอบ         บัญชีผู้ใช้ (รหัสผ่านเก็บแบบเข้ารหัสทางเดียว อ่านย้อนกลับไม่ได้) · คอลัมน์สุดท้าย = โรงงาน / บริษัท
 *                    (เพิ่มเป็นคอลัมน์สุดท้าย ไม่ให้ salt / hash เลื่อน · ชีตเดิมที่ยังไม่มีหัวคอลัมน์นี้ setup เติมให้เอง)
 *                    ลืมรหัสผ่าน: พิมพ์รหัสใหม่ในช่อง "รหัสผ่านชั่วคราว" ผู้ทดสอบเข้าระบบด้วยรหัสนั้นได้ทันที
 *                    ระงับบัญชี: เปลี่ยนช่อง "สถานะ" เป็น ระงับ
 *                    ผู้ดูแล (เห็นแดชบอร์ดสรุปผล): ช่อง "บทบาท" = ผู้ดูแล หรือสมัครโดยติ๊ก "สมัครเป็นผู้ดูแล" พร้อมรหัสผู้ดูแล
 *   ข้อทดสอบ         รายการข้อทดสอบทั้งหมด (ตรงกับไฟล์ข้อทดสอบ data/cases-renu.json)
 *   ตั้งค่า           รหัสเชิญสำหรับสมัครสมาชิก / รุ่นโปรแกรมปัจจุบัน / อายุการเข้าระบบ / โฟลเดอร์ภาพแนบ
 *                    ปุ่มวิธีการบันทึก (เปิด / ปิด) และลิงก์วิธีการบันทึก: ปุ่มเปิดเว็บตัวอย่างทีละขั้นในหน้าเว็บ (มีผลภายใน 1 นาที)
 *                    อัปเดตโปรแกรมระหว่างทดสอบ: แก้ "รุ่นโปรแกรมปัจจุบัน" ข้อที่ทดสอบหลังจากนั้นจะบันทึกรุ่นใหม่ให้เอง
 */

const SH = { RESULTS: 'ผลทดสอบ', LOG: 'ประวัติการบันทึก', SUMMARY: 'สรุป', USERS: 'ผู้ทดสอบ', CASES: 'ข้อทดสอบ', SETTINGS: 'ตั้งค่า', ANSWERS: 'คำชี้แจงผู้ดูแล', ARCHIVE: 'ผลรุ่นก่อน' };
const HEAD = {
  RESULTS: ['แก้ไขล่าสุด', 'ชื่อผู้ใช้', 'ผู้ทดสอบ', 'รหัสข้อ', 'ระบบ', 'ประเภท', 'โจทย์', 'ผล', 'ผลที่ได้จริง / ปัญหาที่พบ', 'ภาพแนบ', 'วันที่ทดสอบ', 'รุ่นโปรแกรม', 'โรงงาน / บริษัท', 'ชุดทดสอบที่ใช้'],
  LOG: ['เวลา', 'ชื่อผู้ใช้', 'ผู้ทดสอบ', 'รายการ', 'รหัสข้อ', 'ผลเดิม', 'ผลใหม่', 'ผลที่ได้จริง / ปัญหาที่พบ'],
  USERS: ['ชื่อผู้ใช้', 'ชื่อ-นามสกุล', 'หน่วยงาน', 'บทบาท', 'สถานะ', 'รหัสผ่านชั่วคราว', 'สมัครเมื่อ', 'เข้าระบบล่าสุด', 'salt', 'hash', 'โรงงาน / บริษัท'],
  CASES: ['ลำดับ', 'รหัสข้อ', 'ระบบ', 'ประเภท', 'โจทย์', 'ช่วงเวลา', 'เมนู', 'ขั้นตอนทดสอบ (1 บรรทัดต่อ 1 ขั้น)', 'ข้อมูลทดสอบ', 'ผลที่คาดหวัง', 'แสดง', 'ปุ่มตัวอย่าง'],
};
const CC = { order: 0, code: 1, sys: 2, type: 3, task: 4, slot: 5, menu: 6, steps: 7, data: 8, expect: 9, show: 10, tb: 11 };
const COL = { R: { t: 0, user: 1, full: 2, code: 3, v: 7, note: 8, img: 9, day: 10, ver: 11, factory: 12, dset: 13 },
              U: { user: 0, full: 1, org: 2, role: 3, status: 4, temp: 5, created: 6, last: 7, salt: 8, hash: 9, factory: 10 } };
const ROLE = { tester: 'ผู้ทดสอบ', admin: 'ผู้ดูแล' };
const LABEL = { pass: 'ผ่าน', fail: 'ไม่ผ่าน', block: 'ติดปัญหา' };
const TZ = 'Asia/Bangkok';
const HASH_ROUNDS = 300;
const PRODUCT = 'Herbal ERP';
const DEFAULT_VER = 'v1.6.84';
const DRIVE_FOLDER = 'ภาพแนบ ผลทดสอบ Herbal ERP';   // ใช้เมื่อยังไม่มีโฟลเดอร์ในแท็บ ตั้งค่า เท่านั้น
const KEY = { invite: 'รหัสเชิญ', adminCode: 'รหัสผู้ดูแล', ver: 'รุ่นโปรแกรมปัจจุบัน', hours: 'อายุการเข้าระบบ (ชั่วโมง)', folder: 'โฟลเดอร์ภาพแนบ', days: 'วันที่เปิดให้ทดสอบ',
              trainOn: 'ปุ่มวิธีการบันทึก', trainUrl: 'ลิงก์วิธีการบันทึก' };
const TRAIN_URL = 'https://santibms.github.io/herbal-erp-test-trainnig/';   // เว็บตัวอย่างวิธีการบันทึกทีละขั้น (หน้าข้อทดสอบลิงก์ไปที่ #รหัสข้อ)
// ส่วนที่ tools/build_web_app.py เติมให้ · รหัสเชิญอ่านจากไฟล์ .local-settings.json (ไม่เผยแพร่)
const BUILD = /*__BUILD__*/'dev';
const DEFAULT_INVITE = /*__INVITE__*/'';
// ข้อทดสอบตั้งต้น [รหัสข้อ, ระบบ, ประเภท, โจทย์, ช่วงเวลา, เมนู, ขั้นตอนทดสอบ, ข้อมูลทดสอบ, ผลที่คาดหวัง]
// ระหว่างใช้งาน รายการข้อทดสอบจริงอยู่ในแท็บ "ข้อทดสอบ" (แอดมินเพิ่มแถวหรือตั้ง "แสดง" เป็น ไม่แสดง ได้)
const CASES = /*__CASES__*/[];
const SYSTEMS = /*__SYSTEMS__*/[];
const TEST_DAYS = /*__DAYS__*/['14 ต.ค. 2569'];
const SYSTEM_NAMES = SYSTEMS.concat(CASES.map(function (c) { return c[1]; })).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
const TYPES = ['Positive', 'Negative', 'E2E'];

// ======================================================================= ติดตั้ง (เรียกซ้ำได้)
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);
  const mk = function (name, head, widths) {
    let sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (head && sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#d6ebe7');
      sh.setFrozenRows(1);
      (widths || []).forEach(function (w, i) { if (w) sh.setColumnWidth(i + 1, w); });
    }
    return sh;
  };
  const dv = function (list) { return SpreadsheetApp.newDataValidation().requireValueInList(list, true).setAllowInvalid(false).build(); };
  // ชีตเดิมที่สร้างจากโค้ดรุ่นก่อน: เติมเฉพาะหัวคอลัมน์ที่ยังว่าง (คอลัมน์ใหม่ต่อท้ายเสมอ ข้อมูลเดิมไม่เลื่อน)
  const head = function (sh, h, widths) {
    const cur = sh.getRange(1, 1, 1, h.length).getValues()[0];
    h.forEach(function (x, i) {
      if (String(cur[i] == null ? '' : cur[i]).trim()) return;
      sh.getRange(1, i + 1).setValue(x).setFontWeight('bold').setBackground('#d6ebe7');
      if (widths && widths[i]) sh.setColumnWidth(i + 1, widths[i]);
    });
    return sh;
  };
  const W = { R: [140, 110, 190, 80, 130, 80, 280, 80, 360, 200, 100, 100, 220], U: [120, 220, 220, 90, 80, 140, 140, 140, 60, 60, 240] };
  head(mk(SH.RESULTS, HEAD.RESULTS, W.R), HEAD.RESULTS, W.R);
  head(mk(SH.LOG, HEAD.LOG, [140, 110, 190, 120, 80, 80, 80, 360]), HEAD.LOG);
  const users = head(mk(SH.USERS, HEAD.USERS, W.U), HEAD.USERS, W.U);
  users.hideColumns(COL.U.salt + 1, 2);
  users.getRange(2, COL.U.role + 1, 300, 1).setDataValidation(dv([ROLE.tester, ROLE.admin]));
  users.getRange(2, COL.U.status + 1, 300, 1).setDataValidation(dv(['ใช้งาน', 'ระงับ']));
  // ครั้งเดียว (14 ต.ค. 2569 ผู้ใช้สั่ง): ตั้งรหัสผ่านชั่วคราว 123456 ให้บัญชีเหล่านี้ เข้าระบบด้วยรหัสนี้แล้วกลายเป็นรหัสผ่านจริง
  const P1 = PropertiesService.getScriptProperties();
  if (P1.getProperty('temp-pw-20261014b') !== 'done') {
    const want = ['renuherb', 'renuherb2', 'renuherb3', 'renuherb4', 'renuherb5', 'renuherb6', 'renuherb7', 'kook'];
    rowsOf(users, HEAD.USERS.length).forEach(function (r, i) {
      if (want.indexOf(String(r[COL.U.user]).trim().toLowerCase()) >= 0) users.getRange(i + 2, COL.U.temp + 1).setValue("'123456");
    });
    CacheService.getScriptCache().remove('users');
    P1.setProperty('temp-pw-20261014b', 'done');
  }

  const cs = mk(SH.CASES, HEAD.CASES, [60, 90, 150, 90, 320, 200, 240, 320, 240, 320, 90]);
  // ปุ่มตัวอย่างรายข้อ (เปิด/ปิด) — ชีตเดิมได้หัวคอลัมน์นี้เองครั้งแรก ช่องว่าง = เปิด
  if (String(cs.getRange(1, CC.tb + 1).getValue()).trim() !== HEAD.CASES[CC.tb]) {
    cs.getRange(1, CC.tb + 1).setValue(HEAD.CASES[CC.tb]).setFontWeight('bold').setBackground('#d6ebe7');
    cs.setColumnWidth(CC.tb + 1, 110);
  }
  cs.getRange(2, CC.tb + 1, 500, 1).setDataValidation(dv(['เปิด', 'ปิด']));
  // ช่องที่ยังว่าง: ข้อที่มีตัวอย่างแล้ว = เปิด · ข้อที่ยังไม่มี = ปิด (ค่าที่ผู้ดูแลตั้งไว้แล้วไม่ถูกแตะ)
  const EX_CODES = ['PUR-01', 'PUR-02', 'PUR-03', 'PUR-06', 'PUR-07', 'PUR-04', 'PUR-05', 'QC-01', 'QC-02', 'QC-03', 'PRM-01', 'PRM-04', 'GMP-01', 'GMP-05',
                    'HR-01', 'HR-02', 'SAL-02', 'SAL-05', 'ACC-02', 'ACC-04', 'CST-01'];
  const crow = rowsOf(cs, HEAD.CASES.length);
  if (crow.length) {
    const col = crow.map(function (r) {
      const v = String(r[CC.tb]).trim(), code = String(r[CC.code]).trim();
      return [v || !code ? v : (EX_CODES.indexOf(code) >= 0 ? 'เปิด' : 'ปิด')];
    });
    cs.getRange(2, CC.tb + 1, col.length, 1).setValues(col);
  }
  // ครั้งเดียว (16 ต.ค. 2569): ตัวอย่างวิธีการบันทึกของระบบจัดซื้อที่ทำเพิ่ม — เปิดปุ่มตัวอย่างของข้อเหล่านี้
  // (ปุ่มขึ้นจริงเฉพาะข้อที่เว็บตัวอย่างมีแล้วใน codes.json)
  const P2 = PropertiesService.getScriptProperties();
  if (P2.getProperty('tb-open-pur-20261016') !== 'done') {
    const openNow = ['PUR-01', 'PUR-02', 'PUR-03', 'PUR-06', 'PUR-07'];
    rowsOf(cs, HEAD.CASES.length).forEach(function (r, i) {
      if (openNow.indexOf(String(r[CC.code]).trim()) >= 0) cs.getRange(i + 2, CC.tb + 1).setValue('เปิด');
    });
    P2.setProperty('tb-open-pur-20261016', 'done');
  }
  syncCases(cs);
  // ช่องเลือกสำหรับแถวที่แอดมินเพิ่มเอง (รวมชื่อระบบที่มีอยู่แล้วในแท็บ ไม่ให้แถวเดิมกลายเป็นค่าที่ไม่ถูกต้อง)
  const names = SYSTEM_NAMES.slice();
  rowsOf(cs, HEAD.CASES.length).forEach(function (r) { const n = unq(r[CC.sys]); if (n && names.indexOf(n) < 0) names.push(n); });
  if (names.length) cs.getRange(2, CC.sys + 1, 500, 1).setDataValidation(dv(names));
  cs.getRange(2, CC.type + 1, 500, 1).setDataValidation(dv(TYPES));
  cs.getRange(2, CC.show + 1, 500, 1).setDataValidation(dv(['แสดง', 'ไม่แสดง']));

  ensureSettings(mk(SH.SETTINGS, ['รายการ', 'ค่า', 'คำอธิบาย'], [200, 320, 420]));

  const sm = mk(SH.SUMMARY, null);
  if (sm.getLastRow() === 0) {
    const R = "'" + SH.RESULTS + "'!A:L";
    sm.getRange(1, 1).setValue('สรุปผลการทดสอบ (อัปเดตอัตโนมัติจากแท็บ ผลทดสอบ)').setFontWeight('bold');
    sm.getRange(2, 1).setValue('ความคืบหน้าของผู้ทดสอบ').setFontWeight('bold');
    sm.getRange(3, 1).setFormula('=IFERROR(QUERY(' + R + ',"select C, count(D) where H is not null and H <> \'\' group by C label C \'ผู้ทดสอบ\', count(D) \'บันทึกผลแล้ว (ข้อ)\'",1),"ยังไม่มีผล")');
    sm.getRange(2, 4).setValue('ผลแยกตามผู้ทดสอบและระบบ').setFontWeight('bold');
    sm.getRange(3, 4).setFormula('=IFERROR(QUERY(' + R + ',"select C, E, count(D) where H is not null and H <> \'\' group by C, E pivot H label C \'ผู้ทดสอบ\', E \'ระบบ\'",1),"ยังไม่มีผล")');
    sm.getRange(2, 11).setValue('ข้อที่ไม่ผ่าน / ติดปัญหา (ล่าสุดอยู่บน)').setFontWeight('bold');
    sm.getRange(3, 11).setFormula('=IFERROR(QUERY(' + R + ',"select A, C, D, G, H, I, J where H = \'ไม่ผ่าน\' or H = \'ติดปัญหา\' order by A desc",1),"ยังไม่มี")');
    [190, 130, 30, 190, 130, 70, 70, 70, 70, 30, 140, 190, 70, 260, 80, 360, 200].forEach(function (w, i) { sm.setColumnWidth(i + 1, w); });
  }
  // ลบแผ่นงานเปล่าที่สร้างมากับไฟล์ (เช่น แผ่น1 / Sheet1)
  ss.getSheets().forEach(function (sh) {
    const n = sh.getName();
    if (Object.keys(SH).map(function (k) { return SH[k]; }).indexOf(n) < 0 && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
  PropertiesService.getScriptProperties().setProperty('ready', BUILD);
  const c = CacheService.getScriptCache();
  ['cases', 'settings', 'users', 'users2', 'answers'].forEach(function (k) { c.remove(k); });
  SETTINGS_MEMO = null;
  return 'ติดตั้งเรียบร้อย';
}

// ปรับแท็บ "ข้อทดสอบ" ตามข้อทดสอบตั้งต้น: ข้อใหม่เพิ่มต่อท้าย ข้อเดิมแก้เฉพาะแถวที่เปลี่ยน (ไม่แตะช่อง "แสดง")
// ข้อที่เคยอยู่ในไฟล์ข้อทดสอบแต่ถูกเอาออก ตั้งเป็น ไม่แสดง (ผลที่บันทึกแล้วยังอยู่) · แถวที่แอดมินเพิ่มเองไม่แตะ
function syncCases(cs) {
  const props = PropertiesService.getScriptProperties();
  let before = [];
  try { before = JSON.parse(props.getProperty('builtin') || '[]'); } catch (e) {}
  const rows = rowsOf(cs, HEAD.CASES.length), at = {};
  rows.forEach(function (r, i) { const k = String(r[CC.code]).trim(); if (k) at[k] = { row: i + 2, r: r }; });
  const codes = CASES.map(function (c) { return c[0]; }), add = [];
  let order = rows.length;
  CASES.forEach(function (c) {
    const vals = c.slice(1);                       // ระบบ ... ผลที่คาดหวัง (8 ช่อง)
    const cell = vals.map(function (v, k) { return k === 1 ? v : safe(v); });   // ประเภทเก็บค่าตรง (ใช้กับรายการตรวจสอบ)
    const f = at[c[0]];
    if (!f) { add.push([++order, c[0]].concat(cell).concat(['แสดง', 'เปิด'])); return; }
    const same = vals.every(function (v, k) { return unq(f.r[CC.sys + k]) === String(v); });
    if (!same) cs.getRange(f.row, CC.sys + 1, 1, cell.length).setValues([cell]);
  });
  if (add.length) cs.getRange(rows.length + 2, 1, add.length, HEAD.CASES.length).setValues(add);
  before.forEach(function (code) {
    if (codes.indexOf(code) < 0 && at[code]) cs.getRange(at[code].row, CC.show + 1).setValue('ไม่แสดง');
  });
  props.setProperty('builtin', JSON.stringify(codes));
}

// แท็บ "ตั้งค่า": เติมเฉพาะรายการที่ยังไม่มี (ค่าที่ทีมงานแก้ไว้แล้วไม่เปลี่ยน)
function ensureSettings(st) {
  const rows = rowsOf(st, 2), has = {};
  rows.forEach(function (r) { const k = String(r[0]).trim(); if (k) has[k] = String(r[1]).trim(); });
  const want = [
    [KEY.invite, DEFAULT_INVITE || ('RN-' + Utilities.getUuid().slice(0, 6).toUpperCase()), 'ผู้ทดสอบต้องใส่รหัสนี้ตอนสมัครสมาชิก (ตัวพิมพ์เล็ก-ใหญ่ต้องตรง)'],
    [KEY.adminCode, 'BMS-' + Utilities.getUuid().slice(0, 8).toUpperCase(), 'ใช้ตอนสมัครโดยติ๊ก "สมัครเป็นผู้ดูแล" (เห็นแดชบอร์ดสรุปผล) แจ้งเฉพาะทีม BMS เปลี่ยนเป็นค่าอื่นได้'],
    [KEY.ver, safe(DEFAULT_VER), 'ทีม BMS แก้ค่านี้ทุกครั้งที่อัปเดต ' + PRODUCT + ' หน้าเว็บใช้เป็นค่าเริ่มต้นของข้อที่ทดสอบหลังจากนั้น (ข้อที่บันทึกแล้วไม่เปลี่ยน)'],
    [KEY.hours, 72, 'เข้าระบบแล้วอยู่ได้นานเท่านี้ก่อนต้องเข้าใหม่'],
    [KEY.folder, '', 'รหัสโฟลเดอร์ Google Drive ที่เก็บภาพหน้าจอที่ผู้ทดสอบแนบ'],
    [KEY.trainOn, 'เปิด', 'เปิด = แสดงปุ่ม "วิธีการบันทึก (ตัวอย่างทีละขั้น)" ที่หน้าเข้าสู่ระบบ แถบบน และหน้าข้อทดสอบ · ปิด = ซ่อนปุ่ม (มีผลภายใน 1 นาที)'],
    [KEY.trainUrl, TRAIN_URL, 'ลิงก์เว็บตัวอย่างวิธีการบันทึก (หน้าข้อทดสอบต่อท้ายด้วย #รหัสข้อ เช่น #ACC-02)'],
  ];
  const help = [
    ['วิธีตั้งผู้ดูแล', 'แท็บ ผู้ทดสอบ > ช่อง บทบาท = ผู้ดูแล', 'ผู้ดูแลจะเห็นปุ่ม แดชบอร์ดสรุปผล ด้านบนหลังเข้าระบบใหม่'],
    ['วิธีเพิ่มข้อทดสอบ', 'แท็บ ข้อทดสอบ > เพิ่มแถวใหม่ต่อท้าย', 'กรอก รหัสข้อ (ห้ามซ้ำ เช่น QC-09) ระบบ ประเภท โจทย์ ขั้นตอน ผลที่คาดหวัง แล้วตั้ง แสดง ผู้ทดสอบกดรีเฟรชหน้าเว็บก็เห็นข้อใหม่'],
    ['วิธีซ่อนข้อทดสอบ', 'แท็บ ข้อทดสอบ > ช่อง แสดง = ไม่แสดง', 'ข้อนั้นจะไม่แสดงในหน้าเว็บ ผลที่บันทึกไว้แล้วยังอยู่ในแท็บ ผลทดสอบ'],
  ];
  if (!rows.length) {                                // ติดตั้งครั้งแรก: วางตามรูปแบบเดิม (ตั้งค่า แถว 2–6 · วิธีใช้ แถว 8–10)
    st.getRange(2, 1, want.length, 3).setValues(want);
    st.getRange(want.length + 3, 1, help.length, 3).setValues(help);
  } else {
    want.concat(help).filter(function (w) { return !(w[0] in has); }).forEach(function (w) { st.appendRow(w); });
  }
  // ปุ่มวิธีการบันทึก: ช่องค่าเป็นตัวเลือก เปิด / ปิด (ตั้งซ้ำได้)
  const keys = rowsOf(st, 1);
  for (let i = 0; i < keys.length; i++) if (String(keys[i][0]).trim() === KEY.trainOn) {
    st.getRange(i + 2, 2).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['เปิด', 'ปิด'], true).setAllowInvalid(false).build());
    break;
  }
  // โฟลเดอร์ภาพแนบ: ใช้โฟลเดอร์เดิมถ้ายังเปิดได้ ไม่งั้นหาโฟลเดอร์ชื่อเดียวกัน แล้วจึงสร้างใหม่
  const id = rows.length ? has[KEY.folder] : '';
  let ok = false;
  if (id) { try { DriveApp.getFolderById(id).getName(); ok = true; } catch (e) {} }
  if (!ok) {
    const it = DriveApp.getFoldersByName(DRIVE_FOLDER);
    const folder = it.hasNext() ? it.next() : DriveApp.createFolder(DRIVE_FOLDER);
    const all = rowsOf(st, 1);
    for (let i = 0; i < all.length; i++) if (String(all[i][0]).trim() === KEY.folder) { st.getRange(i + 2, 2).setValue(folder.getId()); break; }
  }
}

// ======================================================================= รับคำขอจากหน้าเว็บ
// เวลาที่สคริปต์เริ่มทำงาน (ส่งกลับใน _t เพื่อแยกว่าความช้าอยู่ในสคริปต์ หรืออยู่ที่ระบบของ Google ก่อนถึงสคริปต์)
// RID = รหัสคำขอจากหน้าเว็บ ส่งกลับไปให้หน้าเว็บตรวจว่าคำตอบเป็นของคำขอนี้จริง · HOLD = คำขอนี้ถือคิวงานอยู่
let T0 = 0, RID = '', HOLD = false;
// GET ใช้ปลุกระบบเท่านั้น · ตอบ ok:false เสมอ: บางครั้ง Google ส่งคำตอบของ GET ไปให้คำขอ POST อื่น
// ถ้าตอบ ok:true หน้าเว็บจะเข้าใจว่าบันทึกผลสำเร็จทั้งที่ยังไม่ได้บันทึก (ok:false ทำให้ส่งใหม่)
function doGet(e) {
  T0 = Date.now(); RID = str(e && e.parameter && e.parameter.rid, 40);
  try { ensureReady(); } catch (err) { console.error(err && err.stack || err); }
  let n = 0, train = null; try { n = caseList().length; } catch (err) {}
  try { train = trainOf(); } catch (err) {}   // หน้าเข้าสู่ระบบใช้แสดงปุ่มวิธีการบันทึก (ตอบเฉพาะ 2 ค่านี้ ไม่ต้องเข้าระบบ)
  return out({ ok: false, code: 'METHOD', error: 'ระบบตอบกลับผิดพลาด กรุณาลองใหม่', service: PRODUCT + ' · ระบบบันทึกผลการทดสอบ', build: BUILD, cases: n, train: train });
}

function doPost(e) {
  T0 = Date.now(); RID = '';
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, code: 'INPUT', error: 'รูปแบบข้อมูลไม่ถูกต้อง' }); }
  RID = str(req && req.rid, 40);
  const fn = ACTIONS[req && req.action];
  if (!fn) return out({ ok: false, code: 'INPUT', error: 'ไม่รู้จักคำสั่ง' });
  try {
    ensureReady();
    return out(fn(req));
  } catch (err) {
    if (err && err.userCode) return out({ ok: false, code: err.userCode, error: err.message });
    console.error(err && err.stack || err);
    return out({ ok: false, code: 'SERVER', error: 'ระบบขัดข้อง กรุณาลองใหม่' });
  }
}

const ACTIONS = { register: register, login: login, me: me, save: save, upload: upload, logout: logout, dashboard: dashboard, setCurrent: setCurrent, setOpenDays: setOpenDays, delImg: delImg, retest: retest, diag: diag, addCases: addCases, answer: answer, setProfile: setProfile };

// สร้างแท็บที่ยังไม่มี / ปรับข้อทดสอบเมื่อขึ้นโค้ดรุ่นใหม่ (ตรวจไม่บ่อย: จำผลไว้ในแคช 6 ชั่วโมง)
function ensureReady(force) {
  const c = CacheService.getScriptCache();
  if (!force && c.get('ready') === BUILD) return;
  const ready = function () {
    const names = SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function (s) { return s.getName(); });
    return [SH.RESULTS, SH.LOG, SH.SUMMARY, SH.USERS, SH.CASES, SH.SETTINGS].every(function (n) { return names.indexOf(n) >= 0; })
      && PropertiesService.getScriptProperties().getProperty('ready') === BUILD;
  };
  if (!ready()) withLock(function () { if (!ready()) setup(); });
  c.put('ready', BUILD, 21600);
}

function out(o) {
  o._t = [T0, Date.now() - T0];   // [เวลาเริ่มของสคริปต์, มิลลิวินาทีที่ใช้ในสคริปต์]
  if (RID) o.rid = RID;
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function fail(code, msg) { const e = new Error(msg); e.userCode = code; throw e; }
// งานที่ต้องทำทีละคำขอ (หาแถวแล้วเขียน) · รอคิวไม่เกิน 20 วินาที ถ้าเกินหน้าเว็บจะส่งใหม่เอง
// เขียนลง Sheet ให้เสร็จก่อนปล่อยคิว คำขอถัดไปจึงเห็นแถวที่เพิ่งเพิ่ม (กันแถวซ้ำ) · ถือคิวอยู่แล้วทำต่อได้เลย
function withLock(fn) {
  if (HOLD) return fn();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) fail('SERVER', 'ระบบมีคำขอรอคิวมาก กรุณาลองใหม่');
  HOLD = true;
  try { const r = fn(); SpreadsheetApp.flush(); return r; } finally { HOLD = false; lock.releaseLock(); }
}
function sheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { ensureReady(true); sh = ss.getSheetByName(name); }   // แท็บถูกลบระหว่างใช้งาน: สร้างใหม่ให้
  if (!sh) fail('SERVER', 'ยังไม่ได้ติดตั้ง (เรียกใช้ฟังก์ชัน setup ก่อน)');
  return sh;
}
function rowsOf(sh, width) {
  const n = sh.getLastRow();
  return n > 1 ? sh.getRange(2, 1, n - 1, width).getValues() : [];
}
let SETTINGS_MEMO = null;
function setting(name) {
  if (!SETTINGS_MEMO) SETTINGS_MEMO = cached('settings', 60, function () { return rowsOf(sheet(SH.SETTINGS), 2); });
  const r = SETTINGS_MEMO.filter(function (x) { return x[0] === name; })[0];
  return r ? r[1] : '';
}
// รายการข้อทดสอบจากแท็บ "ข้อทดสอบ"
// เก็บข้อมูลที่อ่านบ่อยไว้ในแคช 60 วินาที (แก้ใน Sheet แล้วมีผลภายใน 1 นาที) ลดการอ่าน Sheet ทุกคำขอ
function cached(key, ttl, fn) {
  const c = CacheService.getScriptCache(), v = c.get(key);
  if (v) { try { return JSON.parse(v); } catch (e) {} }
  const r = fn();
  try { c.put(key, JSON.stringify(r), ttl); } catch (e) {}
  return r;
}
function caseList() { return cached('cases', 60, caseListRaw); }
function caseListRaw() {
  return rowsOf(sheet(SH.CASES), HEAD.CASES.length)
    .filter(function (r) { return String(r[CC.code]).trim(); })
    .map(function (r) {
      return { code: String(r[CC.code]).trim(), sysName: unq(r[CC.sys]).trim(), type: String(r[CC.type]).trim() || 'Positive',
               task: unq(r[CC.task]), slot: unq(r[CC.slot]), menu: unq(r[CC.menu]), steps: unq(r[CC.steps]),
               data: unq(r[CC.data]), expect: unq(r[CC.expect]), show: String(r[CC.show]).trim() !== 'ไม่แสดง', tb: String(r[CC.tb]).trim() !== 'ปิด' };
    });
}
function caseOf(code) {
  const c = caseList().filter(function (x) { return x.code === code; })[0];
  if (!c) fail('INPUT', 'ไม่พบรหัสข้อ ' + code + ' ในแท็บ ข้อทดสอบ');
  return c;
}
function setSetting(name, value) {
  CacheService.getScriptCache().remove('settings');
  const sh = sheet(SH.SETTINGS), rows = rowsOf(sh, 1);
  for (let i = 0; i < rows.length; i++) if (rows[i][0] === name) { sh.getRange(i + 2, 2).setValue(value); SETTINGS_MEMO = null; return; }
  sh.appendRow([name, value, '']);
  SETTINGS_MEMO = null;
}
// วันที่เปิดให้ทดสอบ: ผู้ทดสอบเห็นเฉพาะข้อของวันที่เปิด (ยังไม่ตั้งค่า = เปิดวันแรก) · มีผลเมื่อมีวันทดสอบมากกว่า 1 วัน
function current() {
  const d = unq(setting(KEY.days) || TEST_DAYS[0]);
  return { ver: unq(setting(KEY.ver) || DEFAULT_VER).trim(), days: d.split(',').map(function (x) { return x.trim(); }).filter(String), train: trainOf() };
}
// ปุ่มวิธีการบันทึก: on = ค่าในแท็บ ตั้งค่า เป็น "เปิด" · url = ลิงก์เว็บตัวอย่าง
function trainOf() {
  return { on: unq(setting(KEY.trainOn)).trim() === 'เปิด', url: unq(setting(KEY.trainUrl)).trim() };
}
function str(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }
// ข้อความจากผู้ใช้เก็บเป็นข้อความเสมอ (ใส่ ' นำหน้า): กันสูตร และกัน Sheet แปลง "14 ต.ค. 2569" / "1.2" เป็นวันที่หรือตัวเลข
function safe(s) { s = String(s == null ? '' : s); return s ? "'" + s : ''; }
// ค่าที่อ่านจาก Sheet (ตัด ' ออก ถ้าเคยถูกแปลงเป็นวันที่ให้แปลงกลับเป็นข้อความแบบไทย)
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function unq(v) {
  if (v instanceof Date) return v.getDate() + ' ' + TH_M[v.getMonth()] + ' ' + v.getFullYear();
  return String(v == null ? '' : v).replace(/^'/, '');
}
function ms(d) { return d instanceof Date ? d.getTime() : 0; }
function now() { return new Date(); }
function log(user, full, what, code, oldV, newV, note) {
  sheet(SH.LOG).appendRow([now(), user, safe(full), what, code || '', oldV || '', newV || '', safe(note || '')]);
}

// ======================================================================= บัญชีผู้ใช้
function hashPw(salt, pw) {
  let h = salt + ':' + pw;
  for (let i = 0; i < HASH_ROUNDS; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + '|' + salt, Utilities.Charset.UTF_8));
  }
  return h;
}
function findUser(u) {
  const sh = sheet(SH.USERS), rows = rowsOf(sh, HEAD.USERS.length);
  for (let i = 0; i < rows.length; i++) if (String(rows[i][COL.U.user]).toLowerCase() === u) return { sh: sh, row: i + 2, r: rows[i] };
  return null;
}
function newSession(u) {
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  const hours = Number(setting(KEY.hours)) || 72;
  const props = PropertiesService.getScriptProperties();
  props.setProperty('S_' + token, JSON.stringify({ u: u, exp: Date.now() + hours * 3600 * 1000 }));
  // ล้างการเข้าระบบที่หมดอายุ (นาน ๆ ครั้ง เพื่อให้เข้าระบบเร็ว)
  if (Math.random() > 0.1) return token;
  const all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('S_') === 0) { try { if (JSON.parse(all[k]).exp < Date.now()) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); } }
  });
  return token;
}
function auth(req) {
  const raw = req.token && PropertiesService.getScriptProperties().getProperty('S_' + str(req.token, 100));
  const s = raw ? JSON.parse(raw) : null;
  if (!s || s.exp < Date.now()) fail('AUTH', 'หมดเวลาเข้าระบบ กรุณาเข้าสู่ระบบใหม่');
  // ใช้ข้อมูลผู้ใช้จากแคช (ชื่อผู้ใช้ ชื่อ หน่วยงาน บทบาท สถานะ โรงงาน · ไม่เก็บรหัสผ่านชั่วคราว salt hash)
  const secret = [COL.U.temp, COL.U.salt, COL.U.hash];
  const rows = cached('users2', 60, function () {
    return rowsOf(sheet(SH.USERS), HEAD.USERS.length).map(function (r) { return r.map(function (x, i) { return secret.indexOf(i) >= 0 ? '' : String(x); }); });
  });
  const r = rows.filter(function (x) { return x[COL.U.user].toLowerCase() === s.u; })[0];
  if (!r || r[COL.U.status] === 'ระงับ') fail('AUTH', 'บัญชีนี้ใช้งานไม่ได้ กรุณาติดต่อทีม BMS');
  return userOf(r);
}
function userOf(r) {
  return { username: String(r[COL.U.user]).toLowerCase(), full: unq(r[COL.U.full]), org: unq(r[COL.U.org]),
           factory: unq(r[COL.U.factory]).trim(), role: String(r[COL.U.role]).trim() === ROLE.admin ? 'admin' : 'tester' };
}
function tooMany(key, limit) {
  const c = CacheService.getScriptCache(), n = Number(c.get(key) || 0);
  return n >= limit;
}
function bump(key) {
  const c = CacheService.getScriptCache();
  c.put(key, String(Number(c.get(key) || 0) + 1), 600);
}

function register(req) {
  const invite = str(req.invite, 100), u = str(req.username, 40).toLowerCase(), full = str(req.full, 120), org = str(req.org, 160), factory = str(req.factory, 160);
  const pw = String(req.password || ''), admin = req.admin === true;
  if (tooMany('inv', 30)) fail('LOCKED', 'ลองรหัสเชิญผิดหลายครั้ง กรุณารอ 10 นาที');
  if (!full || !u || !pw || !invite || !factory) fail('INPUT', 'กรุณากรอกช่องที่มีเครื่องหมาย * ให้ครบ');
  if (!/^[a-z0-9._-]{3,40}$/.test(u)) fail('INPUT', 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - อย่างน้อย 3 ตัว');
  if (pw.length < 6 || pw.length > 100) fail('INPUT', 'รหัสผ่านต้องมี 6 – 100 ตัว');
  if (invite !== unq(setting(KEY.invite))) { bump('inv'); fail('INVITE', 'รหัสเชิญไม่ถูกต้อง กรุณาติดต่อทีม BMS'); }
  if (admin && str(req.adminCode, 100) !== unq(setting(KEY.adminCode))) { bump('inv'); fail('INVITE', 'รหัสผู้ดูแลไม่ถูกต้อง'); }
  return withLock(function () {
    if (findUser(u)) fail('USER_EXISTS', 'ชื่อผู้ใช้นี้มีคนใช้แล้ว');
    const salt = Utilities.getUuid(), t = now();
    sheet(SH.USERS).appendRow([u, safe(full), safe(org), admin ? ROLE.admin : ROLE.tester, 'ใช้งาน', '', t, t, safe(salt), safe(hashPw(salt, pw)), safe(factory)]);   // ใส่ ' นำหน้า: hash ที่ขึ้นต้นด้วย + ไม่ถูกตีความเป็นสูตร
    CacheService.getScriptCache().remove('users2');
    log(u, full, admin ? 'สมัครสมาชิก (ผู้ดูแล)' : 'สมัครสมาชิก', '', '', '', factory);
    return { ok: true, token: newSession(u), user: { username: u, full: full, org: org, factory: factory, role: admin ? 'admin' : 'tester' }, current: current() };
  });
}

function login(req) {
  const u = str(req.username, 40).toLowerCase(), pw = String(req.password || '');
  if (!u || !pw) fail('INPUT', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
  if (tooMany('lf_' + u, 8)) fail('LOCKED', 'เข้าระบบผิดหลายครั้ง กรุณารอ 10 นาที หรือติดต่อทีม BMS');
  const T = [Date.now()];
  const f = findUser(u); T.push(Date.now());
  const temp = f ? String(f.r[COL.U.temp] || '') : '';
  const okPw = f && (hashPw(unq(f.r[COL.U.salt]), pw) === unq(f.r[COL.U.hash]) || (temp && pw === temp)); T.push(Date.now());
  if (!okPw) { bump('lf_' + u); fail('BAD_LOGIN', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'); }
  if (f.r[COL.U.status] === 'ระงับ') fail('AUTH', 'บัญชีนี้ถูกระงับ กรุณาติดต่อทีม BMS');
  if (temp && pw === temp) withLock(function () {   // เข้าด้วยรหัสผ่านชั่วคราว: ตั้งเป็นรหัสผ่านใหม่แล้วล้างช่อง
    const g = findUser(u), salt = Utilities.getUuid();
    g.sh.getRange(g.row, COL.U.salt + 1, 1, 2).setValues([[safe(salt), safe(hashPw(salt, pw))]]);
    g.sh.getRange(g.row, COL.U.temp + 1).setValue('');
  });
  CacheService.getScriptCache().remove('lf_' + u);
  const user = userOf(f.r);
  const out = meData(user); T.push(Date.now());   // อ่านก่อนเขียน: ไม่ต้องรอให้ Sheet เขียนเสร็จก่อนอ่าน
  out.token = newSession(u); T.push(Date.now());
  f.sh.getRange(f.row, COL.U.last + 1).setValue(now());
  log(u, user.full, 'เข้าระบบ'); T.push(Date.now());
  out._ms = T.slice(1).map(function (x, i) { return x - T[i]; });   // เวลาแต่ละขั้น: หาผู้ใช้, ตรวจรหัส, ผล, session, บันทึก
  return out;
}

function logout(req) {
  if (req.token) PropertiesService.getScriptProperties().deleteProperty('S_' + str(req.token, 100));
  return { ok: true };
}

// ======================================================================= ผลทดสอบ
function keyOf(label) {
  for (const k in LABEL) if (LABEL[k] === label) return k;
  return '';
}
function imgsOf(cell) { return String(cell || '').split('\n').filter(String); }

function me(req) { return meData(auth(req)); }
function meData(user) {
  const results = {};
  rowsOf(sheet(SH.RESULTS), HEAD.RESULTS.length).forEach(function (r) {
    if (r[COL.R.user] !== user.username) return;
    results[r[COL.R.code]] = { v: keyOf(r[COL.R.v]), note: unq(r[COL.R.note]), t: ms(r[COL.R.t]),
                               img: imgsOf(r[COL.R.img]), day: unq(r[COL.R.day]), ver: unq(r[COL.R.ver]), dset: unq(r[COL.R.dset]) };
  });
  const answers = answersOf().filter(function (a) { return a.user === user.username; });   // คำชี้แจงของผู้ดูแล (ใช้ในฉบับพิมพ์)
  return { ok: true, user: user, results: results, prev: prevOf(user.username), cases: caseList(), current: current(), answers: answers };
}

// ======================================================================= ผลรุ่นก่อน
// ผู้ทดสอบกด "ทดสอบซ้ำกับรุ่น …" ที่ข้อที่บันทึกด้วยรุ่นเก่า: ย้ายแถวผลเดิมทั้งแถว (ผล ข้อความ ภาพ วันที่ รุ่น)
// ไปแท็บ ผลรุ่นก่อน โดยไม่แก้ค่าใด ๆ แล้วข้อนั้นว่างให้ทดสอบใหม่ (16 ต.ค. 2569)
function archiveSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SH.ARCHIVE);
  if (!sh) {
    sh = ss.insertSheet(SH.ARCHIVE);
    const head = HEAD.RESULTS.concat(['ย้ายมาเมื่อ']);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#d6ebe7');
    sh.setFrozenRows(1);
  }
  return sh;
}
function prevOf(username) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH.ARCHIVE), out = {};
  if (!sh) return out;
  rowsOf(sh, HEAD.RESULTS.length + 1).forEach(function (r) {
    if (r[COL.R.user] !== username) return;
    out[r[COL.R.code]] = { v: keyOf(r[COL.R.v]), ver: unq(r[COL.R.ver]), day: unq(r[COL.R.day]) };   // แถวล่างสุด = ล่าสุด
  });
  return out;
}
function retest(req) {
  const user = auth(req), code = str(req.code, 20);
  caseOf(code);
  return withLock(function () {
    const sh = sheet(SH.RESULTS), f = findResult(sh, user.username, code);
    if (!f || !String(f.r[COL.R.v]).trim()) fail('INPUT', 'ข้อนี้ยังไม่มีผลที่บันทึกไว้');
    // ทุกแถวของผู้ทดสอบ + ข้อนี้ (รวมแถวซ้ำที่อาจค้างจากก่อนหน้า) ย้ายไปผลรุ่นก่อนตามลำดับเดิม แล้วลบจากล่างขึ้นบน
    const ar = archiveSheet(), t = now(), rows = [];
    rowsOf(sh, HEAD.RESULTS.length).forEach(function (r, i) { if (r[COL.R.user] === user.username && r[COL.R.code] === code) rows.push({ i: i + 2, r: r }); });
    rows.forEach(function (x) { ar.appendRow(x.r.concat([t])); });
    rows.slice().reverse().forEach(function (x) { sh.deleteRow(x.i); });
    log(user.username, user.full, 'ทดสอบซ้ำกับรุ่นใหม่ (ย้ายผลเดิมไปแท็บ ผลรุ่นก่อน)', code, String(f.r[COL.R.v]), '', 'รุ่นเดิม ' + unq(f.r[COL.R.ver]));
    return { ok: true, prev: { v: keyOf(f.r[COL.R.v]), ver: unq(f.r[COL.R.ver]), day: unq(f.r[COL.R.day]) } };
  });
}

function findResult(sh, user, code) {
  const n = sh.getLastRow();
  if (n < 2) return null;
  const keys = sh.getRange(2, COL.R.user + 1, n - 1, COL.R.code - COL.R.user + 1).getValues();
  const last = COL.R.code - COL.R.user;
  for (let i = keys.length - 1; i >= 0; i--) {   // แถวล่างสุด = แถวที่หน้าเว็บแสดง
    if (keys[i][0] === user && keys[i][last] === code) return { row: i + 2, r: sh.getRange(i + 2, 1, 1, HEAD.RESULTS.length).getValues()[0] };
  }
  return null;
}

function save(req) {
  const user = auth(req), code = str(req.code, 20), c = caseOf(code);
  const v = str(req.v, 10);
  if (v && !LABEL[v]) fail('INPUT', 'ผลทดสอบไม่ถูกต้อง');
  const note = str(req.note, 5000), day = str(req.day, 30), ver = str(req.ver, 40);
  const dset = str(req.dset, 60);   // ชุดข้อมูลทดสอบที่ผู้ทดสอบเลือก (ว่าง = ยังไม่ได้เลือก)
  const cur = current(), t = now();
  // seq = เวลาที่ผู้ทดสอบแก้ข้อนี้ (จากเครื่องเดียวกัน) · คำขอเก่าที่มาถึงช้ากว่าคำขอใหม่ จะไม่เขียนทับผลใหม่
  const seq = Number(req.seq) || 0, sk = 'sq_' + str(req.token, 100).slice(0, 24) + '_' + code;
  const done = withLock(function () {
    if (seq) {
      const c = CacheService.getScriptCache(), last = Number(c.get(sk) || 0);
      if (seq < last) return { stale: true };
      c.put(sk, String(seq), 21600);
    }
    const sh = sheet(SH.RESULTS), f = findResult(sh, user.username, code);
    const oldV = f ? String(f.r[COL.R.v]) : '', oldNote = f ? unq(f.r[COL.R.note]) : '';
    const row = [t, user.username, safe(user.full), code, c.sysName, c.type, safe(c.task), LABEL[v] || '', safe(note), f ? f.r[COL.R.img] : '', safe(day), safe(ver), safe(user.factory), safe(dset)];
    if (f) sh.getRange(f.row, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
    return { isNew: !f, oldV: oldV, oldNote: oldNote };
  });
  if (done.stale) return { ok: true, t: t.getTime(), current: cur, stale: true };
  // ประวัติ: บันทึกทุกครั้งที่ผลเปลี่ยน ส่วนการแก้ข้อความอย่างเดียวบันทึกไม่เกิน 1 ครั้งต่อ 10 นาทีต่อข้อ
  const newV = LABEL[v] || '', cache = CacheService.getScriptCache(), key = 'ln_' + user.username + '_' + code;
  if (done.isNew || done.oldV !== newV) { log(user.username, user.full, done.isNew ? 'บันทึกผล' : 'แก้ไขผล', code, done.oldV, newV, note); cache.put(key, '1', 600); }
  else if (done.oldNote !== note && !cache.get(key)) { log(user.username, user.full, 'แก้ไขผล', code, done.oldV, newV, note); cache.put(key, '1', 600); }
  return { ok: true, t: t.getTime(), current: cur };
}

function upload(req) {
  const user = auth(req), code = str(req.code, 20), c = caseOf(code);
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.data || ''));
  if (!m) fail('INPUT', 'รองรับเฉพาะไฟล์ภาพ JPG PNG WEBP');
  if (m[2].length > 10 * 1024 * 1024) fail('INPUT', 'ไฟล์ภาพใหญ่เกิน 7 MB');
  const root = DriveApp.getFolderById(String(setting(KEY.folder)));
  const it = root.getFoldersByName(user.username + ' ' + user.full);
  const folder = it.hasNext() ? it.next() : root.createFolder(user.username + ' ' + user.full);
  const ext = m[1] === 'image/png' ? 'png' : m[1] === 'image/webp' ? 'webp' : 'jpg';
  const name = code + '_' + Utilities.formatDate(now(), TZ, 'yyyyMMdd-HHmmss') + '.' + ext;
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name));
  const url = file.getUrl();
  return withLock(function () {
    const sh = sheet(SH.RESULTS), f = findResult(sh, user.username, code);
    const imgs = (f ? imgsOf(f.r[COL.R.img]) : []).concat([url]).join('\n');
    if (f) sh.getRange(f.row, COL.R.img + 1).setValue(imgs);
    else sh.appendRow([now(), user.username, safe(user.full), code, c.sysName, c.type, safe(c.task), '', '', imgs, '', '', safe(user.factory)]);
    log(user.username, user.full, 'แนบภาพ', code, '', '', name);
    return { ok: true, url: url, name: name };
  });
}

// ลบภาพที่แนบผิด (16 ต.ค. 2569): ผู้ทดสอบลบได้เฉพาะภาพในผลของตัวเอง
// ไฟล์ใน Google Drive ย้ายไปถังขยะ (กู้คืนได้ภายใน 30 วัน) และบันทึกไว้ในประวัติการบันทึก
function delImg(req) {
  const user = auth(req), code = str(req.code, 20), url = String(req.url || '');
  caseOf(code);
  return withLock(function () {
    const sh = sheet(SH.RESULTS), f = findResult(sh, user.username, code);
    const imgs = f ? imgsOf(f.r[COL.R.img]) : [], k = imgs.indexOf(url);
    if (k < 0) fail('INPUT', 'ไม่พบภาพนี้ในผลของคุณ (อาจลบไปแล้ว) กรุณารีเฟรชหน้าเว็บ');
    imgs.splice(k, 1);
    sh.getRange(f.row, COL.R.img + 1).setValue(imgs.join('\n'));
    let name = '';
    try {
      const id = (/[-\w]{25,}/.exec(url) || [])[0];
      if (id) { const file = DriveApp.getFileById(id); name = file.getName(); file.setTrashed(true); }
    } catch (e) {}
    log(user.username, user.full, 'ลบภาพ', code, '', '', name || url);
    return { ok: true, img: imgs };
  });
}

// แก้ข้อมูลผู้ทดสอบ: โรงงาน / บริษัท (บังคับ) และหน่วยงาน (ส่ง org มา = แก้ · ไม่ส่ง = คงเดิม · ส่ง "" = ล้าง)
// ผู้ทดสอบแก้ได้เฉพาะแถวของตัวเอง · ผู้ดูแลแก้ของผู้อื่นได้โดยส่ง user = ชื่อผู้ใช้
// ผลที่บันทึกไว้แล้วของผู้ใช้นั้นได้ช่องโรงงานตรงกันด้วย
function setProfile(req) {
  const me = auth(req), target = str(req.user, 40).toLowerCase() || me.username;
  if (target !== me.username && me.role !== 'admin') fail('FORBIDDEN', 'แก้ได้เฉพาะข้อมูลของตัวเอง');
  const factory = str(req.factory, 160), hasOrg = req.org !== undefined && req.org !== null, org = str(req.org, 160);
  if (!factory) fail('INPUT', 'กรุณากรอกชื่อโรงงาน / บริษัท');
  return withLock(function () {
    const f = findUser(target);
    if (!f) fail('INPUT', 'ไม่พบชื่อผู้ใช้ ' + target);
    f.sh.getRange(f.row, COL.U.factory + 1).setValue(safe(factory));
    if (hasOrg) f.sh.getRange(f.row, COL.U.org + 1).setValue(safe(org));
    const rs = sheet(SH.RESULTS), n = rs.getLastRow();
    if (n > 1) {
      const who = rs.getRange(2, COL.R.user + 1, n - 1, 1).getValues(), fac = rs.getRange(2, COL.R.factory + 1, n - 1, 1).getValues();
      let changed = false;
      who.forEach(function (w, i) { if (String(w[0]) === target && unq(fac[i][0]) !== factory) { fac[i][0] = safe(factory); changed = true; } });
      if (changed) rs.getRange(2, COL.R.factory + 1, n - 1, 1).setValues(fac);
    }
    CacheService.getScriptCache().remove('users2');
    log(me.username, me.full, target === me.username ? 'แก้ข้อมูลผู้ทดสอบ' : 'ผู้ดูแลแก้ข้อมูลผู้ทดสอบ', '', '', target,
        'โรงงาน / บริษัท: ' + factory + (hasOrg ? ' · หน่วยงาน: ' + (org || '-') : ''));
    return { ok: true, user: userOf(findUser(target).r) };
  });
}

// ======================================================================= แดชบอร์ด (เฉพาะผู้ดูแล)
function dashboard(req) {
  const user = auth(req);
  if (user.role !== 'admin') fail('FORBIDDEN', 'หน้านี้สำหรับผู้ดูแลระบบเท่านั้น');
  const testers = rowsOf(sheet(SH.USERS), HEAD.USERS.length).filter(function (r) { return String(r[COL.U.user]).trim(); }).map(function (r) {
    const u = userOf(r); u.status = String(r[COL.U.status]); u.last = ms(r[COL.U.last]); return u;
  });
  const results = rowsOf(sheet(SH.RESULTS), HEAD.RESULTS.length).filter(function (r) { return r[COL.R.user]; }).map(function (r) {
    return { user: String(r[COL.R.user]), code: String(r[COL.R.code]), v: keyOf(r[COL.R.v]), note: unq(r[COL.R.note]), t: ms(r[COL.R.t]),
             img: imgsOf(r[COL.R.img]), day: unq(r[COL.R.day]), ver: unq(r[COL.R.ver]), factory: unq(r[COL.R.factory]), dset: unq(r[COL.R.dset]) };
  });
  const lg = sheet(SH.LOG), n = lg.getLastRow(), k = Math.min(50, Math.max(0, n - 1));
  const log = k ? lg.getRange(n - k + 1, 1, k, HEAD.LOG.length).getValues().reverse().map(function (r) {
    return { t: ms(r[0]), user: String(r[1]), full: unq(r[2]), what: String(r[3]), code: String(r[4]), from: String(r[5]), to: String(r[6]), note: unq(r[7]) };
  }) : [];
  return { ok: true, user: user, testers: testers, results: results, log: log, cases: caseList(), answers: answersOf(),
           sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(), current: current(), time: Date.now() };
}

// คำชี้แจงของผู้ดูแลต่อผลที่ไม่ผ่าน/ติดปัญหา (เช่น วิธีที่ถูกต้อง หรือสิ่งที่แก้แล้ว) เก็บแยกแท็บ ไม่แตะแท็บผลทดสอบ
const ANS_HEAD = ['เวลา', 'ผู้ทดสอบ', 'รหัสข้อ', 'คำชี้แจง / วิธีที่ถูกต้อง', 'ผู้ชี้แจง', 'สถานะการแก้ไข'];
const ANS_ST = { fixed: 'แก้ไขแล้ว', works: 'ระบบทำได้ (ตามคำชี้แจง)', wip: 'อยู่ระหว่างแก้ไข', suggest: 'ข้อเสนอแนะ (พัฒนาต่อ)' };
function stKey(v) { v = unq(v); for (const k in ANS_ST) if (ANS_ST[k] === v) return k; return ''; }
function answerSheet(create) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SH.ANSWERS);
  if (!sh && create) {
    sh = ss.insertSheet(SH.ANSWERS);
    sh.getRange(1, 1, 1, ANS_HEAD.length).setValues([ANS_HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function answersOf() {   // แคช 60 วินาที (ล้างทันทีเมื่อผู้ดูแลบันทึก) เพื่อไม่ให้การเข้าระบบช้าลง
  return cached('answers', 60, function () {
    const sh = answerSheet(false);
    if (!sh) return [];
    return rowsOf(sh, ANS_HEAD.length).filter(function (r) { return String(r[1]).trim() && (unq(r[3]) || stKey(r[5])); }).map(function (r) {
      return { t: ms(r[0]), user: String(r[1]).trim(), code: String(r[2]).trim(), text: unq(r[3]), by: unq(r[4]), st: stKey(r[5]) };
    });
  });
}
function answer(req) {
  const user = auth(req);
  if (user.role !== 'admin') fail('FORBIDDEN', 'เฉพาะผู้ดูแลระบบ');
  const who = str(req.user, 40), code = str(req.code, 20), text = str(req.text, 2000), st = ANS_ST[req.status] ? String(req.status) : '';
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(who) || !/^[A-Za-z0-9-]{2,20}$/.test(code)) fail('INPUT', 'ข้อมูลไม่ครบ');
  return withLock(function () {
    const sh = answerSheet(true);
    if (!String(sh.getRange(1, ANS_HEAD.length).getValue())) sh.getRange(1, ANS_HEAD.length).setValue(ANS_HEAD[ANS_HEAD.length - 1]).setFontWeight('bold');
    let at = 0;
    rowsOf(sh, ANS_HEAD.length).forEach(function (r, i) { if (String(r[1]).trim() === who && String(r[2]).trim() === code) at = i + 2; });
    const vals = [new Date(), who, code, safe(text), safe(user.full), st ? ANS_ST[st] : ''];   // ข้อความและสถานะว่าง = ลบคำชี้แจง
    if (at) sh.getRange(at, 1, 1, vals.length).setValues([vals]); else sh.appendRow(vals);
    CacheService.getScriptCache().remove('answers');
    log(user.username, user.full, 'คำชี้แจงผู้ดูแล', code, '', who, (st ? '[' + ANS_ST[st] + '] ' : '') + text.slice(0, 200));
    return { ok: true, answer: { t: Date.now(), user: who, code: code, text: text, by: user.full, st: st } };
  });
}

// ผู้ดูแลตั้งรุ่นโปรแกรมปัจจุบันจากแดชบอร์ด
function setCurrent(req) {
  const user = auth(req);
  if (user.role !== 'admin') fail('FORBIDDEN', 'เฉพาะผู้ดูแลระบบ');
  const ver = str(req.ver, 40);
  if (!ver) fail('INPUT', 'กรุณากรอกรุ่นโปรแกรม');
  return withLock(function () {
    const old = unq(setting(KEY.ver) || '');
    setSetting(KEY.ver, safe(ver));
    log(user.username, user.full, 'ตั้งรุ่นโปรแกรมปัจจุบัน', '', old, ver, '');
    return { ok: true, current: current() };
  });
}

// ผู้ดูแลเปิด/ปิดรอบทดสอบจากแดชบอร์ด (แสดงเมื่อมีมากกว่า 1 รอบ) · รอบ = ข้อความในช่วงเวลาของข้อ เช่น 14 ต.ค. 2569
function setOpenDays(req) {
  const user = auth(req);
  if (user.role !== 'admin') fail('FORBIDDEN', 'เฉพาะผู้ดูแลระบบ');
  const days = (req.days || []).map(function (d) { return String(d).trim(); }).filter(function (d) { return TEST_DAYS.indexOf(d) >= 0; });
  if (!days.length) fail('INPUT', 'เลือกอย่างน้อย 1 รอบ');
  return withLock(function () {
    const old = unq(setting(KEY.days) || TEST_DAYS[0]);
    setSetting(KEY.days, safe(days.join(', ')));
    log(user.username, user.full, 'ตั้งวันที่เปิดให้ทดสอบ', '', old, days.join(', '), '');
    return { ok: true, current: current() };
  });
}

// ตรวจสภาพระบบ (เฉพาะผู้ดูแล): ขนาดแต่ละแท็บ และเวลาที่ใช้อ่านรายการข้อทดสอบ
function diag(req) {
  const user = auth(req);
  if (user.role !== 'admin') fail('FORBIDDEN', 'เฉพาะผู้ดูแลระบบ');
  const out = { sheets: {}, build: BUILD };
  SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(function (sh) {
    out.sheets[sh.getName()] = { lastRow: sh.getLastRow(), lastCol: sh.getLastColumn(), maxRows: sh.getMaxRows(), maxCols: sh.getMaxColumns() };
  });
  let t = Date.now(); const cs = caseListRaw(); out.caseListMs = Date.now() - t; out.cases = cs.length;
  out.casesJson = JSON.stringify(cs).length;
  out.cacheHit = !!CacheService.getScriptCache().get('cases');
  out.props = Object.keys(PropertiesService.getScriptProperties().getProperties()).length;
  return Object.assign({ ok: true }, out);
}

// ผู้ดูแลเพิ่ม/แก้ข้อทดสอบหลายข้อพร้อมกัน (จับคู่ด้วยรหัสข้อ: มีแล้วแก้แถวเดิม ไม่มีเพิ่มต่อท้าย)
function addCases(req) {
  const user = auth(req);
  if (user.role !== 'admin') fail('FORBIDDEN', 'เฉพาะผู้ดูแลระบบ');
  const list = (req.cases || []).slice(0, 200);
  if (!list.length) fail('INPUT', 'ไม่มีข้อทดสอบ');
  return withLock(function () {
    const sh = sheet(SH.CASES), rows = rowsOf(sh, HEAD.CASES.length);
    const at = {}; rows.forEach(function (r, i) { at[String(r[CC.code]).trim()] = i + 2; });
    // ช่องระบบรับเฉพาะชื่อในรายการตรวจสอบ: เพิ่มชื่อระบบใหม่เข้ารายการก่อน ไม่งั้นการแก้แถวเดิมจะถูกปฏิเสธ
    const names = SYSTEM_NAMES.slice();
    rows.map(function (r) { return unq(r[CC.sys]); }).concat(list.map(function (c) { return str(c.sysName, 80); }))
      .forEach(function (n) { if (n && names.indexOf(n) < 0) names.push(n); });
    sh.getRange(2, CC.sys + 1, 500, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(names, true).setAllowInvalid(false).build());
    let added = 0, updated = 0, order = rows.length;
    list.forEach(function (c) {
      const code = str(c.code, 20);
      if (!/^[A-Za-z0-9-]{2,20}$/.test(code)) fail('INPUT', 'รหัสข้อไม่ถูกต้อง: ' + code);
      const type = TYPES.indexOf(String(c.type)) >= 0 ? String(c.type) : 'Positive';
      const vals = [safe(str(c.sysName, 80)), type, safe(str(c.task, 300)), safe(str(c.slot, 80)), safe(str(c.menu, 200)),
                    safe(str(c.steps, 3000)), safe(str(c.data, 1000)), safe(str(c.expect, 2000)), c.show === false ? 'ไม่แสดง' : 'แสดง'];
      if (at[code]) { sh.getRange(at[code], CC.sys + 1, 1, vals.length).setValues([vals]); updated++; }
      else { sh.appendRow([++order, code].concat(vals)); at[code] = sh.getLastRow(); added++; }
    });
    CacheService.getScriptCache().remove('cases');
    log(user.username, user.full, 'เพิ่ม/แก้ข้อทดสอบ', '', '', '', 'เพิ่ม ' + added + ' แก้ ' + updated);
    return { ok: true, added: added, updated: updated };
  });
}
