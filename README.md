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
| `data/products.json` | The 269 products from the Zoho All_Products export (image links omitted) |
| `reference/` | `PRICING-FORMULAS.xlsx`. Its worked examples are checked in `src/engine/excel.test.ts`. |

Settings edits and saved estimates persist in the browser (localStorage). Use Saved estimates → Export JSON to back them up.

## Known gaps

- Rules match on the product's Business Unit. 39 Fusion products (C50, C60, D44, F56, T60 and others) are not on the pricing sheet, so they use "Anything else" (manual cost, markup 2.5) until rules are added.
- The Estimator/Manager switch controls markup editing. It is not access control; v1 has no login.
- The §4 open rules show an "unconfirmed" badge until the business confirms them.

## Temporary hosting (GitHub Pages)

`.github/workflows/pages.yml` runs the tests, builds and deploys on every push to `main`.
Enable it once in **Settings → Pages → Source: GitHub Actions**.
A Pages site is public, even from a private repo, so anyone with the link can see the pricing rules.
