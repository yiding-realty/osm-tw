#!/usr/bin/env python3
"""從開放街圖台灣資料（.osm.pbf）產生「地號查經緯度」工具用的道路／門牌／地物分塊檔。
每塊 0.01 度見方（約 1 公里），檔案內含該塊外擴 0.004 度（約 400 公尺）範圍內的資料，
工具只要讀土地中心所在的那一塊即可。"""
import sys, os, re, json, math, datetime
from collections import defaultdict
import osmium

CELL = 0.01
MARGIN = 0.004
BBOX = (118.0, 21.5, 122.5, 26.6)  # 台灣（含離島）

RIVER_OK = ('臺南運河', '安平港', '安平舊港', '鹽水溪', '竹溪', '二仁溪', '曾文溪', '嘉南大圳',
            '愛河', '前鎮河', '後勁溪', '幸福川', '高屏溪', '鳳山溪', '典寶溪')  # 景觀河川（Allen 2026-10-23 指定）
DRAIN = ('排水', '大排', '圳', '溝', '渠', '涵')
PUBLIC = re.compile(r'國立|市立|縣立|^臺南市|^高雄市')
HIDE = ('cycleway', 'footway', 'path', 'bridleway', 'steps', 'proposed', 'corridor', 'platform', 'elevator', 'raceway')

def nname(t):
    return (t.get('name') or '').replace('台', '臺')

def river_name_ok(nm):
    """回傳 True＝清單內景觀河川；False＝排水溝類；None＝其他（看寬度）"""
    if any(w in nm for w in RIVER_OK) and ('嘉南大圳' in nm or not any(d in nm for d in DRAIN)):
        return True
    if any(d in nm for d in DRAIN):
        return False
    return None

def underground(t):
    try:
        lay = float(t.get('layer') or 0)
    except ValueError:
        lay = 0
    return (t.get('tunnel') not in (None, 'no')) or t.get('covered') == 'yes' or lay < 0

def volt(t):
    m = [int(x) for x in re.findall(r'\d+', t.get('voltage') or '')]
    return max(m) if m else 0

def fkind(t):
    g = t.get
    nm = nname(t)
    am, lu, le = g('amenity'), g('landuse'), g('leisure')
    # 嫌惡設施
    if am == 'funeral_hall' or '殯儀館' in nm:
        return '殯儀館'
    if am == 'crematorium' or '火葬場' in nm:
        return '火葬場'
    if re.search(r'納骨塔|靈骨塔', nm):
        return '納骨塔'
    if lu == 'cemetery' or am == 'grave_yard':
        return '公墓'
    if g('power') == 'substation' and (re.search(r'變電所|變電站', nm) or volt(t) >= 69000):
        return '變電所'
    if re.search(r'焚化廠|焚化爐|資源回收廠', nm) and (g('power') == 'plant' or g('man_made') == 'works' or am == 'waste_disposal' or lu == 'industrial'):
        return '焚化廠'
    if lu == 'landfill' or '掩埋場' in nm:
        return '掩埋場'
    if am == 'fuel':
        return '加油站'
    # 公立文化設施
    if PUBLIC.search(nm):
        if '美術館' in nm or g('tourism') == 'gallery':
            if g('tourism') in ('museum', 'gallery') or am == 'arts_centre':
                return '美術館'
        if g('tourism') == 'museum':
            return '博物館'
        if am == 'arts_centre':
            return '文化中心'
    if am in ('school', 'university', 'college') and not any(w in nm for w in ('幼兒園', '幼稚園', '托嬰', '補習', '安親')):  # 幼兒園不算學校
        return '學校'
    if g('place') == 'square' or (g('highway') == 'pedestrian' and g('area') == 'yes'):
        return '廣場'
    w = g('water')
    if (g('natural') == 'water' and (not w or any(k in w for k in ('river', 'canal', 'stream', 'ditch', 'oxbow', 'harbour', 'lagoon')))) or g('waterway') == 'riverbank':
        if underground(t):
            return ''
        return '水'  # 之後依名稱／寬度決定是否算河川
    if le in ('park', 'garden', 'playground', 'dog_park', 'common') or lu in ('recreation_ground', 'village_green', 'grass', 'greenery'):
        if g('access') in ('private', 'no', 'customers') or g('garden:type') in ('residential', 'private'):
            return ''  # 私人庭園、社區中庭
        if not nm and (le == 'garden' or lu in ('grass', 'greenery', 'village_green') or le == 'common'):
            return '綠地'  # 沒名字的庭園／草地：工具端要國土利用圖也是公園色才算公園
        return '公園'
    return ''

def geo_meta(rings):
    """外環總面積（㎡）與等效矩形短邊（m）"""
    A = P = 0.0
    for r in rings:
        if len(r) < 3:
            continue
        lat0 = sum(p[1] for p in r) / len(r)
        kx = 111320 * math.cos(math.radians(lat0)); ky = 110540
        pts = [(p[0] * kx, p[1] * ky) for p in r]
        a = 0.0
        for i in range(len(pts)):
            x1, y1 = pts[i - 1]; x2, y2 = pts[i]
            a += x1 * y2 - x2 * y1
            P += math.hypot(x2 - x1, y2 - y1)
        A += abs(a) / 2
    h = P / 2
    disc = h * h - 4 * A
    W = (h - math.sqrt(disc)) / 2 if disc > 0 else h / 2
    return int(round(A)), int(round(W))

def r6(x):
    return round(x, 6)

CORR = {}
try:
    CORR = {k: v for k, v in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'corrections.json'), encoding='utf-8')).items() if not k.startswith('_')}
except FileNotFoundError:
    pass

HERITAGE = []  # (name, lon, lat)
try:
    for ln in open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'heritage.txt'), encoding='utf-8'):
        if ln.startswith('#') or '|' not in ln:
            continue
        nm, lv, la, lo = ln.strip().split('|')
        la, lo = float(la), float(lo)
        if la > lo:
            la, lo = lo, la
        HERITAGE.append((nm, lo, la))
except FileNotFoundError:
    pass

def pip(x, y, ring):
    c = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            c = not c
        j = i
    return c

HGRID = {}
for _i, (_nm, _lo, _la) in enumerate(HERITAGE):
    HGRID.setdefault((math.floor(_lo * 100), math.floor(_la * 100)), []).append(_i)

def heritage_in(rings):
    xs = [p[0] for r in rings for p in r]; ys = [p[1] for r in rings for p in r]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    cand = []
    for i in range(math.floor(x0 * 100), math.floor(x1 * 100) + 1):
        for j in range(math.floor(y0 * 100), math.floor(y1 * 100) + 1):
            cand.extend(HGRID.get((i, j), ()))
    return [i for i in cand if x0 <= HERITAGE[i][1] <= x1 and y0 <= HERITAGE[i][2] <= y1 and any(pip(HERITAGE[i][1], HERITAGE[i][2], r) for r in rings)]

class H(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.roads = []   # (name, [(lon,lat),...])
        self.lines = []   # (kind, coords)  河川線
        self.polys = []   # (kind, [ring,...])
        self.addrs = []   # (street, no, lon, lat)
        self.points = []  # (kind, lon, lat, name) 點狀地物
        self.hmatched = set()

    def node(self, n):
        t = n.tags
        k = fkind(t)
        if k in ('殯儀館', '火葬場', '納骨塔', '變電所', '焚化廠', '掩埋場', '加油站', '博物館', '美術館', '文化中心', '古蹟') and n.location.valid():
            self.points.append((k, r6(n.location.lon), r6(n.location.lat), nname(t)))
        if 'addr:housenumber' in t and ('addr:street' in t or 'addr:place' in t) and n.location.valid():
            self.addrs.append((t.get('addr:street') or t.get('addr:place'), t['addr:housenumber'], r6(n.location.lon), r6(n.location.lat)))

    def way(self, w):
        t = w.tags
        try:
            pts = [(r6(n.lon), r6(n.lat)) for n in w.nodes if n.location.valid()]
        except osmium.InvalidLocationError:
            return
        if len(pts) < 1:
            return
        hw = t.get('highway')
        nm = t.get('name') or t.get('ref')
        if hw and nm and hw not in HIDE and not (hw == 'pedestrian' and t.get('area') == 'yes') and len(pts) > 1:  # 自行車道、步道、預定線不算道路
            self.roads.append((nm, pts))
        if t.get('waterway') in ('river', 'canal', 'stream') and len(pts) > 1 and not underground(t):
            key = 'way/' + str(w.id)
            if CORR.get(key, None) == '' :
                pass
            elif CORR.get(key) == '河川' or river_name_ok(nname(t)) is True:  # 線狀水道只收清單內景觀河川（暗渠、排水溝不收）
                self.lines.append(('河川', pts, 'w%d' % w.id, nname(t)))
        if 'addr:housenumber' in t and ('addr:street' in t or 'addr:place' in t):
            lon = sum(p[0] for p in pts) / len(pts); lat = sum(p[1] for p in pts) / len(pts)
            self.addrs.append((t.get('addr:street') or t.get('addr:place'), t['addr:housenumber'], r6(lon), r6(lat)))

    def area(self, a):
        k = fkind(a.tags)
        t = a.tags
        hcand = k in ('公園', '廣場', '博物館', '美術館', '文化中心') or any(x in t for x in ('historic', 'tourism', 'building')) or t.get('amenity') == 'place_of_worship' or t.get('leisure') is not None
        key = ('way/' if a.from_way() else 'relation/') + str(a.orig_id())
        if key in CORR and k != '水':
            k = CORR[key]
        if not k and not (hcand and HGRID):
            return
        if not k:  # 只是可能的古蹟範圍：附近沒有古蹟點就略過，免得處理每棟建物
            try:
                n0 = next(iter(next(iter(a.outer_rings()))))
                ci, cj = math.floor(n0.lon * 100), math.floor(n0.lat * 100)
            except Exception:
                return
            if not any((ci + di, cj + dj) in HGRID for di in (-1, 0, 1) for dj in (-1, 0, 1)):
                return
        rings = []
        try:
            for ring in a.outer_rings():
                rings.append([(r6(n.lon), r6(n.lat)) for n in ring])
        except Exception:
            return
        if rings:
            hs = heritage_in(rings) if (hcand and k != '學校' and HGRID) else []
            if not k and not hs:
                return
            A, W = geo_meta(rings)
            nm = nname(a.tags)
            if hs and A <= 30000:  # 國定／直轄市定古蹟所在的範圍
                self.hmatched.update(hs)
                self.polys.append(('古蹟', rings, {'a': A, 'w': W, 'n': HERITAGE[hs[0]][0], 'id': key[0] + key[key.index('/') + 1:]}))
                return
            if not k:
                return
            if k == '水':
                ok = river_name_ok(nm)
                if key in CORR:
                    ok = CORR[key] == '河川'
                if ok is False or (ok is None and W < 30):
                    return  # 排水溝、窄水道不算河川（清單外要寬 30m 以上）
                k = '河川'
            self.polys.append((k, rings, {'a': A, 'w': W, 'n': nm, 'id': key[0] + key[key.index('/') + 1:]}))

def cells_of(x0, y0, x1, y1):
    i0 = math.floor((x0 - MARGIN) / CELL); i1 = math.floor((x1 + MARGIN) / CELL)
    j0 = math.floor((y0 - MARGIN) / CELL); j1 = math.floor((y1 + MARGIN) / CELL)
    for i in range(i0, i1 + 1):
        for j in range(j0, j1 + 1):
            yield i, j

def ebox(i, j):
    return (i * CELL - MARGIN, j * CELL - MARGIN, (i + 1) * CELL + MARGIN, (j + 1) * CELL + MARGIN)

def inside(p, b):
    return b[0] <= p[0] <= b[2] and b[1] <= p[1] <= b[3]

def seg_hits(a, c, b):
    """線段 a-c 是否碰到方框 b（保守判斷：線段外框與方框重疊）"""
    return not (max(a[0], c[0]) < b[0] or min(a[0], c[0]) > b[2] or max(a[1], c[1]) < b[1] or min(a[1], c[1]) > b[3])

def clip_line(pts, b):
    """把折線切成落在方框內的幾段；每段多保留框外一個點，維持方向。"""
    out, cur = [], []
    for k in range(1, len(pts)):
        a, c = pts[k - 1], pts[k]
        if seg_hits(a, c, b):
            if not cur:
                cur = [a]
            cur.append(c)
        else:
            if len(cur) > 1:
                out.append(cur)
            cur = []
    if len(cur) > 1:
        out.append(cur)
    return out

def bbox(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)

def main(src, dst):
    h = H()
    h.apply_file(src, locations=True, idx='flex_mem')
    print('roads', len(h.roads), 'lines', len(h.lines), 'polys', len(h.polys), 'points', len(h.points), 'addrs', len(h.addrs), flush=True)
    # 無名稱的河川面（riverbank 等）：借用落在面內的有名稱河川線的名字（例：鹽水溪）
    def pip(x, y, ring):
        c = False
        j = len(ring) - 1
        for i in range(len(ring)):
            xi, yi = ring[i][0], ring[i][1]; xj, yj = ring[j][0], ring[j][1]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                c = not c
            j = i
        return c
    named = [(pts, nm) for k, pts, lid, nm in h.lines if nm]
    for idx, (k, rings, meta) in enumerate(h.polys):
        if k != '河川' or meta.get('n'):
            continue
        xs = [p[0] for r in rings for p in r]; ys = [p[1] for r in rings for p in r]
        bx0, bx1, by0, by1 = min(xs), max(xs), min(ys), max(ys)
        cnt = {}
        for pts, nm in named:
            for p in pts[::2] + [pts[-1]]:
                if bx0 <= p[0] <= bx1 and by0 <= p[1] <= by1 and any(pip(p[0], p[1], r) for r in rings if len(r) > 3):
                    cnt[nm] = cnt.get(nm, 0) + 1
        if cnt:
            meta['n'] = max(cnt, key=cnt.get)
    C = defaultdict(lambda: {'w': [], 'f': [], 'a': []})
    inb = lambda x0, y0, x1, y1: not (x1 < BBOX[0] or x0 > BBOX[2] or y1 < BBOX[1] or y0 > BBOX[3])
    for nm, pts in h.roads:
        x0, y0, x1, y1 = bbox(pts)
        if not inb(x0, y0, x1, y1):
            continue
        for i, j in cells_of(x0, y0, x1, y1):
            for part in clip_line(pts, ebox(i, j)):
                C[(i, j)]['w'].append([nm, part])
    for k, pts, lid, lnm in h.lines:
        x0, y0, x1, y1 = bbox(pts)
        if not inb(x0, y0, x1, y1):
            continue
        for i, j in cells_of(x0, y0, x1, y1):
            for part in clip_line(pts, ebox(i, j)):
                C[(i, j)]['f'].append([k, 1, [part], {'id': lid, 'n': lnm} if lnm else {'id': lid}])
    for i, (nm, lon, lat) in enumerate(HERITAGE):
        if i not in h.hmatched:
            h.points.append(('古蹟', lon, lat, nm))
    print('heritage matched', len(h.hmatched), 'of', len(HERITAGE), flush=True)
    for k, lon, lat, nm in h.points:
        if not inb(lon, lat, lon, lat):
            continue
        for i, j in cells_of(lon, lat, lon, lat):
            if inside((lon, lat), ebox(i, j)):
                C[(i, j)]['f'].append([k, 3, [[[lon, lat]]], {'n': nm}])
    for k, rings, meta in h.polys:
        x0, y0, x1, y1 = bbox([p for r in rings for p in r])
        if not inb(x0, y0, x1, y1):
            continue
        big = (x1 - x0) > 0.05 or (y1 - y0) > 0.05
        for i, j in cells_of(x0, y0, x1, y1):
            if big:  # 很大的面（如河道）只留碰到這塊的部分邊界
                parts = [pp for r in rings for pp in clip_line(r, ebox(i, j))]
                if parts:
                    C[(i, j)]['f'].append([k, 2, parts, meta])
            else:
                C[(i, j)]['f'].append([k, 0, rings, meta])
    for st, no, lon, lat in h.addrs:
        if not inb(lon, lat, lon, lat):
            continue
        for i, j in cells_of(lon, lat, lon, lat):
            if inside((lon, lat), ebox(i, j)):
                C[(i, j)]['a'].append([st, no, lon, lat])
    os.makedirs(os.path.join(dst, 't'), exist_ok=True)
    n = 0; tot = 0
    for (i, j), d in C.items():
        s = json.dumps(d, ensure_ascii=False, separators=(',', ':'))
        # 國土測繪雲網頁限制只能用 fetch 連政府網站，但允許載入外部 script，所以資料包成 .js
        with open(os.path.join(dst, 't', f'{i}_{j}.js'), 'w', encoding='utf-8') as fp:
            fp.write(f"__OSMT('{i}_{j}',{s});")
        n += 1; tot += len(s)
    meta = {'built': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'), 'cells': n, 'cell': CELL, 'margin': MARGIN,
            'source': 'OpenStreetMap contributors, ODbL (via Geofabrik taiwan-latest)'}
    with open(os.path.join(dst, 'meta.json'), 'w', encoding='utf-8') as fp:
        json.dump(meta, fp, ensure_ascii=False)
    with open(os.path.join(dst, 'meta.js'), 'w', encoding='utf-8') as fp:
        fp.write("__OSMT('meta'," + json.dumps(meta, ensure_ascii=False) + ");")
    with open(os.path.join(dst, 'index.html'), 'w', encoding='utf-8') as fp:
        fp.write('<!doctype html><meta charset="utf-8"><title>osm-tw</title><p>義鼎不動產「地號查經緯度」工具用的開放街圖分塊資料。'
                 '資料來源：© OpenStreetMap contributors（ODbL）。更新時間：' + meta['built'] + '</p>')
    print('cells', n, 'MB', round(tot / 1e6, 1))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
