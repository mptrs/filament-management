# Filament Manager

What filament you own, what is loaded in which printer, and what is still sealed —
a phone-first app that runs on GitHub Pages with no server and no accounts.

Built for two Bambu Lab printers (**Maker Bee**, a P1S with an AMS, and **Maker Ant**,
an A1 mini), but printers are records you can add, rename and re-spec, so it copes
with a third machine or the mini growing an AMS lite.

## How it works

- **The data is a file.** `data/inventory.json` in this repo is the whole inventory.
- **Reading needs nothing.** Anyone with the link sees the current state; the app
  reads the file through the public GitHub API.
- **Editing needs a token.** Paste a fine-grained personal access token once on the
  Sync screen. It is kept in that browser's `localStorage`, sent only to github.com,
  and never leaves your device otherwise — there is no server to send it to.
- **Every save is a commit,** so the inventory has a full history you can roll back
  from GitHub's UI.
- **It works offline.** The app is a PWA: the last synced copy opens without signal
  and edits queue until you are back.

## Setup

1. Push this repo to GitHub as a **public** repo (Pages on a private repo needs a
   paid plan).
2. In **Settings → Pages**, set *Source* to **GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and deploys.
4. Open `https://<you>.github.io/<repo>/`. The app works out which repo it lives in
   from that URL, so there is nothing to configure.
5. Create a token at **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens**:
   - *Repository access*: only this repository
   - *Permissions → Contents*: **Read and write**
6. Paste it on the Sync screen. Editing unlocks.

Saving the inventory commits `data/inventory.json`, which the deploy workflow
deliberately ignores — the app reads that file at runtime, so edits show up
immediately instead of waiting for a rebuild.

## The colour catalogue

`src/catalog.generated.json` holds 412 colours with real hex values, so a swatch
in the app matches what you saw when you bought the filament — 310 Bambu Lab and
102 Elegoo, across PLA, PLA Matte, Silk, Translucent, Galaxy, Sparkle, Glow,
PETG, PETG Pro, Rapid PETG, ABS, ASA, TPU and the engineering grades.

Three sources, merged in this order of authority:

| Source | What it gives |
| --- | --- |
| Bambu Lab's published hex tables (one PDF per product line) | The official values, the ones the store shows |
| [SpoolmanDB](https://github.com/Donkie/SpoolmanDB) | The broadest coverage, and the only good Elegoo data — including co-extruded multi-colour |
| [filamentcolors.xyz](https://filamentcolors.xyz) | Measured from printed swatches; fills remaining gaps |

Both community sources file everything under a bare family (`PLA`) and put the
range in the colour name (`Matte Ivory White`, `RAPID PETG Blue`). The build
splits those back apart, which is what stops Bambu's official *PLA Matte /
Ivory White* and a community *PLA / Matte Ivory White* becoming two entries.

Co-extruded filament keeps every colour it has. A dual-colour silk draws as hard
bands rather than a blend, because a blend would invent a colour that is not on
the reel.

Regenerate it with:

```bash
node scripts/build-catalog.mjs              # rebuild from data/catalog-raw.json
node scripts/build-catalog.mjs --refresh    # also re-pull SpoolmanDB + filamentcolors
python3 scripts/fetch-bambu-pdfs.py         # re-parse Bambu's PDFs (needs pypdf)
```

Anything not in the catalogue goes in by hand with a colour picker.

## Data model

```jsonc
{
  "printers": [{ "id", "name", "model", "amsUnits", "slotsPerUnit" }],
  "spools": [{
    "id", "brand", "material", "colorName", "hex",
    "form": "spool | refill",   // refill = spool-less filament
    "mounted": false,            // a refill sitting on a reusable spool
    "netWeightG", "remainingPct", "sealed", "openedAt",
    "dryState": "dry | needs-drying | drying",
    "location": { "kind": "ams", "printer": "maker-bee", "slot": 3 }
  }],
  "emptySpools": 2               // reusable spools free for the next refill
}
```

`amsUnits: 0` means a single direct feed. Fitting a unit moves the spool already in
the printer into slot 1; removing one keeps slot 1 on the direct feed and sends the
rest back to storage. Removing a printer never deletes filament — its spools move to
storage.

## Development

```bash
npm install
npm run dev
```

On `localhost` there is no repo to detect, so set owner/repo by hand on the Sync
screen — or just work offline against the local cache.

```bash
npm run build       # type-check and bundle
npm run typecheck
```
