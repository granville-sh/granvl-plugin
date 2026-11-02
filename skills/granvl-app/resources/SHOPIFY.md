# Shopify stores — connect, pre-sell pages, attribution, profit

> **Required read before any work for a customer who sells on Shopify** — building a pre-sell / advertorial / listicle / product-finder page that clicks out to a store, answering "which ads make money", or reading store revenue, margin or attribution.

Granvl treats a Shopify store as the **conversion outcome** for click-through pages: the visitor lands on a granvl page, clicks out to the store, buys, and the order comes back carrying the page + ad that produced it. No pixels, no customer identity on granvl — attribution travels **on the order itself** (cart attributes), and the store sends granvl the order via webhook.

---

## 1. How it fits together

```
ad click → granvl page (gv_cid minted, UTMs captured)
        → "Shop now" click-out: the tracking script appends utm_* + click ids + gv_cid to the store URL
        → storefront snippet writes gv_cid + first/last/last-non-direct touch to the cart (hidden `_gv_*` attributes)
        → Shopify order webhook → StoreOrder row (revenue, refunds, products, touches, gv_cid → funnel + variant)
        → Store screen / MCP: MER, nCAC, contribution margin, attribution by channel/campaign/ad/page, product performance
```

Three pieces, in order of how much they matter:

1. **Store connection** (Settings → Integrations → Shopify). The granvl Shopify app is authorized on the store (OAuth, scopes `read_orders`, `read_products`, `read_inventory`); granvl registers `orders/create|updated` + `refunds/create` webhooks, syncs the catalog (title, variants, price, **unit cost** from Inventory → Cost per item, image, product URL), imports the last 60 days of orders, and re-syncs twice a day. Manual/webhook-only mode exists as a fallback (orders only, no catalog, no backfill).
2. **Storefront snippet** (one `<script>` tag pasted into `theme.liquid`). Without it, only orders that _started_ on a granvl page are attributable (via the gv_cid on the click-out). With it, every order carries first / last / last-non-direct touch, so Shopify-direct and organic orders show up in attribution too. The tag is shown in the Shopify drawer; tell the user to paste it before `</head>`.
3. **Cost settings** (`set_store_costs`): payment fee %, fixed fee, shipping cost per order, fallback COGS % for products without a unit cost. These feed contribution margin.

**Where the UI lives:** the **Store** page (`/dashboard/store`) appears in the rail once a store is connected. Agents never drive the UI — the tools below return the same numbers.

---

## 2. Pre-sell pages — the ecommerce build recipe

Shopify customers run **click-through** funnels: no form, the conversion is the click-out (and then the order). Build with `create_funnel({ funnel_type: "click_through" })` and put the store URL on every Shop-now button:

1. `list_store_products({ query? })` → pick the product(s); copy `productUrl` **verbatim as a plain link** (no UTMs, no gv_cid — the tracking script appends the visitor's ad context + gv_cid at click time, and granvl's UTM template handles the ad side).
2. Add `data-pages-convert` to every Shop-now / Add-to-cart anchor (a click-through LANDING page with no `data-pages-convert` fails the publish validator: `no_conversion_path`).
3. Start from a template when one fits — `list_templates` then `create_funnel_from_template`:
   - `ecom-advertorial` — editorial story → product (cold Meta / TikTok traffic).
   - `ecom-listicle` — "[7 reasons] …" with inline CTAs and a comparison table (cold traffic, broad audiences).
   - `ecom-presell-quiz` — product-finder quiz → email capture → match page with Shop-now cards (QUIZ + THANK_YOU; the email goes to the brand's email tool via a form destination).
   - `ecom-waitlist` — launch / drop waitlist (LANDING form + THANK_YOU with a "shop the current collection" click-out).
4. Read [PAGE-BUILDING.md](./PAGE-BUILDING.md) before writing the HTML — the usual rules (bare forms, snake_case field names, a11y, performance budget) all apply. Product images: use the `imageUrl` from the catalog, with width/height and lazy-loading below the fold.
5. **Email capture on an ecommerce page goes to the brand's email platform** — `set_form_destination(funnel_id, "company_id=<Klaviyo public key> list_id=<list id>")` wires a Klaviyo list (browser → Klaviyo; granvl stores no address). Other ESPs: Webhook / Zapier / HubSpot / ActiveCampaign as usual.

Do NOT: hand-add `gv_cid` or `utm_*` to store links; tell the user to install Meta/TikTok pixels on the granvl page for purchase tracking (orders come back through the store connection; purchase forwarding to Meta is an opt-in checkbox in the Shopify drawer, guarded against double counting with the store's own pixel); promise real-time numbers right after an order (webhooks are near-real-time; spend joins land on the twice-daily ad sync).

---

## 3. Reading the numbers — tools

| Question                                                                                                                                                                                                      | Tool                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| "How did the store do this week / month?" — revenue, orders, AOV, spend, MER, new-customer orders + CAC, COGS, fees, shipping, **contribution margin**, attributed revenue + coverage, daily series, channels | `get_store_summary({ days: 7\|30\|90, store_id? })`                                                                             |
| "Which ads / campaigns / landing pages drive orders and are they profitable?"                                                                                                                                 | `get_store_attribution({ level: 'channel'\|'campaign'\|'adset'\|'ad'\|'page', model: 'first'\|'last'\|'lastNonDirect', days })` |
| "Which products sell / have the best margin?"                                                                                                                                                                 | `get_store_products({ days })`                                                                                                  |
| "What's in the catalog?" (building pages)                                                                                                                                                                     | `list_store_products({ query? })`                                                                                               |
| Cost inputs behind contribution margin                                                                                                                                                                        | `set_store_costs({ store_id?, payment_fee_pct?, payment_fee_fixed?, shipping_cost_per_order?, fallback_cogs_pct? })`            |

**Metric definitions (pinned — quote them, don't improvise):**

- **Revenue** = order total − tax, with edits and refunds applied (net of refunds as of the read). Test orders excluded.
- **MER** = revenue ÷ ad spend over the same window (all synced platforms). The blended truth; attribution rows below are a _split_ of it, never a sum that exceeds it.
- **New-customer orders** = Shopify `customerOrderIndex === 1`. **nCAC** = spend ÷ new-customer orders.
- **Contribution margin** = revenue − COGS (unit cost × units, fallback % where missing) − shipping cost − payment fees. Says whether the ads _made money_, not just revenue.
- **Attributed revenue / coverage** = revenue on orders that carry a touch (gv_cid or snippet or Shopify's own journey) ÷ all revenue. Coverage < 60% with the snippet installed means the theme isn't loading it — point the user at Tracking health on the Store page.
- **Attribution rows** show `joined: true|false` — `false` means the order's campaign/ad could not be matched to synced spend (UTMs stripped, campaign renamed, platform not connected). Report it; don't invent a ROAS for it.
- **Models:** `lastNonDirect` is the default for "which ad gets credit"; `first` for "which ad introduced the customer"; `last` for the strict last-click view. Always say which one you used.

**Freshness:** `get_store_summary` returns `lastSyncedAt` / `lastWebhookAt` in `health`; if the last webhook is older than a day on an active store, say so and suggest "Sync now" in the Shopify drawer before quoting figures.

---

## 4. Optimization loop for stores

1. `get_store_summary(30)` → lead with MER, contribution margin, new-customer share and their deltas vs the prior period.
2. `get_store_attribution(level: 'campaign')` → rank by contribution (revenue − spend), not by revenue. Flag `joined: false` rows and `unattributed` as the "unknown" bucket.
3. `get_store_attribution(level: 'page')` → which granvl pages convert to **orders** (not just clicks). Propose variants with `get_research_history` first, exactly as for lead-gen.
4. `get_store_products` → put the highest-margin sellers on the pre-sell pages; retire pages pushing low-margin products.
5. Record what you learn with `save_learning` (metric = `revenue_per_visitor` or `order_rate`).

Guardrails: never recommend scaling spend on a campaign whose attributed contribution margin is negative; never compare a `first`-touch read against a `lastNonDirect` read in the same sentence; no customer lists — granvl holds no customer identity, so "email the buyers who…" is the brand's Klaviyo / Shopify job.
