# Granvl — Meta Ads (Facebook / Instagram)

granvl's Guided Campaign Build for Meta, plus the full Meta tool reference. Read [../SKILL.md](../SKILL.md) first for the universal paid-ads invariants (everything lands PAUSED, budget caps, pause-yes / enable-never).

**Connect:** the user connects Meta from the dashboard's Ads page (Meta Ads → Connect Meta account). Open to every workspace since 2026-09-14. If a user can't connect, the agent-ETL sync recipe in SKILL.md ("Ad accounts") is the fallback.

---

## Guided Campaign Build — the walked-through flow

granvl is a **simplified ads manager**: campaign → ad set → ad, every level created **PAUSED** (activation is always the human, in Meta Ads Manager — there is deliberately no activate tool). Walk the user through the three steps conversationally, confirming each before the write:

1. **`create_meta_campaign`** — ask: which ad account, campaign name, objective. Check `list_meta_pages` — if the account has no **ad identity** (Page), set it yourself with **`set_ad_identity` `{ account_id, page_id }`** (no need to send the user to the dashboard); step 3 requires it.
2. **`create_meta_adset`** — ask: daily budget (**guardrailed** to min(workspace cap, $200/day) — if refused, relay the cap, never work around it) and target countries.
3. **`create_meta_ad`** — ask: which bucket creative(s) (`list_ad_creatives`; image **or** video — upload via `upload_ad_creative` if needed). Provide **`creative_ids`** (array) to launch one ad per creative in a single pass. Then the destination (usually their granvl lander's live URL), primary text, optional headline, and the **CTA button** (`call_to_action`, default `LEARN_MORE`). Optional extras only if the user asks: **`primary_texts` / `headlines`** with multiple entries → Meta rotates them (built-in A/B); **`enhancements`** → opt INTO specific Meta Advantage+ creative enhancements (brightness, text variations, touch-ups, …) — **default is all OFF**; only turn on what the user wants, and Meta silently drops any that don't apply to the ad.

**Tracking UTMs are automatic:** granvl puts its Meta UTM template (`utm_ad_id={{ad.id}}`, plus campaign/adset/ad name + id, placement and `site_source_name`) in the ad's **URL parameters** field (creative `url_tags`) server-side — the website URL itself stays clean, and the user sees/edits the params where Ads Manager expects them — the same params the funnel page hands out — so provide the plain lander URL. It only fills params not already present, so a URL that already has UTMs is never double-tagged.

Then tell the user: the whole chain is paused — review + activate in Ads Manager. Performance will attribute back to the exact creative(s) used.

**Save a draft instead of publishing:** if the user isn't ready to create the campaign on Meta, `save_campaign_draft` persists the in-progress build inside granvl (provide whatever `campaign` / `adset` / `ad` fields you have — same names as the create tools, all optional). It touches nothing on Meta. `list_campaign_drafts` shows saved drafts; `get_campaign_draft` reloads one to keep building (then `create_meta_*` to publish); `delete_campaign_draft` removes it. Drafts and the human wizard's "Save as draft" share the same store, so a draft saved in the UI can be finished by the agent and vice-versa.

---

## Meta tool reference

#### `create_meta_campaign` `{ account_id, name, objective?, creative_ids?, daily_budget_usd?, special_ad_category? }`

**Create a campaign in the user's connected Meta ad account.** Safety is server-enforced, not conventional: the campaign is **always created `PAUSED` and completely empty** (no ad sets, no ads, no budget) so it **cannot spend**; the user reviews and activates in Ads Manager. Use when the user wants to act on insights ("spin up a campaign for the winning lander") without leaving the conversation. Requires a Meta connection with **Manage access** — a `(#200)` error means the grant is read-only → tell the user to reconnect Meta with Manage access from the Ads page. `objective` defaults `OUTCOME_TRAFFIC` (provide ODAX enums like `OUTCOME_LEADS` / `OUTCOME_SALES`). The campaign appears in Granvl's Ads views after the next sync. Always tell the user the campaign is paused and where to activate it. **Money guardrails (server-enforced):** `daily_budget_usd` is capped at min(the workspace admin's guardrail, granvl's **$200/day** platform ceiling) — an over-cap request returns the cap in the error; relay it to the user, NEVER work around it. And there is **deliberately no activate/unpause tool**: activation is always the human's action in Ads Manager. **`special_ad_category`** (`NONE` default | `FINANCIAL_PRODUCTS_SERVICES` | `HOUSING` | `EMPLOYMENT` | `ISSUES_ELECTIONS_POLITICS`) is **required by Meta policy** when the ads promote a regulated vertical (loans/insurance/investing/credit, housing, jobs, or political/electoral issues) — declaring one keeps the account compliant and makes Meta auto-restrict targeting; ask the user if the offer looks financial/housing/employment/political.

#### `create_meta_adset` `{ account_id, campaign_id, name, daily_budget_usd, countries, excluded_countries?, placement_formats? }`

**Step 2**: PAUSED ad set — the targeting/optimization/budget layer. Budget clears the two-layer cap BEFORE any write (lifetime is guarded on effective daily = total ÷ flight days). Configurable: daily OR lifetime budget, optimization goal (LINK_CLICKS / LANDING_PAGE_VIEWS / REACH / IMPRESSIONS), bidding (lowest-cost or a guardrail-capped bid cap), schedule (start/end), audience (countries, age, gender), and placements (automatic Advantage+ or manual facebook/instagram/audience_network/messenger). `excluded_countries` (ISO alpha-2 codes to EXCLUDE from the targeted geo) narrows a broad `countries` set — a code **can't be in both** `countries` and `excluded_countries`. `placement_formats` (`feeds` | `stories_reels`) is a ratio-based placement group so a creative runs only where its aspect ratio looks right (e.g. a 9:16 UGC video → `['stories_reels']`); it **takes precedence over `placements`** — omit both for automatic placements. `advantage_audience` (boolean) is Meta's Advantage+ audience: omit → on, unless you narrowed the audience with `interest_ids` / `custom_audience_ids` / `gender` / a tighter age range, in which case it defaults off so the manual picks are honoured; it is always sent explicitly because Marketing API v26.0 requires it on special-ad-category ad sets. Video ads are a later slice — for those, tell the user to refine in Ads Manager post-activation.

#### `create_meta_ad` `{ account_id, campaign_id, adset_id, creative_ids, name, link_url, primary_text, headline?, call_to_action?, primary_texts?, headlines?, enhancements?, format? }`

**Step 3 (final)**: bucket creative(s) (image or video) → Meta image hash → ad creative under the account's **ad identity** Page → PAUSED ad. Lead with **`creative_ids`** (array) — **one PAUSED ad is created per creative**, so provide several to launch multiple ads in a single pass; the singular **`creative_id`** still works for back-compat. Optional copy/CTA: **`call_to_action`** (Meta CTA enum, default `LEARN_MORE`); **`primary_texts` / `headlines`** with multiple entries → Meta rotates them (built-in A/B, `primary_text` / `headline` are the first); **`enhancements`** → opt INTO specific Meta Advantage+ creative enhancements per feature (**default all OFF** — only turn on what the user asks; Meta silently drops any that don't apply). Errors are actionable (no identity set → point at Ad settings). For video, the build waits on Meta processing (slower). Writes the creative↔ad linkage powering per-creative performance.

**`format`** picks how the creatives become ads:
- `one_per_creative` (default) — one PAUSED ad per creative; each ad reports on its own.
- `multi_media` — ONE ad carrying every creative in `creative_ids` (max 10) as a Meta **multi-media ad** (`media_sourcing_spec`, the current replacement for dynamic creative / the retired flexible format). Meta picks the image or video per impression. Works on any objective, including `OUTCOME_LEADS`. Tell the user the trade-off before choosing it: the ad is the reporting unit, so per-creative performance can't separate the creatives and auto-test rules can't judge them individually.
- `flexible` — legacy flexible ad format (`creative_asset_groups_spec`); Meta only accepts it on `OUTCOME_SALES` / `OUTCOME_APP_PROMOTION`. Prefer `multi_media`.

#### `attach_creatives_to_campaign` `{ account_id, campaign_id, creative_ids }`

**Attach bucket creatives to an existing Meta campaign** — the order-agnostic counterpart to `create_meta_campaign`'s `creative_ids` (campaign-first flows use this). Idempotent; re-attaching is a no-op. Attached creatives are what the ad-build step turns into actual paused ads. Refuses accounts the user removed from the workspace.

#### `list_ad_pixels` `{ account_id }`

The account's Meta pixels (id, name) for conversion-optimized ad sets. Provide a `pixel_id` + `custom_event_type` (PURCHASE / LEAD / COMPLETE_REGISTRATION / …) to `create_meta_adset` with `optimization_goal: OFFSITE_CONVERSIONS` to optimize toward real conversions instead of clicks. Read-only.

#### `list_custom_audiences` `{ account_id }`

The account's saved custom / lookalike audiences (id, name, subtype, approx size) → provide ids to `create_meta_adset` (`custom_audience_ids` / `excluded_custom_audience_ids`). Read-only.

#### `search_ad_interests` `{ query }`

Search Meta's detailed-interest taxonomy by keyword → id, name, path, approx size. Provide chosen ids to `create_meta_adset` as `interest_ids`. Read-only.

#### `list_meta_pages` `{}`

**List the Facebook Pages the workspace's Meta connections manage** (id + name only — never Page content/insights) plus each visible ad account's selected **ad identity** (the Page its ads run under — a **per-account** setting the user picks in the Ads page settings). Check the target account's identity before building ads; if none is selected, ask the user to pick one there (or set it with `set_ad_identity`). Accounts the user removed from the workspace are excluded. Read-only.

---

Creative upload + the creative bucket (`upload_ad_creative`, `list_ad_creatives`, `get_creative_performance`) are shared across platforms — see [REFERENCE.md](./REFERENCE.md).
