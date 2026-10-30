# Oryx Estimation System

Standalone web app for estimating aluminium door, window and curtain wall prices at Oryx Doors & Windows (Dubai).

## Source of truth
- `SPEC.md`: formulas, pricing rules and open settings. Follow it exactly. Never invent pricing rules.
- `reference/`: the original requirements doc, the pricing Excel, the product list and screenshots of record CW01.1.
- `data/products.json`: the 269 products exported from Zoho (All_Products). Business Unit is the origin used for pricing rules; Fabricator is the maker.

## Stack
- Vite + React + TypeScript. No backend for v1.
- Pricing engine as pure functions in `src/engine/`, with no UI code in that folder.
- Settings and pricing rules in `data/pricing-rules.json`, editable on a Settings screen.
- Saved estimates and settings edits persist in localStorage (wrap every access in try/catch).
- Export and import use Excel (.xlsx): `src/io/workbook.ts` maps rows; `src/ui/excelFile.ts` reads and writes files. Products import takes the Zoho All_Products .xlsx export directly.

## Non-negotiables
- The CW01.1 golden test in SPEC.md must pass (rate = 50,225). Write it first with Vitest.
- Every calculated figure appears on screen with its formula, so estimators can audit it.
- The salesperson price never overwrites the calculated rate.
- Unconfirmed rules (SPEC §4) appear as settings, with a small "unconfirmed" badge.
- Currency is AED, with thousands separators and no decimals in the UI.

## Design
- Match the Oryx Fleet app (Vehicle Management System): navy sidebar (#022A3A), warm grey ground (#F4F4F1), white cards with 12px radius, 44px buttons and inputs.
- IBM Plex Sans for text, IBM Plex Mono for formulas. Colour tokens live in `src/ui/styles.css`; use only those.
- Amber pills for "Unconfirmed" and warnings, red and green pills for comparisons. No other accent colours.
- Sections in this order: Product · Dimensions · Pricing · Glass · Other costs · Summary. On wide screens the Summary sits in a sticky right column.

## Writing
UK English. Plain labels (for example "Glass cost (AED)").

## Commands
- `npm run dev`: start the app
- `npm test`: run the Vitest suite
