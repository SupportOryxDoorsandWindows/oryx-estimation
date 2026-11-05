# Oryx Estimation System

Standalone web app for estimating aluminium door, window and curtain wall prices at Oryx Doors & Windows (Dubai).

## Source of truth
- `SPEC.md`: formulas, pricing rules and open settings. Follow it exactly. Never invent pricing rules.
- `reference/`: the original requirements doc, the pricing Excel, the product list and screenshots of record CW01.1.
- `data/products.json`: the 269 products exported from Zoho (All_Products). Business Unit is the origin used for pricing rules; Fabricator is the maker.
- `data/accessories.json`: the standard accessories list. They have no set prices; estimators enter each price by hand.

## Stack
- Vite + React + TypeScript, static site (GitHub Pages).
- Sign-in: Supabase Auth, for now the Fleet app's (Vehicle Management System) project and accounts; only active Admins (`profiles`) can use the app (`src/auth/`). The sign-in screen follows Oryx StockFlow's design.
- Zoho: only through the `estimation-zoho` Supabase Edge Function (`supabase/functions/`), which holds the Zoho MCP link as the `ZOHO_MCP_URL` secret and checks the caller is an Admin. Never put the link in code or the browser.
- Pricing engine as pure functions in `src/engine/`, with no UI code in that folder.
- Settings and pricing rules in `data/pricing-rules.json`, editable on a Settings screen.
- Door price chart (`doorChart` in `data/pricing-rules.json`, maths in `src/engine/doorChart.ts`): AED/m² by bilinear interpolation over the production costing grid, from the Single Door Order Estimator workbook. Door products priced in AED (AED/m² or manual rule) take their supplier price from it automatically (there is no manual switch); GBP/EUR doors keep their supplier quote and show the chart for reference only. With the chart, Profile reference (locked) is the chart rate and Pricing (editable) prices the item.
- Saved estimates and settings edits persist in localStorage (wrap every access in try/catch).
- Revisions (Phase 2): logic in `src/engine/revision.ts`; data through the `ZohoSource` interface in `src/zoho/source.ts`. Zoho is the source of truth: do not store deals, proposals or BOQ lines from Zoho in the app. See `docs/zoho-integration.md`.
- Project Profitability Summary (whole project): on Saved estimates, clicking an estimate's row shows its summary below the list (click again to hide); on the Estimate screen it appears at the bottom once the estimate has a selling price. Per line item: the Summary card has Summary / Profitability tabs (`ItemProfitability`, same function with just that item; the chosen tab stays when moving between items). `projectProfitability()` in `src/engine/profitability.ts` works from the same line results as the Line items table (no second calculation). Selling price = line amounts (never the salesperson price); estimated cost = profile cost before markup + glass + installation + manpower + equipment + accessories + bonding/freight/positive other charges/insurance/duties, × qty, whole AED; negative other charges reduce the price only. Excel export (`src/io/profitabilityWorkbook.ts`) uses the same function. Estimated only, kept apart from actual project costs.
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
- Estimate screen: Proposal details (Zoho Deal and Proposal Information, defined once in `src/ui/proposal.ts`), Line items, then the line item sections.
- Line item sections in this order: Product · Dimensions · Pricing · Glass · Other costs · Summary. On wide screens the Summary sits in a sticky right column.

## Writing
UK English. Plain labels (for example "Glass cost (AED)").

## Commands
- `npm run dev`: start the app
- `npm test`: run the Vitest suite
