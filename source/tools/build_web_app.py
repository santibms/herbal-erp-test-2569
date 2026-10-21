# สร้างข้อมูลของระบบบันทึกผลการทดสอบ Herbal ERP (UAT) · ข้อทดสอบชุดปัจจุบัน: data/cases-renu.json
#   อ่าน   data/cases-renu.json      ข้อทดสอบ (รูปแบบเดียวกับ cases.js ของระบบเดิม: รายการข้อ หรือ {"cases": [...]})
#          .local-settings.json      รหัสเชิญ (ไม่เผยแพร่) เช่น {"invite": "..."}
#   สร้าง  web/cases.js              ข้อทดสอบทั้งหมดสำหรับหน้าเว็บ
#          web/img/*.jpg             ภาพประกอบข้อทดสอบ (ถ้าในไฟล์ข้อทดสอบระบุภาพ)
#          apps-script/Code.gs       โค้ดหลังบ้าน (Google Apps Script) ใส่รายการข้อทดสอบให้แล้ว
# ยังไม่มี data/cases-renu.json: สร้างจากข้อตัวอย่าง 2 ข้อ (ใช้ทดสอบระบบในเครื่องเท่านั้น)
# ใช้งาน: python tools/build_web_app.py [--require-data] [--strict]
#   --require-data  ไม่มีไฟล์ข้อทดสอบให้หยุด (ใช้ตอนเผยแพร่)
#   --strict        พบข้อความต้องห้าม (ที่อยู่ระบบที่ทดสอบ / รหัสผ่าน / อีเมลจริง) ในไฟล์ที่จะเผยแพร่ให้หยุด
import hashlib, json, re, shutil, sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
WEB = ROOT / 'web'
DATA = ROOT / 'data' / 'cases-renu.json'
LOCAL = ROOT / '.local-settings.json'
GS_TEMPLATE = HERE / 'apps_script_template.gs'
GS_OUT = ROOT / 'apps-script' / 'Code.gs'

DAY = '14 ต.ค. 2569'
# 8 ระบบ ตามลำดับใน Zoom (กำหนดการ 14 ต.ค. 2569) [รหัส, ชื่อ, ช่วงเวลา, รหัสอื่นที่อาจใช้]
SYSTEMS = [  # ลำดับตามสายงานผลิต (ผู้ใช้สั่ง 21 ต.ค. 2569)
    ('MD', 'ข้อมูลหลัก', '', ('MASTER',)),
    ('PUR', 'จัดซื้อ', '13:10 – 13:35', ('PO', 'PR', 'PURCHASE')),
    ('INV', 'คลังสินค้า', '', ('STOCK', 'WH')),
    ('QC', 'ควบคุมคุณภาพ', '13:35 – 14:00', ('QA', 'QUALITY')),
    ('PRD', 'การผลิต', '', ('PROD', 'WO', 'MW')),
    ('SAL', 'ขาย', '15:05 – 15:30', ('SALE', 'SALES', 'SO')),
    ('ACC', 'บัญชี', '15:30 – 15:55', ('AC', 'GL', 'AP', 'AR')),
    ('CST', 'การจัดการต้นทุน', '15:55 – 16:10', ('COST', 'CS')),
    ('PRM', 'อาคารสถานที่', '14:00 – 14:20', ('PREM', 'PREMISES', 'FAC')),
    ('GMP', 'มาตรฐาน GMP', '14:20 – 14:45', ('DOC', 'SOP')),
    ('HR', 'ทรัพยากรบุคคล', '14:45 – 15:05', ('EMP',)),
    ('RPT', 'รายงานรวม', '', ('REPORT', 'DASH')),
]
TYPES = ('Positive', 'Negative', 'E2E')
TYPE_NOTE = {'Positive': 'ใช้งานปกติต้องทำได้', 'Negative': 'ระบบต้องป้องกันหรือแจ้งเตือน', 'E2E': 'ทำต่อเนื่องทั้งวงจร'}
# ข้อความที่ห้ามอยู่ในไฟล์ที่เผยแพร่ (เขียนแยกส่วน เพื่อไม่ให้ไฟล์นี้เองมีข้อความนั้น)
FORBIDDEN = ['bms' 'cloud', 'ua' 't2', '@renu' 'hospital', 'herbal-erp-' 'test-uat']

PLACEHOLDER = [
    {'sys': 'PUR', 'code': 'PUR-01', 'task': 'ตัวอย่าง · สร้างใบขอซื้อวัตถุดิบสมุนไพร (รอไฟล์ข้อทดสอบจริง)', 'type': 'Positive',
     'menu': 'จัดซื้อ › ใบขอซื้อ', 'pre': 'มีวัตถุดิบ RN-RM-001 ขมิ้นชันแห้ง ในทะเบียนสินค้า',
     'steps': ['เปิดเมนูใบขอซื้อ > เพิ่ม', 'เลือกวัตถุดิบ RN-RM-001 จำนวน 50 กก.', 'บันทึกและส่งอนุมัติ'],
     'data': 'RN-RM-001 ขมิ้นชันแห้ง 50 กก.', 'sample': [['วัตถุดิบ', 'RN-RM-001 ขมิ้นชันแห้ง'], ['จำนวน', '50 กก.']],
     'expect': 'ได้เลขที่ใบขอซื้อ สถานะรออนุมัติ', 'note': 'ข้อตัวอย่างสำหรับทดสอบระบบบันทึกผลเท่านั้น'},
    {'sys': 'QC', 'code': 'QC-01', 'task': 'ตัวอย่าง · บันทึกผลตรวจวัตถุดิบที่รับเข้า (รอไฟล์ข้อทดสอบจริง)', 'type': 'Negative',
     'menu': 'ควบคุมคุณภาพ › บันทึกผลตรวจ', 'steps': ['เลือกตัวอย่างวัตถุดิบ RN-LOT-0001', 'กรอกค่าความชื้น 14% (เกินเกณฑ์ 10%)', 'กดบันทึก'],
     'data': 'RN-LOT-0001 ความชื้น 14%', 'expect': 'ระบบแสดงผลไม่ผ่านเกณฑ์ และไม่ให้ปล่อยวัตถุดิบ'},
]


TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
RANGE = re.compile(r'(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?\s+(' + '|'.join(re.escape(m) for m in TH_M) + r')\s+(\d{4})')


def round_of(c):
    """รอบทดสอบของข้อ (ต้องเป็นข้อความที่อยู่ในช่วงเวลา slot): วันที่ต้นช่วงเวลา > รอบที่ระบุในไฟล์ > ช่วงเวลาทั้งหมด"""
    slot = c['slot']
    m = re.match(r'^(\d{1,2} \S+ \d{4})', slot)
    if m:
        return m.group(1)
    r = str(c.get('round', '')).strip()
    return r if r and r in slot else slot


def dates_of(key):
    """วันที่ทดสอบจริงในรอบ เช่น 'ทดสอบต่อเอง 16–21 ต.ค. 2569' > 16 ... 21 ต.ค. 2569"""
    m = RANGE.search(key)
    if not m:
        return []
    a, b = int(m.group(1)), int(m.group(2) or m.group(1))
    return [f'{d} {m.group(3)} {m.group(4)}' for d in range(a, b + 1)]


def date_key(d):
    m = RANGE.search(d)
    return (int(m.group(4)), TH_M.index(m.group(3)), int(m.group(1))) if m else (9999, 99, 99)


def warn(msg):
    print('คำเตือน: ' + msg, file=sys.stderr)


def steps_of(v):
    if isinstance(v, list):
        return [str(s).strip() for s in v if str(s).strip()]
    text = str(v or '')
    if '→' in text and '\n' not in text:          # E2E: ขั้นตอนต่อกันเป็นวงจร
        return [s.strip() for s in text.split('→') if s.strip()]
    return [re.sub(r'^\s*\d+[).]\s*', '', s).strip() for s in text.split('\n') if s.strip()]


def pairs(v):
    if isinstance(v, dict):
        return [[str(k), str(x)] for k, x in v.items()]
    out = []
    for p in v or []:
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            out.append([str(p[0]), str(p[-1])])
        elif isinstance(p, dict):
            out.append([str(p.get('k', p.get('label', ''))), str(p.get('v', p.get('value', '')))])
    return out


def fmt(v):
    if isinstance(v, (int, float)):
        return f'{v:,.2f}'.rstrip('0').rstrip('.') if isinstance(v, float) and v % 1 else (f'{int(v):,}' if v else '')
    return str(v or '')


def items_of(it):
    if not it or not it.get('head'):
        return None
    return {'head': [str(h) for h in it['head']], 'rows': [[fmt(x) for x in r] for r in it.get('rows', [])],
            'foot': [[str(f[0]), fmt(f[-1])] for f in it.get('foot', []) if f]}


def jes_of(jes):
    out = []
    for j in jes or []:
        lines = [[str(a), fmt(d), fmt(k)] for a, d, k in j.get('lines', [])]
        out.append({'title': str(j.get('title', '')), 'lines': lines, 'total': fmt(j.get('total', ''))})
    return out


def find_sys(c):
    k = str(c.get('sys', '')).strip().upper()
    pre = str(c.get('code', '')).split('-')[0].strip().upper()
    name = re.sub(r'^ระบบ\s*', '', str(c.get('sysName', ''))).strip()
    for s in SYSTEMS:
        if k and (k == s[0] or k in s[3]):
            return s
    for s in SYSTEMS:
        if name and (name == s[1] or name.startswith(s[1])):
            return s
    for s in SYSTEMS:
        if pre and (pre == s[0] or pre in s[3]):
            return s
    return None


def image(src, code):
    """ภาพประกอบข้อทดสอบ: หาไฟล์จาก data/ หรือ web/ ย่อเป็น JPEG ใน web/img คืนพาธสำหรับหน้าเว็บ"""
    if not src:
        return ''
    if re.match(r'^(https?:|data:)', src):
        return src
    name = Path(src).name
    cands = [ROOT / 'data' / src, ROOT / 'data' / 'img' / name, ROOT / 'data' / 'shots' / name, WEB / src, WEB / 'img' / name, ROOT / src]
    f = next((p for p in cands if p.is_file()), None)
    if not f:
        warn(f'{code}: ไม่พบไฟล์ภาพ {src} (ไม่แสดงภาพ)')
        return ''
    out = WEB / 'img' / (Path(name).stem + '.jpg')
    if f.resolve() == out.resolve():
        return 'img/' + out.name
    try:
        from PIL import Image
        im = Image.open(f).convert('RGB')
        im.thumbnail((1400, 1400))
        im.save(out, 'JPEG', quality=84, optimize=True, progressive=True)
    except ImportError:
        out = WEB / 'img' / name
        shutil.copyfile(f, out)
    return 'img/' + out.name


def load():
    if not DATA.exists():
        return None, PLACEHOLDER
    raw = json.loads(DATA.read_text(encoding='utf-8-sig'))
    if isinstance(raw, dict):
        return raw, raw.get('cases', [])
    return {}, raw


def main():
    require = '--require-data' in sys.argv
    strict = '--strict' in sys.argv
    meta, src = load()
    if meta is None:
        if require:
            sys.exit(f'หยุด: ยังไม่มีไฟล์ข้อทดสอบ {DATA}')
        warn(f'ยังไม่มี {DATA.relative_to(ROOT)} สร้างจากข้อตัวอย่าง {len(PLACEHOLDER)} ข้อ')
    local = json.loads(LOCAL.read_text(encoding='utf-8-sig')) if LOCAL.exists() else {}
    invite = str(local.get('invite', '')).strip()
    # รุ่นของระบบ Herbal ERP ที่ทดสอบ (อ่านจาก /api/health ตอนสร้างไฟล์) · ที่อยู่ระบบเก็บใน .local-settings.json ไม่เผยแพร่
    erp_ver = ''
    erp_url = str(local.get('erpUrl', '')).strip()
    if erp_url:
        try:
            import urllib.request
            body = urllib.request.urlopen(erp_url.rstrip('/') + '/api/health', timeout=15).read().decode('utf-8', 'replace')
            m = re.search(r'HERBAL-BUILD-(v\d+\.\d+\.\d+)', body)
            erp_ver = m.group(1) if m else ''
        except Exception as e:
            print('อ่านรุ่นระบบที่ทดสอบไม่ได้:', e)
    if not invite:
        warn(f'ไม่มีรหัสเชิญใน {LOCAL.name} (setup จะสุ่มรหัสเชิญให้ ดูได้ในแท็บ ตั้งค่า)')

    (WEB / 'img').mkdir(parents=True, exist_ok=True)
    GS_OUT.parent.mkdir(parents=True, exist_ok=True)
    groups = {s[0]: [] for s in SYSTEMS}
    other = {}
    for c in src:
        s = find_sys(c)
        code = str(c.get('code', '')).strip()
        if not re.match(r'^[A-Za-z0-9-]{2,20}$', code):
            sys.exit(f'หยุด: รหัสข้อไม่ถูกต้อง "{code}" (ใช้ได้เฉพาะ A-Z 0-9 - ยาว 2–20 ตัว)')
        typ = str(c.get('type', 'Positive')).strip()
        typ = next((t for t in TYPES if t.lower() == typ.lower()), 'Positive')
        sys_name = ('ระบบ' + s[1]) if s else (str(c.get('sysName', '')).strip() or 'ข้อทดสอบเพิ่มเติม')
        slot = str(c.get('slot', '')).strip() or (f'{DAY} · {s[2]} น.' if s else DAY)
        d = str(c.get('data', '') or '-').strip()
        case = {'sys': s[0] if s else 'X', 'sysName': sys_name, 'sec': str(c.get('sec', '')).strip(), 'code': code,
                'task': str(c.get('task', '')).strip(), 'type': typ, 'typeNote': str(c.get('typeNote', '')).strip() or TYPE_NOTE[typ],
                'slot': slot, 'menu': str(c.get('menu', '')).strip(), 'pre': str(c.get('pre', '')).strip(),
                'steps': steps_of(c.get('steps')), 'data': d, 'sample': pairs(c.get('sample')),
                'items': items_of(c.get('items')), 'jes': jes_of(c.get('jes')), 'expect': str(c.get('expect', '')).strip(),
                'note': str(c.get('note', '')).strip(), 'img': image(str(c.get('img', '') or '').strip(), code),
                'shotCap': str(c.get('shotCap', '')).strip()}
        # ช่องเพิ่มเติม (ถ้ามีในไฟล์ข้อทดสอบ): โจทย์หลัก / รอบ / ฝ่าย / ผู้ทำรายการ / ทำต่อจากข้อ
        case['core'] = bool(c.get('core'))
        for k in ('round', 'dept', 'role', 'dependsOn', 'short'):
            v = str(c.get(k, '') or '').strip()
            case[k] = '' if v in ('-', '—') else v
        case['rk'] = round_of(case)
        if not case['task'] or not case['steps'] or not case['expect']:
            warn(f'{code}: ไม่มีโจทย์ / ขั้นตอน / ผลที่คาดหวัง ครบ')
        (groups[s[0]] if s else other.setdefault(sys_name, [])).append(case)
    out, systems = [], []
    given = {str(x.get('k', '')).upper(): x for x in (meta or {}).get('systems', []) if isinstance(x, dict)}
    for k, short, time, _ in SYSTEMS:
        for i, c in enumerate(groups[k], 1):
            if not c['sec']:
                c['sec'] = f'{len(systems) + 1}.{i}'
        out += groups[k]
        day = str((given.get(k) or {}).get('day', '')).strip() or f'วันที่ {DAY} · {time} น.'
        systems.append({'k': k, 'n': 'ระบบ' + short, 'day': day, 'count': len(groups[k])})
    for name, cs in other.items():
        out += cs
        systems.append({'k': 'X', 'n': name, 'day': DAY, 'count': len(cs)})
        warn(f'ข้อของ "{name}" ไม่ตรงกับระบบที่กำหนด ({", ".join(c["code"] for c in cs)}) แสดงต่อท้าย')
    codes = [c['code'] for c in out]
    dup = sorted({x for x in codes if codes.count(x) > 1})
    if dup:
        sys.exit('หยุด: รหัสข้อซ้ำ ' + ', '.join(dup))
    # รอบทดสอบ (ใช้เปิด/ปิดให้ผู้ทดสอบเห็น เรียงตามวันแรกของรอบ) และวันที่ทดสอบจริง (ใช้ในช่องวันที่ทดสอบ)
    rounds = sorted({c['rk'] for c in out}, key=lambda r: date_key(r)) or [DAY]
    days = sorted({d for r in rounds for d in dates_of(r)}, key=date_key) or [DAY]

    # รายการข้อทดสอบตั้งต้นสำหรับหลังบ้าน: [รหัสข้อ, ระบบ, ประเภท, โจทย์, ช่วงเวลา, เมนู, ขั้นตอน, ข้อมูลทดสอบ, ผลที่คาดหวัง]
    rows = [[c['code'], c['sysName'], c['type'], c['task'], c['slot'], c['menu'], '\n'.join(c['steps']),
             '' if c['data'] == '-' else c['data'], c['expect']] for c in out]
    names = [s['n'] for s in systems]
    # เลขรุ่น = ข้อทดสอบ + โค้ดหลังบ้าน + โค้ดหน้าเว็บ: เปลี่ยนเมื่อใด หลังบ้านเรียก setup ใหม่ 1 ครั้ง (เติมคอลัมน์/แท็บใหม่) และเบราว์เซอร์โหลดไฟล์ใหม่
    code = GS_TEMPLATE.read_text(encoding='utf-8') + (WEB / 'app.js').read_text(encoding='utf-8')
    build = hashlib.sha1(json.dumps([rows, names, rounds, code], ensure_ascii=False).encode('utf-8')).hexdigest()[:12]
    data = {'built': datetime.now().strftime('%Y-%m-%d %H:%M'), 'build': build,
            'source': 'data/cases-renu.json' if meta is not None else 'placeholder',
            'title': 'ทดสอบระบบ Herbal ERP', 'date': DAY, 'rounds': rounds, 'days': days,
            'systems': systems, 'cases': out, 'extraImg': (meta or {}).get('extraImg', {}), 'erpVer': erp_ver}
    js = ('// สร้างจาก tools/build_web_app.py ห้ามแก้ไฟล์นี้โดยตรง\nwindow.SA_DATA = '
          + json.dumps(data, ensure_ascii=False, indent=0) + ';\n')
    (WEB / 'cases.js').write_text(js, encoding='utf-8')

    gs = GS_TEMPLATE.read_text(encoding='utf-8')
    for k, v in (("/*__BUILD__*/'dev'", json.dumps(build)), ("/*__INVITE__*/''", json.dumps(invite, ensure_ascii=False)),
                 ('/*__CASES__*/[]', json.dumps(rows, ensure_ascii=False, indent=1)),
                 ('/*__SYSTEMS__*/[]', json.dumps(names, ensure_ascii=False)),
                 ("/*__DAYS__*/['14 ต.ค. 2569']", json.dumps(rounds, ensure_ascii=False))):
        assert k in gs, k
        gs = gs.replace(k, v)
    GS_OUT.write_text(gs, encoding='utf-8')

    # เปลี่ยนเลขรุ่นของไฟล์ในหน้าเว็บ ให้เบราว์เซอร์โหลดข้อทดสอบชุดใหม่
    idx = WEB / 'index.html'
    html = idx.read_text(encoding='utf-8')
    html2 = re.sub(r'((?:cases|app)\.js)\?v=[^"]*', r'\1?v=' + build, html)
    if html2 != html:
        idx.write_text(html2, encoding='utf-8')

    # ตรวจข้อความต้องห้ามในไฟล์ที่จะเผยแพร่
    bad = [p for p in FORBIDDEN + ([invite] if invite else []) if p.lower() in js.lower()]
    if bad:
        hits = sorted({c['code'] for c in out for p in bad if p.lower() in json.dumps(c, ensure_ascii=False).lower()})
        msg = f'พบข้อความต้องห้ามใน web/cases.js ({len(bad)} แบบ) ในข้อ {", ".join(hits) or "-"}'
        if strict:
            sys.exit('หยุด: ' + msg)
        warn(msg)
    imgs = sorted({c['img'] for c in out if c['img'] and not c['img'].startswith(('http', 'data:'))})
    kb = sum((WEB / i).stat().st_size for i in imgs if (WEB / i).exists()) / 1024
    print(f'cases {len(out)} ({data["source"]}) · build {build} · images {len(imgs)} ({kb:.0f} KB) · rounds {rounds} · days {len(days)} · systems',
          [(s['k'], s['count']) for s in systems])


if __name__ == '__main__':
    main()
