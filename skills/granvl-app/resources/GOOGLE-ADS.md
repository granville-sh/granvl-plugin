# Granvl — Google Ads (Search + Demand Gen)

granvl's opinionated playbooks and build flows for Google Search and Google Demand Gen campaigns. Read [../SKILL.md](../SKILL.md) first for the universal paid-ads invariants (everything lands PAUSED, budget caps, pause-yes / enable-never).

**Connect:** the user connects a Google login from the **Ads page settings** ("Connect Google"). Connected Google Ads accounts + spend sync into the **same dashboard** as Meta — list accounts via the Ads switcher; spend/CPL joins (`get_spend_summary`, `get_ad_to_lander_performance`, …) work identically.

**Invariants (both flows, server-enforced — same posture as the Meta build):**

- **Always created PAUSED.** The campaign is the **single spend gate** — ONE switch to activate in Google Ads (unlike Meta's three paused levels). There is deliberately no activate tool; activation is always the human's action. Close every build by telling the user this.
- **Budget guardrail:** `daily_budget_usd` (and any bid) is capped at the lower of the workspace admin's cap and granvl's **200 USD per day** platform ceiling BEFORE any write — an over-cap request returns the cap in the error; relay it, NEVER work around it.
- **Plain URLs, never pre-tagged:** granvl's Google UTM template (**ValueTrack** ids) is applied as the **Final URL suffix** — campaign-wide AND on each ad's own Ad URL options — so spend joins first-party conversions automatically — every `final_url` you pass stays PLAIN.

---

## Google Search campaigns — the Playbook (STAG)

granvl's opinionated way to build Search campaigns. The server ENFORCES the
hard rules below (the tools reject violations with coaching); this section is
the strategy that makes the result good, not just valid.

### The three bidding recipes — pick by conversion history

| Recipe | When | How |
|---|---|---|
| **Maximize Clicks + CPC ceiling** | LAUNCH DEFAULT — new campaign, no conversion history | `bid_strategy: MAXIMIZE_CLICKS` + `max_cpc_usd` (REQUIRED — the tool rejects it without one). Seed the ceiling from `generate_keyword_ideas` CPC data (start near the median top-of-page bid). |
| **Manual CPC** | User wants full control per ad group | `bid_strategy: MANUAL_CPC`, then per-ad-group `cpc_bid_usd`. Suggest bids from keyword CPC data. |
| **Max Conversions** | GRADUATION — ~15+ tracked conversions in 30 days | Requires `confirm_conversion_tracking: true`, which you may only set after the USER confirms their Google Ads account has the conversion action imported (GA4 import). granvl also verifies a domain has Google tracking wired. Optional `target_cpa_usd` once stable. |

Hard rules (server-enforced, don't fight them):
- **BROAD match needs `allow_broad_match: true`** — only after the user explicitly chooses it despite your warning. Broad + automated bidding on a fresh campaign burns budget on junk queries. The STAG recipe is PHRASE + EXACT.
- **Final URLs on granvl domains must be LIVE** — `create_google_search_ad` rejects unpublished pages. Pages before ads, always.
- **You may PAUSE campaigns but never ENABLE** — going live is always the human, in Google Ads.

### The STAG flow (Single Theme Ad Groups — one theme, one lander)

The modern SKAG: RSAs made single-KEYWORD groups obsolete; single-THEME groups
with a message-matched lander are the play — and granvl is the only tool that
mints the lander during ad-group planning.

1. **Intake**: offer, geo, budget, recipe. Check the workspace has an ACTIVE domain NOW (`list_domains`) — publishing needs it. No domain → do steps 2-3, save the plan as a campaign draft, and tell the user to connect a domain to continue.
2. **Research — bottom-of-funnel only**: seed `generate_keyword_ideas` with the queries someone types when they're already looking for a product like this one, and drop awareness terms when clustering — "mortgage protection quotes", "group benefits plans for small business", "term life insurance rates" are in; "what is mortgage protection", "how do employee benefits work", "is life insurance worth it" are out (they're content queries; paid Search on them buys readers, not leads). Cluster the BOFU set into 3-6 tight single-intent THEMES using volume + CPC (e.g. "mortgage protection quotes" vs "life insurance for homeowners" are different themes).
3. **The Plan** (user sign-off #1): present themes, keywords + match types (phrase/exact), budget, recipe, and the lander each theme gets. Save with `save_campaign_draft` so it survives the session.
4. **Landers**: ONE funnel, one LANDING page per theme (slug = theme), headline message-matched to the theme's keywords. Brand kit applies.
5. **Sign-off #2**: `create_preview_link` → the user approves the pages.
6. **Publish**: `publish_funnel` — pages go live (this is what unblocks step 7).
7. **Build**: `create_google_search_campaign` (recipe from step 1) → one `create_google_ad_group` per theme (phrase/exact keywords) → one `create_google_search_ad` per group, `final_url` = that theme's live page (plain URL — the campaign-wide ValueTrack suffix carries the UTMs). Everything lands PAUSED.
8. **Close the loop**: `get_tracking_health` immediately; hand the user the checklist ("activate in Google Ads when ready"). In later sessions, review performance per theme and iterate landers with new variants.

### Location targeting — provinces, exclusions, presence (Search AND Demand Gen)

`countries` is only the coarse layer. When an offer is geography-bound — licensed per province/state, a local service, "Canada except Quebec" — fence it **at build time**, not after:

1. **`search_google_locations`** `{ account_id, query, country_code?, target_type? }` → `id`, `canonicalName` ("Quebec,Canada"), `targetType`. **Never guess an id**, and always check `targetType` — "Quebec" is a Province *and* a City.
2. On `create_google_search_campaign` / `create_google_demand_gen_campaign` set:
   - `excluded_location_ids` — carve-outs. *Canada minus Quebec* = `countries: ["CA"]` + the Quebec **Province** id here.
   - `location_ids` — target sub-country places instead of (or on top of) countries. Only-some-provinces = those ids + `countries: []`.
   - `location_intent: "PRESENCE"` (Search) — only people physically in the target. Use it whenever the offer can't be bought from elsewhere; Google's default also reaches people merely searching *about* the place.
3. Already-built campaign? **`set_google_location_targeting`** `{ account_id, campaign_id, location_ids?, excluded_location_ids?, location_intent? }`. It is **additive** — it never removes a target or exclusion (that stays a human action in Google Ads).

Every id is verified at Google before anything is written; the create response echoes `excludedLocations` / `targetedLocations` by name — read them back to the user, and have them glance at the campaign's **Locations** tab before enabling.

### Audiences on Search — Observation by default

Search targets by keyword; audiences are a *bid lever*, not the targeting. `attach_google_audiences` works on Search ad groups (it reads the channel and behaves accordingly):

- **Observation (default, omit `mode`)** — reach unchanged; the audience only informs bids. Pair with `bid_modifier` (1.2 = +20% for past visitors / a remarketing list, 0.8 = −20%). This is Google's own UI default and what you want 95% of the time.
- **`mode: TARGETING`** — only people in the attached audiences see the ads. It starves a Search ad group; use it only when the user explicitly asks (e.g. a remarketing-only campaign).
- `optimized_targeting` is Demand Gen only and is rejected on Search. If the campaign sets its audience mode at the campaign level, Google won't accept an ad-group `mode` — attach without one or change it in Google Ads.
- The API's raw default for a fresh Search ad group is **Targeting** (the opposite of the UI), so granvl always writes the mode explicitly when audiences land on Search.

`list_google_audiences` lists what's attachable (custom segments + remarketing lists) for either channel. Not yet supported on Search: in-market / affinity segments, demographics, ad schedules, device bid adjustments, sitelinks and other assets — say so plainly when asked, and hand those to the user in Google Ads.

### The Search build — the 3-step flow (walk it conversationally, confirming each step before the write)

1. **`create_google_search_campaign`** `{ account_id, name, daily_budget_usd, countries, search_partners? }` — PAUSED Search campaign: own daily budget (guardrailed), **required** ISO alpha-2 `countries`, Maximize-clicks bidding, ValueTrack UTM suffix auto-applied.
2. **`create_google_ad_group`** `{ account_id, campaign_id, name, keywords, cpc_bid_usd? }` — the ad group + its keywords (1–100), each `{ text, match_type: BROAD | PHRASE | EXACT, cpc_bid_usd? }`. A keyword's own `cpc_bid_usd` overrides the ad-group bid for that keyword — **only under `MANUAL_CPC`** (automated strategies ignore it), guardrailed like every bid; `add_google_keywords` takes the same field. On a `MANUAL_CPC` campaign every keyword must end up with a bid — set the ad group's `cpc_bid_usd` as the default, or bid each keyword; an ad group with neither is refused (Google would silently fall back to a minimal bid and barely serve). **Prefer PHRASE/EXACT for lead-gen** — BROAD without conversion history burns budget on loose queries. Optional `cpc_bid_usd` sets a max-CPC cap (also guardrailed).
3. **`create_google_search_ad`** `{ account_id, ad_group_id, final_url, headlines, descriptions, path1?, path2? }` — the Responsive Search Ad. Google rotates the copy: **3–15 headlines (≤30 chars each) + 2–4 descriptions (≤90 chars each)** — supply the full spread, not one of each. Optional `path1`/`path2` (≤15 chars each) show as the display path. `final_url` is the PLAIN lander URL.

Then tell the user: the campaign is paused — review + activate in **Google Ads** (one switch does it; the ad group and ad underneath are already enabled).

### Ongoing management (the weekly loop)

- **Negatives hygiene** (highest-ROI recurring task): `get_google_search_terms` (worst spend first) → **classify every term's intent yourself before proposing anything** — label each `buying` (wants the product now), `research` (learning, comparing, "what is / how does"), or `junk` (jobs, free, DIY, wrong product, wrong geo) → propose `research` + `junk` terms as negatives, showing the label and spend beside each so the user can override → `add_google_negative_keywords` (campaign-level usually; ad-group-level to sculpt one theme). Never negative a `buying` term for low volume alone. Converting term clusters that don't fit any theme = a NEW STAG theme: new ad group + new lander.
- **Before proposing a budget raise**: `get_google_impression_share`. It answers the only question that matters here — are you capped by BUDGET or by RANK? Losing 10%+ to budget justifies more spend; losing it to rank does not (that's bids, quality, relevance), and raising budget buys nothing. Campaign level by default; ad-group level works too but `lostToBudget` is campaign-only in Google's API and comes back null.
- **Before adding negatives**: `get_google_negative_keywords` — reads all THREE places Google keeps them (campaign, ad group, shared lists). Skipping it means re-adding negatives that exist, and a keyword getting no traffic for no obvious reason is usually a shared-list negative you can't see from the campaign.
- **Keyword read**: `get_google_keywords` — per-keyword impressions / clicks / spend / conversions / match type, from the synced store (free) and falling back to a live report only when the store is cold. Pair it with the search-terms report: keywords are what you bid on, search terms are what you actually bought. Impression share and lost IS are NOT included — those live in the Google Ads UI.
- **Edits**: **campaign BUDGET changes need a person.** `update_google_campaign` with `daily_budget_usd` never touches Google — it queues a proposal (provide `reason`) that a workspace member applies or dismisses on the Google Ads page. Tell the user it's waiting for their approval; never retry or route around it. `update_google_campaign` still changes bidding (same harness — graduating to Max Conversions happens HERE once ~15+ conversions/30d exist) and pauses. `add_google_keywords` extends a theme (same-theme only; broad needs the override).
- **Pause is yours, enable is theirs**: pause underperformers proactively and say why; after ANY change you make, re-record with `record_ad_entities` (`source: 'agent'` + note) so change-mapped analytics capture it.

---

## Google Demand Gen campaigns — the Playbook (SANG)

Demand Gen = visual ads on Discover / YouTube / Gmail. Search CAPTURES demand
(keywords are the targeting); Demand Gen GENERATES it (audiences + creative are
the targeting). Different channel, same discipline.

**Doctrine: Search captures, Demand Gen scales.** DG works best amplifying an
offer that already converts. It's fine to run it cold — but say so, keep the
budget small, and treat it as creative/audience testing, not scaling.

### The two bidding recipes (no Manual CPC on DG)

| Recipe | When | How |
|---|---|---|
| **Maximize Clicks + CPC ceiling** | LAUNCH DEFAULT — testing audiences + creatives cheaply | `bid_strategy: MAXIMIZE_CLICKS` + `max_cpc_usd` (REQUIRED — rejected without one). DG clicks are curiosity clicks; the ceiling keeps Discover from billing you like Search. |
| **Max Conversions** | GRADUATION — ~15+ tracked conversions in 30 days | `confirm_conversion_tracking: true` only after the USER confirms the conversion action is imported. Optional `target_cpa_usd` once stable. |

Hard rules (server-enforced): final URLs on granvl domains must be LIVE; you
may PAUSE but never ENABLE; budget caps apply.

### Audiences — the whole game

An ad group with NO audiences attached = Google targets broadly with your
money. Never ship that silently. Three levers:

1. **Custom segments** (`create_google_custom_segment`) — keyword-based intent
   audiences ("people who searched these terms on Google"). THE bridge from
   Search research: `generate_keyword_ideas` → cluster into themes → one
   segment per theme. Create them EARLY (they take hours to populate).
2. **Remarketing lists** (`list_google_audiences` → `user_list_ids`) — site
   visitors, customer lists. Highest intent; use whenever lists exist.
3. **Optimized targeting** — `optimized_targeting: false` at launch keeps
   spend INSIDE your audiences (recommended); flip to true later to let Google
   expand once conversions flow.

### The SANG flow (Single Angle ad Groups — one audience theme, one lander)

STAG's sibling: one ad group per audience theme/angle, each with its own
message-matched lander, minted by granvl during planning.

1. **Intake**: offer, geo, budget, recipe. Confirm an ACTIVE domain (`list_domains`) and image creatives in the bucket (`list_ad_creatives`) — DG needs landscape 1.91:1 + square 1:1 minimum, portrait 4:5 recommended, plus a square logo ≥128×128. Missing creatives → `upload_ad_creative` first.
2. **Research**: `generate_keyword_ideas` → cluster into 2-4 audience THEMES (intent clusters, not single keywords). Check `list_google_audiences` for remarketing lists worth their own ad group.
3. **The Plan** (sign-off #1): themes, the custom-segment keywords per theme, creatives per theme, budget, recipe, the lander each theme gets. `save_campaign_draft`.
4. **Segments**: `create_google_custom_segment` per theme NOW (populate while you build).
5. **Landers**: one LANDING page per theme, headline matched to the ANGLE (pain-point / aspiration / social-proof — the variant `angle` metadata). DG visitors are colder than Search: lead with the hook, not the form.
6. **Sign-off #2 + publish**: `create_preview_link` → approval → `publish_funnel`.
7. **Build**: `create_google_demand_gen_campaign` (recipe rules apply) → one `create_google_demand_gen_ad_group` per theme with `custom_audience_ids` (+ `user_list_ids`) and `optimized_targeting: false` → `create_google_demand_gen_ad` (image pack + logo) and/or `create_google_demand_gen_video_ad` (YouTube-hosted URLs only — bucket videos can't be used). Plain final URLs; everything lands PAUSED.
8. **Close the loop**: `get_tracking_health`; hand off ("activate in Google Ads when ready").

### The Demand Gen build — the 3-step flow (visual ads on Discover / YouTube / Gmail)

1. **`create_google_demand_gen_campaign`** `{ account_id, name, daily_budget_usd, countries }` — PAUSED Demand Gen campaign, same guardrails as Search.
2. **`create_google_demand_gen_ad_group`** `{ account_id, campaign_id, name }` — **no keywords** — Demand Gen targets audiences, not queries. Attach targeting here: `custom_audience_ids` (+ `user_list_ids`), `optimized_targeting: false` recommended at launch.
3. **`create_google_demand_gen_ad`** `{ account_id, ad_group_id, final_url, business_name, headlines, descriptions, creative_ids, logo_creative_id, call_to_action_text? }` — the multi-asset IMAGE ad. Provide bucket `creative_ids` (`upload_ad_creative` first; auto-bucketed by aspect — landscape 1.91:1 / square 1:1 / portrait 4:5; 9:16 vertical errors). REQUIRED: a **square logo** creative (**≥128×128**) via `logo_creative_id`, `business_name` (**≤25 chars**), **1–5 headlines (≤40 chars each)**, **1–5 descriptions (≤90 chars each)**; optional `call_to_action_text` (e.g. "Get quote"). **Bucket videos are rejected** with a clear error — Google requires YouTube-hosted video for DG video ads; use `create_google_demand_gen_video_ad` with a YouTube URL, or images.

Then tell the user: the campaign is paused — review + activate in **Google Ads** (one switch does it; the ad group and ad underneath are already enabled).

### Ongoing management (DG weekly loop)

No search-terms report here — the levers are CREATIVE and AUDIENCE:
- `get_creative_performance` / `get_ad_breakdowns` per ad group: kill image packs with spend + no engagement, feed winning angles back into new creatives AND lander variants (same angle, both sides).
- Compare ad groups (= audience themes) on CPL from `get_spend_summary`: losing theme → pause it (say why); winning theme → deepen its segment keywords or add a lookalike-ish broader segment.
- Graduate bidding here too: ~15+ conversions/30d → `update_google_campaign` to MAXIMIZE_CONVERSIONS (harness asks for the confirmation again).
- After ANY change, `record_ad_entities` (`source: 'agent'` + note).
