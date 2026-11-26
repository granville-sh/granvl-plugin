# Granvl: TikTok Ads

TikTok is a **video-first, algorithm-led** channel: no keywords, broad targeting, and the creative does the targeting. Treat it like Meta's cousin, not Google's: read [META-ADS.md](./META-ADS.md) for the creative-led playbook this mirrors and [../SKILL.md](../SKILL.md) for the universal paid-ads invariants. You build the campaign for the user through these tools; there is no TikTok launcher anywhere else in granvl. The user asks you to build it, everything you create lands **paused**, and the user reviews it and switches it on in TikTok Ads Manager.

**Connect first.** The user connects TikTok from TikTok Ads settings and picks the advertisers granvl syncs. `account_id` below is a chosen **advertiser id** (digits; `get_ad_data_status` lists them). An advertiser the workspace did not choose, or removed, is refused. If TikTok launching is not enabled on this deployment yet, every build tool says so and sends nothing: tell the user, and stop.

## The rules that differ from Meta, Google and Microsoft

- **Every level is created paused.** Campaign, ad group and ad all go in with `operation_status` DISABLE. There is **no one-switch rule on TikTok**: an ad group inside a new campaign is paused too, and so are its ads. Going live means the user switches on the campaign, its ad group and its ads in TikTok Ads Manager. Every create result says so in `go_live`; relay it.
- **granvl reads every create back.** `verification` on each result is what TikTok actually holds. `paused: true` is the normal answer. `auto_paused: true` means TikTok listed it as running and granvl paused it at once (tell the user, and report it). A note starting **NOT PAUSED** means the user must pause it in TikTok Ads Manager now.
- **You may pause, never enable.** `pause_tiktok_entity` is the only status change. There is no enable tool.
- **Budgets are the advertiser's own currency.** `daily_budget_usd` is compared with the workspace cap (granvl's ceiling is $200/day) as a number, without conversion, the same as Meta and Microsoft. TikTok enforces its own minimum budgets.
- **Plain landing URLs only.** Pass the lander as is. granvl adds its TikTok UTM template (`utm_campaign_id=__CAMPAIGN_ID__`, `utm_ad_group_id=__AID__`, `utm_ad_id=__CID__` and the rest) to the ad's landing URL so spend joins first-party conversions. A URL that already carries those keys, a TikTok macro or a click id (`ttclid`, `gclid`, `fbclid`, …) is refused: strip them and call again.
- **Video only, from the library.** Ads are built from library VIDEO creatives (`upload_ad_creative` first). Images are refused, and so is anything granvl does not hold the file for (a Meta video's cover is a still, not the video). Videos under 540x960 are refused; 9:16 vertical, 15 to 30 seconds, hook in the first 2 seconds is the creative that works.

## The build

`campaign_preflight { platform: "tiktok" }` → `create_tiktok_campaign` → `create_tiktok_ad_group` → `list_tiktok_identities` → `create_tiktok_ad` → `verify_tiktok_build` → hand over: what exists, that it is all paused, and the go-live steps.

1. **`create_tiktok_campaign`** `{ account_id, name, objective, ad_category, daily_budget_usd? }`. `objective` **TRAFFIC** to start (clicks; it also teaches the pixel), **CONVERSIONS** once the TikTok pixel fires the lead event with volume. Omit `daily_budget_usd`: the ad groups carry the budget. Declare `ad_category` (NONE included).
2. **`create_tiktok_ad_group`** `{ account_id, campaign_id, name, daily_budget_usd, countries, optimization_goal }`. Website destination, automatic placements, smooth pacing.
   - `optimization_goal: "CLICK"` is the launch default (CPC); `bid_cap_usd` is an optional CPC ceiling.
   - `"CONVERT"` optimizes toward a pixel event (oCPM) and needs `pixel_id` + `optimization_event` (from `list_ad_pixels { platform: "TIKTOK" }`), a TikTok pixel on a workspace domain, **and `confirm_conversion_tracking: true`**, set only after the USER confirms the pixel fires that event. `bid_cap_usd` is then the target cost per result.
   - `countries`: US, CA, GB, AU. Optional `age_groups` (`AGE_18_24` … `AGE_55_100`) and `gender`; leave them off for housing, employment and finance offers (the result warns).
3. **`list_tiktok_identities`**: every ad runs under an identity, a linked TikTok account or a custom identity (brand name and avatar). An empty list means the user adds one in TikTok Ads Manager (Assets, Identities) first. Ask which one when there are several.
4. **`create_tiktok_ad`** `{ account_id, ad_group_id, creative_ids, name, ad_text, call_to_action, landing_page_url, identity_id }`: one paused single-video ad per creative, at most 3 per call. `ad_text` is at most 100 characters, a hook, not a paragraph. granvl uploads each video to the advertiser's TikTok library and uses TikTok's poster frame as the cover. On a granvl domain the page must be LIVE (publish first). `copy_warnings` is granvl's offline copy review; the ad is built either way, so read them to the user.
5. **`verify_tiktok_build`** `{ account_id, level, ids }`: read what TikTok holds and show the user. For ads it also says whether the landing URL carries granvl's UTM template.

Names follow SKILL.md "Naming": the campaign in Title_Case with underscores (`Roof_Repair_Spring_TikTok`), ad groups and ads in snake case (`broad_us_25_54`, `hook_storm_damage`). A name off the convention is created as given and comes back with `naming_note`.

## When a call fails part way

- A result with `complete: false` lists exactly what exists (`ads`), the step that failed (`failed`, with what was already uploaded) and what was never attempted (`not_attempted`). Fix the cause and call `create_tiktok_ad` again for the rest: a creative that already has an ad in that ad group is returned, not built twice.
- **"MAY HAVE BEEN CREATED"** means TikTok did not answer clearly (a timeout, a server error). granvl did not send it again. Run `verify_tiktok_build` by `name` before anything else; continue from the id if it exists. Never repeat the create blindly.
- Calling `create_tiktok_campaign` or `create_tiktok_ad_group` again with the same name within 15 minutes returns the one granvl already made (`reused: true`).
- A TikTok refusal comes back with TikTok's own code and message. If it mentions the token or permissions, the user reconnects TikTok Ads with a login that manages the advertiser.

## Editing a running campaign

- **`update_tiktok_ad_group_budget`** `{ account_id, ad_group_id, daily_budget_usd, reason }` applies at once, like Meta ad sets: under the workspace cap, and a raise of at most 20% (or the workspace's lower setting) above the budget at the start of the trailing 24 hours. Cuts are always allowed. Only daily ad-group budgets; lifetime and campaign budgets are the user's, in TikTok Ads Manager.
- **`pause_tiktok_entity`** `{ account_id, level, ids, reason }` pauses campaigns, ad groups or ads. Pausing something live stops its delivery at once: pause only what the user asked for, or what a rule you agreed with them says.

Both record the change in granvl's warehouse with your `reason`.

## Restricted ad categories on TikTok

Declare `ad_category` on `create_tiktok_campaign` the same way as on the other platforms (SKILL.md "Restricted ad categories"): it is recorded for the campaign and inherited by its ad groups and ads. granvl holds **no verified TikTok rules** for these categories yet, so on TikTok it limits and refuses nothing; the result's `ad_category.warnings` say so. TikTok's own advertising policies and review still apply, and regulated offers (credit, housing, employment, health, alcohol, gambling, dating, political) can be rejected or limited by TikTok. Tell the user to check TikTok's rules for the category before switching the campaign on.

## Pixel and Events API (before CONVERT)

granvl sends page conversions to TikTok server-side when a domain carries a TikTok pixel. `list_ad_pixels { platform: "TIKTOK" }` returns each pixel's `pixelId` (for `create_tiktok_ad_group`) and `code` (the `ttq.load` id). Pass `code` to `update_domain_tracking` as the domain's `tiktok_pixel_id`; the Events API access token is entered by the user in Settings → Tracking.

## Reading results

Spend, impressions, clicks and TikTok's own conversions land in the warehouse twice a day. `get_ad_entities` takes `platform: "TIKTOK"`; `get_ad_to_lander_performance` takes it only together with a TikTok advertiser's `account_id` (on its own, `platform` is not used there). **`get_spend_summary` has no platform argument**: it always covers every connected ad account in the workspace (Meta, Google, TikTok, Microsoft), so its `totals` and `daily.totals` are workspace-wide, never TikTok-only, and a `platform` you pass is ignored. For TikTok spend, add up the `byCampaign` rows whose `platform` is `TIKTOK` (each row carries `platform` and `accountId`; daily campaign rows carry no platform, so match them to those rows by `campaignId`), and relay TikTok's entries in `accountFreshness`. Say which you quote: a workspace total is not TikTok spend. What you create shows up in `get_ad_entities` at once (granvl records it as it builds). First-party conversions join through the UTM template; `get_tracking_health` flags ads whose landing URL lost it.

## Platform differences to remember

- No keywords, search terms or negatives: creative rotation is the optimization loop (`get_creative_performance`, then replace the losers).
- TikTok's learning phase wants roughly 50 conversions per ad group per week; under that, judge on CPC and the lander's conversion rate from granvl, not TikTok's CPA.
- Countries: US / CA / GB / AU until more markets are verified.
- Ad text at most 100 characters; videos at least 540x960, 9:16 preferred, at most 500 MB.
