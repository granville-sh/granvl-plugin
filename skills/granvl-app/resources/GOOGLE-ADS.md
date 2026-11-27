# Granvl — Google Ads (Search + Demand Gen)

granvl's opinionated playbooks and build flows for Google Search and Google Demand Gen campaigns. Read [../SKILL.md](../SKILL.md) first for the universal paid-ads invariants (the one-switch status rule, budget caps, pause-yes / enable-never).

**Connect:** the user connects a Google login from the **Ads page settings** ("Connect Google"). Connected Google Ads accounts + spend sync into the **same dashboard** as Meta — list accounts via the Ads switcher; spend/CPL joins (`get_spend_summary`, `get_ad_to_lander_performance`, …) work identically.

**Invariants (both flows, server-enforced — same posture as the Meta build):**

- **Restricted ad categories.** Declare `ad_category` (NONE included; you classify the offer, SKILL.md "Restricted ad categories") on `create_google_search_campaign` / `create_google_demand_gen_campaign` unless the brand or the funnel of `landing_page_url` already declares one, with `ad_category_countries` when it differs from the campaign's countries; tighten it later with `update_google_campaign`. granvl stores it per campaign and checks every later step against it (ad groups, ads, audiences, locations), tightening from the ad's landing-page funnel when that is stricter. Housing, employment, credit, banking and debt relief: no ZIP `location_ids` and no age / gender / parental / marital targeting in the US and Canada; Canadian FSAs (M5J) are fine, and household income / homeownership are allowed with a warning. Insurance and health insurance keep age and gender on Google (insurance isn't named), but the category is sensitive. Sensitive-interest categories (debt relief, health, addiction, gambling, alcohol): Google doesn't support Customer Match, remarketing lists, lookalikes or optimized targeting, and Demand Gen may not serve; granvl attaches what you pass and returns Google's own words if it refuses. Political ads aren't built on Google. Certification categories return `attestations_needed` for an Owner or Admin to confirm in granvl. Full rules: SKILL.md "Restricted ad categories".
- **Google's own policy labels.** After a build, the sync reads Google's policy summary for every ad Google does not plainly approve, and the account's advertiser verification once a day. `get_ad_health` returns them as `policy` (disapproved / limited ads with the topic, the countries and what to do; verification deadlines). When Google's topic clearly names a restricted category, granvl tightens the campaign's stored category to it (never looser). A missing certificate is the advertiser's to get from Google; once the account holds it, an Owner or Admin confirms it in Settings → Compliance.
- **One switch (server-decided).** A new campaign is always created **PAUSED** and is the one switch: ad groups, ads and keywords you create inside it go in **ENABLED** (the result says `status: ACTIVE`) while it stays paused and has never delivered. A new ad group inside an **old** campaign (enabled, has ever delivered even if paused now, or not created by granvl) is created **PAUSED** and becomes the switch; the ads and keywords you then add to it go in enabled. An ad or keyword added to an existing ad group that is not provably new and off is created **PAUSED**. Any check granvl cannot read means PAUSED; `status_reason` / `status_decision.off_switch` on every result say which. There is deliberately no activate tool; activation is always the human's action. Close every build by telling the user which switch to flip.
- **Budget guardrail:** `daily_budget_usd` (and any bid) is capped at the lower of the workspace admin's cap and granvl's **200 USD per day** platform ceiling BEFORE any write — an over-cap request returns the cap in the error; relay it, NEVER work around it.
- **Plain URLs, never pre-tagged:** granvl's Google UTM template (**ValueTrack** ids) is applied as the **Final URL suffix** — campaign-wide AND on each ad's own Ad URL options — so spend joins first-party conversions automatically — every `final_url` you provide stays PLAIN.

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

> **Shortcut:** when `plan_search_campaign` is in your tool list, call it first — it does steps 1–2 below (research, intent filter, themes, CPC, negatives) server-side and returns the structure to build. Fall through to the manual recipe only when it is not available.


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

1. **`create_google_search_campaign`** `{ account_id, name, daily_budget_usd, countries, ad_category, landing_page_url?, search_partners? }` — PAUSED Search campaign: own daily budget (guardrailed), **required** ISO alpha-2 `countries`, Maximize-clicks bidding, ValueTrack UTM suffix auto-applied.
2. **`create_google_ad_group`** `{ account_id, campaign_id, name, keywords, cpc_bid_usd? }` — the ad group + its keywords (1–100), each `{ text, match_type: BROAD | PHRASE | EXACT, cpc_bid_usd? }`. A keyword's own `cpc_bid_usd` overrides the ad-group bid for that keyword — **only under `MANUAL_CPC`** (automated strategies ignore it), guardrailed like every bid; `add_google_keywords` takes the same field. On a `MANUAL_CPC` campaign every keyword must end up with a bid — set the ad group's `cpc_bid_usd` as the default, or bid each keyword; an ad group with neither is refused (Google would silently fall back to a minimal bid and barely serve). The group and its keywords are created in **one atomic call** — if Google rejects a keyword, nothing is created and the error names it; there is never an empty ad group to clean up. Freshly created campaigns/ad groups show up in `get_ad_entities` after the next sync; the ids returned here are the source of truth until then. **Prefer PHRASE/EXACT for lead-gen** — BROAD without conversion history burns budget on loose queries. Optional `cpc_bid_usd` sets a max-CPC cap (also guardrailed).
3. **`create_google_search_ad`** `{ account_id, ad_group_id, final_url, headlines, descriptions, path1?, path2? }` — the Responsive Search Ad. Google rotates the copy: **3–15 headlines (≤30 chars each) + 2–4 descriptions (≤90 chars each)** — supply the full spread, not one of each. Optional `path1`/`path2` (≤15 chars each) show as the display path. `final_url` is the PLAIN lander URL. The result's `copy_warnings` is granvl's offline copy review for Google and the ad category (no "!" in headlines, no "click here", no unverified "#1", no implied affiliation, no wording that pulls the ad into a sensitive-interest category such as "bad credit OK", the category's own tells, and the landing-page disclosures for credit and lending). The ad is built either way: read them to the user and fix the copy where they apply. The same review runs on `create_google_demand_gen_ad` and `create_google_demand_gen_video_ad`.

Then tell the user which switch to flip, from `status_decision.off_switch`: for a new campaign, review + turn **the campaign** on in **Google Ads** (the ad group and ad underneath are already enabled); for an ad group you added to an existing campaign, turn **that ad group** on.

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

### Audiences — the whole game (build from the audience library)

An ad group with NO audiences attached = Google targets broadly with your
money. Never ship that silently.

**Start from the library.** `list_google_audiences` with
`include: ["library"]` returns granvl's audience library for the account's
brand, each with an `id` (pass it as `audience_ids`), its `kind`, `source`,
ICP / angle, size, where it is live, and a `compliance` label for the
account's ad category:
- **imported**: the account's existing custom segments and lists (granvl
  mirrors them on every Demand Gen sync and on this read; Customer Match lists
  show as source `crm`);
- **granvl's**: anything `create_google_custom_segment` made;
- **drafts suggested from research** (status `draft`): the report's
  bottom-of-funnel keyword themes → one search segment each; competitor
  websites → a sites segment; customer phrases (the report's language bank, an
  ICP's language to mirror) → an interest segment; ICP buying triggers →
  life-event and in-market suggestions. A draft is a suggestion: nothing exists
  on Google until a build or a create call uses it.
Add `include: ["taxonomy"]` with a `query` ("mortgage", "moving") for Google's
in-market, affinity, life event and detailed demographic ids (pass as
`taxonomy_ids`), and `"performance"` for each audience's latest call.

The levers on `create_google_demand_gen_ad_group` / `attach_google_audiences`:
1. **`audience_ids`** (library ids): a custom segment with no copy on this
   account is CREATED on Google on first use from its definition (they take
   hours to populate: build early). Lists and lookalikes live in one Google
   account and are never copied.
2. **`taxonomy_ids`**: `user_interest:<id>` (in-market, affinity) and
   `life_event:<id>`. Detailed demographics can't be attached by granvl yet
   (they need Google's grouped Audience resource): say so and set them in
   Google Ads if the user wants them.
3. **`excluded_user_list_ids`**: exclude converters and existing customers
   from prospecting cells (only lists can be exclusions on Google).
4. **Optimized targeting**: `optimized_targeting: false` at launch keeps
   spend INSIDE your audiences (recommended); flip to true later to let Google
   expand once conversions flow.
`custom_audience_ids` / `user_list_ids` (raw Google ids) still work.

**Making new audiences** (`create_google_custom_segment`, returns the library
`audience_id`): `keywords` (type SEARCH, the bridge from Search research:
`generate_keyword_ideas` → themes → one segment per theme), `urls`
(competitors' sites) or `apps`; `type: "INTEREST"` is sent as AUTO (Google no
longer creates INTEREST segments). `kind: "site_visitors"` + `url_rules` makes
a rule-based list of people who visited matching URLs (e.g. the thank-you page:
an exclusion and a lookalike seed; it needs the Google tag on the site).
`kind: "lookalike"` + `seed_user_list_ids` (lists ALREADY in the account) +
`expansion` (narrow / balanced / broad) + `countries`. Or `audience_id` to
create a library draft as defined. Name every new audience in snake case, in
this order: `{brand}_{icp}_{kind}_{theme}_v1` (e.g.
`acme_homeowners_35_54_search_roof_repair_v1`; SKILL.md "Naming"). Library
drafts granvl generates are named this way already.

**What granvl will not do.** It never uploads a customer list, a hashed email
or any personal data (granvl stays out of the data path): customer lists and
CRM-pushed lists are the customer's to build in their own Google account, and
granvl attaches what exists. It never gates an audience by ad category: the
`compliance` label and the result's `ad_category.warnings` are warnings, and
when Google refuses an audience its own message comes back verbatim. Tell the
user what the warning says; don't look for a way around Google's answer.
For the sensitive-interest categories (debt relief, health, addiction,
gambling, alcohol) Google says Customer Match, your-data segments,
lookalikes and optimized targeting aren't supported (label
`blocked_by_platform`): lean on custom segments and in-market audiences.
Lookalikes act as suggestions now (they widen reach), so they are never a
test variable.

### Demand Gen - the audience x creative test (manual, today)

On Demand Gen the campaign holds the budget and bidding, the ad group holds
the audience and the channels, and the ad is a pack of assets Google mixes.
So the test unit is **audience x concept**, and **a campaign with ONE ad
group is the Demand Gen "ad set"**: one budget, one audience, one cell (the
live account that spends on Demand Gen converged on exactly this). Every
cell is judged on **granvl's first-party leads** (what landed), not Google's
conversion count: Google's includes engaged-view and modelled conversions and
runs about 2x higher. Say which number you judge by.

**Before building:** a LIVE granvl lander (`publish_funnel`);
`get_google_conversion_actions` shows an action that counts granvl leads; a
qualification rule on the funnel (`set_qualification_rule`) so cells can be
judged on qualified leads too; images in the bucket at 1.91:1, 1:1, 4:5 and
9:16 (at least one landscape or square) plus a square logo of at least
128 px; for video, videos in the bucket (the default: granvl uploads them to
YouTube, unlisted, on the Google-managed channel), or the user's own YouTube
links when they have them.

**Structure by budget**
- **$100-200/day:** TWO or THREE campaigns, ONE ad group each (at least
  $40/day per campaign). Each campaign is one test cell, like an ABO ad set
  on Meta. Optionally a 10-15% retargeting campaign once a site-visitor list
  has 1,000+ users, kept out of the test, converters excluded.
- **$50-99/day:** ONE campaign, TWO ad groups, one audience each. Google
  moves spend to the ad group it predicts will win; an ad group under about
  25% of the spend after 7 days is "untested", not "lost", and gets its own
  campaign next round.
- Name every cell by the convention (SKILL.md "Naming"), its parts in this
  order: the campaign `DG_{Offer}_{Audience}_{Concept}_{YYYYMMDD}` in
  Title_Case (`DG_Roof_Replacement_Roof_Repair_Searchers_Storm_Calendar_20261110`),
  the ad group `{audience}_x_{concept}` in snake case
  (`roof_repair_searchers_x_storm_calendar`). Save the plan with
  `save_campaign_draft`.

**Phase 1 - test audiences, hold the creative constant**
1. Audiences, one per cell, from the library (`list_google_audiences`
   `include: ["library"]`): A = the research's strongest bottom-of-funnel
   search draft; B = a second theme, the competitor-sites draft, or the ICP's
   buying-trigger audience. Prefer `compliance: allowed`; read any warning to
   the user. Keep remarketing lists out of the test; run them as their own
   small campaign later.
2. One `create_google_demand_gen_campaign` per cell (or one campaign below
   $100/day; a phone-only or computer-only cell sets `devices` on its
   campaign, see the build below), then `create_google_demand_gen_ad_group` with
   `audience_ids: [<one library id>]` (its custom segment is created on
   Google on first use; build early, it takes hours to populate),
   `excluded_user_list_ids` for converters / customers,
   **`optimized_targeting: false`** (otherwise the cell measures "audience +
   Google's expansion"), and
   `channel_strategy: "ALL_OWNED_AND_OPERATED_CHANNELS"` for image ads.
3. **The same ad in every cell**: `create_google_demand_gen_ad` with identical
   `creative_ids`, headlines (5 x 40 chars max), descriptions (5 x 90 max),
   logo and business name. granvl records which bucket creative became which
   Google asset, so `get_creative_performance` can read it back. Video goes
   in its own ad group (YouTube Shorts / in-feed channels), never mixed into
   the image test.
4. Bidding: Max Clicks + `max_cpc_usd` at launch, or Max Conversions with no
   target once the conversion action is confirmed.
5. Status (the one-switch rule): each new campaign is created **PAUSED** with
   its ad group and ad **enabled** inside it, so the campaign is the only
   switch. The user turns the campaigns on in Google Ads, together, so the
   cells start on the same day.

**Reading (weekly, from day 7)**
- Start with the calls: `get_ad_breakdowns` with `platform: "GOOGLE"`,
  `dimension: "audience"`, the last 30 days (`since` / `until`). It returns
  the same Audiences level as the Google Insights page (Decision matrix,
  Campaign type Demand Gen, the Audiences tab): one row per audience across
  its ad groups, each with its `call` and `reason`, judged on the account's
  ceiling with the Demand Gen criteria (Set criteria, Demand Gen section):
  - **Untested**: under 30 clicks, or under 2x the ceiling spent, in its
    first 7 days. Never cut an untested cell.
  - **Off**: over the ceiling on 14 AND 30 days. Pause its cell (say why).
  - **Bench**: under the ceiling over 30 days, over it in the last 14: a
    fading winner. Refresh the concept before cutting it.
  - **Scale**: at least 5 leads in 14 days under the ceiling. Raise its
    campaign budget at most 20% (`update_google_campaign` queues a proposal
    the user approves), at least 7 days between raises.
  - **Keep**: everything else under the ceiling.
  - **Mixed ad group**: the audience shares its ad group with other
    audiences, so granvl's leads can't be split (`granvlLeadsShared`; no
    click macro names the matched audience). It is not judged: move it into
    its own cell. This is why a cell carries ONE audience (or one Google
    grouped audience).
  Leads are **granvl first-party leads** by default (`audiences.judgeBy`);
  when no granvl lead joined in 30 days the calls fall back to Google's
  conversions (`audiences.firstPartyFallback`; fix the tracking first).
  Google's conversions only judge days at least 2 days old.
- Read `audiences.warnings` every week: the same audience live in two
  cells (their reads are not independent), a your-data list one cell
  retargets not excluded from a prospecting cell, keyword segments sharing
  half their keywords. Fix these before trusting a call.
- `audiences.expansion`: with optimized targeting on, the ad group total
  minus its audience rows, an estimate. Test cells keep optimized targeting
  off; a large expansion share means the cell is measuring Google's reach,
  not the audience.
- Per cell totals: `get_spend_summary` (ad group rows: spend, granvl leads,
  qualified, CPL / CPQL). On the Insights page the Ad groups level judges
  each Demand Gen ad group on the same rules and shows its channel lens.
- Audience x concept: the Audiences tab's "Audience x concept" view (rows
  audiences, columns the ads by concept; empty cells never ran).
  `get_ad_breakdowns` `dimension: "audience"` + `level: "ad_group"` gives
  the audience x ad group grid.
- Channels: `get_ad_breakdowns` `dimension: "channel"` (Discover / Gmail /
  YouTube in-stream / in-feed / Shorts, per ad group with `level`), and
  `get_segmented_stats` with `dimension: placement` for the first-party side
  (youtube / gmail; empty is Discover, an approximation).
- Google's count vs granvl's: `get_ad_breakdowns`
  `dimension: "attribution_event"` splits Google's conversions into
  interaction / engaged view / impression. The no-click part is real to
  Google and invisible to granvl; it is why the two numbers differ.
- What a cell targets, and since when: `list_google_ad_groups` returns each
  Demand Gen ad group's `targeting` (audiences, optimized targeting,
  channels, `since`).
- Creative: `get_creative_performance` with `platform: "GOOGLE"` (Google's
  per-asset numbers for each bucket creative; first-party leads are per ad,
  so they show as `sharedConversions`; `by_asset: true` lists every asset of
  every ad with Google's rating).
- Say which number each call used (granvl leads or Google conversions). One
  change per cell per week; never change the goal and the budget together.

**Phase 2 - test creative inside the winning audience**
- A new cell (campaign) with the winning audience and the NEW concept, same
  budget; the old cell keeps running as the control. Judge as above.

**Then consolidate**
- The winning audience + concept become the scale campaign. Only after about
  30 conversions in 30 days: `attach_google_audiences` with
  `optimized_targeting: true`, and graduate bidding (`update_google_campaign`).
- If one channel's granvl CPL is over 2x another's (YouTube often is), give
  video its own campaign or drop that channel from the image ad groups.

**Regulated offers** (mortgage, credit, loans, banking, housing, jobs): no
age, gender, parental or marital status, or ZIP / postal narrowing (Canada
may use the 3-character FSA), no demographic exclusions; city, country and
radius targeting are fine. **Insurance** is a sensitive category but Google
does not name it in consumer finance, so age targeting stays available on
Google (Meta and Microsoft restrict it): say it is sensitive. For debt
relief or credit repair offers: no remarketing lists, no lookalikes, no
optimized targeting, and expect Demand Gen to serve poorly or not at all.
Say so before building. The library's `compliance` labels say this per
audience; they are warnings, never a block.

**After every change:** `record_ad_entities` (`source: 'agent'` + note).
After every call: `save_learning` with the audience, the concept, the metric
(granvl leads or Google conversions) and the numbers, losers too.

### The Demand Gen build — the 3-step flow (visual ads on Discover / YouTube / Gmail)

1. **`create_google_demand_gen_campaign`** `{ account_id, name, daily_budget_usd, countries, ad_category, landing_page_url?, location_ids?, excluded_location_ids?, languages?, targeting_level?, devices? }` — PAUSED Demand Gen campaign, same guardrails as Search. By default location **and language** targeting live on the campaign (every ad group inherits them): `languages` takes ISO 639-1 codes (`["en"]`, `["en","fr"]`); omit for all languages. Budget, campaign and criteria are created in one atomic call — a rejected criterion creates nothing. `targeting_level: "ad_group"` opts into Google's upgraded targeting: the campaign carries no geo and granvl puts the same locations and languages on every ad group it builds there (immutable after create; only when the user wants geo per ad group).
   **Devices:** `devices` picks where the campaign may serve, from `MOBILE` (mobile phones), `DESKTOP` (computers), `TABLET`, `CONNECTED_TV` (TV screens). Omit it (or list all four) for every device, Google's default. A subset (`["MOBILE"]` for a phone-only test, `["DESKTOP"]` for computer-only) opts the other devices out on the campaign, at either `targeting_level` (Google keeps device targeting on the campaign), in the same atomic create: if Google refuses it, nothing is created and the error says so; run again without `devices` only if the user agrees to set Devices in Google Ads by hand before turning the campaign on. The result's `devices` / `devicesOptedOut` say what was applied; relay them. `devicesApplied: false` means Google did not confirm the restriction: the message leads with that, and the campaign must not be turned on until Devices is set in Google Ads. Some traffic Google reports as "Other" devices can still appear. Device bid adjustments (for example -30% on tablets) are not offered: Google does not support them on Demand Gen.
2. **`create_google_demand_gen_ad_group`** `{ account_id, campaign_id, name }` — **no keywords** — Demand Gen targets audiences, not queries. Attach targeting here: `audience_ids` (library ids; + `taxonomy_ids`, `excluded_user_list_ids`, or raw `custom_audience_ids` / `user_list_ids`), `optimized_targeting: false` recommended at launch. **Channels** (where the ads show) are per ad group: omit for all channels; `channel_strategy: "ALL_OWNED_AND_OPERATED_CHANNELS"` drops third-party Display; or pick `channels: [...]` from `YOUTUBE_IN_STREAM, YOUTUBE_IN_FEED, YOUTUBE_SHORTS, DISCOVER, GMAIL, DISPLAY, MAPS` (e.g. a Shorts-only ad group for 9:16 video).
3. **`create_google_demand_gen_ad`** `{ account_id, ad_group_id, final_url, business_name, headlines, descriptions, creative_ids, logo_creative_id, call_to_action_text? }` — the multi-asset IMAGE ad. Provide bucket `creative_ids` (`upload_ad_creative` first; auto-bucketed by aspect from the stored dimensions, which are measured on upload — landscape 1.91:1 / square 1:1 / portrait 4:5 (1080×1350) / vertical 9:16 (1080×1920, at least 600×1067); at least one landscape or square; up to 20 across ratios). REQUIRED: a **square logo** creative (**≥128×128**) via `logo_creative_id`, `business_name` (**≤25 chars**), **1–5 headlines (≤40 chars each)**, **1–5 descriptions (≤90 chars each)**; optional `call_to_action_text` (e.g. "Get quote"). Bucket videos don't go here: use `create_google_demand_gen_video_ad` (the video variant below).

   **Video variant: `create_google_demand_gen_video_ad`** `{ account_id, ad_group_id, final_url, business_name, headlines, long_headlines, descriptions, logo_creative_id, creative_ids?, youtube_urls? }`. Videos come from two sources, in this order:
   - **Default: `creative_ids`**, bucket videos (`upload_ad_creative`; 10 seconds or longer to run in-stream). granvl uploads them to YouTube through the Google Ads API, unlisted, on the Google-managed channel linked to the ad account.
   - **`youtube_urls`** only when the user gives a YouTube link or asks to use their own channel (their videos there, public or unlisted).
   - Both can be mixed, 1-5 videos in total. Same copy limits as the image ad, plus 1-5 long headlines (at most 90 characters each).
   - YouTube processing takes minutes, so a call with `creative_ids` can return `pending: true` with no ad: call it again with the same arguments a few minutes later and granvl reuses the uploads (nothing is uploaded twice).

Then tell the user which switch to flip, from `status_decision.off_switch`: for a new campaign, review + turn **the campaign** on in **Google Ads** (the ad group and ad underneath are already enabled); for an ad group you added to an existing campaign, turn **that ad group** on.

### Ongoing management (DG weekly loop)

No search-terms report here; the levers are AUDIENCE, CREATIVE and CHANNEL,
read as in "Reading" above: the weekly read is `get_ad_breakdowns`
`dimension: "audience"` (calls, shared flags, expansion, warnings), then the
channel and attribution reads. Judge by granvl leads by default, name the
number you use, pause an Off cell (say why), deepen a winning audience's
segment keywords, and graduate bidding at about 15+ conversions in 30 days
(`update_google_campaign` to MAXIMIZE_CONVERSIONS; the harness asks for the
confirmation again). After ANY change, `record_ad_entities` (`source:
'agent'` + note).
