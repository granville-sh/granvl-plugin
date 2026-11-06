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
2. **Storefront script** (one `<script>` tag in `layout/theme.liquid`). Without it, only orders that _started_ on a granvl page are attributable (via the gv_cid on the click-out). With it, every order carries first / last / last-non-direct touch, so Shopify-direct and organic orders show up in attribution too, and storefront A/B tests (§5) can run. The tag is `<script src="https://app.granvl.com/api/integrations/shopify/snippet?shop=<store>.myshopify.com"></script>` (shown per store in the Shopify drawer and in `create_store_experiment`'s reply): as early as possible in `<head>`, right after `{{ content_for_header }}`, **without `async`**. Older tags without `?shop=` keep working for attribution only. **Consent-first:** in regions where Shopify requires consent, the script writes nothing (no cookie, storage or cart attribute) and assigns no one until the visitor accepts analytics in Shopify's own privacy banner; if Shopify's consent API can't load, it fails closed. The merchant must keep Shopify's banner on for the regions they sell into — granvl renders no banner.
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

| Question                                                                                                                                                                                                      | Tool                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| "How did the store do this week / month?" — revenue, orders, AOV, spend, MER, new-customer orders + CAC, COGS, fees, shipping, **contribution margin**, attributed revenue + coverage, daily series, channels | `get_store_summary({ days: 7\|30\|90, store_id? })`                                                                                           |
| "Which ads / campaigns / landing pages drive orders and are they profitable?"                                                                                                                                 | `get_store_attribution({ level: 'channel'\|'campaign'\|'adset'\|'ad'\|'page', model: 'first'\|'last'\|'lastNonDirect', days })`               |
| "Which products sell / have the best margin?"                                                                                                                                                                 | `get_store_products({ days })`                                                                                                                |
| "What's in the catalog?" (building pages)                                                                                                                                                                     | `list_store_products({ query? })`                                                                                                             |
| Cost inputs behind contribution margin                                                                                                                                                                        | `set_store_costs({ store_id?, payment_fee_pct?, payment_fee_fixed?, shipping_cost_per_order?, fallback_cogs_pct? })`                          |
| Storefront A/B tests (§5)                                                                                                                                                                                     | `create_store_experiment`, `set_store_experiment_status`, `get_store_experiment_results`, `list_store_experiments`, `update_store_experiment` |

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

---

## 5. A/B tests on the storefront

Test the store's own pages (product, collection, page, home) — not granvl pages, not cart or checkout. Results are in **revenue per visitor and projected store MER**, joined to the store's ad spend, with no pixel and no customer identity. **granvl never writes to the store**: the merchant's own Shopify MCP makes every theme change; granvl only serves the storefront script and counts.

**Content vs template.**

- **Content** (`kind: 'content'`) — a few DOM changes the granvl script applies on the targeted pages: `text`, `attr` (href / src / srcset / alt / title / class / aria-label), `image` (`<img>` only), `show` / `hide`, `html` (only into elements the theme marks with `data-gv-slot`; allowlisted tags, no scripts / styles / handlers), or one same-store `redirect`. Headlines, button labels, badges, a hero image, hiding a block. Max 40 ops; URLs are same-store paths or `https:`. For an element only B should show, give it `class="gv-hidden"` in the theme plus `.gv-hidden{display:none}` in the theme CSS, and `show` it in B.
- **Template** (`kind: 'template'`) — a different layout: Shopify alternate templates (`templates/product.gv-b.json` rendered with `?view=gv-b`). Cohort B is redirected to `?view=<suffix>` once per page; control visitors on a shared `?view=` link are sent back. Product / collection / page / index targeting only. **TEMPLATE creation is yours**: granvl can't see or write the theme.

**Install (once per store).** Through the merchant's Shopify MCP, write the tag into `layout/theme.liquid` right after `{{ content_for_header }}`, no `async`. Then open the store once in a browser and accept analytics if a banner shows: `list_store_experiments` / `create_store_experiment` report `installed`, `last_seen_at`, `version` (3). Starting an experiment is refused until the script has been seen.

**Template recipe (what you do).**

1. Read the live template through the merchant's Shopify MCP (`templates/product.json`, or the one the targeted products use).
2. Create `templates/product.<suffix>.json` (e.g. `product.gv-b.json` — `create_store_experiment` returns the exact file name) with the changed layout: reorder / add / remove sections and blocks, change section settings. Keep it a JSON template so the section schema stays valid.
3. Preview: open a targeted product with `?view=<suffix>`; confirm it renders and add-to-cart works.
4. Confirm the granvl storefront script is in `layout/theme.liquid` (`<head>`, no `async`).
5. `set_store_experiment_status({ id, status: 'running' })`.
6. After `readiness: 'ready'`, the user picks the winner: `set_store_experiment_status({ id, status: 'concluded', winner_key: 'B', conclusion })` (or `no_winner: true`). If B wins, copy B's layout into the default template through the Shopify MCP, then archive the experiment.

Guardrails: never assign a product's template to the `gv-*` template in Admin (that shows B to everyone); never target cart / checkout / account; **one running experiment per page at a time** (starting an overlapping one is refused with the other's name — pause or conclude it first, or narrow the handles).

**Reading results** (`get_store_experiment_results`):

- `orders` / `revenue` are **stamped** orders only — the visitor's cart carried the test's `_gv_ab` attribute. Truth.
- `inferred` is a separate object: template-test orders with no stamp whose recorded landing page carried the variant's `?view=<suffix>`. Inference is view-param only — a plain landing URL infers nothing (not even control), because Shopify records the URL before the script redirects cohort B — so `inferred` only ever counts non-control arms. Report it as its own line ("plus N orders inferred from ?view= landing pages"); **never add it to orders**. Content tests can't be inferred. A large unstamped share (`health.unstampedShare`) means the script isn't loading, the consent banner blocks most visitors, or the tag sits after something that fails — say so.
- `conversion.probabilityToBeatControl` / `expectedLift` / `liftInterval` (Beta-Binomial) and `revenuePerVisitorStats` (normal approximation) compare each variant with control (A).
- **`readiness`: never call a winner before `'ready'`** (every variant ≥ 100 stamped orders AND ≥ 14 days). Before that, report the trend and `daysRemainingEstimate`. granvl never picks the winner; the user does.
- `projectedMer` per variant is **projected**: store MER (revenue ÷ the store's ad spend) if that variant went to every tested visitor. Label it as a projection.
- `health.status`: `ok` | `degraded` | `broken` (script not seen for 24 h, or over half of recent orders unstamped). `get_daily_brief` lists degraded / broken running tests in `storeExperimentAlerts`.

**EU / consent.** Where Shopify says consent is required, visitors take part only after accepting analytics; until then they see the page as served and are not counted. Lower exposure counts in those regions are expected, not a bug. Exposures are daily counters — granvl stores no visitor rows, cookie values or IPs.
