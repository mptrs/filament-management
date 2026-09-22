#!/usr/bin/env python3
"""Re-parse Bambu Lab's published hex code tables into data/catalog-raw.json.

Bambu publish one PDF per product line giving the official colour names and
hex values - the same ones their store shows. These beat any community source,
so build-catalog.mjs treats rows from here as authoritative.

This script only touches rows whose source is 'bambu-official'; everything
else in the raw file is left alone.

    pip install pypdf
    python3 scripts/fetch-bambu-pdfs.py
"""
import json
import pathlib
import re
import subprocess
import sys
import tempfile
from collections import Counter

try:
    from pypdf import PdfReader
except ImportError:
    sys.exit("pypdf is needed: pip install pypdf")

CDN = "https://store.bblcdn.com/s%s/default/%s/%s"
EU = "https://store.bblcdn.eu/s8/default/%s/%s"

# (material, url). Several lines have both a US and an EU table; the EU ones
# tend to carry more colours, and duplicates collapse on name anyway.
SOURCES = [
    ("PLA Basic", CDN % ("4", "a33986cf4928404cb7056cb374da4984", "Bambu_PLA_Basic_Hex_Code.pdf")),
    ("PLA Basic", EU % ("903b60b06ac142e9b1b49ad53cfa4c82", "Bambu_PLA_Basic_Hex_Code.pdf")),
    ("PLA Basic", CDN % ("7", "716e7544652048698930b01d63307679", "PLA_Basic_Hex_Code_Table_Refill.pdf")),
    ("PLA Matte", EU % ("f131f643495b417197832b291fc7b068", "Bambu_PLA_Matte_Hex_Code.pdf")),
    ("PLA Silk+", CDN % ("7", "8aaeedf46e504db4afa2fc13cfbfae0a", "PLA_Silk_Upgrade_Hex_Code_Table.pdf")),
    ("PLA Translucent", CDN % ("7", "2dbf9e91887b486693323dda23adcbb5", "PLA_Translucent_Hex_Code_Table.pdf")),
    ("PLA Sparkle", CDN % ("7", "2a16583d2dc6404ea2ebcdf192441852", "PLA_Sparkle_Hex_Code_Table.pdf")),
    ("PLA Galaxy", CDN % ("7", "dcb05d280a474fb095adfee359c13574", "PLA_Galaxy_Hex_Code_Table.pdf")),
    ("PLA Metal", CDN % ("7", "5e89111c48cb487f88b561ef16aa9175", "PLA_Metal_Hex_Code_Table.pdf")),
    ("PLA Wood", CDN % ("7", "312a35d5cdce4fc5a76692955b493a82", "PLA_Wood_Hex_Code_Table.pdf")),
    ("PLA Marble", CDN % ("7", "89394d4bbaff4f519bf5b9c3e7c7fcac", "PLA_Marble_Hex_Code_Table.pdf")),
    ("PLA-CF", CDN % ("1", "e21002baf7b948098d1936d0a04d238a", "PLA-CF_Hex_Code_Table.pdf")),
    ("PETG Basic", CDN % ("2", "d2138ff5c32b4b2896f60508df9a27bf", "PETG_Basic_Hex_Code_Table.pdf")),
    ("PETG Translucent", CDN % ("7", "5c46875459bc4a27986707f49560a961", "PETG_Translucent_Hex_Code_Table.pdf")),
    ("PETG-CF", CDN % ("1", "72c1318eb3d943b09d9187ae51737d98", "PETG-CF_Hex_Code_Table.pdf")),
    ("ABS", CDN % ("7", "a7d9f82d874c453cbbc1bb0efb82dd42", "Bambu_ABS_Hex_Code_(1).pdf")),
    ("ABS-GF", CDN % ("7", "7d0175cb776b415e94eec1a8c7ffbf54", "ABS-GF_Hex_Code_Table.pdf")),
    ("ASA", CDN % ("7", "8b59c35ced5c4b848affd97e0664e12c", "ASA_Hex_Code_Table.pdf")),
    ("PA6-GF", CDN % ("7", "59bf6c3e0af14df380b9c69c40b02772", "PA6-GF_Hex_Code_Table.pdf")),
    ("PC", CDN % ("7", "e6a6c5416fc440d88639172ff9e546ac", "PC_Hex_Code_Table.pdf")),
    ("TPU-85A", CDN % ("7", "c910d98d275f470ba1a3eb5639d7c81f", "Bambu_TPU_85A_Hex_Code.pdf")),
    ("TPU-90A", CDN % ("1", "7e2c8bbbf2ff4c6996778bbb577bae13", "Bambu_TPU_90A_Hex_Code_Table.pdf")),
    ("TPU-95A", CDN % ("7", "6ec4738ccb144e8880cfec81a4cb6665", "TPU_95A_HF_Hex_Code_Table.pdf")),
]

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"
HEX = re.compile(r"Hex\s*:\s*#?([0-9A-Fa-f]{6})")
ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "catalog-raw.json"


def is_header(line, material):
    text = line.strip().lower()
    return (
        not text
        or text.startswith("bambu lab")
        or "hex code table" in text
        or text == material.lower()
        or text in ("pla", "petg", "abs", "asa", "tpu", "pc")
    )


def parse(material, url, workdir):
    path = workdir / (re.sub(r"[^A-Za-z0-9]+", "_", url[-60:]) + ".pdf")
    subprocess.run(["curl", "-sL", "--max-time", "60", "-A", UA, url, "-o", str(path)], check=False)
    try:
        text = "\n".join((page.extract_text() or "") for page in PdfReader(str(path)).pages)
    except Exception as exc:  # a moved or renamed PDF should not stop the rest
        print("  %-18s FAILED  %s" % (material, exc))
        return []

    lines = [l.strip() for l in text.splitlines() if l.strip()]
    found = []
    for i, line in enumerate(lines):
        match = HEX.search(line)
        if not match:
            continue
        for j in range(i - 1, -1, -1):
            if HEX.search(lines[j]):
                break
            if is_header(lines[j], material):
                continue
            found.append(
                {
                    "brand": "Bambu Lab",
                    "material": material,
                    "color": lines[j],
                    "hex": "#" + match.group(1).upper(),
                    "source": "bambu-official",
                }
            )
            break
    print("  %-18s %3d colours" % (material, len(found)))
    return found


def main():
    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        workdir = pathlib.Path(tmp)
        for material, url in SOURCES:
            rows.extend(parse(material, url, workdir))

    seen, unique = set(), []
    for row in rows:
        key = (row["material"].lower(), row["color"].lower())
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)

    existing = json.loads(RAW.read_text()) if RAW.exists() else []
    kept = [e for e in existing if e.get("source") != "bambu-official"]
    RAW.write_text(json.dumps(unique + kept, indent=1, ensure_ascii=False) + "\n")

    print("\n%d official Bambu colours across %d lines (kept %d rows from other sources)"
          % (len(unique), len(Counter(r["material"] for r in unique)), len(kept)))


if __name__ == "__main__":
    main()
