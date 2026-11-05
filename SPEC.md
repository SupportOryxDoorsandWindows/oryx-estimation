# Oryx Estimation System – Calculation Spec

Date: 29 October 2026
Owner: Production, Oryx Doors & Windows
Status: Draft. Rules marked **SETTING** are unconfirmed and must be editable without code changes.

## Summary

A standalone web app where estimators enter a line item (product, dimensions, glass, charges) and the app calculates the cost, the selling rate and the amount, showing every step. The formulas below reproduce proposal P268194R3, item CW01.1, exactly (AED 50,225). Where the business has not yet confirmed a rule, the app uses the behaviour seen in CW01.1 as a default setting.

## 1. Inputs per line item

| Field | Notes |
|---|---|
| Product | Picked from `data/products.json` (fabricator, business unit, product code, type, size range) |
| Ref #, Location, Remarks | Free text |
| Width, Height (mm) | Whole item, not per panel |
| No. of panels | Used for glass weight and per-panel freight |
| Qty | Integer, default 1 |
| Supplier price | One field, with currency set by origin: AED/m² (Fusion), GBP (Origin), EUR (Hyline, OTIF, Inotherm, Kobbe), or a lump AED supplier quote |
| Markup | Default from the pricing rule; editable by permitted users only |
| Glass rate (AED/m²), thickness (mm), glazing spec | |
| Bonding charges, freight, other charges, installation, equipment rental | AED. Other charges may be negative. |
| Accessories | A list of rows, each with a description and an AED cost |
| Discount | Mode: fixed amount or percentage. Editing one calculates the other. |
| Margin change | Multiplier, default 1.00 |
| Salesperson price | Optional. Shown next to the calculated rate and never overwrites it. |

**Change, 4 November 2026 (Production):** Insurance and Duties are no longer entered in the app, and the curtain-wall bonding default (§4.1) and insurance rate (§4.5) are no longer settings. Bonding charges are entered as a plain AED amount (no per-m² rate). The formulas below still apply insurance and duties when a Zoho BOQ line carries a value, so imported and live Zoho proposals keep matching Zoho.

## 2. Core formulas (from CW01.1)

```
area          = width_mm * height_mm / 1_000_000          # whole item
profile_cost  = area * profile_rate_aed_per_sqm
profile_price = profile_cost * markup
glass_cost    = area * glass_rate_aed_per_sqm             # SETTING: glass area = full area
bonding       = area * bonding_rate                       # SETTING: default 1000 for Curtain Wall, else manual
glass_weight  = (area / panels) * thickness_mm * 2.5      # kg per panel, SETTING
rate          = (profile_price + glass_cost + bonding + freight + other_charges
                 + accessories + installation + equipment + insurance + duties) * margin_change
              - discount
amount        = rate * qty
```

Rounding (**SETTING**, default `floor`): each component is rounded down to a whole AED before summing. This matches the live system. Excel's ROUND gives 50,227 for CW01.1, so the setting must also offer `round`.

### Golden test: CW01.1 (must pass)

| Input | Value |
|---|---|
| Width × Height | 4,789 × 3,366 mm |
| Panels / Qty | 8 / 1 |
| Profile rate | 800 AED/m² (Insulux · Fusion · C35 Reinforced) |
| Markup | 2.5 |
| Glass rate / thickness | 450 AED/m² / 16 mm |
| Bonding | 16,120 |
| Other charges | −5,387 |

| Expected output | Value |
|---|---|
| Area | 16.119774 |
| Profile price | 32,239 |
| Glass cost | 7,253 |
| Glass weight | 80 |
| Rate / Amount | 50,225 |

## 3. Pricing rules by origin (from PRICING-FORMULAS.xlsx)

These are editable defaults stored in `data/pricing-rules.json`.

| Origin | Cost to AED | Markup | Freight default | Other default |
|---|---|---|---|---|
| Fusion – Series 1, B3710 Folding, F44 Fixed, C35 Curtain Wall | area × AED/m² | 2.5 | 0 | 250 |
| Fusion – Series 2, Series 3, B3800 Folding | area × AED/m² | 2.85 | 0 | 250 |
| Origin | GBP × 5 | 2.85 | 1,500 per panel | 0 |
| Hyline | EUR × 4.32 | 2.5 | 5,000 | 0 |
| OTIF | EUR × 4.32 | 2.22 (no glass line) | 5,000 | 0 |
| Inotherm | EUR × (1 − 0.45) × 4.32 | 2.85 | 7,500 | 1,500 |
| Kobbe | EUR × 4.32 | 2.85 | 20,000 | 0 |
| Anything else | Manual cost | 2.85 | Manual | Manual |

The exchange rates (GBP 5, EUR 4.32) and the Inotherm discount (45%) are settings.

## 4. Open rules: build as settings, flag in the UI

1. Bonding: AED 1,000/m² for curtain walls, or always manual?
2. Is a negative "Other charges" a discount? Show a warning when other charges are below zero.
3. Standard Pricing per m² (product list) and Glass Rate Reference: show them as reference values only, and warn when the calculated price per m² falls below Standard Pricing.
4. Markup for products outside the pricing sheet: default 2.85 (confirmed by Production, 4 November 2026; was 2.5). 190 products have a Standard Pricing of 0.
5. Base for insurance (1%), duties and discount %: default to the subtotal before discount.
6. Rounding: floor or round (default floor).

**Added, 4 November 2026 (Production):** Manpower charges (AED), entered by hand, added to the subtotal like Installation:
`rate = (profile_price + glass_cost + bonding + freight + other_charges + accessories + installation + manpower + equipment + insurance + duties) * margin_change - discount`.

**Added, 4 November 2026 (Production):** Dual colour tick box: `dual_colour = profile_price × 10%` (setting `dualColourSurcharge`), added to the subtotal after the profile price. Glass and other costs are not affected.

**Added, 4 November 2026 (Production):** Glass type sets the glass rate (AED/m²), which the estimator can still change: Standard 450, Special 800, Jumbo 950, Super Jumbo 2,000 (setting `glassTypeRates`).

**Confirmed by Production, 4 November 2026:** glass area = full item area; glass weight factor 2.5 kg/m²/mm; a negative Other charges value is allowed (the app still shows a warning); discount % is taken on the subtotal before discount (§4.5). Still unconfirmed: rounding (§4.6) and the Standard Pricing warning (§4.3).

## 5. Out of scope

BOQ comparison, reading elevation drawings, counting windows from drawings, and the Zoho integration.


## 6. Project Profitability Summary (5 November 2026)

Estimated profitability of the whole estimate, shown at the bottom of the Estimate screen and exported to Excel. It reuses the line-item results above; nothing is calculated twice.

| Figure | Formula (all line items, × qty, whole AED) |
|---|---|
| Selling price | Sum of line amounts (after markup, dual colour, margin change and discount). The salesperson price is never used. |
| Total estimated cost | Profile cost before markup + glass + installation + manpower + equipment rental + accessories + other additional charges (bonding, freight, positive other charges, insurance, duties) |
| Estimated profit | Selling price − total estimated cost |
| Profit margin | Estimated profit ÷ selling price × 100; "—" when the selling price is 0 |

Markup on profile, dual colour and margin change are what Oryx earns, not costs. Discounts reduce the selling price. Negative other charges (e.g. CW01.1's −5,387) reduce the client price and are not counted as income or cost. Price build-up: total cost + markup on profile + dual colour + margin change − discounts − negative other charges = selling price.
