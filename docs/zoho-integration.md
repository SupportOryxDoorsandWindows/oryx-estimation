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

## Checked in Zoho (read-only, 3 November 2026)

Read through the MCP server: tool list, metadata of `All_Proposals2`, `BOQ_Summary`, `Add_Proposal` and `BOQ`, one proposal and one BOQ line. Nothing was created or changed.

### MCP server
- 41 tools, all Zoho Creator. The CRM tools are no longer on the server.
- Includes admin tools (`updateForm`, `updateField`, `updateButton`, `updateApplicationStatus`, approvals, blueprints, chat agent) that the app does not need.

### Custom buttons (report `All_Proposals2`)
`Revise_Accepted_Proposal` ("Revise Accepted Proposal", row action with criteria), `Mark_as_Accepted_by_the_C`, `Generate_BOQ`, `Generate_SPC`, `GENERATE_CBN`. Callable with `executeReportCustomAction` and the proposal ID.

### Proposal (`Add_Proposal`)
| Field | Type | Notes |
|---|---|---|
| `Deal_Name` | CRM lookup | `{ID, zc_display_value, potential_name}` |
| `Quote_Status` | Drop-down | Not Started, Work in Progress, Waiting for Information, Sent to the Client, Accepted by the Client, Rejected by the Client, Replaced Accepted Proposal |
| `Revision_Number` | Number | |
| `Order_Type` | Drop-down | Main Order, Variation |
| `Main_Order_Reference`, `Previous_Order_Reference` | Lookups | |
| `Proposal_Reference` | Formula | e.g. P266308R5 |
| `BOQ` | Subform | BOQ lines |

### BOQ line (`BOQ` form, `BOQ_Summary` report)
Editable fields hold the values; fields ending in a digit are read-only formula copies for display.

| Value | Editable field | Formula copy |
|---|---|---|
| Ref # | `Reference` | `Reference1` |
| Width / Height (mm) | `Width`, `Height` | `Width1`, `Height2` |
| Panels | `No_of_Panels` | `No_of_Panels1` |
| Quantity | `Quantity` | `Quantity1` |
| Location | `Location` | `Location1` |
| Rate (AED) | `Unit_Rate_AED` | `Rate` |
| Amount (AED) | `Amount_AED` | `Amount` |
| Glass rate | `Glass_Rate` (`Glass_Rate2` is the reference rate) | `Glass_Rate_AED` |
| Product | `Product_Code_Detailed` (lookup) | |
| Proposal | `Proposal_Reference` (lookup) | |

Revision fields: `Order_Type` (Main Order, Additional Item, Item Replacement, Cancelled Item, Replaced Item, Remake, Overpayment, Credit Note, Variation), `Old_Order_Type`, `Old_Amount_AED`, `Copied_Replaced_from`, `Copied_Replaced_by` (lookups), `Main_Order_ID`, `Main_Order_Reference`, checkboxes `Cancel_Item`, `Replace_Item`, `Copy_Item`, `Size_Adjustment`, `Price_Adjustment`.

Observed: on an accepted proposal (P266308R5) the original lines have an empty `Order_Type`, not "Main Order".

## Still open
1. **The "Revise Accepted Proposal" button.** Is it the copy workflow, and may the app press it when a revision is submitted? To be tried first on a test proposal.
2. **`Price_Adjustment` checkbox.** When is it ticked?
3. **`Order_Type` on resized lines.** Original lines are empty, not "Main Order". Leave empty, or set "Main Order"?
4. **Deal lookup.** The CRM tools are gone from the MCP server. Add read-only CRM Deals search back, or list deals from Creator proposals (enough for Revisions)?
5. **Tool list.** Remove the admin tools the app does not need.

## Deferred
- **Users and roles** (who gets an account, and whether there is a separate "Estimator" role). On hold at Oryx's request, 3 November 2026. Needed before the live connection is opened to staff.


## Interface the live source implements
- `searchDeals(query)`: CRM Deals search.
- `proposals(dealName)`: Creator proposals for the deal; the page lists only "Accepted by the Client".
- `boq(proposal)`: BOQ lines of the selected proposal, fetched on selection.
- `submit(draft)`: call the copy Custom API, then update the copied lines with the revision actions (table above). Never delete the original.
