# Oryx Estimations

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

Settings edits and saved estimates persist in the browser (localStorage). Use Saved estimates → Export Excel to back them up or share them; Import Excel reads that file back. Import products (Excel) takes the Zoho All_Products export as it comes.

## Known gaps

- Rules match on the product's Business Unit. 39 Fusion products (C50, C60, D44, F56, T60 and others) are not on the pricing sheet, so they use "Anything else" (manual cost, markup 2.5) until rules are added.
- The Estimator/Manager switch controls markup editing. It is not access control.
- The §4 open rules show an "unconfirmed" badge until the business confirms them.

## Hosting (Zoho Catalyst)

Slate (app `Oryx-Estimations`) builds and deploys the app from this repository. The server function is in `functions/estimation_zoho/`.

To release the function, run `npm install --omit=dev` in its folder, zip the folder's contents without the tests, and upload the bundle in the Catalyst console.

The function needs one environment variable, `ZOHO_MCP_URL`. Set it in the console; never commit it.

Sign-in uses Catalyst's scripts, which load only on Slate, so `npm run dev` cannot sign in.
