# Granvl — Golden-path conversation scripts

Each section below is a full user-↔-assistant flow showing the MCP tools you'd call, the order, and what the AiActivity row should look like. Lift these patterns rather than improvising.

For schema and tool args, see [REFERENCE.md](./REFERENCE.md). For the high-level rules, see [../SKILL.md](../SKILL.md).

---

## 0. First session — brand-new workspace (the onboarding build)

This is the very first thing a new user experiences. They've just connected you and they're on the onboarding **"build"** screen, watching for a real page to appear. See SKILL.md → "Brand-new workspace → build a first page immediately."

### Step 1 — Detect the fresh workspace

```
list_funnels                 → []
```

No funnels = new workspace. Run a *tight* intake (don't interrogate — two questions, or accept a URL):

> Welcome! Tell me two things and I'll build you a live page right now: what's the business, and what's the one action you want visitors to take (book a call, buy, sign up)? A link to your current site is enough if you've got one.

> **User:** "Acme Perks — a perks platform for small-business teams. Want people to book a demo. acme.com"

### Step 2 — Build immediately (don't pause)

```
create_funnel({ name: "Acme Perks — demo", funnel_type: "standard", platform: "META" })
  # → auto-bootstraps a LANDING + THANK_YOU page. Grab the LANDING page.id.
create_variant({
  page_id,            # the auto-created LANDING page — no create_page needed
  name: "v1",
  headline: "Perks your team actually uses",
  angle_hypothesis: "benefit-led hero converts cold demo traffic",
  value_proposition: "Book a 15-min demo, launch perks this week",
  target_audience: "SMB ops / people leads",
  form_factor: "minimal hero + single CTA",
  html_content: "<!-- clean on-brand hero: headline + subhead + 'Book a demo' CTA + one supporting section -->"
})
```

One funnel, the auto-created LANDING page, one variant. No A/B test, no multi-page funnel — speed-to-live wins.

### Step 3 — Hand them the live page + offer the first edit

Give them the `previewUrl` from the `create_variant` response:

> Done — your first page is live: {previewUrl}. It'll pop up on your onboarding screen in a sec too. Want me to make the headline punchier, add a testimonial, or try a different CTA colour?

**Do NOT `publish_funnel`** — there's no domain yet; the preview URL is the deliverable. Publish later, when they connect a domain.

**Activity rows:** `Created funnel "Acme Perks — demo"`, `Created variant "v1"` (verb: `created`, color: green).

---

## 1. "Build me a landing page for X"

> **User:** "Build me a landing page for our hiring campaign — Northline Delivery Hiring. We want to capture name, email, phone for delivery driver roles in Vancouver."

### Step 1 — Default to new (don't search for an existing match)

The user said *"build me a landing page"* — that's the **default-to-new** trigger from the SKILL.md "New funnel vs. new variant" rule. Don't `list_funnels` looking for a "Northline Delivery Hiring" funnel that might already exist; just build new. Funnels are cheap to delete; mis-attached variants corrupt experiment integrity.

The exception: only search for + reuse an existing funnel when the user explicitly says *"new variant"*, *"another version"*, *"add to [funnel name]"*, or names a specific existing funnel. *"Build me a landing page for X"* is not that.

### Step 2 — Ask which platform first, then create the funnel

The user hasn't mentioned a channel ("Meta", "TikTok", etc.) so ask before calling `create_funnel`. `platform` is required:

> Which platform is this for — Meta, Google Search, TikTok, something else?

Once they answer (say *"Meta"*):

```
create_funnel({
  name: "Northline Delivery Hiring",
  description: "Delivery driver hiring — Vancouver",
  funnel_type: "standard",
  platform: "META"
})
```

If the user had said *"build me a landing page for my Meta ads"* in the original prompt you'd skip the question and just confirm casually in Step 3 ("Built this for Meta — let me know if that's wrong").

Response will include the two auto-bootstrapped pages: a LANDING and a THANK_YOU. Capture both `page.id` values.

**Activity row written:** `Created funnel "Northline Delivery Hiring"` (verb: `created`, color: green)

### Step 3 — Draft the LANDING variant

Generate the HTML following the form-driven template in REFERENCE.md. Pick metadata that matches the brief:
- `headline_type`: `benefit` (driver pay benefit)
- `cta_type`: `sign-up`
- `angle`: `value`
- `page_style`: `minimal`

```
create_variant({
  page_id: "<LANDING page id>",
  name: "Hiring v1 — benefit hero",
  html_content: "<!doctype html>...",
  weight: 100,
  headline_type: "benefit",
  cta_type: "sign-up",
  angle: "value",
  page_style: "minimal"
})
```

**Activity row written:** `Generated variant "Hiring v1 — benefit hero" — Benefit headline · Value angle` (verb: `generated`)

### Step 4 — Draft the THANK_YOU variant

The thank-you variant doesn't get A/B'd; one variant at 100%.

```
create_variant({
  page_id: "<THANK_YOU page id>",
  name: "Thank you — default",
  html_content: "<!doctype html>...",
  weight: 100
})
```

### Step 5 — Hand off

Don't activate the variants yet. Reply to the user with:

> Built `Northline Delivery Hiring` with a benefit-led landing + thank-you page. Both are in DRAFT — preview URLs:
> - Landing: `<previewUrl>`
> - Thank-you: `<previewUrl>`
>
> Once you've connected a domain (`/dashboard/domains` or ask me to walk through DNS), I'll flip them to ACTIVE.

The user will likely say "looks good, ship it." That's when you `publish_funnel` — publishing is the ONLY thing that flips variants to ACTIVE (`update_variant` has no `status` field) — AFTER confirming a domain is attached.

---

## 2. "Add a new variant to test against the current one"

> **User:** "Make a second variant for Northline Delivery Hiring — try a question headline this time."

### Step 1 — Find the page

```
get_funnel({ funnel_id: "<id>" })
```

You need:
- The LANDING page's `id`
- The existing variant's `weight` so you can rebalance

### Step 2 — Create the new variant

If existing variant is at 100%, create the new one at 50% and we'll rebalance:

```
create_variant({
  page_id: "<LANDING page id>",
  name: "Hiring v2 — question hero",
  html_content: "<!doctype html>...",
  weight: 50,
  headline_type: "question",
  cta_type: "sign-up",
  angle: "value",
  page_style: "minimal"
})
```

### Step 3 — Rebalance weights

`set_weights` requires every variant on the page. Get them from `get_funnel`:

```
set_weights({
  page_id: "<LANDING page id>",
  weights: [
    { variant_id: "<v1 id>", weight: 50 },
    { variant_id: "<v2 id>", weight: 50 }
  ]
})
```

### Step 4 — Activate the new variant

`create_variant` defaults to `DRAFT`. The user expects a 50/50 test — set the weights, then publish (publishing is what activates variants; there is no `status` field on `update_variant`):

```
set_weights({ page_id: "<page>", weights: [
  { variant_id: "<v1 id>", weight: 50 },
  { variant_id: "<v2 id>", weight: 50 },
]})
publish_funnel({ funnel_id: "<funnel>", confirm: true })
```

### Step 5 — Reply

> Added `Hiring v2 — question hero` and split traffic 50/50 with v1. Both are live now.
>
> Preview the new one: `<previewUrl>`
>
> First meaningful comparison usually needs ~100 visitors per variant — I'll check back in once we have a sample.

---

## 3. "Pause the underperformer"

> **User:** "Hiring v2 isn't working — pause it and put all the traffic on v1."

### Step 1 — Validate the call before acting

```
get_funnel_stats({ funnel_id: "<id>" })
```

Look at the variant rows (visitors, conversions, primaryMetric, convRatePct, qualifiedConvRatePct). Apply the heuristics from `SKILL.md`:

- v2 visitors ≥ 200? ✅
- v2 conv rate < 30% of v1's? Calculate from the response.
- v1 visitors ≥ 200? ✅

If any fails, push back: *"v2 only has 73 visitors — too early to call. Want to wait until each variant has at least 100 visitors?"*

If the heuristics pass, proceed.

### Step 2 — Pause the variant (route its traffic away)

```
set_weights({
  page_id: "<LANDING page id>",
  weights: [
    { variant_id: "<v1 id>", weight: 100 },
    { variant_id: "<v2 id>", weight: 0 }
  ]
})
```

Setting the loser's `weight: 0` *is* the pause — it stays on the page (HTML + analytics history preserved) but gets 0 traffic.

**Activity row written:** `Routed traffic on "Hiring"` (verb: `weights_set`, renders as "Routed", color: green).

But the body should be richer. Compose your tool response message as something the user will see in the dashboard:

> Paused Hiring v2 — question hero (weight 0). CTR was 38% lower than v1 over 247 visitors.

### Step 3 — Reply

> Paused v2 (3.1% conv vs v1's 5.0% over 247 visitors) and routed 100% to v1.
>
> If you want to revive v2 later, ask me to reactivate it — the HTML is preserved.

---

## 4. "Promote the winner — full traffic"

> **User:** "Hiring v3 is clearly winning. Push all traffic to it."

### Step 1 — Validate the call

```
get_funnel_stats({ funnel_id: "<id>" })
```

Check the promotion criteria:
- Winner's visitors > 500? ✅
- Winner's primary-metric rate > 140% of next-best? Calculate from `convRatePct` (or `qualifiedConvRatePct` if the funnel has a qualification rule).

### Step 2 — Run the cohort check (Simpson's-paradox guard)

```
get_cohort_comparison({ funnel_id: "<id>" })
```

For each row (cohort), check whether the headline winner is also the per-row winner. If a major cohort (>10% of traffic) flips to a different winner, **DO NOT promote** — surface the conflict to the user and recommend keeping both running instead.

If the winner holds across the top cohorts, proceed.

### Step 3 — Set winner to 100%

```
set_weights({
  page_id: "<LANDING page id>",
  weights: [
    { variant_id: "<winner id>", weight: 100 },
    { variant_id: "<other 1>", weight: 0 },
    { variant_id: "<other 2>", weight: 0 }
  ]
})
```

### Step 4 — Record the lesson

```
save_learning({
  variant_id: "<winner id>",
  title: "Pain-point hero won 7.4% vs 4.1% on Northline Hiring",
  outcome: "WINNER",
  // Capture the experiment, not just the verdict:
  change_type: "HERO",
  change_summary: "aspirational hero → pain-point hero",
  hypothesis: "Naming the pain converts cold paid traffic better than aspiration",
  metric: "conversion_rate",
  baseline_value: 0.041,
  result_value: 0.074,
  notes: "Held across mobile_paid_meta + desktop_organic_search. Promoted at 612 visitors per variant."
})
```

Future tests read this back via `get_research_history` (curated: wins / avoid / lift) or `list_learnings` (raw) — so you build on the win and never re-run a known loser.

### Step 5 — Reply

> Promoted Hiring v3 — pain-point hero to 100% traffic. Winning rate was 7.4% vs the field's 4.1% average over 612 visitors. Lead held across `mobile_paid_meta` and `desktop_organic_search` cohorts, so I flipped the switch.
>
> The other variants stay live but get no traffic — flip them to ARCHIVED later if you don't plan to revisit. Recorded the lesson for future tests.

**Activity row written:** verb is `weights_set` (`Routed`) with body like `Set traffic weights on 3 variants`. The richer message in your reply text is what the user reads.

---

## 5. "What happened today?"

> **User:** "Anything change while I was out?"

### Step 1 — Don't call any mutation tools

This is purely a read. The user wants a digest, not an action.

### Step 2 — Read what's relevant

```
list_funnels()
```

You'll get every funnel + page-and-variant counts. From there, decide what's worth summarizing — recently updated funnels are most likely interesting.

For specific drill-downs, link the user to the dashboard:

- Workspace overview: `/dashboard`
- Per-funnel detail (KPIs, breakdowns, session journeys): `/dashboard/funnels/<id>`

### Step 3 — Reply

> Three of your six funnels saw activity since yesterday:
>
> - **Northline Delivery Hiring** — 47 new visitors, 3 conversions (6.4% rate). v3 is leading.
> - **PerkPoint — Meta** — 142 visitors, 8 conversions. Mostly mobile from Vancouver and Montreal.
> - **Hovr Bracket** — pause v2, the gap to v1 widened to 4x. Want me to handle that?
>
> Full analytics: <https://app.granvl.com/dashboard/funnels>

The "want me to handle that?" line invites the user to authorize a mutation rather than acting unilaterally.

---

## 6. "Publish my funnel"

> **User:** "Looks good, ship it."

### Step 1 — Confirm everything's wired up

You should already know the funnel is in DRAFT with variants ACTIVE and a verified domain attached (via the earlier conversation). If you're unsure:

```
get_funnel({ funnel_id })
```

Look for `domain.status === 'ACTIVE'`, every page has at least one variant, weights sum to 100.

### Step 2 — Call publish_funnel

```
publish_funnel({ funnel_id })
```

The platform validates HTML on every variant, auto-fixes mechanical issues (form action stripping, viewport meta, _next field, honeypot, etc.), and returns:

```json
{
  "message": "Published \"Northline Delivery Hiring\". 4 auto-fixes applied across 2 variants; 0 warnings.",
  "liveUrl": "https://quote.example.com",
  "validation": {
    "variantsChecked": 4,
    "variantsModified": 2,
    "autoFixes": [
      { "variantId": "...", "variantName": "Hiring v1", "code": "viewport_meta_injected", "message": "..." },
      { "variantId": "...", "variantName": "Hiring v1", "code": "honeypot_field_injected", "message": "..." },
      ...
    ],
    "warnings": []
  },
  "nextSteps": ["Funnel is live. Tell the user the URL: https://quote.example.com"]
}
```

### Step 3 — If there are no warnings, just confirm

> Published Northline Delivery Hiring at https://quote.example.com. The platform auto-fixed 4 things on its way out (added viewport meta + honeypot field on both variants); no warnings to address.

### Step 4 — If there are warnings, walk them one at a time

```
{
  ...,
  "validation": {
    ...,
    "warnings": [
      { "variantId": "v1", "code": "no_conversion_path", "message": "..." },
      { "variantId": "v2", "code": "missing_title", "message": "..." }
    ]
  },
  "nextSteps": [
    "Review the 2 warnings above.",
    "For each warning, see the playbook in the granvl-app skill...",
    "Fix via update_variant (replace html_content...), then re-call publish_funnel.",
    ...
  ]
}
```

For each warning, look up the canonical fix in the skill's "Publish-time validator (the safety net)" table. Usually:

```
get_variant({ variant_id })       (read current HTML)
[fix the issue per the playbook]
update_variant({ variant_id, html_content: <fixed> })
publish_funnel({ funnel_id })     (re-publish; the same warnings should disappear)
```

Then reply summarizing what you fixed:

> Published Northline Delivery Hiring. Initial publish flagged 2 issues: Hiring v1 had no conversion path (added a form with email + _next field); Hiring v2 had no `<title>` tag (set it to "Apply — Northline Delivery Hiring"). Re-published clean. Live at https://quote.example.com.

### Step 5 — Block reasons (publish refused)

If `publish_funnel` throws an error, the funnel isn't ready. The error message lists what's missing — common cases:

| Block reason | Fix |
|---|---|
| "Funnel must have a domain connected" | `update_funnel({ domain_id })` after the user has registered a domain via `create_domain` |
| "Domain must be verified before publishing" | Tell the user to add the DNS record + wait; check with `get_domain` |
| "Page N variant weights must sum to 100 (currently X)" | `set_weights` with corrected values |
| "Page N must have at least one variant" | `create_variant` for that page |
| "URL "/slug" conflicts with funnel "X" on this domain" | Rename the page slug via the legacy UI (no MCP tool yet) or use a different domain |

---

## 7. "Connect a domain"

> **User:** "Hook up `quote.example.com` to the Northline hiring funnel."

### Step 1 — Create the domain

```
create_domain({ domain: "quote.example.com" })
```

Returns `status: PENDING` and DNS instructions.

### Step 2 — Tell the user the DNS step

> Added `quote.example.com`. To verify it, add this DNS record to your provider:
>
> | Type | Name | Value |
> |---|---|---|
> | CNAME | quote | cname.vercel-dns.com |
>
> Once that propagates (usually 5-10 minutes), tell me and I'll attach it to the Northline funnel.

Don't poll the domain status. Wait for the user to confirm.

### Step 3 — When the user confirms

```
get_domain({ domain_id: "<id>" })
```

If `status: ACTIVE`, attach:

```
update_funnel({
  funnel_id: "<northline id>",
  domain_id: "<domain id>"
})
```

If still `PENDING`, ask the user to wait or check their DNS records.

### Step 4 — Publish (this is what activates variants)

The variants are usually still `DRAFT` at this point. There is no activate call — `publish_funnel` bakes the HTML and flips every weighted variant ACTIVE in one step.

```
publish_funnel({ funnel_id: "<funnel>", confirm: true })
```

### Step 5 — Reply

> All set. `quote.example.com` is verified and connected, and v1 + v2 are live. The funnel is reachable at `https://quote.example.com`.

---

## 7b. "Use harborhomes.example for this funnel" (casual domain mention)

> **User:** "Use harborhomes.example for this new funnel."

The user almost certainly means *"the verified subdomain I already have on harborhomes.example"* — NOT *"go set up the apex from scratch."* Treating the literal string as a new-domain request kicks off a verification flow they didn't ask for.

### Step 1 — Always `list_domains` before assuming

```
list_domains()
```

Returns (e.g.):

```
[
  { id: "...", domain: "my.harborhomes.example", status: "ACTIVE" },
  { id: "...", domain: "other-brand.com",  status: "ACTIVE" }
]
```

### Step 2 — Match the root

`harborhomes.example` is the root of `my.harborhomes.example`, which is verified. Use it. Don't ask, don't kick off `create_domain`.

```
update_funnel({ funnel_id: "<id>", domain_id: "<my.harborhomes.example id>" })
```

### Step 3 — Tell the user what you picked

> Hooked the funnel up to your verified `my.harborhomes.example`.

This is the part you can't skip — the user said `"harborhomes.example"`, you used `my.harborhomes.example`. Saying so out loud in the next reply lets them correct you immediately if you guessed wrong.

### Variants

* **Multiple verified subdomains on the root** (e.g. both `get.acme.com` and `try.acme.com` are ACTIVE when user says `"acme.com"`) → ask which one. Don't pick blindly.
* **No matching root verified** (user says `"newbrand.com"`, nothing in `list_domains` matches) → confirm before adding:
  > *"I don't see newbrand.com or any subdomain of it in your verified domains. Want me to add it?"*
  Only kick off `create_domain` after the user says yes.
* **User said the FQDN literally** (`"my.harborhomes.example"`) → use that exact domain, no inference. The "match the root" rule is only for casual mentions.

### Anti-pattern

❌ Don't do this:

```
# User said "harborhomes.example" — agent assumes literal
create_domain({ domain: "harborhomes.example" })
# → starts an apex DNS verification the user never asked for
```

The data was right there in `list_domains`. Use it.

---

## 8. "Why are mobile conversions worse than desktop?"

> **User:** "Mobile conv rate looks bad on the hiring funnel. Why?"

### Step 1 — Read what you can via MCP

The MCP tools don't expose device-split data directly. `get_funnel` gives variant-level stats but not device breakdowns.

### Step 2 — Direct the user to the dashboard

The funnel detail page has the breakdown:

> Mobile/desktop split lives on the funnel detail page `/dashboard/funnels/<id>` — check the Top Devices panel under Visitor analytics.
>
> A few common causes:
> - Form fields are too small or stacked badly on narrow screens
> - The CTA button is below the fold on mobile
> - Phone-number input doesn't show the numeric keyboard (`type="tel"` is missing)
> - Loading-time issues (Web Vitals → LCP > 2.5s on mobile)
>
> If you want, I can pull up the latest LANDING variant HTML and check those specifically.

### Step 3 — If user says yes, audit the HTML

```
get_variant_html({ variant_id: "<currently-active LANDING id>" })
```

Read `htmlContent`. Look for:
- Inputs without explicit type (`type="tel"` for phone, `type="email"` for email)
- Small touch targets (anything < 44×44 pt)
- CTA button position relative to the fold
- Missing viewport meta

### Step 4 — Propose, don't act

> Looking at v3's HTML, two things stand out:
>
> 1. The phone field is `type="text"` — should be `type="tel"` so mobile users get the number pad.
> 2. The CTA "Get my free quote" sits ~720px down the page on a 360-wide phone — likely below the fold.
>
> Want me to draft a v4 with both fixed and split it 50/50 against v3?

Wait for confirmation before generating.

---

## 9. "Set up Meta CAPI / TikTok / GA4 / Google Ads"

> **User:** "Connect Meta CAPI for the Northline funnel."

### Step 1 — Find the right domain

Tracking credentials live on the `Domain`, not the funnel. Multiple funnels on the same domain share one set of credentials.

```
list_domains()
```

Pick the `id` of the domain the funnel is published to (e.g. `quote.example.com`).

### Step 2 — Ask the user for the credentials they need

You can't read the user's Meta account; they paste in:
- **Pixel ID** — Events Manager → Data Sources → your pixel → Pixel ID at the top.
- **CAPI access token** — same page → Settings → Generate access token.

> "I need two things from your Meta Events Manager:
> 1. **Pixel ID** — the long number at the top of your pixel page.
> 2. **CAPI access token** — Settings tab on the same page, click *Generate access token*. Enter that one yourself in granvl → Settings → Tracking → Meta (tokens are never pasted into chat or passed over MCP).
> Give me the Pixel ID here and I'll wire it up."

### Step 3 — Save via update_domain_tracking

```
update_domain_tracking({
  domain_id: "<id>",
  meta_pixel_id: "1234567890"
})
```

The user enters the CAPI token in the dashboard; the tool's `configured` summary shows whether it's set.

The tool returns a `configured` summary across all platforms (Meta, GA4, Google Ads, TikTok, GTM) so you can confirm what's wired up + what's still missing.

### Step 4 — Confirm it's live

> Done. Meta is now configured for `quote.example.com`. Every CONVERSION on this domain fires:
> - **Server-side via Meta CAPI** — the canonical signal, survives ad blockers + iOS 17+ third-party cookie blocks.
> - **Client-side via the auto-injected Meta Pixel** — feeds custom audiences and lookalike pools.
>
> No funnel-level changes needed; the next page render picks up the credentials.

### Step 5 — Other platforms work the same way

Same tool, different fields:

```
update_domain_tracking({
  domain_id: "<id>",
  ga4_measurement_id: "G-XXXXXXXXXX"
})
// GA4 API secret: entered by the user in Settings → Tracking → GA4.

update_domain_tracking({
  domain_id: "<id>",
  google_ads_conversion_id: "AW-123456789",
  google_ads_conversion_label: "abc123XyZ_AbC"
})

update_domain_tracking({
  domain_id: "<id>",
  tiktok_pixel_id: "C123456789"
})
// TikTok Events API token: entered by the user in Settings → Tracking → TikTok.
```

GTM is the escape hatch — only suggest it when the user has a custom tag setup not covered by the per-platform fields above:

```
update_domain_tracking({
  domain_id: "<id>",
  google_tag_manager_id: "GTM-XXXXXXX"
})
```

### What the platform does for you (so you don't tell the user to do it manually)

- **Pixels are auto-injected** at serve time — never tell the user to drop fbq / ttq / gtag scripts into their page HTML. That would conflict with the platform's first-party data layer and trigger the publish-validator's `inline_analytics_script` warning.
- **Server-side forwarders fire automatically** for every CONVERSION event. No webhook setup, no zap, no glue code.
- **Domain-scoped, not funnel-scoped** — set credentials once per domain, every funnel published there inherits them.

---

## 10. "Change the headline on Hero v3"

> **User:** "Change the headline on Hero v3 to 'Get hired in 7 days — no resume required'."

### Step 1 — Read first, edit second (do NOT regenerate)

```
get_variant_html({ variant_id: "<v3 id>" })
```

This is the cardinal rule of edits. The variant has a layout, copy, form, CTA — re-generating from scratch loses everything except the headline you're changing AND invalidates the iteration provenance.

### Step 2 — Make the targeted change in your context

Find the `<h1>` (or whatever wraps the headline) and replace its text. Keep everything else verbatim.

### Step 3 — Save with a change summary

```
update_variant({
  variant_id: "<v3 id>",
  html_content: "<edited HTML>",
  change_summary: "Replaced headline with '7 days, no resume' offer",
  generation_prompt: "Change the headline to 'Get hired in 7 days — no resume required'"
})
```

The platform writes a new `VariantVersion` row tagged `AI_EDITED` with your change summary attached. The version timeline now shows the iteration story.

### Step 4 — Reply

> Updated Hero v3's headline to "Get hired in 7 days — no resume required." The rest of the variant — layout, form fields, CTA — is unchanged. New version saved; you can compare against the previous via `list_variant_versions` or the dashboard's version timeline.

### Step 5 — When to actually regenerate

Skip the read-then-edit pattern only when the user explicitly asks for a full rewrite ("redo this whole landing page from scratch") OR when the existing HTML is structurally broken. Default is **always** read-then-edit.

---

## 11. "Why did this lead bounce?"

> **User:** "Look at the journeys for the Northline hiring funnel — most are bouncing. Why?"

### Step 1 — Read the bouncing journeys

```
list_session_journeys({
  funnel_id: "<id>",
  converted: false,
  closed_only: true,
  limit: 30
})
```

Each row has `pagePath`, `audienceCohort`, `device`, `durationSec`, `maxScrollDepth`, `bounced`. Look for patterns:

- **All same device?** → mobile/desktop diagnosis (OPTIMIZATION.md §8)
- **All same cohort?** → source-mix (OPTIMIZATION.md §9)
- **Most have <10s duration + 0% scroll?** → page is slow or breaking on load
- **Cohort spread is wide but durations cluster low?** → headline isn't engaging

### Step 2 — Look at what they actually saw

For one bouncing row, get the HTML the visitor saw at the time:

```
get_variant_html_at_time({
  variant_id: "<row.variantPath[0]>",
  timestamp: "<row.startedAt>"
})
```

This pulls the version that was live at that visit — even if you've edited since. Useful for "did this version of the headline cause the bounce?" investigations.

### Step 3 — Diagnose + propose

> Pulled 30 bouncing sessions on Northline Hiring. Pattern:
>
> - 24 of 30 are `mobile_paid_meta` (your biggest cohort)
> - Average duration 4 seconds, average scroll 0%
> - All saw Hero v1 — Question — same HTML version
>
> The headline is a question ("Tired of dead-end gigs?") that probably doesn't match the Meta ad copy you're driving with. What's the ad headline that's bringing them in? My guess is the ad promises a benefit ("Earn $25/hr starting Monday") and the LP is asking them an existential question, which feels like a switch-and-bait. Want me to draft a v4 with a benefit headline matching the ad copy?

---

## 12. "Set up qualified-lead tracking"

> **User:** "Only count CEOs at companies with 100+ employees as real leads on the hiring funnel."

### Step 1 — Confirm the form fields exist

```
get_funnel({ funnel_id: "<id>" })
```

(`get_funnel`'s response includes `formFieldHints` — distinct field names parsed from the variant HTML's `<input/select/textarea name="">` attributes. Past submissions are NOT used to derive these because form content is never stored on Granvl servers — zero-PII rule, see SKILL.md.) The user's form needs to capture `role` and `employees` (or whatever names they use). Field names are case-sensitive.

### Step 2 — Set the rule

```
set_qualification_rule({
  funnel_id: "<id>",
  rule: {
    type: "all",
    conditions: [
      { field: "role", op: "equals", value: "CEO" },
      { field: "employees", op: "gte", value: 100 }
    ]
  }
})
```

### Step 3 — Surface the deal-close webhook

The rule alone covers form-submit-time qualification. The webhook closes the loop for downstream deal-close events:

```
get_qualify_webhook_url()
```

### Step 4 — Reply with both halves

> Set the qualification rule on Northline Hiring: only sessions where `role = CEO` AND `employees >= 100` will be marked qualified at submit time. The dashboard's stats display can switch between Total / Qualified / Both — set this on the funnel via `update_funnel({ statsDisplayMode })`.
>
> For deal-close events from your CRM, paste this URL into your CRM's "deal won" automation:
>
> `https://app.granvl.com/api/qualify/<token>`
>
> The CRM should POST `{ "lead_id": "...", "qualified": true, "value": 12000, "reason": "Closed-Won" }`. Every form submission carries `granville_lead_id` (and `granville_variant_id` / `granville_funnel_id`) — your CRM should map that into its outbound payload. Setup walkthrough is in the funnel settings modal under "How to wire this."

### Step 5 — Backfill consideration

The rule only applies going forward — existing form submissions aren't retro-evaluated. Tell the user that explicitly so they don't expect historical data to fill in.

---

## 13. "Is this winner real? — cohort check before promoting"

> **User:** "v3 looks like the winner. Should I push it to 100%?"

### Step 1 — Headline numbers

```
get_funnel_stats({ funnel_id: "<id>" })
```

Confirm: visitors ≥500 per variant, gap ≥1.4×, primaryMetric leader is v3.

### Step 2 — Cohort check

```
get_cohort_comparison({ funnel_id: "<id>" })
```

Walk the row winners. Two patterns:

**Confirm**: every row's winner = v3 (or v3 ties). Promote.

**Flip**: one major cohort's winner ≠ v3. Surface the conflict.

```
                  Hero v3   Hero v1
mobile_paid_meta  18.2%     11.8%   ← v3 wins
desktop_direct     6.1%      9.2%   ← v1 wins!
desktop_organic    9.4%      9.0%   ← v3 (barely)
```

### Step 3a — If confirmed, promote

Same as Example #4 — `set_weights` + `save_learning`.

### Step 3b — If flipped, push back

> v3 leads funnel-wide (12.8% vs 10.4%) but the cohort breakdown flags a problem: on `desktop_direct` (~22% of your traffic), v1 actually beats v3 — 9.2% vs 6.1%. Promoting v3 100% would hurt that segment.
>
> Three options:
> 1. Keep both running. Slower convergence but no segment regression.
> 2. Promote v3 anyway and accept the desktop_direct hit (risk: revenue cohort drops).
> 3. Draft a v4 that combines what works on each (v3's hook + v1's structural pieces). I can do that if you want.
>
> What's your preference?

This is the kind of read that turns a quick "ship it" into a 60-second decision the user makes consciously.

---

## 14. "Spin up a Google Search campaign"

> **User:** "Spin up a Google Search campaign for the Northline hiring lander — $50/day, Canada only."

See GOOGLE-ADS.md for the invariants (always PAUSED, $200/day guardrail, plain URLs — the ValueTrack suffix carries the UTMs).

### Step 1 — Campaign (PAUSED, guardrailed budget, countries required)

Confirm the account (Ads switcher) and the plan before writing, then:

```
create_google_search_campaign({
  account_id: "1234567890",
  name: "Northline Hiring — Search — CA",
  daily_budget_usd: 50,          # capped at min(workspace cap, $200/day)
  countries: ["CA"]
})
```

The response confirms the campaign is PAUSED and that granvl's Google UTM suffix is applied campaign-wide — so every URL from here on stays plain.

### Step 2 — Ad group with PHRASE keywords

```
create_google_ad_group({
  account_id: "1234567890",
  campaign_id: "<from step 1>",
  name: "delivery driver jobs vancouver",
  keywords: [
    { text: "delivery driver jobs vancouver", match_type: "PHRASE" },
    { text: "courier jobs vancouver",         match_type: "PHRASE" },
    { text: "delivery driver hiring vancouver", match_type: "EXACT" }
  ]
})
```

PHRASE/EXACT for lead-gen — BROAD without conversion history burns budget on loose queries. Only reach for BROAD when the user asks for it.

### Step 3 — The Responsive Search Ad (full copy spread)

```
create_google_search_ad({
  account_id: "1234567890",
  ad_group_id: "<from step 2>",
  final_url: "https://jobs.northline.example/drivers",   # PLAIN — the campaign suffix adds UTMs
  headlines: [                                    # 3–15, ≤30 chars each
    "Delivery Driver Jobs",
    "Drive in Vancouver",
    "Weekly Pay, Flexible Shifts",
    "Apply in 2 Minutes",
    "Hiring Drivers Now"
  ],
  descriptions: [                                 # 2–4, ≤90 chars each
    "Deliver in your own vehicle on your own schedule. Weekly pay, no experience needed.",
    "Vancouver routes open now. Apply online in minutes and start this week."
  ],
  path1: "drivers",
  path2: "vancouver"
})
```

Supply the full spread of headlines/descriptions — Google rotates them; one of each wastes the RSA format.

### Step 4 — Reply (the PAUSED close)

> Done — the whole chain is built: campaign "Northline Hiring — Search — CA" ($50/day, Canada), one ad group with 3 phrase/exact keywords, and a responsive search ad with 5 headlines + 2 descriptions pointing at your lander. **The campaign is paused — nothing spends until you flip it on in Google Ads** (one switch: the ad group and ad under it are already enabled). Tracking's handled: granvl's UTM suffix is on the campaign, so spend will join your first-party conversions automatically.

**Activity rows:** `Created Google campaign "Northline Hiring — Search — CA"`, `Created ad group "delivery driver jobs vancouver"`, `Created responsive search ad`.

---

## Anti-patterns (do not do this)

### ❌ Searching for an existing funnel to attach to when the user said "build"

```
User: "build me a landing page for the buyer's guide"
You:  list_funnels()
      # finds "Buyer's Guide" funnel
      create_variant({ page_id: <existing buyer's guide LANDING>, ... })
```

Wrong. The user said *"build"* — that's the default-to-new trigger. Attaching the new generation to the existing Buyer's Guide funnel pollutes its A/B test data with a variant the user never intended to add to that experiment, AND silently overwrites their mental model of their funnel inventory. The right move is `create_funnel` with a fresh name. See Example #1 + the "New funnel vs. new variant" rule in SKILL.md. Reuse only kicks in when the user says *"new variant"*, *"another version"*, *"add to [funnel name]"*, or names an existing funnel by name.

### ❌ Regenerating an entire variant for a small change

```
User: "change the headline on Hero v3 to ..."
You:  create_variant({ ... brand new HTML ... })
```

Wrong. You'll silently lose the rest of the page's layout, copy, form, and CTA — AND lose the edit provenance the version timeline depends on. **Always `get_variant_html` → edit in place → `update_variant`** when the user asks for a targeted change. See Example #10.

### ❌ Promoting without `get_cohort_comparison`

```
User: "v3 is winning. Promote it 100%."
You:  set_weights({ ... }) // straight to action
```

A variant that wins funnel-wide can lose on a major cohort (Simpson's paradox). Always run `get_cohort_comparison({ funnel_id })` before any `set_weights` 100/0 call. See Example #13.

### ❌ Generating Formspree forms

```html
<form action="https://formspree.io/f/abc123" method="POST">
```

The serve route strips `action` and `method` and replaces with the Granvl form-submit endpoint. Old habits from non-Granvl workflows. Don't.

### ❌ Loading external analytics

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXX"></script>
```

Granvl does first-party analytics. GTM is allowed (configure per-domain), but inline `<script>` analytics fights the platform's data layer.

### ❌ Hardcoding the thank-you URL

```html
<input type="hidden" name="_next" value="https://quote.example.com/thank-you">
```

This works until the user moves the funnel to a different domain. Use `{{THANK_YOU_URL}}` — server substitutes correctly regardless.

### ❌ Calling `delete_variant` on the user's behalf without explicit confirmation

```
delete_variant({ variant_id: "...", confirm: true })
```

Always require `"yes, delete it"` from the user before providing `confirm: true`. There's no undo and analytics events are gone.

### ❌ `set_weights` without first reading current variants

```
set_weights({
  page_id: "...",
  weights: [{ variant_id: "<guessed-id>", weight: 100 }]
})
```

`set_weights` requires every variant on the page. Always `get_funnel` first to enumerate them.

### ❌ Promoting a winner with < 500 visitors

The math doesn't support a 95% confidence call below ~500 visitors per variant. Push back politely:

> v3 is leading at 6.2% vs v1's 4.1%, but only over 180 visitors. Statistical noise at this scale could explain a 50% gap. Want me to wait until each has ~500 before promoting, or push it now anyway?

---

## Reference: activity verbs and their rendering

Each MCP tool maps to one of these verbs. Your tool-call response message is the user-visible body.

| Tool | Verb | Verb color in dashboard |
|---|---|---|
| `create_funnel` | `created` | green |
| `update_funnel` | `updated` | gray |
| `delete_funnel` | `deleted` | red |
| `create_page` | `created` | green |
| `create_variant` | `generated` | black |
| `update_variant` (default) | `updated` | gray |
| pause a variant (set its `weight: 0` via `set_weights`) | `weights_set` (renders as "Routed") | green |
| `delete_variant` (archives; history preserved) | `archived` | gray |
| `publish_funnel` activating a variant | `promoted` | green |
| `delete_variant` | `deleted` | red |
| `set_weights` | `weights_set` (renders as "Routed") | green |
| `create_domain` | `created` | green |
| `publish_funnel` | `promoted` (renders as "Promoted") | green |
| `unpublish_funnel` | `archived` | gray |
| `update_domain_tracking` | `updated` | gray |
| `set_qualification_rule` | `updated` | gray |
| `mark_lead_qualified` | `flagged` | green |
| `save_learning` | `created` | green |
| `bulk_create_variants` | `generated` | black |
| `update_page` | `updated` | gray |
| `delete_page` | `deleted` | red |
| `verify_domain` | `updated` | gray |

The verb is auto-derived. Your job is to make the rest of the activity entry — name + decision detail — informative.

**Pure read tools don't write activity rows** (e.g. `get_funnel_stats`, `list_session_journeys`, `get_cohort_comparison`, `get_variant_html`, `get_variant_html_at_time`, `list_variant_versions`, `list_learnings`). They're free for analysis without cluttering the user's activity feed.
