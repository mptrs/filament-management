import json, re, subprocess, io, urllib.parse
SRC = [
 ("PLA Basic",        "https://store.bblcdn.com/s4/default/a33986cf4928404cb7056cb374da4984/Bambu_PLA_Basic_Hex_Code.pdf"),
 ("PLA Basic",        "https://store.bblcdn.eu/s8/default/903b60b06ac142e9b1b49ad53cfa4c82/Bambu_PLA_Basic_Hex_Code.pdf"),
 ("PLA Matte",        "https://store.bblcdn.eu/s8/default/f131f643495b417197832b291fc7b068/Bambu_PLA_Matte_Hex_Code.pdf"),
 ("PLA Silk+",        "https://store.bblcdn.com/s7/default/8aaeedf46e504db4afa2fc13cfbfae0a/PLA_Silk_Upgrade_Hex_Code_Table.pdf"),
 ("PLA Translucent",  "https://store.bblcdn.com/s7/default/2dbf9e91887b486693323dda23adcbb5/PLA_Translucent_Hex_Code_Table.pdf"),
 ("PETG Basic",       "https://store.bblcdn.com/s2/default/d2138ff5c32b4b2896f60508df9a27bf/PETG_Basic_Hex_Code_Table.pdf"),
 ("PETG Translucent", "https://store.bblcdn.com/s7/default/5c46875459bc4a27986707f49560a961/PETG_Translucent_Hex_Code_Table.pdf"),
 ("PETG-CF",          "https://store.bblcdn.com/s1/default/72c1318eb3d943b09d9187ae51737d98/PETG-CF_Hex_Code_Table.pdf"),
 ("ABS",              "https://store.bblcdn.com/s7/default/a7d9f82d874c453cbbc1bb0efb82dd42/Bambu_ABS_Hex_Code_(1).pdf"),
 ("ABS-GF",           "https://store.bblcdn.com/s7/default/7d0175cb776b415e94eec1a8c7ffbf54/ABS-GF_Hex_Code_Table.pdf"),
]
from pypdf import PdfReader
HEX = re.compile(r'Hex\s*:\s*#?([0-9A-Fa-f]{6})')
def is_header(l, material):
    s = l.strip().lower()
    return (not s) or s.startswith('bambu lab') or 'hex code table' in s \
        or s == material.lower() or s == material.lower().replace('petg', 'petg') \
        or s in ('pla', 'petg', 'abs')

out, report = [], []
for material, url in SRC:
    f = 'p_' + re.sub(r'[^A-Za-z0-9]+', '_', material + urllib.parse.urlparse(url).netloc) + '.pdf'
    subprocess.run(['curl','-sL','--max-time','45','-A','Mozilla/5.0',url,'-o',f], capture_output=True)
    try:
        txt = '\n'.join((p.extract_text() or '') for p in PdfReader(f).pages)
    except Exception as e:
        report.append('%-17s FAIL %s' % (material, e)); continue
    lines = [l.strip() for l in txt.splitlines() if l.strip()]
    n = 0
    for i, l in enumerate(lines):
        m = HEX.search(l)
        if not m: continue
        for j in range(i - 1, -1, -1):
            cand = lines[j]
            if HEX.search(cand): break
            if is_header(cand, material): continue
            out.append({'brand': 'Bambu Lab', 'material': material, 'color': cand,
                        'hex': '#' + m.group(1).upper(), 'source': 'bambu-official'})
            n += 1
            break
    report.append('%-17s %-28s %2d' % (material, urllib.parse.urlparse(url).netloc, n))

# filamentcolors.xyz — measured swatches; Elegoo is the only source for that brand
def api(mid, brand):
    rows, url = [], 'https://filamentcolors.xyz/api/swatch/?manufacturer=%d&limit=100' % mid
    while url:
        r = subprocess.run(['curl','-s','--max-time','40',url], capture_output=True)
        d = json.loads(r.stdout.decode())
        for s in d.get('results', []):
            hx = (s.get('hex_color') or '').strip().lstrip('#')
            if len(hx) != 6: continue
            rows.append({'brand': brand, 'material': ((s.get('filament_type') or {}).get('name') or 'PLA'),
                         'color': s.get('color_name') or '', 'hex': '#' + hx.upper(),
                         'source': 'filamentcolors.xyz'})
        url = d.get('next')
    return rows

ele = api(188, 'Elegoo')
bam = api(170, 'Bambu Lab')
report.append('filamentcolors     Elegoo %d  /  Bambu %d' % (len(ele), len(bam)))
out.extend(ele); out.extend(bam)

seen, uniq = set(), []
for c in out:
    if not c['color']: continue
    k = (c['brand'].lower(), c['material'].lower(), c['color'].lower())
    if k in seen: continue
    seen.add(k); uniq.append(c)
uniq.sort(key=lambda c: (c['brand'], c['material'], c['color']))
io.open('catalog-raw.json','w',encoding='utf-8').write(json.dumps(uniq, indent=1, ensure_ascii=False))
print('\n'.join(report)); print('\nTOTAL unique:', len(uniq))
from collections import Counter
for (b, m), n in sorted(Counter((c['brand'], c['material']) for c in uniq).items()):
    print('  %-11s %-18s %d' % (b, m, n))
