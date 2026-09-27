# Granvl — Microsoft Ads (Bing) Search

Microsoft Advertising (Bing + Yahoo + DuckDuckGo + Edge/Windows surfaces) is the third connected platform. Treat it as **Google Search's sibling**: same STAG recipe, same slot limits, usually 20–40% cheaper CPCs with older/higher-income demographics. The classic move is to CLONE a proven Google Search structure here rather than invent a new one. Read [../SKILL.md](../SKILL.md) for the universal paid-ads invariants and [GOOGLE-ADS.md](./GOOGLE-ADS.md) for the STAG playbook this mirrors.

**Connect:** the user connects Microsoft Advertising from the dashboard's Ads page, same as Google.

## What transfers 1:1 from the Google playbook

- The three bidding recipes (Max Clicks + ceiling → launch default; Manual/Enhanced CPC; Max Conversions only after the user confirms a UET conversion goal with volume — `confirm_conversion_tracking: true`, never set it unprompted).
- STAG structure: one theme per ad group, phrase/exact keywords, one lander per theme, everything lands PAUSED (you may pause, never enable).
- RSA copy limits are IDENTICAL (3–15 headlines ≤30 chars, 2–4 descriptions ≤90 chars) — reuse the Google copy spread verbatim on the first pass.
- Plain `final_url`s — the campaign-wide Microsoft UTM suffix ({CampaignId} macros) is applied automatically.
- The budget guardrail: `daily_budget_usd` (and any bid) is capped at min(workspace admin's cap, granvl's **$200/day** platform ceiling) before any write.

## The build

`create_microsoft_search_campaign` → `create_microsoft_ad_group` (keywords) → `create_microsoft_search_ad` → `get_tracking_health` → hand the user the "activate in Microsoft Ads when ready" checklist.

1. **`create_microsoft_search_campaign`** — PAUSED Search campaign: daily budget (guardrailed), country targeting, chosen bidding strategy (default Maximize Clicks). The campaign is the single spend gate — the user activates in Microsoft Ads.
2. **`create_microsoft_ad_group`** — the ad group + its keywords, phrase/exact preferred. `add_microsoft_keywords` extends a theme later (same-theme only; BROAD needs `allow_broad_match: true` after an explicit user choice).
3. **`create_microsoft_search_ad`** — the RSA: 3–15 headlines (≤30 chars), 2–4 descriptions (≤90 chars), PLAIN `final_url` (the UTM suffix is automatic).

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

**`excluded_location_ids` — carving a region out.** `countries` targets whole countries; to exclude a province/state/city (the classic being Quebec out of a Canada campaign, for language or regulatory reasons) pass its Microsoft LocationId.

**Always resolve ids with `search_microsoft_locations`.** Never hand-write one. Microsoft's location ids are their own id space, and a wrong id excludes the *wrong region* while the campaign still looks perfectly targeted — a silent miss you'd only catch in the geo report weeks later. Scope with `country_code`, since place names repeat across countries, and check `canonicalName` before picking: results are ranked broadest-first so a province outranks a same-named city, but confirm.

```
search_microsoft_locations { account_id, query: "Quebec", country_code: "CA" }
  → [{ locationId: "20438", name: "Quebec", canonicalName: "Quebec,Canada", locationType: "Province" }, …]

create_microsoft_search_campaign {
  …, countries: ["CA"], excluded_location_ids: ["20438"], location_intent: "PEOPLE_IN"
}
```

`set_microsoft_location_targeting` is **additive** — it adds criteria, so *removing* an existing target is still a Microsoft Ads UI job. Setting `location_intent` on a campaign that already carries one fails (Microsoft adds a default); change that one in the UI.

## Microsoft differences worth knowing

- Negative keywords support only PHRASE and EXACT (`add_microsoft_negative_keywords`) — no broad negatives.
- `countries` currently supports US / CA / GB / AU — ask before assuming another market works. Sub-country targeting has no such limit: resolve any place with `search_microsoft_locations`.
- Conversion tracking is the UET tag (domain-level, Settings → Tracking) — there is no GA4-import equivalent; Max Conversions optimizes against UET goals only.
- **A UET tag is not conversion tracking.** granvl fires exactly one UET event, action `lead`. Microsoft only counts a conversion when an Event goal matches it (operator Equals). Its own goal wizard suggests names like `submit_lead_form`, which looks right, matches nothing, and reports zero conversions forever while the tag, the pages, and the goal all read as configured. Run `get_microsoft_conversion_goals` before recommending MAXIMIZE_CONVERSIONS or diagnosing "no conversions in Microsoft"; if nothing matches, have the user create an Event goal with Action = `lead`.
- **Read before you write targeting.** `set_microsoft_location_targeting` is ADDITIVE — Microsoft keeps whatever criteria are already there. `get_microsoft_campaign_settings` with `include_targeting: true` shows the current targets, exclusions and intent option, so you can tell an exclusion you already added from one you still need. It also surfaces budget, bidding, languages and whether granvl's UTM suffix is present (missing = spend won't join first-party data).
- `get_microsoft_audiences` lists remarketing / in-market / customer-list audiences with their ids and sizes. Anything under ~1000 is flagged `tooSmallToServe`: Microsoft won't serve against it, so targeting it reaches nobody while looking configured.
- Editing a live campaign is `update_microsoft_campaign` (bidding or pause; a `daily_budget_usd` is queued for a person to approve on the Microsoft Ads page, same as Google). There is no enable — going live stays a human action in Microsoft Ads.
- Search terms + keyword stats come from granvl's SYNCED store (see above), so they're only as fresh as the last sync — not a live report.
