#!/usr/bin/env python3
"""從開放街圖台灣資料（.osm.pbf）產生「地號查經緯度」工具用的道路／門牌／地物分塊檔。
每塊 0.01 度見方（約 1 公里），檔案內含該塊外擴 0.004 度（約 400 公尺）範圍內的資料，
工具只要讀土地中心所在的那一塊即可。"""
import sys, os, json, math, datetime
from collections import defaultdict
import osmium

CELL = 0.01
MARGIN = 0.004
BBOX = (118.0, 21.5, 122.5, 26.6)  # 台灣（含離島）

def fkind(t):
    g = t.get
    if g('leisure') in ('park', 'garden', 'playground', 'dog_park') or g('landuse') in ('recreation_ground', 'village_green'):
        return '公園'
    if g('amenity') in ('school', 'university', 'college'):  # 幼兒園不算學校
        return '學校'
    if g('place') == 'square' or (g('highway') == 'pedestrian' and g('area') == 'yes'):
        return '廣場'
    w = g('water')
    if (g('natural') == 'water' and (not w or any(k in w for k in ('river', 'canal', 'stream', 'ditch', 'oxbow')))) or g('waterway') == 'riverbank':
        return '河川'
    if g('landuse') in ('grass', 'greenery') or g('leisure') == 'common':
        return '公園'
    return ''

def r6(x):
    return round(x, 6)

CORR = {}
try:
    CORR = {k: v for k, v in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'corrections.json'), encoding='utf-8')).items() if not k.startswith('_')}
except FileNotFoundError:
    pass

class H(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.roads = []   # (name, [(lon,lat),...])
        self.lines = []   # (kind, coords)  河川線
        self.polys = []   # (kind, [ring,...])
        self.addrs = []   # (street, no, lon, lat)

    def node(self, n):
        t = n.tags
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
        if hw and nm and not (hw == 'pedestrian' and t.get('area') == 'yes') and len(pts) > 1:
            self.roads.append((nm, pts))
        if t.get('waterway') in ('river', 'canal', 'stream') and len(pts) > 1:
            self.lines.append(('河川', pts))
        if 'addr:housenumber' in t and ('addr:street' in t or 'addr:place' in t):
            lon = sum(p[0] for p in pts) / len(pts); lat = sum(p[1] for p in pts) / len(pts)
            self.addrs.append((t.get('addr:street') or t.get('addr:place'), t['addr:housenumber'], r6(lon), r6(lat)))

    def area(self, a):
        k = fkind(a.tags)
        key = ('way/' if a.from_way() else 'relation/') + str(a.orig_id())
        if key in CORR:
            k = CORR[key]
        if not k:
            return
        rings = []
        try:
            for ring in a.outer_rings():
                rings.append([(r6(n.lon), r6(n.lat)) for n in ring])
        except Exception:
            return
        if rings:
            self.polys.append((k, rings))

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
    print('roads', len(h.roads), 'lines', len(h.lines), 'polys', len(h.polys), 'addrs', len(h.addrs), flush=True)
    C = defaultdict(lambda: {'w': [], 'f': [], 'a': []})
    inb = lambda x0, y0, x1, y1: not (x1 < BBOX[0] or x0 > BBOX[2] or y1 < BBOX[1] or y0 > BBOX[3])
    for nm, pts in h.roads:
        x0, y0, x1, y1 = bbox(pts)
        if not inb(x0, y0, x1, y1):
            continue
        for i, j in cells_of(x0, y0, x1, y1):
            for part in clip_line(pts, ebox(i, j)):
                C[(i, j)]['w'].append([nm, part])
    for k, pts in h.lines:
        x0, y0, x1, y1 = bbox(pts)
        if not inb(x0, y0, x1, y1):
            continue
        for i, j in cells_of(x0, y0, x1, y1):
            for part in clip_line(pts, ebox(i, j)):
                C[(i, j)]['f'].append([k, 1, [part]])
    for k, rings in h.polys:
        x0, y0, x1, y1 = bbox([p for r in rings for p in r])
        if not inb(x0, y0, x1, y1):
            continue
        big = (x1 - x0) > 0.05 or (y1 - y0) > 0.05
        for i, j in cells_of(x0, y0, x1, y1):
            if big:  # 很大的面（如河道）只留碰到這塊的部分邊界
                parts = [pp for r in rings for pp in clip_line(r, ebox(i, j))]
                if parts:
                    C[(i, j)]['f'].append([k, 2, parts])
            else:
                C[(i, j)]['f'].append([k, 0, rings])
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
        with open(os.path.join(dst, 't', f'{i}_{j}.json'), 'w', encoding='utf-8') as fp:
            fp.write(s)
        n += 1; tot += len(s)
    meta = {'built': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'), 'cells': n, 'cell': CELL, 'margin': MARGIN,
            'source': 'OpenStreetMap contributors, ODbL (via Geofabrik taiwan-latest)'}
    with open(os.path.join(dst, 'meta.json'), 'w', encoding='utf-8') as fp:
        json.dump(meta, fp, ensure_ascii=False)
    with open(os.path.join(dst, 'index.html'), 'w', encoding='utf-8') as fp:
        fp.write('<!doctype html><meta charset="utf-8"><title>osm-tw</title><p>義鼎不動產「地號查經緯度」工具用的開放街圖分塊資料。'
                 '資料來源：© OpenStreetMap contributors（ODbL）。更新時間：' + meta['built'] + '</p>')
    print('cells', n, 'MB', round(tot / 1e6, 1))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
