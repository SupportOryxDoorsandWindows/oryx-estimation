# Zoho integration (Phase 2)

Deals come from Zoho CRM, and accepted proposals and BOQ lines from Zoho Creator. Revisions are sent back to Zoho. The revision features use the `ZohoSource` interface (`src/zoho/source.ts`). Until the live source exists, the Revisions page uses a BOQ_Summary export held in memory for testing.

Zoho is the source of truth: the app does not store deals, proposals or BOQ lines from Zoho.

## Decisions confirmed by Oryx (3 November 2026)

### Access
| Item | Decision |
|---|---|
| Data centre | .com |
| Connection | Zoho MCP server ("estimationapp"). The URL contains its access key: it is kept only as a server secret, never in code, documents or chat. Regenerate it after go-live. |
| CRM module | `Deals` |
| Creator app | Owner `oryxdoors`, app `proposals-2-0` |
| Creator reports | `All_Proposals2` (proposals), `BOQ_Summary` (BOQ lines) |
| Creator forms | `Add_Proposal` (proposals), `BOQ` (BOQ lines) |
| Proposal ↔ BOQ link | `Proposal_Reference`, a lookup field |
| Sign-in | Supabase, same project as the Fleet app |
| Who revises and submits | Sales support (estimator) |
| Hosting | GitHub Pages for now; Zoho data stays behind sign-in on the server |

### Proposal statuses (`Quote_Status`)
| Status | Meaning |
|---|---|
| Accepted by the Client | The proposal that can be revised. The Revisions page lists only this status. |
| Work in Progress | A new revision, after it is copied from the accepted proposal |
| Replaced Accepted Proposal | The earlier proposal, once its revision is accepted |

Client acceptance is marked in Zoho, not in the app. The proposal that is revised is whichever currently has "Accepted by the Client".

### Creating a revision
Zoho has an existing copy button on `Add_Proposal` that copies a proposal and references the original. The Zoho admin will expose it as a **Custom API** for the app to call (decision: option A).

### BOQ line fields for revisions
| Revision action | `Order_Type` | Checkbox | Other fields |
|---|---|---|---|
| Original line | Main Order | – | – |
| Cancel Item | Cancelled Item | `Cancel_Item` | `Old_Amount_AED`, `Old_Order_Type` |
| Replace Item (original) | Replaced Item | `Replace_Item` | `Old_Amount_AED`, `Old_Order_Type`, `Copied_Replaced_by` |
| Replace Item (new line) | Item Replacement | – | `Copied_Replaced_from` |
| Add Item | Additional Item | – | – |
| Size Revision without price change | Main Order | `Size_Adjustment` | – |
| Size Revision with price change | Main Order | – | New size and amount |

- Other `Order_Type` values (Remake, Overpayment, Credit Note, Variation) are not set by the app.
- `Copy_Item` is for duplicating a line item; Phase 2 does not use it.
- Zoho does not keep the original size; the app's revision history and Excel export do.
- `Main_Order_ID` and `Main_Order_Reference` link a revision to the accepted proposal. `Previous_Order_Reference`: purpose unknown, not used.

### Pricing defaults
No change: markups (2.5 Fusion, 2.22 OTIF, 2.85 the rest), freight (including Origin AED 1,500 per panel) and other charges (Fusion 250, Inotherm 1,500) stay as in `data/pricing-rules.json`.

### Scope
Sending estimate BOQs back to Zoho is Phase 3 (BOQ generation).

## Still open
1. **Creator tools on the MCP server.** The tools listed so far are CRM tools only. Creator (read, add and update records) must be linked.
2. **Custom API for the copy button.** Its name, authentication, input (original proposal ID) and output (new proposal ID, and which new BOQ line came from which original).
3. **Field link names of BOQ values.** Several look duplicated (Width / Width1, Height / Height2, Quantity / Quantity1 and others). To be read from one real record through MCP, read-only.

## Deferred
- **Users and roles** (who gets an account, and whether there is a separate "Estimator" role). On hold at Oryx's request, 3 November 2026. Needed before the live connection is opened to staff.


## Interface the live source implements
- `searchDeals(query)`: CRM Deals search.
- `proposals(dealName)`: Creator proposals for the deal; the page lists only "Accepted by the Client".
- `boq(proposal)`: BOQ lines of the selected proposal, fetched on selection.
- `submit(draft)`: call the copy Custom API, then update the copied lines with the revision actions (table above). Never delete the original.
