# Granvl — Microsoft Ads (Bing) Search

Microsoft Advertising (Bing + Yahoo + DuckDuckGo + Edge/Windows surfaces) is the third connected platform. Treat it as **Google Search's sibling**: same STAG recipe, same slot limits, usually 20–40% cheaper CPCs with older/higher-income demographics. The classic move is to CLONE a proven Google Search structure here rather than invent a new one. Read [../SKILL.md](../SKILL.md) for the universal paid-ads invariants and [GOOGLE-ADS.md](./GOOGLE-ADS.md) for the STAG playbook this mirrors.

**Connect:** the user connects Microsoft Advertising from the dashboard's Ads page, same as Google.

## What transfers 1:1 from the Google playbook

- The three bidding recipes (Max Clicks + ceiling → launch default; Manual/Enhanced CPC; Max Conversions only after the user confirms a UET conversion goal with volume — `confirm_conversion_tracking: true`, never set it unprompted).
- STAG structure: one theme per ad group, phrase/exact keywords, one lander per theme.
- The one-switch status rule, same as Google: a new campaign is created **Paused** and is the switch, and the ad groups, ads and keywords you build inside it go in **Active**; a new ad group in an old campaign (active, has ever delivered, or not granvl's) is created **Paused** and becomes the switch; an ad or keyword added to an existing ad group that is not provably new and off is **Paused**. Microsoft has no synchronous lifetime-delivery read, so its delivery history is granvl's synced warehouse. You may pause, never enable.
- RSA copy limits are IDENTICAL (3–15 headlines ≤30 chars, 2–4 descriptions ≤90 chars) — reuse the Google copy spread verbatim on the first provide.
- Plain `final_url`s — the campaign-wide Microsoft UTM suffix ({CampaignId} macros) is applied automatically.
- The budget guardrail: `daily_budget_usd` (and any bid) is capped at min(workspace admin's cap, granvl's **$200/day** platform ceiling) before any write.

## The build

`create_microsoft_search_campaign` → `create_microsoft_ad_group` (keywords) → `create_microsoft_search_ad` → `get_tracking_health` → tell the user which ONE switch to flip in Microsoft Ads (`status_decision.off_switch`).

1. **`create_microsoft_search_campaign`** — PAUSED Search campaign: daily budget (guardrailed), country targeting, chosen bidding strategy (default Maximize Clicks). It is the one switch: the user turns it on in Microsoft Ads.
2. **`create_microsoft_ad_group`** — the ad group + its keywords, phrase/exact preferred. `add_microsoft_keywords` extends a theme later (same-theme only; BROAD needs `allow_broad_match: true` after an explicit user choice).
3. **`create_microsoft_search_ad`** — the RSA: 3–15 headlines (≤30 chars), 2–4 descriptions (≤90 chars), PLAIN `final_url` (the UTM suffix is automatic). `copy_warnings` in the result is granvl's offline copy review for Microsoft and the ad category (rate and APR claims need the full terms on the page, healthcare copy must address adults, editorial rules, the landing-page disclosures for credit and lending); the ad is built either way, so read them to the user and fix the copy where they apply.

Names follow SKILL.md "Naming": the campaign in Title_Case with underscores (`AC_Repair_Phoenix_Search`), ad groups in snake case (`ac_repair_phoenix`). A name off the convention is created as given and comes back with `naming_note`.

## LinkedIn targeting (the B2B lever)

Microsoft owns LinkedIn, and Microsoft Ads is the ONLY search platform where you can bid on the searcher's professional profile: **company, industry, and job function**. For any B2B funnel this is the reason to run Microsoft at all.

**Boost, not filter.** On Search campaigns LinkedIn criteria are bid adjustments (-90% to +900%), never hard targeting. Someone outside the profile still sees the ad; you just pay up for the right people. So: keywords do the filtering, LinkedIn boosts steer the budget.

The flow:

1. **Look up profile ids.** `list_linkedin_profiles { profile_type: INDUSTRY | JOB_FUNCTION }` returns the full stable lists (~150 industries with groups, ~30 job functions). For named-account (ABM) plays, `search_linkedin_companies { query }` finds company profile ids by name.
2. **Apply boosts.** `set_microsoft_linkedin_targeting { campaign_id | ad_group_id, criteria: [{ profile_type, profile_id, bid_boost_pct }] }`. Campaign level is the usual scope; ad-group level for theme-specific steering.
3. **Pick boosts by intent strength**, not vibes:
   - Target industries / job functions: **+100 to +300**.
   - Named target accounts (ABM lists): **+300 to +600**.
   - Actively wrong fits you can name (e.g. Staffing & Recruiting when you sell to employers): **-50 to -90**.
   - Start conservative; you can re-run the tool to adjust. Boosts multiply with the bidding strategy, so a +900 on Max Clicks with a $5 ceiling can bid toward $50 — mention the effective max to the user.
4. **Tell the user where to watch it**: Microsoft Ads → campaign → Demographics shows delivery split by company/industry/job function, which proves whether the boosts are pulling the right crowd.

A good B2B recipe: tight PHRASE/EXACT keywords for the pain, +200 on the 3–5 target industries, +150 on the buying job functions (e.g. Human Resources, Operations, Finance), -80 on obvious non-buyers. Keep the campaign PAUSED handoff exactly as usual.

## Keyword research + optimization data

- **`generate_microsoft_keyword_ideas`** `{ account_id, keywords?, page_url?, countries?, limit? }` — Microsoft's own planner (volume, competition, suggested bid). LIVE vendor call, rate-limited. `suggestedBid` is in the ACCOUNT's currency, not always USD.
- **`get_microsoft_search_terms`** `{ account_id, campaign_id?, ad_group_id? }` — what people actually typed. Reads the SYNCED store (no live report, no quota cost). Microsoft uniquely reports the **matched keyword** per term, so you can see which keyword pulled which junk query → `add_microsoft_negative_keywords` (PHRASE/EXACT only).
- **`get_microsoft_keywords`** `{ account_id, campaign_id?, ad_group_id? }` — per-keyword performance from the same synced store.

Both store-backed reads depend on the sync having run. Empty result ≠ no data: tell the user to hit **Sync now** on the Microsoft ads page and retry.

**For a NEW build, prefer cloning over researching.** If the workspace already has a winning Google Search campaign, port its structure (themes, keywords, negatives, RSA copy) into Microsoft rather than starting from planner data — Microsoft mirrors Google intent closely and the proven structure is worth more than fresh volume estimates. Use the keyword-ideas tool to *extend* the cloned set, not to originate it.

## Location targeting (presence, and carve-outs)

Two controls that decide who actually sees the ad. Both matter more than they sound.

**`location_intent` — presence vs intent.** Microsoft's default is `PEOPLE_IN_OR_SEARCHING_FOR`, which also serves someone in another country searching *about* your target market. For anything geography-bound — a licensed service, a province-specific offer, a local trade — that spends money on people who can never buy. Provide **`location_intent: "PEOPLE_IN"`** to require the searcher actually be there. Set it on `create_microsoft_search_campaign`, or on an existing campaign with `set_microsoft_location_targeting`.

**`excluded_location_ids` — carving a region out.** `countries` targets whole countries; to exclude a province/state/city (the classic being Quebec out of a Canada campaign, for language or regulatory reasons) provide its Microsoft LocationId.

**Always resolve ids with `search_microsoft_locations`.** Never hand-write one. Microsoft's location ids are their own id space, and a wrong id excludes the *wrong region* while the campaign still looks perfectly targeted — a silent miss you'd only catch in the geo report weeks later. Scope with `country_code`, since place names repeat across countries, and check `canonicalName` before picking: results are ranked broadest-first so a province outranks a same-named city, but confirm.

```
search_microsoft_locations { account_id, query: "Quebec", country_code: "CA" }
  → [{ locationId: "20438", name: "Quebec", canonicalName: "Quebec,Canada", locationType: "Province" }, …]

create_microsoft_search_campaign {
  …, countries: ["CA"], excluded_location_ids: ["20438"], location_intent: "PEOPLE_IN"
}
```

`set_microsoft_location_targeting` is **additive** — it adds criteria, so *removing* an existing target is still a Microsoft Ads UI job. Setting `location_intent` on a campaign that already carries one fails (Microsoft adds a default); change that one in the UI.

## Restricted ad categories on Microsoft

Declare `ad_category` (NONE included; you classify the offer, SKILL.md "Restricted ad categories") on `create_microsoft_search_campaign` unless the brand or the funnel of `landing_page_url` already declares one; tighten it later with `update_microsoft_campaign`. Microsoft's rule is broader than Google's and has no country limit: ads for housing, employment, insurance (health insurance included), credit and other financial services must not be targeted by ZIP code, age, gender or language, so granvl refuses `PostalCode` targets for those categories (`search_microsoft_locations` marks them with `restricted_for`) and bans income targeting for financial and insurance ads. Microsoft prohibits political ads; granvl won't build them. Debt relief needs Microsoft's Financial Services Advertising program approval, and lead generators may only run comparison ads; addiction recovery is US-only, needs LegitScript, and Microsoft doesn't allow lead generation ads for it. granvl refuses both when the funnel sends its leads to a lead-distribution destination. Gambling and dating need Microsoft's licence check / pre-approval, confirmed by an Owner or Admin in granvl (`attestations_needed`). Full rules: SKILL.md "Restricted ad categories".

## Microsoft differences worth knowing

- Negative keywords support only PHRASE and EXACT (`add_microsoft_negative_keywords`) — no broad negatives.
- `countries` currently supports US / CA / GB / AU — ask before assuming another market works. Sub-country targeting has no such limit: resolve any place with `search_microsoft_locations`.
- Conversion tracking is the UET tag (domain-level, Settings → Tracking) — there is no GA4-import equivalent; Max Conversions optimizes against UET goals only.
- **A UET tag is not conversion tracking.** granvl fires exactly one UET event, action `lead`. Microsoft only counts a conversion when an Event goal matches it (operator Equals). Its own goal wizard suggests names like `submit_lead_form`, which looks right, matches nothing, and reports zero conversions forever while the tag, the pages, and the goal all read as configured. Run `get_microsoft_conversion_goals` before recommending MAXIMIZE_CONVERSIONS or diagnosing "no conversions in Microsoft"; if nothing matches, have the user create an Event goal with Action = `lead`.
- **Read before you write targeting.** `set_microsoft_location_targeting` is ADDITIVE — Microsoft keeps whatever criteria are already there. `get_microsoft_campaign_settings` with `include_targeting: true` shows the current targets, exclusions and intent option, so you can tell an exclusion you already added from one you still need. It also surfaces budget, bidding, languages and whether granvl's UTM suffix is present (missing = spend won't join first-party data).
- `get_microsoft_audiences` lists remarketing / in-market / customer-list audiences with their ids and sizes. Anything under ~1000 is flagged `tooSmallToServe`: Microsoft won't serve against it, so targeting it reaches nobody while looking configured.
- Editing a live campaign is `update_microsoft_campaign` (bidding or pause; a `daily_budget_usd` is queued for a person to approve on the Microsoft Ads page, same as Google). There is no enable — going live stays a human action in Microsoft Ads.
- Search terms + keyword stats come from granvl's SYNCED store (see above), so they're only as fresh as the last sync — not a live report.
