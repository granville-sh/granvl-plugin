# Granvl — Optimization playbook

**This file covers the operational essentials of A/B testing, CRO, and reading analytics — but only the parts that translate to Granvl MCP tool calls.** It is NOT a textbook on those domains. For deep theory, the user has other resources; here you only need to know enough to make the right `update_variant` / `set_weights` / `create_variant` calls.

For schema and tool args, see [REFERENCE.md](./REFERENCE.md). For golden-path scripts, see [EXAMPLES.md](./EXAMPLES.md). For high-level rules, see [../SKILL.md](../SKILL.md).

---

## Table of contents

1. [Sizing an A/B test on Granvl](#sizing)
2. [Calling a winner — the Granvl math](#calling-winners)
3. [Reading `get_funnel_stats` output holistically](#reading-funnels)
4. [Qualified-rate optimization (the closed-loop signal)](#qualified)
5. [Cohort stratification — the Simpson's-paradox check](#cohorts)
6. [Investigating individual sessions (journeys)](#journeys)
7. [What to actually test (CRO patterns)](#what-to-test)
8. [Mobile vs desktop diagnosis](#mobile-desktop)
9. [Source-mix asymmetry diagnosis](#source-mix)
10. [Performance Feed → action mapping](#feed-to-action)
11. [Common reading mistakes](#mistakes)

---

## <a name="sizing"></a>1. Sizing an A/B test on Granvl

Granvl doesn't expose a sample-size calculator MCP tool, so you'll do the math from `get_funnel_stats`'s variant rows. The numbers below are the practical thresholds — they're slightly conservative so the user doesn't ship a "winner" that was actually noise.

**Use `get_funnel_stats` for stats, not `get_funnel`.** `get_funnel` returns structure only; `get_funnel_stats` returns visitors / conversions / clickThrus / qualifiedConversions / per-variant rates with a `primaryMetric` field telling you whether to optimize on conversions or click-throughs for each variant's page type.

### Decision floor: ~100 visitors per variant

Below 100 visitors per variant, **don't make any pause/promote/archive recommendation**. The standard error on a 5% conv rate at n=50 is ±3.1%; you'd be calling a winner on noise. Push back politely:

> "v2 only has 73 visitors — too early to call. Each variant should have at least 100 before any decision is robust. Want to wait for that or push it now anyway?"

### Promotion threshold: ≥500 visitors per variant + 1.4× ratio

To recommend `set_weights` 100/0 (promote winner, kill others), all of these must hold:

- Winner has **≥500 visitors**
- Each other ACTIVE variant has **≥200 visitors** (else not a fair comparison)
- Winner's primary-metric rate is **≥1.4× the next-best** (use `qualifiedConvRatePct` if the funnel has a qualification rule, else `convRatePct`)
- The winner's lead **holds across the top 2–3 audience cohorts** when there's enough cohort traffic — see [§5 Cohort stratification](#cohorts). At minimum the lead must hold on mobile + desktop separately.

Why 1.4×? It's the ratio at which a 5%-vs-7% test reaches ~95% confidence at n=500 each. Below this you're flipping a coin on a real difference.

**Cohort caveat**: if the headline winner loses on a major cohort, DO NOT promote even if the funnel-wide gap clears 1.4×. Run `get_cohort_comparison(funnel_id)` before any promotion call.

### Pause threshold: ≥200 visitors + clear loser

Pausing one variant (route its traffic to the rest) is less aggressive than full promotion. Lower bar:

- Loser has **≥200 visitors**
- Loser's conv rate is **<60% of the leader's** rate
- Leader has **≥200 visitors**

Action: `set_weights` with the loser at `weight: 0` (redistribute the rest across the survivors). The loser stays on the page (so analytics history is preserved) but gets 0 traffic.

### "Inconclusive" — what to actually say

When the floor is met but the gap isn't decisive, don't fake a recommendation. Tell the user:

> "Both variants are running, but the gap is within noise (v1 at 4.8% vs v2 at 4.2% over 230 each — within ±1% margin). Let it run another week or until each has ~500 visitors before we decide."

This is not a non-answer. It's the correct answer.

---

## <a name="calling-winners"></a>2. Calling a winner — the Granvl math

You won't run chi-square tests by hand. The thresholds above approximate ~95% confidence for the kinds of conv-rate differences that matter (3% → 5%, 5% → 8%). What you should NOT do:

### Don't peek-and-promote

Re-running the math every day and promoting whenever the number "looks good" inflates false positives. Either:
- Promote when the threshold above is hit, OR
- Wait until the user explicitly asks for a verdict

If the user asks "what's the latest?", you can describe trends without recommending action. *"v2 widened its lead to 1.6× this week, but we're at 412 visitors — needs ~88 more before I'd promote."*

### Don't call by absolute conv rate alone

A variant at 9% conv rate can be the LOSER if the other variant is at 13%. Always compare to the field. Use ratios.

### Don't ignore segment behavior

If `get_funnel` shows a variant winning overall but you have reason to believe a segment is driving the result (e.g. all the conversions came from one ad campaign), surface that — point the user at the funnel's detail page `/dashboard/funnels/<id>` (Visitor analytics) for the per-source / per-device / per-region breakdown.

---

## <a name="reading-funnels"></a>3. Reading `get_funnel_stats` output holistically

`get_funnel_stats` returns per-variant numbers; `get_funnel` returns structure. Always use `get_funnel_stats` for the "is this working?" reads. Here's what to scan for, in order:

### 1. Variant traffic balance

Are the visitor counts roughly proportional to the weights? If you set 50/50 and the actual split is 70/30, something's broken (sticky cookie collision, weights misconfigured, one variant in DRAFT, etc.). Investigate before reading any other signal.

### 2. Variant conv rate spread

If all variants are within 0.5% of each other, none of them is "winning." Tell the user: *"Variants are running but converting indistinguishably — the test isn't telling us anything yet. Want to draft a more aggressive variant (different angle, different CTA) instead of waiting?"*

### 3. Conv rate vs target

Ask the user what they consider "good" for this funnel type. Rules of thumb (don't quote these unless asked — they vary wildly by industry):
- B2B lead gen: 2–5% is typical, 8%+ is great
- B2C newsletter signup: 5–10% typical, 15%+ great
- E-comm checkout completion: 1–3% typical, 5%+ great
- Free trial signup: 8–15% typical, 25%+ great

### 4. Outlier variants

If one variant has 5× the visitors of another with similar weight, the high-traffic one probably went into ACTIVE earlier. Check `createdAt` for context.

---

## <a name="qualified"></a>4. Qualified-rate optimization (the closed-loop signal)

When the funnel has a qualification rule or webhook updates, the conversion rate isn't the headline number — the **qualified conversion rate** is. A variant that wins on raw conversions but loses on qualified leads is the variant you ship LESS of.

### Detect whether qualified data is meaningful

Call `get_qualification_rule(funnel_id)` once per session. The response carries:

```json
{
  "rule": {...} | null,
  "counts": {
    "total": 412,
    "qualified": 87,
    "unqualified": 28,
    "bySource": [{ "qualified": true, "source": "RULE", "count": 78 }, ...]
  }
}
```

Qualified data is meaningful when:
- A rule is set AND has classified ≥30 sessions, OR
- The webhook has been hit ≥30 times (counts by `source: WEBHOOK`)

Below those floors, the qualified rate is too noisy to drive promotion calls.

### Reading `get_funnel_stats` with qualification

Each variant row has both `convRatePct` and `qualifiedConvRatePct`. Two patterns to watch for:

**Pattern A — qualified rate confirms the winner**: Hero v3 leads on conv rate AND on qualified rate. Strong signal — promote.

**Pattern B — qualified rate flips the winner**: Hero v1 leads on conv rate (more form fills) BUT Hero v3 leads on qualified rate (better-fit leads). Promote v3, NOT v1. Tell the user: *"v1 has more conversions but v3's leads are 2× more likely to qualify. Promoting v3 — fewer leads but worth more downstream."*

### Quick-recommend phrasing

> "v3 leads on qualified rate (24% vs 17% for v1) over 800+ visitors per variant. Even though v1 has slightly higher raw conversions, the lead quality is what matters here. Promoting v3."

---

## <a name="cohorts"></a>5. Cohort stratification — the Simpson's-paradox check

The single most-common bad call in A/B testing is promoting a variant that wins overall but loses on a critical cohort. Granvl's `audienceCohort` field (`mobile_paid_meta`, `desktop_organic_search`, etc.) makes this one query away.

### Always run this before promoting

```
get_cohort_comparison({ funnel_id })
```

Returns the variant × cohort grid: rows are cohorts (sorted by visitor volume desc), columns are entry variants (sorted similarly). Each cell carries visitors / conversions / qualified / rates.

Use the **per-row winner** to detect flips:

```
                      Hero v3   Hero v2   Hero v1
mobile_paid_meta      18.2%     11.8%     9.1%       ← v3 wins
desktop_organic       9.4%      9.2%      7.5%       ← v3 wins (barely)
desktop_direct        6.1%      7.0%      5.9%       ← v2 wins!
```

Hero v3 wins overall but loses to v2 on `desktop_direct`. Whether to promote depends on traffic mix:
- If `desktop_direct` is <10% of traffic → promote v3 anyway, you're not bleeding much
- If `desktop_direct` is >25% of traffic → DON'T promote. Either keep both or build a v4 that combines what works on each cohort.

### When to push back on the user

User: "v3 is winning, promote it 100%."
You: *"Funnel-wide v3 wins (12.8% vs 10.4%). But on `desktop_direct` (28% of your traffic) v2 actually beats v3 — 7.0% vs 6.1%. Promoting v3 100% would hurt that segment. Want to keep both running, or do you want me to draft a v4 tuned for that cohort?"*

This is the kind of read that turns "Claude is convenient" into "Claude is essential."

### When cohort data is too thin

If `get_cohort_comparison` returns rows with <50 visitors per cell, the cohort comparison is noisy. Note that to the user but still call the headline winner — just with reduced confidence.

---

## <a name="journeys"></a>6. Investigating individual sessions (journeys)

When the user asks "why did this lead bounce?" or "what did the converting visitor on Tuesday actually see?", the data is in `SessionJourney` — one materialized row per session × funnel.

### Recipe: bounce diagnosis

```
1. list_session_journeys({ funnel_id, converted: false, limit: 50 })
2. Scan rows: device, audienceCohort, durationSec, maxScrollDepth, bounced
3. Look for patterns:
   - All bouncing on mobile? → §8 mobile diagnosis
   - All from one cohort (e.g. mobile_paid_tiktok)? → §9 source-mix
   - Most have <10s duration + 0% scroll? → page might be slow / breaking
4. If the pattern is a specific variant:
   get_variant_html_at_time({ variant_id, timestamp: <one row's startedAt> })
   → see exactly what HTML was running for that visitor
```

### Recipe: convert-quality diagnosis

When `convRatePct` is healthy but `qualifiedConvRatePct` is low, look at the actual journeys of unqualified converters:

```
1. list_session_journeys({ funnel_id, qualified: false, converted: true, limit: 30 })
2. Their pagePath / variantPath shows which variants attracted bad-fit leads
3. Compare against qualified converters: list_session_journeys({ funnel_id, qualified: true, converted: true, limit: 30 })
4. If unqualified leads cluster on one variant, recommend pausing it
```

### Recipe: HTML retrospective on a specific session

```
1. list_session_journeys({ funnel_id, ... }) → find the row
2. For each step in journey.variantPath:
     get_variant_html_at_time({ variant_id, timestamp: journey.startedAt })
3. Read what the visitor actually saw — even if the variant has been edited since.
```

The version timeline is preserved on `VariantVersion`; this lets you investigate sessions weeks after the variant has been changed.

---

## <a name="what-to-test"></a>7. What to actually test (CRO patterns)

When the user asks "what should we try?", suggest from this menu. The metadata fields (`headline_type`, `cta_type`, `angle`, `page_style`) make it easy to slot the new variant into a known dimension — and Granvl's analytics groups by those values.

### Hero / headline (highest-impact lever)

| Pattern | When to try | `headline_type` |
|---|---|---|
| **Pain-point** ("Stop losing leads to slow forms") | Audience is aware of the problem | `pain-point` |
| **Benefit** ("Triple your conversion rate in a week") | Audience is solution-aware | `benefit` |
| **Question** ("Why does your form convert at 2%?") | Cold audience, intrigue play | `question` |
| **Curiosity** ("The mistake most landing pages make") | Cold audience, content-style | `curiosity` |
| **Urgency** ("Your competitors already switched") | Warm audience, decision-stalled | `urgency` |
| **Social proof** ("Used by 4,200 marketers at X, Y, Z") | New brand, trust deficit | `social-proof` |

If two variants share `headline_type`, the test isn't really testing the headline. Make sure your A/B variants differ on the dimension you intend to test.

### CTA

| Pattern | When | `cta_type` |
|---|---|---|
| Action verb + specificity ("Get my free quote") | Default; clearer than "Submit" | `get-quote` |
| Low-friction ("Start free trial") | When committing the user to free | `sign-up` |
| Speed ("Get started in 60 seconds") | When time-to-value is short | `get-started` |
| Bottom-funnel ("Buy now — $49") | Direct-to-purchase | `buy-now` |
| Demo / hands-off ("Book a 15-min call") | High-ticket B2B | `book-call` |

### Form fields (count matters more than wording)

Each additional required field costs ~5–10% conversion. Test:
- Email-only vs email+phone
- Email+name vs email+name+phone
- Single-step form vs multi-step (FORM page type)

### Page style

| Pattern | When | `page_style` |
|---|---|---|
| **Minimal** — hero + form, no scroll | High-intent traffic (search, retargeting) | `minimal` |
| **Detailed** — features, benefits, FAQ | Cold audience, B2B | `detailed` |
| **Video** — explainer in hero | Complex product | `video` |
| **Testimonial-heavy** — quotes throughout | Trust-deficit / new brand | `testimonial-heavy` |
| **Comparison** — vs competitors | Crowded category | `comparison` |

### What NOT to test (without warning the user)

- **Branding / logo**: low impact, high distraction
- **Color tweaks** (beyond CTA color contrast): rarely moves the needle, distracts from real tests
- **Adding tracking pixels**: not a CRO test; configure via `update_funnel` domain settings instead

---

## <a name="mobile-desktop"></a>8. Mobile vs desktop diagnosis

When the Performance Feed surfaces a `MOBILE_GAP` insight (or the user asks about mobile), pull the active LANDING variant's HTML and audit specifically for:

### Layout

- Is the CTA above the fold on a 360-wide × 700-tall viewport? Most landing-page heroes push CTA below the fold on mobile.
- Are form inputs full-width? Inputs that don't fill the viewport feel cramped on mobile.
- Are touch targets at least 44×44pt? Buttons smaller than that fat-finger badly.

### Form ergonomics

- Phone field: `<input type="tel">` (triggers numeric keyboard) — NOT `type="text"`
- Email field: `<input type="email">` (triggers email keyboard) — NOT `type="text"`
- Number field: `<input type="number" inputmode="numeric">`
- Avoid HTML5 `pattern` regex on phones — it suppresses common input methods

### Performance

- LCP > 2500ms on mobile usually means a hero image > 200 KB, fonts loaded synchronously, or above-the-fold JS
- Tailwind CDN compile happens on the client — fine on desktop, occasionally lags on slow mobile connections. If LCP is bad and Tailwind CDN is in use, that's a likely cause; suggest precompiled Tailwind or a `<link rel=preload>` for the CDN script

### Mobile-only patterns to test

- Stacked CTA above the form (vs after) — mobile users never scroll to find "Submit"
- Sticky bottom CTA bar — controversial but real conv lift on long pages
- Single-column layout (no sidebars) — most LP authors get this right; double-check anyway

---

## <a name="source-mix"></a>9. Source-mix asymmetry diagnosis

When `CHANNEL_MIX` insight fires (top traffic source converts <70% of funnel-wide rate), the issue is almost always **message mismatch** — the ad/post promised something the LP doesn't deliver. Diagnostic flow:

### Step 1 — read the active LP

`get_variant` on the funnel's currently-active LANDING variant.

### Step 2 — ask the user about the source

"Meta is your biggest traffic source but it converts 3× worse than search. What's the headline copy in the Meta ads driving here? The page leads with [whatever the headline says]; if your ads promise X but the page promises Y, that's likely the gap."

### Step 3 — propose a source-tuned variant

If the user shares the ad copy, draft a v2 whose headline mirrors the ad. Set `angle` to match (e.g. `urgency` for a "limited time" ad, `social-proof` for a UGC ad).

### Step 4 — split test it

50/50 against the current variant, only using traffic from that source. (Granvl can't filter traffic by source server-side yet; the test will catch the broader signal anyway since the source is your biggest segment.)

---

## <a name="feed-to-action"></a>10. Performance Feed → action mapping

When the user clicks "Ask Claude →" on a Performance Feed card, you receive a pre-formatted prompt with the metric values. Here's the action recipe per category. Don't deviate.

### `MOBILE_GAP` (System flagged)

```
1. list_funnels                        (orient)
2. get_funnel_stats({ funnel_id })     (find the LANDING page_id + leading variant)
3. get_variant_html({ variant_id })    (read current HTML — DON'T regenerate)
4. Audit per §5 above
5. Draft new variant fixing the issues you found
6. create_variant({ ..., html_content })
7. set_weights — split 50/50 with the current variant
8. publish_funnel({ funnel_id, confirm: true }) — publishing is what activates the new variant (no status field on update_variant)
9. Reply to user: "Drafted a mobile-fixed variant. Live at 50/50 against v3. I changed: [bulleted list of what you fixed]."
```

### `SCALE_VARIANT` (System suggests)

```
1. list_funnels
2. get_funnel_stats({ funnel_id })     (confirm the data still holds)
3. get_cohort_comparison({ funnel_id }) (Simpson's-paradox check)
4. If the winner holds across major cohorts:
     set_weights — winner at 100, all others at 0
   Else:
     Tell the user about the cohort flip; recommend keeping both
5. save_learning({ variant_id, title, outcome: 'WINNER', notes }) (record the lesson)
6. Reply: "Promoted [variant name] to 100% traffic. The winning combo was [headline_type] + [cta_type] + [angle]. Held across [top cohorts]. Paused variants kept for history."
```

### `PERF_FIX` (System flagged)

```
1. list_funnels
2. get_funnel({ funnel_id })
3. get_variant({ variant_id })
4. Find heavy assets — large <img> without dimensions, render-blocking <script>, sync font loads
5. Draft fix: compressed-image markup, preloaded fonts, async-loaded scripts
6. create_variant + set_weights 50/50 + activate
7. Reply: "Drafted a perf-optimized variant. Changes: [bullet list]. Should drop LCP by ~[estimate]ms."
```

### `CHANNEL_MIX` (System noticed)

```
1. list_funnels
2. get_funnel({ funnel_id })
3. get_variant on the active LANDING
4. Reply asking the user about the ad copy for the asymmetric source (don't act yet)
5. Once user shares: create_variant tuned for that source's audience + set_weights 50/50
```

---

## <a name="mistakes"></a>11. Common reading mistakes

### Comparing variants from different time windows

If v1 ran for 30 days and v2 has been live for 3, their conv rates aren't comparable — v2 hasn't seen the same source mix, day-of-week distribution, or seasonal effects. Wait for v2 to accumulate similar exposure before calling.

### Confusing visitors with sessions

`get_funnel` returns visitors as unique `sessionId`. A returning visitor with the sticky cookie counts once per ~30-day session window. Don't say "X visited Y times" — that's not what we measure.

### Treating bot traffic as real

The platform classifies traffic into `human / ai_agent / crawler / social_preview / tool`. The variant stats in `get_funnel` include all of them. If a funnel has a sudden spike in conv rate that looks too good, inspect the raw events with `get_analytics_events` (the projection includes `trafficType`) — bot crawls of THANK_YOU pages auto-convert and inflate the rate.

### Recommending re-tests after non-significant results

If a test ran 4 weeks at 50/50 and the gap is <0.5%, the variants are functionally equivalent. Don't recommend "let's test again with a third variant" — recommend a **categorically different** variant (different headline_type, different angle), not another tweak.

### Promoting without checking mobile/desktop split

Variant A might win 6% to 4% overall but only because mobile is 10% to 4% (great win) while desktop is 5% to 4% (noise). Promoting kills the desktop experience for no reason. Always check both surfaces before set_weights 100/0.

---

## Reference: thresholds at a glance

| Decision | Per-variant visitor floor | Primary-metric gap | Other |
|---|---|---|---|
| Make any pause/promote call | 100 | — | — |
| Recommend `paused` | 200 | <60% of leader | — |
| Recommend `promoted` (set_weights 100/0) | 500 | ≥1.4× next-best | Holds on top 2–3 cohorts (`get_cohort_comparison`); use `qualifiedConvRatePct` if rule is set |
| Flag mobile gap | 50 mobile + 50 desktop | mobile <60% of desktop | — |
| Flag perf | n/a | LCP avg >2500ms over ≥100 samples | — |
| Flag channel mix | top source ≥100 | top source <70% of funnel-wide rate | — |
| Trust qualified rate | 30 classified sessions | — | `get_qualification_rule` counts ≥30 |

These come from granvl's insights rules engine and the heuristics in [../SKILL.md](../SKILL.md). When in doubt, defer to those — this file's job is to give you the *why* behind them, not to override them.
