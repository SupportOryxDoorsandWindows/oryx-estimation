# Oryx Estimation System

Standalone web app for estimating aluminium door, window and curtain wall prices. See `CLAUDE.md` and `SPEC.md`.

## Run

```bash
npm install
npm test       # Vitest, including the CW01.1 golden test (rate = AED 50,225)
npm run dev    # http://localhost:5173
```

## Structure

| Path | Contents |
|---|---|
| `src/engine/` | Pure pricing functions. No UI code. |
| `src/ui/` | React screens: Estimate, Saved estimates, Settings |
| `data/pricing-rules.json` | SPEC §3 rules and §4 open settings (seed defaults) |
| `data/products.json` | Placeholder. Replace with the 269-product Zoho export. |
| `reference/` | Put the requirements doc, pricing Excel and CW01.1 screenshots here. |

Settings edits and saved estimates persist in the browser (localStorage). Use Saved estimates → Export JSON to back them up.

## Known gaps

- `data/products.json` holds only the CW01.1 product. Import the full list with "Import products.json".
- The Estimator/Manager switch controls markup editing. It is not access control; v1 has no login.
- The §4 open rules show an "unconfirmed" badge until the business confirms them.

## Temporary hosting (GitHub Pages)

`.github/workflows/pages.yml` runs the tests, builds and deploys on every push to `main`.
Enable it once in **Settings → Pages → Source: GitHub Actions**.
A Pages site is public, even from a private repo, so anyone with the link can see the pricing rules.
