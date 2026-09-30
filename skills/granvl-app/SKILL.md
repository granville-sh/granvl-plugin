---
name: granvl-app
description: Build, deploy, A/B test, and optimize landing pages and paid campaigns on Granvl via MCP. Use before Granvl page, campaign, copy, research, or performance work so task-specific resources, warehouse boundaries, approval gates, and runtime conventions are loaded only when relevant.
---

# Granvl — App Skill

You are operating against an **AI-native landing page platform**. The user has connected you to Granvl via MCP. You can create funnels, add pages, draft variants, set traffic weights, build ad campaigns, and read performance data — without ever leaving the conversation.

**Read this skill before generating page HTML or calling any MCP tool.** The platform has specific runtime conventions: forms are auto-rewritten at serve time, tracking is auto-injected, certain template tokens are substituted server-side, and per-funnel tracking secrets (CAPI, GA4) are kept off the client. If you ignore these, the pages still serve but tracking, A/B routing, conversion attribution, or auto-optimization will silently break.

## HARD RULE — MCP tools only. Never drive the dashboard UI.

**Never use computer use, browser automation, or GUI clicking to create, edit, configure, or delete ANYTHING in Granvl.** Not funnels, pages, variants, traffic weights, domains, form destinations, tracking settings, campaigns, API keys, or workspace settings — **every write goes through the Granvl MCP tools** (or the documented HTTP API with an API key). The dashboard is the *user's* surface. Agent-driven clicks bypass the platform's validation, guardrails, HTML bake pipeline, and audit trail, and can silently corrupt state the tools would have protected.

- A task seems to need the UI? It doesn't — find the MCP tool (decision tree below, or `resources/REFERENCE.md`). If no tool exists for it, **say so and let the user do it in the dashboard themselves.** Never click it into existence.
- **Sole exception — explicit visual testing.** If the user *explicitly asks* you to test or verify something in a browser ("run through the quiz with the browser", "check how it renders on mobile"), you may open pages, look, and submit *test* data as instructed. Even then it is **read-and-test only**: never change a setting, never create or edit anything through the UI, and return to MCP for any fix the test reveals.

This file holds the rules that always apply. Task-specific depth lives in resource files, and reading the right one is a **required step**, not optional background:

- **Before generating or editing any variant HTML** → STOP and read [resources/PAGE-BUILDING.md](./resources/PAGE-BUILDING.md) (forms, quizzes, embeds, styling, brand kit, a11y, performance, legal footer, validator codes). Do not author page HTML from memory.
- **Before any Meta campaign work** → STOP and read [resources/META-ADS.md](./resources/META-ADS.md).
- **Before any Google Ads work (Search or Demand Gen)** → STOP and read [resources/GOOGLE-ADS.md](./resources/GOOGLE-ADS.md).
- **Before any Microsoft Ads work** → STOP and read [resources/MICROSOFT-ADS.md](./resources/MICROSOFT-ADS.md).
- **Before deep tool-arg / schema / error questions** → read [resources/REFERENCE.md](./resources/REFERENCE.md).
- **Before customer/ICP/offer research or writing copy** → read [resources/COPYWRITING.md](./resources/COPYWRITING.md). Use the bounded strategy/copy brief tools when available; preserve Product + ICP + Angle + CopyLine lineage.
- **Before analyzing performance or proposing tests** → read [resources/OPTIMIZATION.md](./resources/OPTIMIZATION.md).
- **When the user EXPLICITLY asks for a dashboard / report / command center** → read [resources/DASHBOARDS.md](./resources/DASHBOARDS.md) and build it locally with the granvl dashboard kit (`resources/dashboard-kit/`) — never from scratch, never with a chart framework. Dashboards are strictly user-initiated: do NOT build one, or offer to build one, as a side effect of other work.
- **For golden-path conversation scripts** → read [resources/EXAMPLES.md](./resources/EXAMPLES.md).

---

## Confirming the skill is loaded (onboarding verification)

If the user asks you to confirm the skill is installed — e.g. **"Granvl: confirm the skill is installed"** — reply with a message that **begins with the exact phrase `Granvl skill ready`**, then one short line naming what you can now do (build, deploy, A/B test, and optimize landing pages via the Granvl MCP tools). That exact opening phrase is the signal the onboarding flow tells users to look for — it's how they know the skill actually loaded rather than just self-attesting a checkbox. Lead with it verbatim; don't embellish the opening phrase.

---

## Keeping this skill current — `get_skill`

If you got this skill through the granvl plugin, it updates with the plugin — nothing to do. The Granvl MCP also exposes **`get_skill`**, which returns the canonical bundle, for clients that keep their own copy:

- Optionally, at the start of a session, call `get_skill` with `since_version` set to the version you last saw. `upToDate: true` → you're current, carry on.
- Otherwise the response carries `version` and `files[]` (each `{ path, content }`). You can read the files straight from the response. If your client keeps a local copy, `installPaths` names the directory for your client (`claude`, `codex`, `other`); writing there is optional and never required to use granvl.
- It's read-only — `get_skill` never edits the server's skill.

---

## START HERE — get your bearings every session

**Before anything else — building, editing, advising — call `list_funnels`, and `get_brand_kit` for the domain you're about to touch.** Together they tell you what's already live and what this customer looks and sounds like. Building without reading them is how a generic page happens.

Brand specifics — colors, fonts, logo, voice — live in the **brand kit**, per domain. Durable CRO findings live in **learnings** (`save_learning` / `list_learnings`), per funnel. Those two are your memory between sessions; keep them fed.

### Fresh workspace → run the intake ("grill me")

When `list_funnels` returns nothing, **don't silently proceed with a generic build.** Pause and ask a tight intake set, in one or two turns — not an interrogation:

1. **What kind of operation is this?** — an **agency** (multiple brands across multiple domains), a **single business**, or a **solo founder/creator**?
2. **Name + one-liner** — what's the business called, and what does it do?
3. **Industry / vertical** and **who you're selling to**.
4. **Voice / tone** — three words is plenty ("modern, trustworthy, premium").
5. **Primary goal** for most pages — leads, sales, signups, bookings?

Use the answers in this session, and put the durable half where it survives: brand colors, fonts, logo and voice into the domain's brand kit via `update_brand_kit`.

### Brand-new workspace → build a first page immediately (don't just talk)

When it's a **fresh workspace** — `list_funnels` returns nothing — the user is almost certainly sitting on the onboarding **"build"** screen waiting to see something real. After the tight intake, **build and ship one simple page so they get the "it's live" moment in seconds.**

Sequence — keep it fast, one of each, minimal back-and-forth:

1. `create_funnel` (`funnel_type: "standard"`) — name it after their business/offer; set `platform` from what they told you (omit if unknown). This auto-bootstraps a `LANDING` and a `THANK_YOU` page — grab the **LANDING** page's `id` from the response (no `create_page` needed).
2. `create_variant` on that LANDING page — one clean, on-brand hero: headline + subhead + a single primary CTA + one supporting section. If a brand kit exists (`get_brand_kit`), pull its colors/fonts — onboarding often auto-extracts one from the user's website (`sourceUrl` set, `screenshots[]` for look-and-feel); otherwise tasteful defaults. Keep it genuinely simple — a strong first draft, not a finished site.
3. Give the user the **`previewUrl`** from the `create_variant` response and tell them it's live — it also appears on their onboarding screen automatically within a few seconds. (Later, for a shareable client/teammate link, use `create_preview_link`; the per-variant previewUrl is for their own eyes.)
4. Offer the first edit: suggest 2–3 concrete tweaks and let them drive.

Guardrails:

- **Don't `publish_funnel` during onboarding.** A new workspace has no domain yet — the **preview URL is the deliverable**. Only publish when they later connect a domain and ask to go live.
- **Don't over-grill.** A URL or a one-liner is enough to build — infer the rest and go. Fill in the brand kit _after_ they've seen the page.
- **One page, one variant.** Speed-to-live beats completeness here.
- This branch is **only** for a genuinely new workspace. If any funnel already exists, skip it and behave normally.

### Agency workspaces → every domain needs its own brand kit

If the workspace is an **agency** (multi-brand / multi-domain), then **each domain is a different brand** and must carry its own brand kit. Whenever you work on a domain, call `get_brand_kit` for it; if it's empty or thin, ask the user for that brand's colors, fonts, logo, and voice (or infer from their existing site) and fill it via `update_brand_kit`. Never let an agency domain ship on another brand's palette.

---

## TL;DR — Mental model

| Concept               | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Funnel**            | A campaign container. One funnel ≈ one ad campaign or one product offer. Optionally connected to a domain, with a conversion type, an optional qualification rule, and one or more pages. **Many funnels can share one domain** — they're disambiguated by page slug, which must be unique across all funnels on that domain. That includes the root slug `'/'` — one live funnel owns a domain's root at a time. To swap the live root page, archive or unpublish the old funnel first (a released slug is free to claim); a `/` still live on the domain is refused at create/rename/attach time. |
| **Page**              | A URL path inside a funnel. Type is `LANDING`, `QUIZ`, `THANK_YOU`, `FORM`, or `MAGNET` (post-conversion lead-magnet content — see Lead magnets below). Conversions fire client-side **at the moment of the action** (form submit / converting click), not on TY-page arrival — the `_cv`-redirect chain is a deduped fallback. `CLICK_THROUGH` events are intra-funnel page navigation only (not user-facing conversions).                                                                                                                |
| **Variant**           | One HTML version of a page. Multiple variants per page = A/B test. Each has a `weight` (0–100) and traffic-routing is server-side and sticky.                                                                                                                                                                                                                                                                                                                                                                                              |
| **VariantVersion**    | Every change to `htmlContent` writes a snapshot row with provenance (`AI_GENERATED` / `AI_EDITED` / `HUMAN_EDITED` / `IMPORTED`) + the prompt that produced it. Read past versions with `list_variant_versions`.                                                                                                                                                                                                                                                                                                                           |
| **Domain**            | A custom hostname (e.g. `quote.example.com`). Account-level — a funnel connects to at most one domain, but a single domain can host multiple funnels (each funnel's pages live at distinct slugs).                                                                                                                                                                                                                                                                                                                                         |
| **AnalyticsEvent**    | Every visit, conversion, scroll milestone, bounce, web vital, and bot hit. Auto-enriched with geo, device, UTMs, click IDs, traffic type, visitor identity. CONVERSION rows carry structured `conversionAction` (`'form_submit' \| 'click_through'`) and `conversionQuality` (`'qualified' \| 'unqualified' \| null`).                                                                                                                                                                                                                     |
| **LeadQualification** | One row per `(sessionId, funnelId)` saying whether the lead was qualified — by rule (form-submit match), by webhook (CRM deal-close echo), or manual flip. Closes the {variant, audience, outcome} loop with downstream quality data.                                                                                                                                                                                                                                                                                                      |
| **SessionJourney**    | One materialized row per session per funnel — funnel structure at the time of visit, the path taken, audience features, outcome, qualification, deal value. Read with `list_session_journeys`.                                                                                                                                                                                                                                                                                                                                             |
| **AiActivity**        | Audit feed of every successful tool call you make. Surfaces in the user's dashboard "Claude Activity" panel — narrate well.                                                                                                                                                                                                                                                                                                                                                                                                                |

---

## Ad accounts — sync, Tracking Health, spend questions

Granvl is the **persistent warehouse for the user's historical ad-account data**. Data arrives through Granvl-managed syncs:

1. The user connects Meta or Google Ads on the dashboard's Ads page.
2. Granvl syncs campaigns, spend, creatives, and search evidence server-side into the warehouse.
3. Agents answer historical performance, optimization, and analytics questions only from Granvl reads. If a read is empty, stale, or failed, call the data-status tool and report its exact reason and remedy. **Never fall back to a live platform read or agent ETL for history.**

Live platform connections remain available for an explicitly approved CREATE workflow: account identity, pixels, conversion actions, interest/audience lookup, Keyword Planner discovery, and paused campaign writes. These calls are rate-limited and purpose-bounded; they are not a way around missing warehouse history.

Note on **Campaigns** (the granvl grouping hubs that link funnels + ad campaigns into one view): they are managed on the dashboard (`/dashboard/campaigns`) — there is no MCP tool for creating or linking hubs. When a user asks to "group" or "organize" funnels with their ad campaigns, point them there.

### Sync and action boundary

- If history is unavailable, surface the connection/sync reason and send the user to the Ads connection or sync remedy returned by Granvl. Do not import history yourself.
- Campaign creation and updates go through Granvl's guarded tools only. They enforce tenant scope, API quotas, budget limits, and paused defaults. When a guardrail refuses a request, relay the limit to the user; do not look for another way to make the same change.
- When building pages/links, follow the workspace UTM convention (`utm_source`, `utm_campaign`, `utm_adgroup` at minimum) so the warehouse can join spend to first-party outcomes.

### Answering spend + optimization questions

The decision tree below routes each question to its tool. Universal habits:

- **Always relay freshness** on spend answers (`get_spend_summary` → `staleHours` > 36 → say the data is stale and offer a re-sync before quoting numbers). Rows with `joined: false` mean broken tracking → point at `get_tracking_health`. `mode='recognized'` also recovers UTM-stripped clicks by matching the ad's destination URL to the granvl page it hits.
- **Start sessions with `list_optimization_actions` and/or `get_daily_brief`** and lead with what changed: "overnight I paused Variant A and shipped two fresh variants; C is leading at 4.1%". This is how the user _sees_ the product working — don't leave it silent.
- **Call `get_research_history` before proposing or generating any new variant/experiment.** It returns `wins` (repeat these), `avoid` (never re-test these), and `inconclusive`, with structured `changeType` / `metric` / `lift` capture. Never burn a test on a known loser.
- **Record what tests teach with `save_learning`** — capture the experiment, not just the verdict: `change_type`, `change_summary`, `metric` + `baseline_value`→`result_value`, `hypothesis`. Log losers and inconclusives too.

---

## Paid ads — universal invariants (all platforms)

granvl can build ad campaigns on Meta, Google (Search + Demand Gen), and Microsoft (Bing) directly from the conversation. These invariants hold on EVERY platform (server-enforced — don't fight them):

- **Everything is created PAUSED.** You may pause campaigns, but never enable — going live is always the human's action in the platform's own ads manager. There is deliberately no activate tool. Close every build by telling the user where to flip the switch.
- **Budget guardrail:** daily budgets (and bids) are capped at min(the workspace admin's cap, granvl's **$200/day** platform ceiling) before any write. An over-cap request returns the cap in the error — relay it, NEVER work around it.
- **Plain URLs, never pre-tagged:** granvl applies each platform's UTM template automatically so spend joins first-party conversions. Every destination URL you provide stays plain.
- **Pages before ads:** final URLs on granvl domains must be LIVE — publish first.
- **BROAD match keywords require `allow_broad_match: true`** — set only after the user explicitly chooses broad despite your warning.
- **Max Conversions bidding requires `confirm_conversion_tracking: true`** — set only after the USER confirms conversion tracking is wired (Google: GA4-imported conversion action; Microsoft: a UET goal with volume). Never set it unprompted.
- **Regulated verticals on Meta need `special_ad_category`** (financial / housing / employment / political) — ask if the offer looks like one.
- **Microsoft limits:** negative keywords are PHRASE/EXACT only; country targeting currently US / CA / GB / AU only.
- **After a guarded platform write,** rely on Granvl's audited write path and next warehouse sync. Do not manually re-record the entity.

Per-platform playbooks and build flows are a **required read** — before creating anything on a platform, STOP and read the matching resource; do not proceed from memory:

- **Meta (Facebook / Instagram)** — Guided Campaign Build (campaign → ad set → ad), creatives, CTAs, copy rotation, Advantage+ enhancements, special ad categories → **read [resources/META-ADS.md](./resources/META-ADS.md) first.**
- **Google Search + Demand Gen** — STAG / SANG playbooks, bidding recipes, keyword research, audiences, the weekly negatives loop → **read [resources/GOOGLE-ADS.md](./resources/GOOGLE-ADS.md) first.**
- **Microsoft Ads (Bing) Search** — Google's sibling with cheaper clicks; UET tracking; platform differences → **read [resources/MICROSOFT-ADS.md](./resources/MICROSOFT-ADS.md) first.**

---

## Decision tree — which MCP tool, when

```
User intent                              → Tool sequence
──────────────────────────────────────────────────────────
(start of EVERY session, before anything)→ list_funnels            (what's live — see "START HERE")
"Which workspace am I in?" / agency with → list_workspaces         (every workspace + which is active)
several client workspaces                  switch_workspace        (by id or name; scopes every later call)
                                           get_brand_kit           (who they are, per domain)
                                           # no funnels? run the intake, then build

"Remember this about our brand"           → update_brand_kit        (colors, fonts, logo, voice)
"Note that <CRO learning>"                 save_learning            (per funnel; read with list_learnings)

"Build me a landing page for X"          → ASK shape + platform first → see "Before building"
"Create something for <topic>"             create_funnel        (with funnel_type + platform)
"Make a page about <X>"                    [read resources/PAGE-BUILDING.md]
                                           create_variant       (variant HTML on the relevant page)
                                           [user reviews preview]
                                           publish_funnel       (activates + bakes HTML)
                                           # Don't search for an existing funnel
                                           # named like X — see "New funnel vs.
                                           # new variant" rule below.

"Start from a template" / "use a template"→ list_templates      (cards: name, slug, category, previewUrl, previewImageUrl)
                                           get_template / get_template_html   (inspect before committing)
                                           create_funnel_from_template        (whole funnel at once; response
                                           # carries pages[].variantIds — adapt THOSE variants next)
                                           # The USER picks the template — show the options, never choose for them.
                                           # See "Platform templates" below: creating is the easy half,
                                           # the copy adaptation IS the build.

"Only accept work emails on this form"   → update_funnel({ validate_work_email_enabled: true })
                                           # rejects free/personal providers at submit (gmail, yahoo, …);
                                           # composes with the mailbox check; per-variant granularity
                                           # (A/B the rule itself) lives in the dashboard.

"Build X in the <brand> brand"           → list_brands          (confirm the brand exists; get its id)
                                           create_funnel({ ..., brand_id })   # brand_id = the brand's id OR name
                                           # No brand named + list_brands shows more than one → ASK which
                                           # brand before creating anything. Omitting brand_id files the
                                           # funnel under the default brand. Use that brand's domain +
                                           # brand kit (list_domains({ brand_id }) → get_brand_kit).
"Show me <brand>'s funnels"              → list_funnels({ brand_id })   # list_domains takes brand_id too
"Move this funnel to <brand>"            → update_funnel({ brand_id })  # re-homes the funnel's owning brand
"Move this domain to <brand>"            → move_domain_to_brand({ domain_id, brand_id, move_funnels: true })
                                           # move_funnels carries every funnel on the domain along (usually
                                           # wanted — confirm). Organizational only: live pages, stats,
                                           # tracking and settings are untouched. Admin/owner only.
"Put these funnels in a folder"          → move_to_folder({ entity: "funnel", ids, folder_name, brand_id })
"Make a folder called X"                   # reuses a same-named folder, else creates it; ids: [] = empty
"Take it out of the folder"                # folder; remove: true takes items out. list_folders({ kind })
                                           # shows what exists. Also for product / icp / angle /
                                           # copy_line / creative. Folders never affect serving or stats.
                                           # Folders are PER BRAND: provide the brand the items live in (default
                                           # brand when omitted); items from another brand are skipped, and a
                                           # funnel that changes brand leaves its old brand's folder.

"Single page that links to <off-site>"   → create_funnel({ funnel_type: "click_through" })
"Just one page, click out to <X>"          # no ask needed — user named the shape
"Click-through landing page"               create_variant       (LANDING page only)
                                           [no thank-you page is created]
                                           [external <a> tags auto-track conversions]
                                           publish_funnel       (activates + bakes HTML)

"Sync/connect my ad account"             → explain Ads-page OAuth connection
"Why is Meta/Google history missing?"      → get_ad_data_status → report reason + remedy
                                           # never agent-ETL or live-history fallback

"Are my ads tracked right?"              → get_tracking_health
"What's my CPL / CPQL / ROAS?"           → get_spend_summary  (relay freshness!)
"What campaigns am I running?"           → get_ad_entities    (Granvl's memory)
"What's working by age/placement/etc?"   → get_ad_breakdowns  (per-segment, rank by metric)
"Which lander variant wins ad X?"        → get_ad_to_lander_performance  (ad→variant, Wilson-gated winner)
"Which of these 2 ad sets is better?"    → compare_ad_sets    (metrics + AI verdict, names the layer)
"Which ads are healthy / need attention?"→ get_ad_health      (0–100 self-benchmark score, worst-first)
"Log a Shopify/Stripe sale back in"      → record_external_conversion  (idempotent on order id)

"Build me a Meta / Facebook / Instagram  → read resources/META-ADS.md FIRST, then
 campaign"                                 the Guided Campaign Build:
                                           create_meta_campaign →
                                           create_meta_adset → create_meta_ad.
                                           Everything is created PAUSED (the human
                                           activates in Ads Manager).

"Build a Google Search / Demand Gen      → read resources/GOOGLE-ADS.md FIRST
 campaign"                                 (STAG / SANG playbooks + the two
                                           3-step build flows): campaign →
                                           ad group → ad. Always created PAUSED —
                                           one switch to activate in Google Ads.
                                           Research keywords FIRST with
                                           generate_keyword_ideas (volume + CPC
                                           from Keyword Planner) instead of
                                           guessing.

"Build a Microsoft / Bing campaign"      → read resources/MICROSOFT-ADS.md FIRST:
                                           create_microsoft_search_campaign →
                                           create_microsoft_ad_group →
                                           create_microsoft_search_ad. Same STAG
                                           playbook as Google Search; always
                                           created PAUSED.

"What's going on in my account?"         → get_daily_brief    (the Morning Brief —
"Anything I should know today?"            free read; same brief the user sees.
                                           Good first call of a session to orient.)
"What did the optimizer do?"             → list_optimization_actions (narrate it)
"What should I do next?"                 → get_optimization_suggestions
"What have we already tried?"            → get_research_history (BEFORE proposing tests)
"Record what this test taught us"        → save_learning

"What's running right now?"              → list_funnels
"What's in this funnel?" (navigation)      get_funnel_summary   (slim: status, domain,
                                                                 pages w/ ids + variant counts)
                                           # Need brand kit / legal URLs / full variant
                                           # metadata to BUILD or edit? → get_funnel (full payload)

"Make a new variant for X"               → get_funnel           (find page_id)
                                           create_variant
                                           set_weights          (rebalance)

"Pause the underperformer"               → get_funnel           (read variant stats)
                                           set_weights          (set the loser's weight=0,
                                                                 redistribute to winners)
                                           # there is no `status: PAUSED` —
                                           # weight=0 is the single source of truth
                                           # for "off". Status is owned by publish.

"Connect this domain"                    → create_domain
                                           [user adds DNS]
                                           update_funnel        (domain_id)

"Serve this funnel at customer.com/"     → update_funnel        (domain_id)
"Make this the homepage"                   update_page          (slug: "/")
                                           [serve route resolves customer.com/ → this page]
                                           [if another funnel on this domain has slug "/", oldest wins]

"Set up Meta CAPI / TikTok / GA4 /        → list_domains         (find domain_id)
 Google Ads / Microsoft Ads / etc."        get_domain            (read the `tracking` block —
                                                                  set vs missing; secret tokens
                                                                  show as booleans, never values)
                                           update_domain_tracking ({ <platform creds> })
                                           test_tracking_pixel    (verify Meta/GA4/TikTok creds
                                                                  fired — after setting tokens)
"Add Hotjar / Intercom / a consent tool /  → get_domain            (read `custom_scripts` first)
 any script granvl doesn't support"        update_domain_scripts  (upsert_block { slot, marker,
                                                                  content } — one vendor block;
                                                                  never paste it into page HTML)
                                           [Microsoft is single-credential: just
                                            the UET tag ID drives both pixel +
                                            server-side fire]
                                           [Google Ads: conversion_id + label, plus
                                            optional google_tag_id (GT-) + tracking_mode]
                                           [per-domain; serve route auto-injects on next
                                            render — no per-page code]

"Why's conversion dropping?"             → get_funnel_stats     (per-variant numbers)
                                           get_variant_history   (did conv rate move around an
                                                                  edit? series + edit markers)
                                           list_session_journeys (path + cohort breakdown)
                                           # get_variant_history is a CORRELATION surface —
                                           # relay its caveats[]; never say an edit "caused" it.

"Where are people dropping off          → get_step_funnel      (per-step drop-off, multi-step quizzes)
 in my quiz?"                              [largestDropIndex IS the answer — the step to rewrite]

"Save these brand colors / fonts"        → update_brand_kit     (set per-domain tokens)
"What's my brand kit?"                   → get_brand_kit        (read current tokens + brandMode)

"Edit this variant" / "change the X"     → get_variant_html     (read current HTML — DON'T regenerate)
                                           update_variant       (with new html_content + change_summary)

"Fork this" / "make a version of X"      → get_variant_html     (read what's there)
"Copy this winning page to my funnel"      duplicate_variant    (creates DRAFT copy, weight: 0)
"Iterate on [teammate]'s page"             update_variant       (iterate on the COPY, not the source)
                                           # Cross-funnel: provide target_page_id
                                           # Same-type pages only (LANDING→LANDING etc.)

"Clone [teammate]'s funnel"              → duplicate_funnel     (full pages + variants, DRAFT)

"What's been changing on this variant?"  → list_variant_versions(variant_id)

"Map my form to LeadProsper"             → list_leadprosper_campaigns (campaign fields + suppliers)
"Send TrustedForm / source to LP"          set_leadprosper_destination (explicit field map; static:<value>
                                                                  for constants; idempotent)
"Pause / rename / reorder a destination" → update_form_destination (enabled, label, sort_order 0 = primary,
"Change the hidden fields it sends"                               hidden_fields)
"Map / copy ActiveCampaign fields"       → get_form_destinations (meta.acFields = AC's fields + required flags,
                                           meta.fieldMap = current map) → update_form_destination({ field_map })
                                           # { "<form input name>": "<AC field name>" }. To copy a mapping to
                                           # another funnel, read the source's meta.fieldMap and provide it as-is.
                                           # Map every required AC field or AC rejects the lead.
"Remove this integration"                → delete_form_destination (one by id; confirm first)

"Did my webhook / GHL hookup work?"      → send_test_lead       (synthetic lead, union of ALL variants'
"Send a test lead so I can map fields"                            form fields; GHL's mapper needs one
                                                                  sample request before it can map)

"Verify phone numbers / block bot leads" → set_sms_verification  (funnel-level; texted 6-digit code
                                                                  gates the form; 100 free per team,
                                                                  then credits; fails open at 0)

"Filter junk WITHOUT hurting conv %"     → update_funnel         (validate_phone_enabled /
                                                                  validate_email_enabled: silent
                                                                  real-number / real-mailbox checks,
                                                                  inline error, no texted code)

"Prove consent / TCPA cert on leads"     → update_funnel         (trusted_form_enabled: TrustedForm
                                                                  snippet + xxTrustedFormCertUrl
                                                                  field on every lead)

"Set up qualified-lead tracking"         → set_qualification_rule (rule JSON)
                                           get_qualify_webhook_url (URL for the user's CRM)
"Mark this lead qualified"               → mark_lead_qualified

"What did this visitor actually do?"     → list_session_journeys(funnel_id, ...)
```

**Always `list_funnels` before assuming context.** Even if the user names a funnel, confirm the ID — names aren't unique and tool errors burn budget.

---

## Platform templates — instantiate, then ADAPT

Granvl ships a published template gallery (`list_templates`): multi-page funnels with proven structure — e.g. **Card quiz** (`quiz-cards`), **Full-screen quiz** (`quiz-fullscreen`), **Ebook + quiz** (`ebook-quiz`). Each card carries `previewUrl` (a live example) and `previewImageUrl` (a screenshot) — surface those so the **user picks**; never choose a template for them.

The contract after `create_funnel_from_template`:

1. **Creating the funnel is the easy half — the copy adaptation IS the build.** The instantiated pages carry the template's example vertical and placeholder copy ("Your Brand", the template's own questions). Rewrite headline, questions, options, and thank-you copy for the user's actual product. Adapt as **copy surgery**: swap text and colors while keeping the template's structure, classes, and step wiring intact — the quiz JS (`data-step`, `var TOTAL=N`, hidden answer fields) is load-bearing. If you change the number of steps or options, renumber `data-step`, update `var TOTAL`, and keep one hidden input per option-question key.
2. The response's `pages[].variantIds` names exactly the variants to adapt — re-read each (`get_variant_html`) when done and confirm no template copy survived.
3. **Wire lead delivery** — template forms point at the built-in fallback until a destination is configured (`get_form_destinations` / `set_form_destination`; LeadProsper with a field map: `set_leadprosper_destination`).
4. End with a preview link (`create_preview_link`) so the user can see the adapted funnel.

## New funnel vs. new variant — default to new

When the user says **"create"**, **"build"**, or **"make"** something, the default is `create_funnel`. **Don't search for an existing funnel that sounds similar.** Two funnels can target the same audience with different angles — that's a feature, not a duplicate. Attaching a "new project" to an old funnel silently pollutes its A/B test data.

Only call `list_funnels` + `create_variant` instead when the user explicitly says one of: _"new variant"_, _"another version"_, _"test against [existing funnel]"_, _"add to [existing funnel]"_, or names an existing funnel. When uncertain, bias toward new — funnels are cheap to delete; mis-attached variants corrupt experiment integrity.

---

## Before building — ask shape + platform in one turn

Funnel shape is the single biggest cause of "rebuild this" loops. **When the user asks to create a new funnel, ask shape + platform together in ONE message before calling `create_funnel`** — unless the user already told you both unambiguously.

**The canonical shapes** (pick the closest; everything maps onto a `funnel_type` + optional follow-on `create_page` calls):

| #   | Shape                         | Use case                                                                                | `funnel_type` + follow-ons                                                                                                    |
| --- | ----------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | **1-page click-through**      | Single landing → external link (Calendly, Stripe, app store). No form on Granvl's side. | `click_through`                                                                                                               |
| 2   | **Lander → Thank-you**        | Classic lead capture. Form on landing, redirect to TY page.                             | `standard`                                                                                                                    |
| 3   | **Quiz → Thank-you**          | Multi-step quiz → lead form on final step → TY page.                                    | `quiz` (skip the landing — first page is the quiz itself)                                                                     |
| 4   | **Lander → Quiz → Thank-you** | Hook page first, then qualify with quiz, then TY.                                       | `quiz` + `update_page` on the first page to add hook copy. The default `quiz` shape already gives Landing + Quiz + Thank You. |
| 5   | **Lander → Form → Thank-you** | Long-form sales letter on landing, dedicated form page, TY.                             | `standard` + `create_page({ type: 'FORM' })` between landing and TY.                                                          |
| 6   | **Something else**            | Custom shape — describe it.                                                             | Ask follow-ups; usually maps to `standard` + a few `create_page` calls.                                                       |

**Skip the ask** when the request is unambiguous (_"click-through page for our Calendly link"_ → shape 1; _"3-step quiz funnel for insurance leads"_ → shape 4; _"lead capture page for our PDF"_ → shape 2). **Ask** when it's generic (_"build me a landing page for X"_, _"create something for our spring promo"_).

**The combined question template** (short, structured, one turn):

> Quick build setup. Two things first:
>
> **Funnel shape — which feels right?**
>
> 1. **1-page click-through** — single landing, CTA links off-site
> 2. **Lander → Thank-you** — classic lead capture, form on the landing
> 3. **Quiz → Thank-you** — multi-step quiz, lead form on final step
> 4. **Lander → Quiz → Thank-you** — hook page, then qualify with quiz
> 5. **Lander → Form → Thank-you** — long-form sales letter, dedicated form page
> 6. Something else — describe it
>
> **Ad platform — which channel is this for?** (Meta, Google Search, TikTok, LinkedIn, ...)

If the user picks shape 5 or 6, do one follow-up to confirm the page list before building.

**What you don't need to ask upfront** (handle naturally as you build): domain (`list_domains` surfaces what's connected), form destination (`get_form_destinations` — only once a form-bearing page is being authored), brand kit (`get_brand_kit`, adopt silently), conversion goal (derived from page composition unless the user names one), embedded booking widgets (set `embedded_widget` at `create_variant` if mentioned). The goal is **one question, one answer, one build**.

---

## Always ask which ad platform a new funnel is for

`create_funnel` requires a `platform` value (`META`, `GOOGLE_SEARCH`, `TIKTOK`, `LINKEDIN`, `REDDIT`, `X`, `PINTEREST`, `SNAPCHAT`, `MICROSOFT_SEARCH`, `MICROSOFT_AUDIENCE`, `GOOGLE_DEMAND_GEN`, `GOOGLE_DISPLAY`, `YOUTUBE`, `YOUTUBE_SHORTS`, `PERFORMANCE_MAX`, `ORGANIC`, `EMAIL`, `OTHER`). Without it, channel-level rollups break and there's no way to ask _"how's TikTok converting vs. Meta?"_ later.

1. **If the user mentioned a platform casually** → confirm casually: _"Building this for Meta — sound right?"_
2. **If they didn't** → ask before calling `create_funnel`, phrased like a person: _"Which platform is this for — Meta, Google Search, TikTok, something else?"_
3. **If they genuinely don't know yet** → use `OTHER` and note they can change it in Settings → Funnel. Don't guess.

**Map casual phrasing to the enum:** Meta/Facebook/Instagram → `META` · Google/search ads → `GOOGLE_SEARCH` · Demand Gen/Discovery → `GOOGLE_DEMAND_GEN` · GDN/display → `GOOGLE_DISPLAY` · pmax → `PERFORMANCE_MAX` · YouTube → `YOUTUBE` (Shorts → `YOUTUBE_SHORTS`) · TikTok → `TIKTOK` · Microsoft/Bing → `MICROSOFT_SEARCH` · MS Audience → `MICROSOFT_AUDIENCE` · LinkedIn → `LINKEDIN` · Reddit → `REDDIT` · X/Twitter → `X` · Pinterest → `PINTEREST` · Snap → `SNAPCHAT` · SEO/organic/blog → `ORGANIC` · newsletter/email → `EMAIL` · unsure/multiple → `OTHER`.

`platform` is _attribution metadata_, not a tracking config — it doesn't fire any pixel; that's `update_domain_tracking`.

### Never put the platform in the funnel _name_

The platform belongs in the `platform` field **only** (it renders in its own column everywhere and is editable later). Name funnels after the **business / offer / angle**, never the traffic source. ✅ `name: "PerkPoint — Benefits Savings", platform: "META"` · ❌ `name: "PerkPoint — Meta — Benefits Savings"`. Applies to `update_funnel` renames, page slugs, and variant names too.

---

## Domain references — match casual mentions to existing verified domains

Users speak in casual root-domain shorthand. _"Use harborhomes.example"_ almost always means the verified subdomain they already set up (e.g. `my.harborhomes.example`), NOT "verify the apex from scratch."

1. **Always call `list_domains` first** when the user mentions a domain.
2. **If a verified (`status: ACTIVE`) domain whose root matches exists, use it** — and say so (_"using your verified my.harborhomes.example"_). Two matching subdomains → ask which.
3. **Only treat the mention as a new-domain request if no matching root is verified**, and confirm before `create_domain`.
4. **Never propose verifying an apex** when the user clearly has a working subdomain on it.

---

## CRITICAL — form field names are a contract

The server REFUSES `create_variant` / `update_variant` / `patch_variant_html` / `bulk_create_variants` when a form breaks either rule below, and the error names the exact fix. Get it right the first time:

1. **Contact fields are ALWAYS named `first_name`, `last_name`, `email`, `phone`.** No matter what the user, the template, the CRM or a previous page calls them — never `firstName`, `fname`, `email_address`, `phone_number`, `mobile`, `tel`. Destination-side names (HubSpot `firstname`, LeadProsper `FirstName`, ActiveCampaign `field[3]`) are handled by the field map at serve time; the FORM side is always these four.
2. **NEVER respell a field that is already on any variant of the funnel.** The same question carries the same `name` on every variant, forever. Before authoring or editing a form on a funnel that already has variants, call `get_form_destinations(funnel_id)` and reuse `formFields` verbatim — that list is every input name across the funnel's variants plus declared fields. Adding a NEW question is fine (pick a snake_case name); renaming an existing one (`employees` → `company_size`, `phone` → `phone_number`) is not, even on a brand-new variant. A rename splits the CRM field map and every downstream join. If a live funnel already uses a non-standard contact name, keep the funnel's spelling — consistency wins, and the response says so under `fieldNameNotes`.

## Page-structure rules (non-negotiable)

These conventions are enforced by the serve pipeline. Violating them won't reject the variant on write, but the page will mis-track at runtime.

**Scaffold first, always.** Before authoring any NEW variant HTML, call `get_page_scaffold(page_type)` and build on what it returns — a contract-perfect skeleton (control-field placement, form shape, `data-step` sections, `<main>` landmark) guaranteed to clear the write-time audit and the publish validator with zero warnings. Replace the `REPLACE:` markers with real content; keep the structure exactly as given. Freehand HTML is how contract violations happen; the scaffold is how pages come out correct on the first provide regardless of which model is driving.

**Before generating or editing ANY variant HTML, STOP and read [resources/PAGE-BUILDING.md](./resources/PAGE-BUILDING.md)** — it has the full form-wiring guide, quiz scaffold, embed tables, styling paths, brand-kit application, a11y and performance detail, and the publish-validator code playbook. Do not author page HTML from memory. The hard rules it expands on:

1. **Forms are zero-PII.** Granvl never stores form content — there is nowhere on granvl's side that could hold an email, phone, or address from a form. Every form MUST point at an external destination for the lead to be captured; **call `get_form_destinations(funnel_id)` before authoring any form** — to learn which FIELDS the destination expects, not to hardcode wiring. Author a BARE form (no `action`, no `method`, no vendor hidden fields) with `_next={{THANK_YOU_URL}}`; granvl wires delivery at serve time (primary adapter + fan-out + injected credentials), and the publish validator strips any hardcoded action (`form_action_stripped` = the contract working, not an error). The rendered DOM may show `action="/api/form-submit"` while deliveries still reach every saved destination — verify with `send_test_lead`, never by inspecting the DOM. No destination → warn the user (leads aren't delivered anywhere). Field names are ALWAYS snake_case, consistent across variants — see **CRITICAL — form field names are a contract** above.
2. **Never fire conversions manually for funnel progressions** — the serve route and injected script handle form-submit, click-through, and TY-fallback conversions automatically. Add `data-pages-convert` only to external outbound links that should count as conversions.
3. **Quizzes are single-page.** One QUIZ page per funnel (the tools reject a second), every step a `<section data-step="N">` inside ONE `<form>`, `_next` included, nav buttons `type="button"`. Multi-page quizzes are an antipattern and publish blocks on them.
4. **Embedded booking widgets / third-party forms are invisible to tracking unless declared.** Booking embeds → set `embedded_widget` on the variant. Embedded third-party forms → vendor redirect to the TY page + `update_funnel({ thank_you_view_conversion: true })`.
5. **Styling: Tailwind utilities or plain `<style>` CSS.** Three patterns break the precompile and cost real page speed: inline `tailwind.config`, `@apply` in `<style>`, and JS class toggling. Use CSS-only interactivity.
6. **Brand kit is yours to own.** Read it before building (`get_brand_kit`), fill it proactively when thin, bake actual hex/font values into the HTML, honor `brandMode: true` as a hard lock (ask before overriding).
7. **Accessibility minimums:** exactly one `<main>` wrapping primary content, text contrast ≥ 4.5:1 (3:1 for large text), `alt` on every image (empty `alt=""` for decorative), one `<h1>`.
8. **Performance:** host images via `upload_image` (never hotlink; for LOCAL files use `start_image_upload` → PUT the raw bytes to the signed URL → `finish_image_upload`, so nothing rides your context window), CSS gradients over raster gradients, fonts via the preload+onload pattern with ≤3 weights per family, hero `<img>` gets `fetchpriority="high"` + `width`/`height`, no third-party analytics SDKs, **never paste ad-pixel snippets into page HTML** (configure via `update_domain_tracking` — the platform injects them interaction-gated; any OTHER third-party script the user wants on every page — chat widget, consent tool, heatmaps, a vendor pixel granvl doesn't support — goes in the domain's custom-script slots via `update_domain_scripts`, never inline in a variant), scripts deferred or at body-end, total page weight under ~1.5 MB.
   8a. **Funnel shape: at most ONE page of each type.** A funnel is LANDING → QUIZ or FORM → THANK_YOU → MAGNET, one of each (the server rejects seconds). Multi-step quizzes/forms live INSIDE their single page (`data-step` sections). A different offer or audience gets its own funnel (`create_funnel`); an alternative version of a page is a VARIANT (`create_variant`) — that's what makes A/B stats work. The one sanctioned exception: TWO thank-you pages when using qualified/unqualified audience routing (`qualification_audience`).

8b. **Lead magnets — deliver the promised asset from the thank-you page.** Two shapes, both ungated (anyone with the URL can open them):

- **Hosted file (PDF or HTML) in the workspace library:** `upload_lead_magnet` with `source_url` (public URL), `html` (the document itself — use this for an HTML ebook on disk), or `data` (base64). Pick the domain with `domain` or `funnel_id`. granvl hosts it at `https://{domain}/{slug}` and the response returns the `url`; `list_lead_magnets` shows everything already in the library (+ served-download counts) — reuse an existing one rather than re-uploading. Link it from a thank-you page button exactly the same way whether it's a PDF or HTML: `<a href="https://{domain}/{slug}">Get the guide</a>`. This is the same library the user sees under Resources → Lead magnets.
- **HTML magnet page:** create a page with `type: "MAGNET"` and author the magnet itself as the variant (guide, checklist, video page — nicer on mobile than a PDF and A/B-testable). Link it from the TY page by its slug. MAGNET pages never count as a funnel step or a conversion, never get a form (validator warns `magnet_has_form`), and don't change click-through derivation.

9. **Every lead-capture funnel ends on a working thank-you page — build it without being asked.** Assume the user won't think to ask; a form that dead-ends after submit reads as broken and drops the conversion redirect. Keep the auto-created `THANK_YOU` page, author a REAL variant on it (confirmation + what happens next — never leave the page empty or default), and point every form at `_next="{{THANK_YOU_URL}}"`. The only exception is `click_through` funnels, which have no form and no TY page by design.
10. **Legal footer: never block a build on it.** If `get_funnel` → `legal.privacyPolicyUrl` is set, every variant links it in the footer; if it's null, build anyway and skip the footer links — NEVER ship a placeholder link (`#`, `/privacy`, example.com) and never stop a first build or preview to demand legal pages. The requirement lands at **custom-domain publish / paid-traffic time**: ad platforms reject landing pages without a discoverable privacy policy, and publish injects a plain fallback footer if the URLs exist but you omitted them. When the user moves to publish on a custom domain or run ads, that's the moment to have them add their URLs in Settings → Domains → Legal & compliance.

### Forbidden patterns

| Pattern                                                                                                    | Why it breaks                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Third-party form hosts (Formspree, Netlify Forms, etc.) hardcoded as `action` outside the destination flow | Form data bypasses Granvl's form-submit pipeline; conversions don't track.                                                                                                    |
| External `<script>` analytics (GA, Mixpanel, Plausible, Heap, Clarity)                                     | Conflicts with first-party analytics AND adds 30-100 KiB of blocking JS each. Use the domain's tracking config instead.                                                       |
| HubSpot Marketing full snippet                                                                             | ~70 KiB of mostly-irrelevant CRM tracking. Booking → slim Meetings iframe + `embedded_widget: 'hubspot_meetings'`. Lead capture → `set_form_destination(provider='HUBSPOT')`. |
| Raster image used as a gradient                                                                            | CSS gradients are 0 bytes and pixel-perfect.                                                                                                                                  |
| Bare `<link rel="stylesheet">` for Google Fonts                                                            | Adds ~750ms to FCP on slow 4G. Use the preload + onload pattern.                                                                                                              |
| Loading 5+ weights of one font family                                                                      | Wasteful. Cap at 3 per family.                                                                                                                                                |
| `<base href>` injection                                                                                    | Breaks the form-action rewriter.                                                                                                                                              |
| Setting `action` or `method` on a bare `<form>` (no-destination path)                                      | Auto-rewrite drops your value anyway — leave it off.                                                                                                                          |

### Test every funnel end to end — unprompted, every time

Assume the user is not technical and will NOT ask for this. An untested funnel is an unfinished funnel — never hand one over with "let me know if it works."

After publishing (or before handing over a preview for review):

1. **Get a test-drive link:** `create_test_link(funnel_id)` returns the LIVE page URLs with a signed test token. Everything you do on those URLs runs the real flow (forms, validation, qualification, thank-you redirect, tracking) but **nothing reaches the user's CRM or ad platforms**, and every analytics row is tagged as test — so you can test as hard as you like without the client seeing junk leads.
2. **Walk every page** via the test link. Confirm each renders, the copy is right, and nothing breaks at mobile width. Quizzes: click through every step, including validation errors (submit empty once).
3. **Submit a test lead through the test link** with obviously fake data (first name "Test", `test@example.com`). Confirm the submit redirects to the thank-you page and `get_funnel_stats` (range `24h`) shows the visit and the conversion.
4. **Clean up — mandatory.** When testing is done, call `cleanup_test_data(funnel_id)`. It deletes every test row and heals the stats. Never skip this; never leave test traffic in a funnel you hand over.
5. **Verify real delivery once** when you wired a NEW destination: a test-drive submit can't prove the CRM field mapping, so finish with one `send_test_lead` (Webhook/GHL/Zapier) or one real submit on the live page (other destinations) and ask the user to confirm + delete it from their CRM.
6. **Tell the user what you tested** in one or two lines.

Note: the SMS verification popup is skipped in test mode (no SMS spend on tests) — if the funnel uses 2FA and the user wants it proven, do one real submit with their phone number.

If any link in that chain fails, fix it before reporting the funnel as done.

### The write-time audit comes first

`create_variant` and `update_variant` return an `htmlAudit` block whenever your HTML misses the platform contract. Treat it as a build failure: **fix every `htmlAudit.warnings` entry with `update_variant` before doing anything else** — these are serve-time contracts (phone/email selectors, submit controls, `_next` on quizzes, honeypot name collisions, consent) that publish does NOT correct and that fail silently in front of visitors. `htmlAudit.publishWillAutoFix` is informational — publish normalizes those for you — but a page that triggers neither list is the goal: author to the canonical shape and both stay empty.

### Publish is the safety net, not the target

**Publish is also when wiring lands on the live site.** The bake is where form actions, destination adapters, fan-out, credentials, and injected fields are applied — so form, destination, and field changes only take effect on the live site after a re-publish. Changed a form or its destination on a published funnel? Re-`publish_funnel` before verifying anything live.

`publish_funnel` runs every variant through a deterministic validator and returns `validation.autoFixes` + `validation.warnings` (stable codes) plus `budgetViolations[]` (performance budgets, warn-only). **Walk every warning and budget violation in the same session** — fix via `update_variant`, re-publish, repeat until clean. Never tell the user a page is "fully optimized" while `budgetViolations` is non-empty. After publish, `get_page_speed` returns the Lighthouse score (hourly re-score; `pending` right after publish) — if score < 90, apply the `opportunities[]` and republish. The full code → fix playbook is in [resources/PAGE-BUILDING.md](./resources/PAGE-BUILDING.md) §6.

---

## Editing variants — read first, then edit

For a small change to an existing variant, **DO NOT regenerate the entire HTML from scratch** — you'll silently lose the rest of the page's design and invalidate provenance. The sequence is always:

1. `get_variant_html(variant_id)` — pull the current HTML
2. Make the targeted change
3. `update_variant(variant_id, html_content, change_summary)`

**ALWAYS provide `change_summary`** — a tight one-liner of what you changed and why. It becomes the label on the edit markers in `get_variant_history`; an unlabeled marker forces the reader to guess.

**Edit vs. new variant — default to EDIT.** _"Change / edit / fix / tweak / update X"_ → `update_variant` on that same variant, and keep using the _same_ variant id across iteration rounds (five tweaks = five updates to one id, not five new variants). Call `create_variant` / `bulk_create_variants` **only** when the user explicitly wants a new variant alongside (_"new variant"_, _"A/B test this against..."_). Zero-traffic funnels: edit in place, always — new-variant clutter has no upside there.

**Fork, don't overwrite, on teammates' work.** _"Version / fork / copy / based on"_ → `duplicate_variant` (weight 0) + iterate on the copy; never `update_variant` on someone else's live variant. Ambiguous (_"change the CTA on Sarah's page"_) → default to duplicate and offer to edit directly instead. The asymmetry of mistakes favors forking (cheap to delete) over overwriting (silent data loss).

**The stat-pollution guardrail (server-enforced).** Editing `html_content` on a variant with real traffic blends two pages' stats under one id, so `update_variant` **blocks** with `requiresAck: true` at ≥100 visitors OR ≥5 conversions OR any paid traffic (soft-warns below that; no guardrail at 0 conversions). When blocked: default to `duplicate_variant`; if the user explicitly chooses to edit live anyway, surface the trade-off, and only then retry with `acknowledge_stat_pollution: true`. **Never set that flag on your own initiative** — the user consents, not you.

Recipes (cross-funnel duplication, `TYPE_MISMATCH`, funnel cloning, the guardrail response shape) are in [resources/PAGE-BUILDING.md](./resources/PAGE-BUILDING.md) §7.

---

## Lead qualification — the closed-loop signal

A `CONVERSION + action=form_submit` says the visitor submitted; a `LeadQualification` row says whether the lead was any good. Three paths populate it:

- **Rule-based** (synchronous): `set_qualification_rule(funnel_id, rule)` — a JSON rule evaluated against form data **in memory at submit time**; the result is recorded, then the field values are discarded (zero-PII by design). For external-CRM forms the rule runs client-side in the visitor's browser — values never leave the device. Rule shape: `{ type: 'all'|'any', conditions?: [{ field, op, value }], children?: [Group] }`, nested up to 5 levels; full shape + operators in [resources/REFERENCE.md](./resources/REFERENCE.md). Note: the dashboard builder only edits flat rules; nested ones render read-only there.
- **Webhook-back** (asynchronous): every submission carries `granville_lead_id` (plus `granville_variant_id` / `granville_funnel_id`, so the CRM knows which variant produced the lead); the user's CRM/Zapier POSTs `{ lead_id, qualified, value? }` to the workspace's qualify URL when a deal closes. `get_qualify_webhook_url()` returns URL + setup notes.
- **Manual flips**: `mark_lead_qualified(session_id, funnel_id, qualified, value?, reason?)` — use sparingly.

**Declare form schemas with `set_funnel_form_fields`** whenever you build or change a form — the rule UI then offers real dropdowns instead of field names guessed from your HTML.

**Optimization implication:** when a funnel has qualification data, compare variants on `qualifiedConvRatePct`, not raw `convRatePct` — the variant producing more qualified leads is the one to scale. Qualified vs. unqualified leads can also route to different thank-you pages (`qualification_audience` on TY pages) — recipe in [resources/PAGE-BUILDING.md](./resources/PAGE-BUILDING.md) §8.

---

## Reading visitor behavior — sessions + journeys

When the user asks "what happened with this lead?" or "why is bounce rate spiking?", read the journey rows instead of guessing: `list_session_journeys(funnel_id?, funnel_type?, qualified?, converted?, audience_cohort?, ...)`. Each row carries visitor identity (60-day persistent), session (30-min sliding boundary), `pagePath`, `variantPath` (joinable to VariantVersion for the exact HTML seen), `audienceCohort` (e.g. `"mobile_paid_meta"`), form-submitted flag, outcome, qualification, deal value, and engagement. The dashboard renders the same rows in the funnel detail page's Session Journeys widget.

**Stratify with cohorts when reporting on a test**: "this variant beats the other on `mobile_paid_meta` but ties on `desktop_organic`" is the kind of signal that makes A/B results actionable instead of mushy. Full field reference in [resources/REFERENCE.md](./resources/REFERENCE.md).

---

## Variant metadata — required attribution fields

Every `create_variant` **and** `bulk_create_variants` call **requires** five attribution fields — the MCP rejects calls without them. They fuel the per-attribute conversion breakdowns ("which angle converts best") and force you to articulate the hypothesis before shipping.

| Field               | What goes here                                                                                      | Format       |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------ |
| `headline`          | The verbatim H1 you wrote — copy/paste from the HTML, don't paraphrase                              | ≤ 500 chars  |
| `angle_hypothesis`  | 1–2 sentences on **why this should convert** — the persuasive thesis, specific about the psychology | ≤ 2000 chars |
| `value_proposition` | One sentence on what the page concretely promises                                                   | ≤ 500 chars  |
| `target_audience`   | One sentence on who this variant is built for                                                       | ≤ 500 chars  |
| `form_factor`       | Short structural description (long-form, quiz-first, VSL, etc.)                                     | ≤ 200 chars  |

`bulk_create_variants` takes the same five fields **per item** in the `variants` array. `update_variant` accepts them optionally — provide updated values whenever an edit shifts the headline / angle / value-prop / form (a weight change alone doesn't need them). There is no `status` field on `update_variant`: pause = `weight: 0`, activate = `publish_funnel`. A worked example + the optional bucket-field vocabularies are in [resources/PAGE-BUILDING.md](./resources/PAGE-BUILDING.md) §9.

---

## Optimization heuristics — when to recommend each action

Read variant stats from `get_funnel_stats` (NOT `get_funnel` — structure-only) and apply this tree. Prefer the qualified-rate signal when the funnel has qualification data. For channel/audience/creative questions use `get_segmented_stats(funnel_id, dimension)` (`utmSource` / `device` / `headlineType` / etc.); ignore tiny-sample buckets.

- **Sample-size gate:** visitors per variant < 100 → "not enough data yet"; no pause/promote below the floor regardless of conv rate.
- **Pause** when a variant has >200 visitors and a conv rate <30% of the leader's (leader also >200 visitors). Action: `set_weights` — loser to 0, redistribute (weights still sum to 100). Weight 0 IS the pause signal.
- **Promote (winner takes all)** when one variant has >500 visitors, conv rate >140% of next-best, AND the gap holds across mobile + desktop separately (no Simpson's-paradox flips). Action: `set_weights` winner 100, others 0.
- **Flag, don't act:** mobile vs desktop conv gap >2×; top traffic source converting <50% of funnel average; one geo >50% of conversions but <20% of visitors (possible bot inflation). Tell the user, pointing at the funnel detail page.
- **Archive** a variant only after ≥14 days at weight 0 AND user confirmation. `delete_variant` soft-deletes (archives) — it preserves the audit trail; never suggest anything harder.

Narrate every action with the data that drove it ("Paused Variant 5 — CTR dropped 38% over 200 visitors").

---

## Activity narration — what shows up in the dashboard

Every successful MCP tool call writes to the user-visible activity feed, and **your tool-call response message becomes the entry**. Good: `"Generated 2 new variants for Northline Delivery Hiring — pain-point hero + urgency CTA angles"`. Bad: `"Done."`, `"Tool call completed successfully."` The verb is auto-derived from the tool; your job is the rest — funnel name, the change, the data behind the decision.

---

## What this skill does NOT cover

- **Initial domain DNS setup** — the user adds the CNAME themselves; you verify after by polling `get_domain`.
- **Stripe / payments / billing** — out of scope. Use `data-pages-convert` to mark the click; the checkout is theirs.
- **Email lifecycle / nurture** — Granvl routes form submissions to user-chosen integrations. Don't try to send mail from the platform.
- **Multi-page quizzes** — every quiz is single-page; authoring blocks multi-QUIZ funnel shapes.
- **Branching quiz logic** — not yet supported. Build linear single-page quizzes for now.

For paid-ads strategy or general marketing unrelated to Granvl's product surface, use base knowledge — this skill adds nothing there. Copywriting is NOT in that bucket any more: granvl has a copy library and a framework, and both are covered below.

---

## Read next — required reads by task

- Authoring or editing page HTML → [resources/PAGE-BUILDING.md](./resources/PAGE-BUILDING.md) **(required before writing HTML)**
- Writing headlines, subheadlines or ad copy → [resources/COPYWRITING.md](./resources/COPYWRITING.md) **(required before writing copy anywhere — page, ad, or library)**
- Meta campaigns → [resources/META-ADS.md](./resources/META-ADS.md) **(required before any Meta build)**
- Google Search / Demand Gen → [resources/GOOGLE-ADS.md](./resources/GOOGLE-ADS.md) **(required before any Google build)**
- Microsoft Ads → [resources/MICROSOFT-ADS.md](./resources/MICROSOFT-ADS.md) **(required before any Microsoft build)**
- Tool args, schema, serve runtime, error catalog → [resources/REFERENCE.md](./resources/REFERENCE.md)
- A/B sizing, CRO patterns, diagnosis playbooks → [resources/OPTIMIZATION.md](./resources/OPTIMIZATION.md)
- Golden-path scripts → [resources/EXAMPLES.md](./resources/EXAMPLES.md)
