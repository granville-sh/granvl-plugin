# Granvl — Page Building

The full authoring guide for variant HTML: form wiring, quizzes, embeds, styling, brand kit, accessibility, performance, the legal footer, and the publish-time validator. Read [../SKILL.md](../SKILL.md) first for the hard rules; this file is the how-to behind them.

> **Two things the user will never ask for but always needs:** (1) every lead-capture funnel ends on a real thank-you page — author a proper TY variant and point forms at `_next="{{THANK_YOU_URL}}"`; (2) test the funnel end to end before calling it done (walk each page, one live test submit, confirm the TY redirect + delivery + `get_funnel_stats`). Both are hard rules in SKILL.md.

> **Start from a template when one fits.** Before building a funnel from scratch, call `list_templates` — granvl ships conversion-tested starting points (quiz flows, landers). `create_funnel_from_template` clones one into the workspace; then adapt copy/brand/images with `update_variant` and rewire the forms per this guide. Bespoke builds are for when no template matches.

---

## 1. Forms — zero-PII by design; external destination is the primary path

**Granvl never stores form content.** Form submissions are zero-PII by design — there is nowhere on granvl's side that could ever hold an email, phone, or address from a form. This is a structural privacy guarantee, not a soft policy.

**Implication:** every form on a Granvl-served page MUST point at an external destination (Formspree, GHL, HubSpot, ActiveCampaign, Supabase, etc.) for the lead to actually be captured. The `/api/form-submit` fallback exists but only fires the analytics event + handles the `_next` redirect — it does not persist field values. A funnel without a configured form destination will see zero leads in the user's CRM.

**Before generating any variant that contains a form, call `get_form_destinations(funnel_id)`.** It tells you whether the user has connected a third-party destination, and exactly how to wire the form so submissions go directly to that destination — Granvl is never in the data path.

The tool returns `{ destinations: [...], guidance }`. **A funnel can fan out to MULTIPLE destinations** — wire the form to `destinations[0]` and Granvl's serve-time keepalive fan-out mirrors each submission to the rest, browser-side (Granvl is never in the data path for any of them). The MCP `set_form_destination` tool is non-destructive: it updates the same-provider destination in place or adds a new one alongside the others (never removing other providers unless `replace_all: true` is set explicitly); the user can also manage destinations in the dashboard funnel **Integrations** tab. The array is one of two shapes:

### A) `destinations: []` — no integration configured

**Warn the user.** Without a destination, the form will fire conversion events but the lead's contact info is lost (form posts to `/api/form-submit`, which discards field values after evaluating the qualification rule in memory). Strongly recommend they call `set_form_destination` before the funnel goes live.

If they want to proceed anyway (e.g. just testing), write a **bare form** (no `action`, no `method`); the serve route rewrites it to point at the fallback endpoint:

```html
<form>
  <input type="email" name="email" required>
  <input type="text" name="first_name">
  <input type="hidden" name="_next" value="{{THANK_YOU_URL}}">
  <button type="submit">Get my quote</button>
</form>
```

- **Do NOT hardcode** `action="https://formspree.io/..."` or any third-party host in this case.
- **Use the `{{THANK_YOU_URL}}` template token** in `_next` — the serve route substitutes the funnel's thank-you URL at render time.
- The `_next` URL is validated against the funnel's verified domain.
- **Honeypot — the whole policy, stated once:** authoring one is OPTIONAL. Publish injects an off-screen `_gotcha` input automatically when it's missing, on every form, whatever the destination — no provider needs special-casing. If you do author it, make it a hidden `<input name="_gotcha">` placed as a **DIRECT child of `<form>`** (nested in a wrapper div, publish can't see it and injects a duplicate), styled `position:absolute;left:-9999px`. The server rejects any submission where a honeypot field (`_gotcha`, `website`, `url`, `homepage`, `phone_number_2`) is filled — which also means you must **never name a real field** `website`, `url`, `homepage`, or `phone_number_2` (use e.g. `company_website`).
- **`submitted_at` is added for you.** At submit, publish stamps a hidden `submitted_at` input with the moment the form was sent, so every destination (native POST, fan-out mirrors, the broker, the CRM adapters) receives it. The format (ISO 8601 UTC by default; local ISO, `YYYY-MM-DD HH:mm:ss` UTC, US local, Unix seconds, or off) is a funnel setting under Conversion, next to the phone format. Don't author your own `submitted_at` field; map it at the destination if the CRM needs a named property (LeadProsper field maps must include it explicitly). Same for TrustedForm: when it is on, the snippet appends `xxTrustedFormCertUrl` (plus `xxTrustedFormPingUrl` / `xxTrustedFormCertToken`) to the form at capture time — map `xxTrustedFormCertUrl` onto the buyer's cert-URL field in the LeadProsper map; the dashboard lists it and auto-matches the usual LP names.
- **Field-name conventions — ALWAYS snake_case, lowercase, underscore-separated:** `first_name`, `last_name`, `email`, `phone`, `mortgage_balance`, `zip_code`. NEVER `firstName`, `MortgageBalance`, `First Name`, or `Province`. **CRITICAL (server-enforced): the four contact fields are always exactly `first_name` / `last_name` / `email` / `phone`, and a name already used on any variant of the funnel is never respelled — read `get_form_destinations(funnel_id).formFields` first and reuse those names verbatim; the write is refused otherwise.** Use the SAME snake_case name across **every variant** of a funnel — inconsistent casing creates duplicate columns in form handlers (e.g. Formspree) and breaks integration field maps (e.g. LeadProsper, whose mapping keys are snake_case, so a `Province` input never matches the `province` mapping and the lead arrives empty). These names also feed the qualification-rule UI's field-name autocomplete (it parses your variant HTML; submissions aren't stored). The platform force-normalizes field names to snake_case at submit time as a safety net, but author them correctly — don't rely on the guard. Names beginning with `_` (`_next`, `_subject`, `_gotcha`) are control fields and provide through untouched.

### B) `destinations: [...]` — integration(s) connected

**Author a BARE form here too** — no `action`, no `method`, no vendor hidden fields, no fan-out code. Granvl wires everything at serve time: `destinations[0]` gets the primary submit adapter, every other destination is mirrored browser-side (keepalive fan-out), and credentials/hidden fields are injected by the bake. What you control is the **field set and field names** (use `fieldShape` / the LeadProsper field map to know what the destination expects), the `_next={{THANK_YOU_URL}}` input, and the visual design.

**Do not hardcode the destination's `action`/`method`** — the publish validator strips them (`form_action_stripped` / `form_method_stripped`; that's the contract being enforced, not an error), and the serve route overwrites the action anyway. The live DOM may show `action="/api/form-submit"` while submissions still reach every saved destination through the runtime — **verify delivery with `send_test_lead` or the destination's own inbox, never by inspecting the DOM** (alpha QA-005/006: an agent read the DOM, concluded the destination was disconnected, and made edits the next publish reverted).

**Hidden fields** (`destinations[0].hiddenFields`) — reference only; the bake injects these. Shapes you may see: `source: "static"` (literal value, e.g. `lp_key`), `source: "cookie"` (read at submit time), `source: "page"` (URL/title at submit time). You never author them.

**Submit strategies:**

```
submitStrategy === "post"        — native browser submit. You still author a
                                    BARE form; the serve route wires the action.
                                    Used by Webhook, Formspree, Zapier, GHL
                                    (Workflow Webhook).

submitStrategy === "jsonp"       — granvl bakes the JSONP adapter at serve
                                    time: it intercepts submit, serializes the
                                    form data to URL query params, injects
                                    <script src="{action}?{params}&jsonp=true">,
                                    and defines the `window._show_thank_you` /
                                    `window._show_error` globals AC's eval'd
                                    response calls. Used by ActiveCampaign
                                    (their proc.php's CORS is unreliable; JSONP
                                    works around it). You author a BARE form
                                    only — no interception script, no stubs.

submitStrategy === "json-v3"     — Granvl bakes the adapter at
                                    serve time. Generate an ORDINARY bare
                                    <form> (no action/method) with
                                    standard <input name="..."> fields whose
                                    names match the HubSpot form's field
                                    internal names (firstname, lastname,
                                    email, phone, company, custom property
                                    names). The runtime adapter intercepts
                                    submit, reads cookies + page properties
                                    per the destination's hiddenFields
                                    config, builds the v3 JSON payload
                                      { fields: [{name, value}, ...],
                                        context: {pageUri, pageName, hutk?} }
                                    and POSTs to HubSpot directly from the
                                    visitor's browser. You don't write the
                                    fetch() handler — just the form.

submitStrategy === "leadprosper" — LeadProsper ping-post. Granvl bakes the
                                    adapter at serve time (like json-v3).
                                    Generate an ORDINARY <form> with normal
                                    <input name="..."> fields; the runtime
                                    adapter remaps them to LeadProsper's field
                                    names (per the saved field map), attaches
                                    lp_campaign_id / lp_supplier_id / lp_key
                                    from hiddenFields, and fires a
                                    mode:'no-cors' keepalive POST to
                                    direct_post, then redirects to _next.
                                    direct_post returns JSON + isn't CORS-
                                    enabled, so it CAN'T be the native form
                                    action. You don't write the handler — just
                                    the form, with the right field NAMES.
```

**Provider-specific addenda:**

- **`provider === "FORMSPREE"`** — nothing special to author. The honeypot policy in §1 covers Formspree too: publish injects `_gotcha` automatically, and Formspree silently rejects submissions where it's non-empty.

- **`provider === "HUBSPOT"`** — `fieldShape` is `null` because HubSpot stores field config inside their form editor, not the embed. Default to standard contact internal names: `email`, `firstname`, `lastname`, `phone`, `company`. If the user mentions custom HubSpot properties, ask them for the internal name (visible in HubSpot's form-field settings). **Field name mismatches** are the #1 source of HubSpot rejections — if `<input name="full_name">` is in the variant but the HubSpot form expects `firstname` + `lastname`, every submission gets a 400 with `INVALID_HUBSPOT_FORM_FIELD`. The visitor sees the error inline; the audit log records the rejection. When in doubt, ask the user to confirm field names against their HubSpot form before publishing. **You DO NOT write the JSON-fetch handler or the form action** — Granvl's serve pipeline bakes the adapter and wires the HubSpot endpoint automatically; you just write a normal bare `<form>` with matching `name` attrs.

  **Preferred path: OAuth auto-create.** If the workspace has connected HubSpot in Settings → Integrations, steer the user to the funnel's Settings → Integrations → HubSpot → **"Create my HubSpot form"** instead of pasting an embed. Granvl reads the funnel's form fields, reuses matching contact properties in their portal (granvl's `first_name`/`last_name`/`phone` conventions map onto HubSpot's standard `firstname`/`lastname`/`phone` automatically), creates any missing custom properties, and creates a HubSpot form that mirrors the funnel exactly — the field-name mismatch failure mode can't happen because both sides are authored to match. Keep writing variant inputs with granvl's normal snake_case names; the serve-time adapter renames them for HubSpot. The paste-an-embed flow above remains the fallback for portals that don't want to grant OAuth or want to reuse an existing HubSpot form (its workflows, notifications, etc.).

  **After connecting a HubSpot form destination, tell the user to visit `/dashboard/integrations/hubspot`** to complete the remaining setup steps. The page surfaces a guided 4-step widget covering: ① install the tracking pixel on their domain (sets the `hubspotutk` cookie + auto-registers the domain so submissions don't land in HubSpot's spam bucket), ② register the domain in HubSpot's analytics settings, ③ create custom contact properties for any quiz fields that don't map to standard HubSpot properties (`reason_for_loan`, `home_type`, etc. — without matching properties, those values land on the submission record but are dropped from the contact). The dashboard widget pre-fills the tracking-pixel snippet using the connected portal ID; the customer just clicks one button to install it. **Real failure mode if these steps are skipped: HubSpot puts every submission in the Spam Submissions bucket as "Unregistered Site Domain" and the customer thinks the integration is broken.** Always mention the guided widget when setting up HubSpot — don't assume the customer will find it.

- **`provider === "GOHIGHLEVEL"` AND `action === ""`** — the user pasted the iframe embed but hasn't given you the Workflow Webhook URL yet. Fall back to the bare-form pattern (option A) until they call `set_form_destination` again with the Workflow Webhook URL — direct submission to GHL's native form endpoint isn't viable (reCAPTCHA-locked).

  **Once a GHL Workflow Webhook (or generic Webhook / Zapier) destination is saved, offer `send_test_lead(funnel_id)`.** GHL's inbound-webhook trigger sits in a "waiting for a sample request" state until a payload arrives, and its field mapper only offers fields it has seen — the test lead carries the union of form fields across every variant (obviously fake values) **plus every attribution field live leads carry** — `utm_source` … `utm_ad_id`, `utm_term`, `utm_content`, `utm_placement`, `site_source_name`, the click ids, `ip_address` — with routable sample values (`utm_source = granvl-test`), so the user can map AND write routing rules on UTMs before any real traffic exists. Live leads always carry that same standard set (empty when the visit had none) plus any custom `utm_*` the ad URL carried, so a rule built on the test lead keeps working. Relay the returned field list and point them at the trigger's mapping screen.

- **`provider === "LEADPROSPER"`** — LeadProsper (lead-distribution / ping-post) is normally set up in the **dashboard**: the user connects a LeadProsper dev API key once (funnel → Integrations tab), then picks a **campaign → supplier** and maps form fields to LeadProsper field names. You usually don't set this up — but `set_form_destination` **does** accept a LeadProsper **"Get API Specs"** curl/JSON sample (it carries `lp_campaign_id` + `lp_supplier_id` + `lp_key`). If only the API key is captured, the tool returns `meta.requiresSetup: true` + `meta.missing[]`; ask the user to paste that API-specs sample to finish. Once connected, just write a normal `<form>` — the `leadprosper` adapter (above) does the rest. **When LeadProsper was connected through `set_form_destination` there is no field map**: every input is posted under its own name, so the input names in the HTML must be LeadProsper's exact field names (a dashboard-built map is the only way to post under different names). Two hard rules: **field names are case-sensitive** (`FirstName`, `LastName`, `Email`, `Phone`, …) and **`FirstName` + `LastName` are REQUIRED as separate inputs** (never a single `name`). Check the campaign spec for the exact required field set before generating the form; a missing/misnamed field is silently rejected by LeadProsper.

**Phone formatting — all destinations (don't hand-roll it).** The funnel's **Integrations tab** carries one phone-format setting (E.164 / 10-digit / `(650) 327-1100` / `650-327-1100`) that Granvl applies to the phone field at serve time for *every* destination. Just collect `<input type="tel" name="phone">` — the bake reformats the value before submit. Don't normalize phone numbers in your own form JS. If a destination rejects the phone format (e.g. LeadProsper rejects E.164 `+1…` and wants US-formatted), tell the user to switch this setting rather than editing HTML.

**Serve-contract selectors — the bake keys its injections off these exact shapes; a miss fails silently:**

- **Phone** = `<input type="tel" name="phone">` — always `phone` (the server refuses `phone_number` / `mobile` on new funnels). Any other phone-ish name/type skips the phone mask, integration formatting, and silent validation.
- **Email** = `<input type="email" name="email">`. Anything else skips silent email validation.
- **Submit control must be real**: `<button type="submit">` (or a button with no `type`) or `<input type="submit">`. A styled `<div>` or `type="button"` can't be re-triggered by platform scripts (OTP gate, destination adapters).
- **Never name a real field** `website`, `url`, `homepage`, or `phone_number_2` — those are honeypot names and any submission where they're filled is silently rejected.

**Wiring lands at publish.** The bake is where actions, adapters, fan-out, and injected fields are applied — form, destination, and field changes reach the live site only after a re-`publish_funnel`.

**Don't fight the tool — read the destination, generate accordingly.** If you're unsure, call `get_form_destinations` again and re-read the guidance string in the response.

## 1b. Required form fields, consent checkboxes, and validation UX

Forms that look right but don't enforce required fields are one of the highest-frequency agent-built bugs. The browser will happily submit a form where the "I agree" checkbox is decorative. Ad platforms reject accounts whose landing pages don't capture explicit consent. TCPA exposes the customer to legal risk if their SMS opt-in checkbox isn't actually required. This section is the canonical reference — copy-paste the snippets from [REFERENCE.md](./REFERENCE.md) rather than hand-rolling.

### Default to required for these fields

| Field | Required? | Why |
|---|---|---|
| `email` | Always | Primary lead identifier; without it the destination has nothing to ingest. |
| `phone` | When captured | Required when the form collects phone OR when SMS OTP is enabled. |
| `name` / `first_name` / `full_name` | Usually | Skip only on anonymous lead forms (rare; flag to user before omitting). |
| Quiz question inputs that gate progression | Always | Without an answer the funnel can't decide qualification. |
| Privacy/terms consent checkbox | When contact info is captured AND legal URLs exist | Ad-platform compliance + GDPR. Pattern A below. No legal URLs yet (first build / preview)? Skip it — add it once the URLs land, before paid traffic. |

**Skip required for these:**

- "How did you hear about us?" / referral fields
- Optional message / notes
- **Marketing email opt-in checkbox** — must be optional AND unchecked by default. Pre-checked opt-ins are deceptive, rejected by Meta/Google ad reviewers, and a GDPR violation in the EU.

### Consent checkbox patterns

**Pattern A — Privacy & terms (include when capturing contact info and the legal URLs exist):**

```html
<label class="gv-consent">
  <input type="checkbox" name="consent_privacy" required>
  <span>
    I agree to the
    <a href="{privacyPolicyUrl}" target="_blank" rel="noopener">Privacy Policy</a>
    and
    <a href="{termsOfServiceUrl}" target="_blank" rel="noopener">Terms</a>.
  </span>
</label>
```

Use the workspace's actual `privacyPolicyUrl` / `termsOfServiceUrl` from `get_funnel` → `legal`. **Never** use `#`, `/privacy`, or `https://example.com/privacy` placeholders.

**Pattern B — TCPA-compliant SMS opt-in (only when phone is captured AND the customer plans to send marketing texts):**

```html
<label class="gv-consent">
  <input type="checkbox" name="consent_sms" required>
  <span>
    By providing my phone number I agree to receive marketing text messages
    from {businessLegalName} at the number provided. Message and data rates
    may apply. Reply STOP to opt out.
  </span>
</label>
```

If the customer isn't sending marketing texts, **omit this** rather than making it optional. Collecting an explicit opt-in implies you'll use it; an unused opt-in is a bad signal to auditors.

### Validation UX — don't use the browser default

The native `required` attribute triggers the browser's default tooltip ("Please fill out this field"), which looks bad and breaks the variant's design. Use the inline-error pattern in [REFERENCE.md](./REFERENCE.md) — it intercepts the `invalid` event, renders the error inline next to the field, and clears it on input. The full snippet is one copy-paste block; bake it into every form.

**Never set `novalidate` on a `<form>`.** It turns every `required` attribute decorative — the browser submits empty fields and partial leads ship to every destination (observed live: empty phone numbers billed at LeadProsper). The platform injects its own inline-error UX; there is no reason to suppress native validation.

### Common bugs (don't do these)

- ❌ `<input type="checkbox" required>` with no `name` attribute → required but never submitted. **Always include `name`.**
- ❌ Label not wrapping the input → screen readers + click-to-toggle broken. Use `<label><input>...</label>` (wrap) OR `<label for="id">...</label>` + `<input id="id">` (associate).
- ❌ `<a href="#privacy">` for the privacy link → goes nowhere. Use the workspace's actual `privacyPolicyUrl`.
- ❌ Marketing opt-in checkbox pre-checked → rejected by ad platforms + GDPR violation in EU.
- ❌ "Required" asterisk in the label but no `required` attribute on the input → cosmetic only, not enforced. Always pair the asterisk with the attribute.
- ❌ Using a `<div>` instead of `<form>` → no `submit` event, conversion tracking doesn't fire.
- ❌ `novalidate` on the `<form>` → `required` becomes decorative, partial leads ship. Never set it.
- ❌ Submit button outside the `<form>` element → click doesn't submit.

### Self-check before declaring a variant done

- [ ] Submit the form with every required field empty → confirms it does NOT submit and errors render inline (not browser default).
- [ ] Consent checkbox is unchecked → form does NOT submit.
- [ ] Tab through the form → every required field has a visible focus state.
- [ ] All `<a>` links inside the form (privacy, terms) open in a new tab and point at real URLs (not `#`).
- [ ] Every input has a `name` attribute.
- [ ] Submit successfully → confirms the form-submit event fires (DevTools Network → `/api/f` shows a 200).

### Server-side safety net

If the funnel has a `qualificationRule` and the submission omits a field the rule references, the fallback endpoint logs a compliance warning in the workspace audit log with the field name (never the value — zero-PII). The submission still goes through (we don't want to break customer flows on edge cases), but the audit row tells the operator the variant has a required-field bug to fix.

## 2. Conversion tracking — automated by the serve route

You do **not** need to fire conversions manually for funnel progressions. The serve route + inlined client-side script handle them automatically.

**Conversion data model:** every conversion is one event shape:

```
type: CONVERSION
conversionAction: 'form_submit' | 'click_through'
conversionQuality: 'qualified' | 'unqualified' | null   ← populated by the qualification gate
metadata.trigger: forensic provenance — 'client_listener' | 'ty_page_fallback' | 'outbound_click' | 'server_form_submit'
```

The action attribute is the load-bearing field. The trigger is just provenance — don't query on it.

**What fires automatically:**

| Visitor action | What fires (and on whose variant) |
|---|---|
| Submits any form (any destination, including external CRMs) | `CONVERSION + action=form_submit` on the **source variant**. Fired client-side by the inlined submit listener at the moment of submit, before browser navigation. Survives navigation via `sendBeacon`. |
| Submits form → arrives on Granvl TY page (the `_cv` redirect chain still works) | `CONVERSION + action=form_submit + trigger=ty_page_fallback` on the **source variant**. Deduped against any earlier client-side fire by the same visitor on the same funnel within 24h — only one row lands. Belt-and-suspenders for funnels where the chain works. |
| Clicks internal link from LANDING → QUIZ | `CLICK_THROUGH` event (separate event type for intra-funnel navigation — NOT a conversion). The serve-side script auto-rewrites internal links to carry `_cv`. |
| Clicks `data-pages-convert` outbound link from any page | `CONVERSION + action=click_through` on the **page where the click happened**. THANK_YOU pages use this for "post-arrival outbound engagement" (e.g. book-a-call buttons). |
| Books a meeting inside an embedded Calendly/Cal.com/HubSpot/Acuity/SavvyCal/TidyCal iframe | `CONVERSION + action=embedded_widget + metadata.provider=<provider>` on the **page hosting the embed**. ONLY fires when the variant has `embedded_widget` set — see §2c below. |

**Dedup is action-keyed**: a visitor doing both a form-submit and a click-through on the same funnel within 24h counts as two distinct conversions, not one. `embedded_widget` is its own action and dedupes independently.

The injected `window.pagesTrack` is available for custom interactions (video-watched, scroll-50%) — `window.pagesTrack('CONVERSION', { metadata })`. Don't load any third-party tracker. GTM and Meta CAPI flow through the user's configured `Domain` settings server-side.

**When to add `data-pages-convert` manually:**
- External outbound links that should count as conversions (Calendly, Stripe, app-store)
- Outbound CTAs on THANK_YOU pages (post-conversion follow-through)

**When NOT to add it:**
- Internal links between funnel pages (the serve route auto-attributes via `_cv`)
- Form submit buttons (form-submit listener handles attribution)
- Anchor links that scroll within the same page

## 2b. Multi-step quizzes — single page

For a quiz / multi-step funnel on **one HTML page**, Granvl auto-tracks per-question drop-off for you — **you write zero tracking JS and you maintain no "current step" state.** You only tell Granvl where one question ends and the next begins.

**The whole contract:** wrap each question (and the intro / "Get started" screen, if any) in its own element carrying `data-step="N"` — 1-indexed, in order (an intro can be `data-step="0"`). Optionally:
   - `data-step-name="..."` — chart label (e.g. `"Budget"`). If omitted, Granvl falls back to the section's first heading text.
   - `data-step-kind="..."` — one of `"question" | "form" | "intro" | "review"`.

That's it — no `data-current-step`, no `data-step-total`, no event-firing JS. Granvl's injected observer watches for an **answer inside a `data-step` element** — a click on a button/option **or** a `change`/`input` on a field — and fires the step events for you:

- `STEP_VIEW` when the visitor first answers a question (so step 1 = "answered Q1", and answering the intro = "clicked start").
- `STEP_COMPLETE` for the previous question (with `timeOnStep` in ms) as they advance.
- A final `STEP_COMPLETE` with `metadata.abandoned: true` on `beforeunload` if they bail mid-quiz — that's where the drop-off chart shows the funnel hemorrhaging.

Because it keys on *answers*, it works the same whether your quiz shows one question at a time or all at once, and whether questions are answered by **buttons** (button-advance quizzes) or **inputs** (selects, radios, text). How you hide inactive steps is irrelevant to tracking.

> **Forms** (a plain multi-field form, no `data-step` sections) need **nothing at all** — Granvl auto-tracks field-by-field engagement (which field they reached, where they stalled), skipping hidden + tracking fields (`utm_*`, `gclid`, …).
>
> **Legacy:** if you instead put `data-current-step="N"` on a wrapper and update it as the visitor advances, Granvl uses an older explicit observer keyed on that attribute. Still supported, but you don't need it — prefer plain `data-step`.

**Form wiring still applies — the whole quiz IS a form.** Single-page quizzes wrap every step in one `<form>` element. That means §1's form-wiring rules apply *to the quiz itself*: the form needs an `_next` redirect, follows the destination-or-bare-form pattern, and gets its `action` + `method` rewritten by the serve route. Skipping `_next` is the #1 cause of "the quiz reloaded back to step 1 after submit" reports — the form posts successfully but the response page has no redirect, the browser does its default thing, and the page re-renders at step 1.

**Common pitfalls (read before scaffolding):**

1. **Forgot `_next` →** quiz appears to restart at step 1 after submit. Always include `<input type="hidden" name="_next" value="{{THANK_YOU_URL}}">` inside the form. The serve route substitutes the literal token.
2. **Forgot `type="button"` on Next buttons →** buttons inside `<form>` default to `type="submit"`. Clicking "Next" on step 1 submits the whole quiz immediately. Every navigation button MUST be `type="button"`; only the final "Submit" button can be `type="submit"` (or default).
3. **Wrapped the JS submit handler with `e.preventDefault()` + nothing else →** the form never actually submits. Don't do this; let the form submit natively. The serve route handles attribution + the destination handles the redirect.
4. **Steps outside the form →** if `<section data-step="3">` is OUTSIDE the `<form>`, that step's inputs never make it into the submission. Every step `<section>` must be a child of the `<form>`.
5. **Enter key submitting the quiz early →** pressing Enter in a single-line `<input>` fires the browser's *implicit* form submit — historically this jumped the quiz forward or submitted the contact step before it was filled. **The platform now auto-guards this at serve time**: Enter advances to the next *visible* field, and on the last visible field clicks the step's primary button. So **you don't write an Enter handler.** Two structural things keep the guard correct: hide non-current steps with `display:none` (their fields are then skipped — see the scaffold), and keep Next as `type="button"` (pitfall #2) so the button it clicks is "Next," not a stray submit. If you *do* add your own Enter handling, call `e.preventDefault()` in it and the platform guard stands down (it only acts when nothing else handled the key).

**Minimal scaffold (bare-form path — `destination === null`):**

```html
<form id="quiz">
  <!-- _next is critical. Without it the post-submit redirect doesn't
       fire and the page appears to "reload back to step 1". The
       {{THANK_YOU_URL}} token gets substituted by the serve route. -->
  <input type="hidden" name="_next" value="{{THANK_YOU_URL}}">

  <section data-step="1" data-step-name="Budget" data-step-kind="question">
    <label>What's your budget?
      <select name="budget">
        <option value="under_5k">Under $5K</option>
        <option value="5k_25k">$5K–$25K</option>
      </select>
    </label>
    <!-- type="button" is REQUIRED — without it, this button defaults
         to type="submit" and clicking Next submits the form early. -->
    <button type="button" onclick="advanceTo(2)">Next</button>
  </section>

  <section data-step="2" data-step-name="Timeline" data-step-kind="question" hidden>
    <label>When are you starting?
      <select name="timeline">
        <option value="now">Right away</option>
        <option value="3_months">Next 3 months</option>
      </select>
    </label>
    <button type="button" onclick="advanceTo(3)">Next</button>
  </section>

  <section data-step="3" data-step-name="Contact" data-step-kind="form" hidden>
    <input type="email" name="email" required>
    <label class="gv-consent">
      <input type="checkbox" name="consent_privacy" required>
      <span>I agree to the <a href="{privacyPolicyUrl}" target="_blank" rel="noopener">Privacy Policy</a>.</span>
    </label>
    <!-- Final step: type="submit" (or omit, since this is the only
         submit-defaulting button in the form). DO NOT add onsubmit
         handlers that call e.preventDefault — let the form submit
         natively. -->
    <button type="submit">Get my plan</button>
  </section>

  <script>
    // Your JS only controls which section is visible. You do NOT fire any
    // tracking events or set data-current-step — Granvl detects the answer
    // inside each data-step section and fires the step events for you.
    function advanceTo(n) {
      document.querySelectorAll('#quiz [data-step]').forEach(function(s) {
        s.hidden = String(s.dataset.step) !== String(n);
      });
    }
  </script>
</form>
```

That's the whole contract. The auto-injected script handles all step-event firing — your `advanceTo` only manages section visibility. The serve route rewrites the form's `action` to `/api/form-submit` (or to the configured destination if one exists) and injects hidden `variantId` / `sessionId` fields. The redirect to `{{THANK_YOU_URL}}` fires on successful submit.

**With a configured destination (`destination !== null`):** exactly the same bare form — no `action`, no `method`, no vendor hidden fields. §1 option B applies to the quiz form unchanged: granvl bakes the destination's adapter, fan-out, and hidden fields at serve time; you control the field names (matching what the destination expects) and the `_next={{THANK_YOU_URL}}` input. The `data-step` grouping attributes are independent of destination wiring — they always work the same.

**Privacy.** Step events capture *that* the visitor reached/left a step and how long they spent, never *what they answered*. Same zero-PII guarantee as the rest of Granvl.

**❌ DO NOT split a quiz across multiple Granvl pages.** A funnel can have at most ONE `Page.type === 'QUIZ'`. The MCP `create_page` and `update_page` calls REJECT any operation that would result in 2+ QUIZ pages in a funnel, and publish blocks until the shape is fixed. Multi-page quizzes (LANDING → QUIZ → QUIZ → QUIZ → THANK_YOU) are an antipattern: page navigation between steps hemorrhages visitors, prevents inline validation, and produces worse conversion math than a single-page quiz. **Every multi-step quiz lives on ONE QUIZ page with `<section data-step>` swaps** — that's the contract.

A legitimate adjacent pattern: LANDING with a "Take the quiz" CTA → QUIZ page (single-page multi-step inside) → THANK_YOU. That's three pages but only ONE QUIZ. Fine.

## 2c. Embedded booking widgets (Calendly / Cal.com / HubSpot / Acuity / SavvyCal / TidyCal)

When the user wants to embed a third-party scheduling tool in a variant (*"add my Calendly here"*, *"drop in a Cal.com embed"*, *"embed our HubSpot meeting link"*, etc.), the booking happens **inside the iframe** and Granvl's normal conversion paths see nothing. The funnel reports 0% conversion while the customer's calendar fills up.

**Fix: set `embedded_widget` on the variant** when calling `create_variant` / `update_variant` / `bulk_create_variants`. Granvl then auto-injects a postMessage listener scoped to the widget's origin and fires `CONVERSION + action=embedded_widget` on a successful booking.

Supported values:

| Trigger phrase from the user | `embedded_widget` value |
|---|---|
| "Calendly", "embed my calendar from Calendly" | `calendly` |
| "Cal.com", "cal.com booking link" | `cal_com` |
| "HubSpot meetings", "HubSpot calendar embed" | `hubspot_meetings` |
| "Acuity", "Acuity scheduling" | `acuity` |
| "SavvyCal" | `savvycal` |
| "TidyCal" | `tidycal` |
| Anything else — different provider, internal booking tool, etc. | `custom` + `embedded_widget_config` |

For `custom`, also provide `embedded_widget_config`:
```ts
{
  embedded_widget: 'custom',
  embedded_widget_config: {
    originPattern: 'https://booking.acme.com',
    matcherJs: "return data && data.type === 'acme.booked';"
  }
}
```

**The HTML still embeds the widget normally** (iframe, script tag, whatever the provider documents). Granvl doesn't touch the embed code — it just adds the listener separately. So:

```html
<!-- Inside the variant HTML -->
<div class="calendly-inline-widget"
     data-url="https://calendly.com/acme/intro"
     style="min-width:320px;height:700px;"></div>
<script src="https://assets.calendly.com/assets/external/widget.js"
        async></script>
```

…paired with `embedded_widget: 'calendly'` in the MCP call. Granvl's injected listener does the rest.

**When NOT to set it:**
- The CTA is a link to a hosted Calendly page (the user clicks and gets navigated OFF the variant). Use `data-pages-convert` on that link instead — it's an outbound click, not an embed.
- The "embed" is actually a redirect-mode booking flow (visitor leaves the variant during booking). Use a Granvl TY page + the `_cv` chain instead.

## 2d. Embedded third-party FORMS (Typeform / LeadConnector / Jotform / Google Forms)

Same iframe blind spot as 2c, but for **lead-capture forms** instead of booking widgets. The form lives in a cross-origin iframe, so Granvl's `submit` listener never sees the submission and the vendor's post-submit redirect can't carry the `_cv` marker. By default the funnel reports 0 conversions even though leads are coming in.

**Fix (two steps):**
1. In the **vendor's** settings, set the form's *on-submit redirect* to the funnel's thank-you page URL (the `{{THANK_YOU_URL}}` value, or the page's published URL). Redirecting the top window OR within the iframe both work — as long as it lands on the Granvl TY page so our tracker beacons a VIEW.
2. Call `update_funnel` with `thank_you_view_conversion: true`. Granvl then counts the visitor's arrival on the TY page as a `CONVERSION` (action `form_submit`), attributed to the embed-hosting page. Same 24h dedup as native submits — never double-counts.

```html
<!-- Inside the LANDING variant HTML — embed the form normally -->
<iframe src="https://form.typeform.com/to/XXXXXX"
        style="width:100%;height:600px;border:0;" title="Apply"></iframe>
```
…paired with `update_funnel({ funnel_id, thank_you_view_conversion: true })` and the vendor's redirect pointed at the TY page.

**When NOT to set it:**
- The form is a **native** `<form>` Granvl generated (§1) — already tracked at submit; leave the flag off.
- The embed shows an **inline** "thanks" with no navigation to a Granvl TY page — there's no arrival to count. Either switch the vendor to redirect-to-TY, or (for booking-style widgets) use the `embedded_widget` postMessage path in §2c.

**Privacy:** the listener captures only the success signal + provider name. Booking details (invitee name, email, time, etc.) never leave the visitor's browser — same zero-PII guarantee as the rest of the system.

---

## 3. Styling — two clean paths, both precompiled at save

Granvl precompiles Tailwind at variant save time to strip the play-CDN's ~525 KiB of unused JS + ~105 KiB of unused CSS, eliminate the FOUC (flash of unstyled content), and give visitors a styled first paint. To stay in the precompile-friendly path, agent-authored variants use **either** Tailwind utility classes **or** plain CSS in `<style>` blocks. Mix freely.

**Path 1 — Tailwind utility classes in HTML.** Include the play-CDN script for local previews; the serve route strips it after compile.

```html
<script src="https://cdn.tailwindcss.com"></script>
<!-- ...content with class="bg-blue-500 hover:bg-blue-600 md:flex" etc. -->
```

All standard modifiers compile: `hover:`, `focus:`, `peer-`, `group-`, `md:`, `lg:`, `dark:`. Arbitrary values compile: `bg-[#1d1d1d]`, `grid-cols-[1fr_2fr]`, `font-['Inter']`. **Pasted code from v0.dev / shadcn / tutorials is welcome** — it'll compile.

**Path 2 — Plain CSS in `<style>` blocks.** Write whatever CSS you want, reference via class name:

```html
<style>
  .cta-btn {
    background: #1d3557;
    padding: 12px 24px;
    border-radius: 6px;
    color: white;
  }
</style>
<button class="cta-btn">Get Started</button>
```

**Three patterns block precompile and force a fallback to the play-CDN** (variant still works but loses the perf win):

1. `<script>tailwind.config = {...}</script>` — inline Tailwind configs. **Don't use these.** For custom brand colors, use Tailwind arbitrary values (`bg-[#1d1d1d]`) — the actual hex baked into the class.
2. `@apply` directives in inline `<style>` blocks — `<style>.btn { @apply bg-blue-500; }</style>`. **Don't use `@apply`.** Either write the utility classes inline OR write the equivalent plain CSS without `@apply`.
3. JavaScript class manipulation — `el.classList.add('hidden')`. **Don't toggle Tailwind classes via JS.** Use CSS-only interactivity instead: Tailwind's `peer-checked:`, `group-hover:`, `:has()`, or native `<details>`/`<dialog>` elements.

If any of those three patterns lands in a saved variant, the `create_variant` / `update_variant` response will include `compileStatus: 'fallback_<reason>'` and `compileWarning: '<explanation>'`. The variant card on the canvas shows a small `⚠ slow` badge. Fix the disallowed pattern and resave to get the perf back.

## 3b. Brand kit — the brand the customer builds with

A **brand kit** is a workspace-level *brand* — name, colors, fonts, radius, **logo**, **voice/tone**, and tagline — attached to one or more domains. It's **reference data only**: Granvl injects nothing at serve time. You read the kit, then bake the actual hex codes, font links, radius, logo, and tone directly into the variant HTML at generate time. A saved variant is fully self-contained — what you save is exactly what renders.

**YOU OWN BRAND CONSISTENCY — BE PROACTIVE.** Granvl is agent-operated; filling out and maintaining the brand kit is *your* job, not a thing to wait for the user to ask about. The moment you start working on a domain:

1. Call `get_brand_kit(domain_id)` (or read `brand` from `get_funnel`).
2. **Check for an auto-extracted kit first.** During onboarding Granvl can scrape the user's website into a kit — if `sourceUrl` is set, the palette, logo, and fonts came from their real site. Trust it as the starting point (confirm, don't re-interview), and use `screenshots[]` — hosted captures of that site — as your look-and-feel reference when generating pages. A kit created seconds ago may still be a stub while extraction finishes; re-read it before declaring it empty.
3. **If it's genuinely empty or thin, build it out before generating pages.** Ask the user for their brand (or offer to pull it from their existing website / a brand doc / their logo), then SAVE it with `update_brand_kit` — colors, fonts, radius, `logo_url`, and especially `voice`. A good brand kit is the single biggest lever on output quality — the same campaign looks weak without brand assets and shippable with them. (Users can also view and edit kits themselves in **Settings → Brand Kits** — point them there if they want to tweak colors or the logo by hand.)
4. Once saved, every page you generate is automatically on-brand — and so is your *copy*, because you write in the kit's `voice`.

**Logo:** upload it with the `upload_image` tool first (gets a hosted Granvl URL), then provide that URL as `update_brand_kit(logo_url: ...)`. Use the logo in the variant header/footer.

**Reading the kit.** Call `get_brand_kit(domain_id)` (or read `brand` from `get_funnel`):

```
{
  brandKitId: "<id>",
  brandKitName: "Acme",
  tokens: {
    colors: { primary: "#1d3557", accent: "#e63946", bg: "#ffffff", text: "#1d1d1d" },
    fonts: { heading: "Playfair Display", body: "Inter" },
    radius: "medium"
  },
  brandMode: false,
  logoUrl: "https://.../logo.webp",              // Granvl-hosted; use in header/footer
  voice: "Confident, punchy, no jargon.",        // write ALL copy in this tone
  tagline: "Insure smarter, not harder.",
  domainId: "<id>",
  sourceUrl: "https://acme.com",                 // set when the kit was auto-extracted from a site
  screenshots: ["https://.../hero.webp"]         // hosted captures of that site — your look-and-feel reference
}
```

`radius` values map to: `sharp` → `0`, `medium` → `8px`, `pill` → `999px`.

**Applying the kit when generating HTML.** Use the actual values, not CSS variables:

```html
<!-- Colors: bake the hex -->
<button class="bg-[#1d3557] hover:bg-[#16263f] text-white px-6 py-3 rounded-lg">
  Get Started
</button>

<!-- Fonts — STRONG DEFAULT: the system stack, no webfont at all.
     `system-ui, -apple-system, sans-serif` is zero bytes, renders
     instantly, and looks native-polished on every device (SF / Segoe /
     Roboto). Nobody bounces over body-text typography. Load a webfont
     ONLY when the brand kit names one, and then for HEADINGS ONLY —
     one family, two weights max; body stays on the system stack.
     Never load Inter: it's designed to look like a system font, so
     the download buys nothing — just use system-ui.

     When you do load a webfont, use the non-blocking preload + onload
     swap below (never a bare <link rel="stylesheet">). Granvl also
     auto-rewrites bare font stylesheets to this pattern at serve time,
     so a miss isn't fatal — but author it right. -->
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;600;700&display=swap"
        onload="this.onload=null;this.rel='stylesheet'">
  <noscript>
    <link rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;600;700&display=swap">
  </noscript>
  <style>
    /* Body on the system stack; the brand webfont only where it earns
       its bytes. */
    body { font-family: system-ui, -apple-system, sans-serif; }
    h1, h2, h3 { font-family: 'Playfair Display', Georgia, serif; }
  </style>
</head>
```

**Font loading rules — every variant:**

- Use the preload + onload pattern shown above. A blocking `<link rel="stylesheet">` adds ~750ms to FCP on slow 4G — never acceptable.
- **Max 3 weights per family.** Typical choice: `400, 600, 700`. Loading 5+ weights (e.g. `400;500;600;700;800`) bloats the font CSS and the woff2 binaries it pulls in, with no visible benefit — designers can't tell `500` from `600` in body copy.
- Only include the `<link>` for fonts actually USED in the variant. Don't preload the brand kit's `heading` font if the variant only uses `body`.
- Always provide `display=swap` so text stays readable while the font loads.
- **Defense in depth:** the serve route also auto-rewrites a bare `<link rel="stylesheet" href="...fonts.googleapis.com...">` to the preload+onload pattern at render time. If you ship the bare form by mistake the system catches it — but author it correctly anyway so the source HTML matches what visitors see, and so the skill rules stay enforceable at review time.

**Two modes, very different behavior:**

**Flexible mode (`brand.brandMode === false`, default):**
- Use the brand kit as a strong default for brand-related styling — colors, fonts, radius.
- If the user gives an explicit override ("make the CTA red", "use Roboto for headlines"), follow the override.
- The brand kit is a default, not a hard rule.

**Brand Mode (`brand.brandMode === true`):**
- The user has locked the brand. **Every variant MUST use the brand palette and fonts.**
- If the user asks for a color or font that conflicts with brand mode, surface this:
  > *"Brand Mode is on for this brand — I have to use your brand colors / fonts. Want me to turn Brand Mode off first? You can also toggle it in dashboard → Brand Kits."*
- Only call `update_brand_kit(domain_id, brand_mode: false)` on explicit confirmation.

**When the brand kit changes.** Since the values are baked into variants, an update to the brand kit doesn't auto-propagate. If the customer changes a color or font, offer to re-skin existing variants:
> *"You updated the brand kit. Want me to re-generate the existing variants to use the new palette?"*

**Writing the brand kit.** Save brand info as you learn it — proactively, not only when handed a spec. `update_brand_kit` takes `domain_id` plus any of `tokens`, `name`, `logo_url`, `voice`, `tagline`, `brand_mode` (provide only what you're changing):

```
update_brand_kit({
  domain_id: "<id>",
  name: "Acme",
  tokens: {
    colors: { primary: "#1d3557", accent: "#e63946", bg: "#ffffff", text: "#1d1d1d" },
    fonts: { heading: "Playfair Display", body: "Inter" },
    radius: "medium"
  },
  logo_url: "<url returned by upload_image>",
  voice: "Confident, punchy, no jargon; speaks to busy founders.",
  tagline: "Insure smarter, not harder."
})
```

Pasted code (v0.dev / shadcn) with off-brand colors should be edited to the brand palette BEFORE save:

```html
<!-- Before paste (generic blue) -->
<button class="bg-blue-500 hover:bg-blue-600">CTA</button>

<!-- After (brand primary baked in) -->
<button class="bg-[#1d3557] hover:bg-[#16263f]">CTA</button>
```

## 4. HTML scaffolding — minimum viable

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ page title }}</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-white text-zinc-900 antialiased">
    <header><!-- nav, logo --></header>
    <main>
      <!-- hero, form, content sections — primary content -->
    </main>
    <footer><!-- legal footer with privacy + terms links — see §5 --></footer>
  </body>
</html>
```

The serve route injects the tracking script before `</body>` and (if configured) GTM after `<head>`. Don't write either yourself.

**Hero image — set `fetchpriority="high"`:** when the variant has a hero image (an `<img>` above the fold, typically the first one in the document), set `fetchpriority="high"` on it. The serve route's image optimizer also auto-detects the first `<img>` and exempts it from lazy-loading + adds `fetchpriority="high"` if you forget — but setting it explicitly is the right contract:

```html
<img src="/hero.jpg" alt="..." fetchpriority="high" width="800" height="450">
```

Why: the hero is almost always the LCP element. Without `fetchpriority="high"` (and without auto-exempting it from lazy), the browser deprioritizes the fetch and Lighthouse can fail to even measure LCP. This single attribute is the cheapest 1-2s LCP win available.

## 4b. Accessibility basics — non-negotiable

Real Lighthouse on production pages caught two gaps that block easy wins: missing `<main>` landmark and low-contrast text. Both are agent-shape problems, not platform problems — fixable here.

Why it matters beyond a Lighthouse score:

- **Meta auto-flags low-contrast landing pages** during ad review — can disapprove the ad or flag the ad account
- **Apple Reader mode + screen readers** rely on `<main>` to identify primary content; without it they grab the whole document including chrome
- **SEO** uses semantic landmarks as hints for "what is this page actually about"

**Required:**

1. **Wrap primary content in `<main>`.** Exactly one `<main>` per page, wrapping hero / form / content. Headers, navigation, and footers live outside it. (See the scaffold example above.)

2. **Text contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text (18pt+).** Common failures:
   - `text-zinc-300` on `bg-white` — too light, 2.4:1
   - `text-blue-200` on `bg-blue-100` — fails
   - Light text on light gradients — fails

   When in doubt, default to **`text-zinc-900` on light backgrounds** and **`text-zinc-50` on dark backgrounds** — both clear WCAG AA on their corresponding `bg-white` / `bg-zinc-900`. When applying brand-kit text/bg colors, the customer picked them so trust them, but spot-check the resulting contrast on dark-on-dark or light-on-light combinations.

3. **Image `alt` attributes — always present.** Decorative images get `alt=""` (empty string is explicitly correct). Content images get descriptive alt text. **Missing `alt` is wrong**; empty `alt=""` for decoration is right.

4. **Exactly one `<h1>` per page** — almost always the hero headline. This is a hard rule (same as in SKILL.md's accessibility minimums), not a nice-to-have: zero or multiple `<h1>`s hurt SEO + a11y, and skipping straight to `<h2>` does too.

**Recommended:**

- Form labels — every `<input>` should have either a `<label for="…">` or `aria-label`. Most agent-generated forms get this right via `<label>`; worth calling out for forms inline with `<input>` elements lacking a wrapping label.
- `lang="en"` on `<html>` — the publish-validator's `lang_attr_added` auto-fix catches missing ones, but include it explicitly. (Use a different language code if the customer's market isn't English.)

## 4c. Performance budget — hard rules

PageSpeed Insights on mobile slow-4G is the bar these pages get graded against by Meta + Google for ad-account Quality Score. A score below 80 raises CPMs measurably and risks ad-account flags. Hit these budgets every time.

**Image handling — Granvl auto-compresses for you (first-party pipeline):**

Every `<img src>` AND every CSS `background-image: url(...)` (in inline `style` attributes OR `<style>` blocks) is automatically rewritten at bake time to route through **Granvl's own first-party image optimizer** — same-domain delivery (no third-party proxy hop), AVIF/WebP negotiation at quality 75, width capped at 800px (`<img>`) or 1200px (background), CDN-cached on the customer's domain. A 2 MB JPEG source serves as ~100 KB AVIF/WebP. **You don't need to estimate output sizes.**

**The allowlist nuance (this is why `upload_image` matters):** only images hosted on Granvl's CDN (via `upload_image` or the save-time auto-rehost) and a short list of known asset hosts are rewritten into the optimizer. An image hotlinked from an arbitrary external host **is served unoptimized** — full original bytes, third-party hop, no format conversion. Hosted images are the only path guaranteed fast.

What this means for you:

- **Embed images at any source size — the optimizer handles the rest** (as long as they're Granvl-hosted). Don't waste back-and-forth asking the user for compressed versions. Upload, paste the returned URL, move on.
- **CSS gradients > raster gradients — always.** `bg-gradient-to-br from-indigo-600 to-purple-700` is 0 bytes and looks identical on every screen. A "gradient.png" image, even after compression, costs bytes for no visible benefit. NEVER use an image for a gradient.
- **`<img>` over `background-image:` for content images** — `<img>` gets responsive sizing + lazy-loading for free, and screen readers see the `alt`. Reserve `background-image:` for full-bleed decorative hero photos (still auto-compressed).
- **Set `width` and `height` on `<img>`** (or `aspect-ratio` via CSS) to prevent layout shift.
- Hero `<img>` gets `fetchpriority="high"` (see §4). Below-the-fold `<img>` gets `loading="lazy"` auto-injected.

**Prefer `upload_image` — host images on Granvl, don't hotlink:**

The best path for ANY image is the `upload_image` MCP tool. It returns a permanent Granvl CDN URL that you paste into the HTML. Why this beats hotlinking an external URL: external hosts rot (404 later), rate-limit, can hijack the referrer, and leak the visitor's IP to a third party. Granvl re-encodes to WebP, strips EXIF/location metadata, resizes oversized images down, and serves from our own CDN.

- **Provide the image one of two ways — exactly one:**
  - `source_url` — a public http(s) URL (an image you found, a generation-API result URL, a stock photo URL). Granvl fetches it server-side.
  - `data` — base64 of a **local file** the user gave you / you read off disk (≤3 MB original; the `data:image/...;base64,` prefix is optional). This is how local files get onto Granvl — there is no separate CLI.
- **Reuse the returned URL across edits.** The `url` is stable. Paste it once and keep using the same string on every later `update_variant`. Do **not** re-upload an image you already uploaded — only call `upload_image` again when the image itself actually changes. (Re-uploading the identical image is deduped and returns the same URL with `dedup: true`, but skipping the redundant call is faster.)
- **Tell the user what you hosted.** When you upload, mention it ("I hosted 3 images on Granvl and used those URLs"). The response includes the workspace's storage usage vs quota — if a call returns a quota error, tell the user to delete unused images or raise the cap.
- **Backstop:** if you forget and paste a raw external `<img src>` URL, `create_variant`/`update_variant`/`bulk_create_variants` will re-host it automatically at save time and report `imagesRehosted` (plus `imageIngestWarnings` for any it couldn't fetch). Don't rely on this — call `upload_image` up front so you control the URLs.

**What the optimizer does NOT cover:**

- SVGs — go through unchanged (already small).
- Relative URLs and data: URIs — left alone.
- Total file count — embedding 30 images is still 30 network requests even if each is small. Keep total assets to a reasonable count.
- **Images on non-allowlisted external hosts** — served untouched (no compression, no format conversion). The save-time auto-rehost usually moves these onto Granvl's CDN first (re-entering the optimized path), but don't rely on it — `upload_image` up front.

**Page-weight sanity cap:**

After compression, the total page weight should land under **1.5 MB** including all images, scripts, fonts, and the variant HTML itself. The optimizer handles most of it; if you find yourself loading 20+ images, audit whether you actually need all of them.

**Script / embed budget:**

- **No client-side analytics SDKs beyond what Granvl injects.** GA / Mixpanel / Plausible / Heap / Clarity / etc. — all conflict with our first-party analytics and add 30-100 KiB of blocking JS each.
- **Never paste ad-pixel snippets into variant HTML — Granvl's injection is strictly better.** Pixels configured via `update_domain_tracking` (GTM, gtag/GA4, Meta, TikTok, Microsoft UET) are auto-injected with **deferred loading that never costs an event**: on landing / quiz / form pages they load on the visitor's first scroll/tap/keypress or 0.5s after the page is ready and visible, whichever comes first — off the first paint, but early enough that a quick bounce still gets its PageView and click cookie. On THANK_YOU pages, and any page arriving with a conversion to report, they load IMMEDIATELY, because a confirmation page is where people leave without touching anything. A hand-pasted snippet adds a second, eager copy that blocks the main thread and double-fires events. Timing matters for conversions: Meta and TikTok also receive them server-side, but **Google Ads conversions on a gtag setup are sent only from the browser**, so never add anything that delays or duplicates the Google tag on a thank-you page.
- **No CRM "marketing infrastructure" embeds.** HubSpot Marketing's full snippet (the one that drags in `common.js`, `banner.js`, `whisper-core.js`) adds ~70 KiB of mostly-irrelevant tracking. If the user mentions HubSpot, only embed what's actually needed:
  - For a booking widget: use the lightest possible Meetings iframe AND set `embedded_widget: 'hubspot_meetings'` on the variant (§2c). Do NOT paste the full HubSpot Marketing snippet.
  - For lead capture: use `set_form_destination(provider='HUBSPOT')` with the form's posting URL — server-side, no client JS.
- **No render-blocking external CSS** other than the deferred Google Fonts pattern in §3b. Tailwind's CDN script counts as JS, not CSS, and is exempt because it's required for compile.
- If a variant absolutely needs a third-party widget (chat, calculator, etc.), it should be:
  - Loaded inside `requestIdleCallback` so it doesn't block first paint, OR
  - Behind a click-to-load button so it never fires until the user explicitly opts in

**Critical-path rules:**

- Inline above-the-fold styles in a `<style>` block in `<head>` when the variant is unusually heavy (long marketing page). Tailwind's CDN typically handles this for short pages.
- Every `<script>` not in `<head>` should be at end of body, OR have `defer` / `async`.
- Avoid the `<script>` tag in `<head>` without `defer` / `async` — it blocks HTML parsing.

**Self-check before publish:**

After generating a variant, run this mental check:
- [ ] No `background-image: url(...)` used for a gradient (use CSS `bg-gradient-to-*` instead)?
- [ ] Fonts use the preload pattern from §3b, with ≤3 weights per family?
- [ ] No third-party analytics SDKs beyond what's in the brand kit / domain tracking config?
- [ ] No HubSpot Marketing full snippet / Heap / Clarity / Mixpanel pasted into the HTML?
- [ ] All scripts deferred or at body-end?

If any answer is no, fix before calling `publish_funnel`. PSI < 80 is a real conversion drag (5-15% bounce-rate penalty on slow mobile) and an ad-account risk.

## 5. Legal footer (privacy + terms) — publish-time, never build-time

When the workspace has legal URLs set, every variant includes a footer linking the privacy policy. Ad platforms (Meta, Google Ads, TikTok) reject ad accounts whose landing pages don't link a discoverable privacy policy from the page itself — so this matters the moment the funnel goes live on a custom domain with paid traffic.

**But missing legal URLs never block a build.** First builds, granvl preview links, and iteration all proceed without them — do not stop, warn, or scan for legal pages while the user is just building. Raise it exactly once, when they're heading toward a custom-domain publish or an ad campaign.

**Pull the URLs from `get_funnel`.** The response contains a `legal` object:

```json
{
  "legal": {
    "privacyPolicyUrl": "https://example.com/privacy",
    "termsOfServiceUrl": "https://example.com/terms",
    "businessLegalName": "Acme Inc."
  }
}
```

- `privacyPolicyUrl` set → link it in the footer. Null → **build anyway, skip the footer links**, and NEVER substitute a placeholder URL (`#`, `/privacy`, `https://example.com/privacy`). When the user wants to publish on a custom domain or run ads, say: *"Before this goes live on your domain, add your Privacy Policy URL in Settings → Domains → [domain] → Legal & compliance. Ad platforms reject landing pages that don't link one."*
- `termsOfServiceUrl` is recommended; render the link only if set.
- `businessLegalName` drives the `© {year} {name}` line; render the line only if set.

**Default footer snippet** (adapt the styling to the page):

```html
<footer class="mt-16 border-t border-zinc-200 py-6 text-center text-xs text-zinc-500">
  <p>
    © 2026 {businessLegalName} ·
    <a href="{privacyPolicyUrl}" class="underline hover:text-zinc-900">Privacy Policy</a>
    · <a href="{termsOfServiceUrl}" class="underline hover:text-zinc-900">Terms</a>
  </p>
</footer>
```

**Server-side fallback**: if you forget the footer, the serve route auto-injects a default one before the page is rendered (using the same domain-level URLs). That's the safety net — but it's a plain default style that won't match the page. **Always include your own.**

## 6. Publish-time validator (the safety net)

> **The write-time audit comes first.** `create_variant` / `update_variant` already return an `htmlAudit` block previewing these fixes plus serve-contract warnings publish never corrects — fix those at write time (see SKILL.md "The write-time audit comes first") so publish has nothing left to say.

When you call `publish_funnel`, every variant runs through a deterministic HTML validator. The tool returns a `validation` object with `autoFixes` (things the platform fixed for you) and `warnings` (things the platform flagged but didn't auto-fix). **Each item has a stable `code` you can match against the playbook below to know exactly what to do.**

If `warnings` is empty, the funnel is live and you're done — tell the user the URL. If there are warnings, walk through them one at a time using the playbook, fix via `update_variant` (replace `html_content` with the corrected HTML), and re-call `publish_funnel`.

**Auto-fix codes (informational — already applied to saved HTML):**

| Code | What the validator did | Why it matters |
|---|---|---|
| `form_action_stripped` | Removed `action="..."` from `<form>` | Serve route auto-routes to `/api/form-submit`; an existing action would conflict |
| `form_method_stripped` | Removed `method="..."` from `<form>` | Same |
| `formspree_url_stripped` | Replaced a third-party form host (formspree, getform, etc.) | Form data must flow through Granvl to track conversions |
| `next_field_injected` | Added `<input name="_next" value="{{THANK_YOU_URL}}">` on LANDING/FORM | Without it the visitor doesn't redirect to thank-you (no auto-conversion) |
| `hardcoded_ty_url_replaced` | Swapped a `https://...` `_next` value for `{{THANK_YOU_URL}}` | Template token is portable across domain changes |
| `honeypot_field_injected` | Added off-screen `name="_gotcha"` input | Spam-bot tripwire |
| `charset_meta_injected` | Added `<meta charset="UTF-8">` | Required for non-ASCII text |
| `viewport_meta_injected` | Added `<meta name="viewport">` | Required for mobile rendering |
| `lang_attr_added` | Added `lang="en"` to `<html>` | Screen reader / SEO compliance |
| `base_tag_stripped` | Removed `<base>` | Breaks the form-action rewriter |

**Warning codes (action required — fix before re-publishing if possible):**

| Code | What to do |
|---|---|
| `no_conversion_path` | LANDING page has no `<form>` AND no `data-pages-convert` element. Either add a form (with `_next={{THANK_YOU_URL}}`) or add `data-pages-convert` to the primary CTA, then `update_variant` + re-`publish_funnel`. |
| `thank_you_has_form` | A `<form>` is on a THANK_YOU page. Move it to the LANDING/FORM/QUIZ page — the conversion fires automatically when the visitor lands here from a form-submit redirect, so a form here is misplaced. `update_variant` to remove the form (or change the page type if intent is different). |
| `oversized_image` | `<img>` is missing `width` and `height`. Add explicit dimensions to prevent CLS. `update_variant` to add the attributes. |
| `untrusted_script_src` | An external `<script src="...">` points at a host outside the allowlist (Tailwind CDN, Cloudflare Turnstile). Browsers may block it under our CSP. Either remove the script entirely (configure tracking via Domain settings instead — GTM, Meta CAPI, GA4 all flow server-side) or substitute one of the allow-listed CDNs. |
| `inline_analytics_script` | Inline GA / GTM / Meta-Pixel / Plausible snippet detected. Remove it — Granvl's first-party analytics + Domain-level CAPI/GTM injection do this server-side, no client-side script needed. `update_variant` to delete the inline `<script>` block. |
| `missing_title` | `<title>` is missing or set to "Untitled". Set a descriptive page title; SEO + tab labels need it. `update_variant` to update the `<title>` tag. |
| `no_main_landmark` | No `<main>` element wrapping primary content. Required for screen-reader / Apple Reader / SEO. `update_variant` to wrap the hero + form + content sections in `<main>`. Header / footer / nav stay outside. See §4b. |

**This is the contract.** Don't try to "test the validator" — write HTML the right way the first time.

## 6b. Performance budgets at publish (the speed loop)

`publish_funnel` also checks every BAKED page against performance budgets and returns `budgetViolations[]` (warn-only — the funnel still goes live). Each entry has a `code`, the numbers, the offending `url` where relevant, and a ready-to-apply `fix`. **Treat a non-empty list as your next task in the same session: apply each fix, `update_variant`, re-publish, confirm the list comes back empty.** Fast pages lower the user's CPC (Google Ads Quality Score includes landing-page experience) — this is money, not cosmetics.

| Code | Budget | The usual fix |
|---|---|---|
| `html_too_large` | 150 KB pre-compression | Trim sections, move giant inline SVG/data-URIs to uploaded assets |
| `image_too_large` | 300 KB per image | Compress/resize (WebP/AVIF at rendered dimensions), `upload_image`, re-reference |
| `render_blocking_external` | 0 in `<head>` | Add `async`/`defer`; if it's `cdn.tailwindcss.com`, your Tailwind precompile fell back — fix the disallowed pattern and re-save |
| `inline_script_too_large` | 80 KB total | Prefer CSS-only interactivity; delete dead JS |

Never tell the user a page is "fully optimized" while `budgetViolations` is non-empty.

**The score:** after publish, an hourly job Lighthouse-scores each live page (PageSpeed Insights, mobile). Read with `get_page_speed { funnel_id }` — score 0-100 + LCP/CLS/TBT + ranked `opportunities[]` with estimated ms savings. Right after publishing the status is `pending` (<=1h). **If score < 90: apply the opportunities, `update_variant`, republish — it re-scores automatically.** When reporting performance to the user, lead with the score and what you already fixed.

**What the platform does automatically (don't re-solve these, and cite them confidently when the user asks "is my page fast?"):** published pages are pre-compressed at publish time (brotli-11, ~4× smaller on the wire), served from the CDN edge with zero database on the hot path, images route through the first-party optimizer (§4c), fonts load non-blocking, the funnel's likely next page is speculatively prerendered, and all domain-configured ad pixels are interaction-gated (they execute after first touch, outside page load). A variant that follows this skill's budgets should score 90+ out of the box with pixels configured.

**Interpreting TBT in speed reports:** platform-injected pixels can no longer contribute to Total Blocking Time. If `get_page_speed` shows meaningful TBT, the cause is the variant's OWN inline JS or a third-party script pasted into the HTML — fix by trimming variant JS / removing the pasted SDK (§4c), not by touching tracking config.

**Verifying a publish on the live URL:** the CDN serves the previous bake for up to ~1 minute after publish. If you fetch the live page right after publishing and see old content, that's propagation, not a failed publish — wait a minute before concluding anything.

---

## 7. Editing + duplication recipes

### Iterating on a teammate's variant — fork, don't overwrite

1. `list_funnels` to find the named funnel (the teammate's).
2. `get_funnel` to identify the right variant (by page + name).
3. `get_variant_html(variant_id)` to read what's there.
4. `duplicate_variant({ variant_id, weight: 0 })` — copy lives on the same page by default, paused (weight 0) so it doesn't immediately compete for traffic.
5. `update_variant(new_variant_id, html_content, change_summary, ...)` with the iterated HTML + a fresh `angle_hypothesis` explaining what differs from the source.
6. Tell the user: *"Built a draft at {previewUrl}, paused. Want me to bump weight when you're ready?"*

**Cross-funnel duplication** — *"take this winning variant and try it on my new funnel"*:

```
duplicate_variant({
  variant_id: "<source>",
  target_page_id: "<new funnel's same-type page>",
  weight: 0
})
```

The target page MUST be the same type as the source's page (LANDING→LANDING, QUIZ→QUIZ, etc.). Different types reject with `TYPE_MISMATCH` — call `get_funnel` on the target funnel first to find a matching page.

**Cross-funnel funnel duplication** — *"clone Sarah's whole insurance funnel for our new vertical"*:

```
duplicate_funnel({ funnel_id, name: "Spring promo — pivoted from insurance" })
```

Copies every page + every variant. Status: DRAFT. Source's domain reference is preserved — you'll need to rename slugs OR archive the source before publishing the duplicate, or the publish-time slug-conflict check rejects.

**Ownership rule:** the duplicate is owned by the user who triggered the duplication, not the original creator. The activity log preserves the lineage for trust + analytics.

### The stat-pollution guardrail — the mechanics

Editing a live variant's `html_content` **in place** blends old-copy and new-copy performance under one variant id — the conversion rate the dashboard shows becomes a meaningless average of two different pages, and the A/B test is silently corrupted. So the rule inverts once a variant has real traffic: **default to duplicate-and-iterate, not edit.**

`update_variant` enforces this server-side. When you change `html_content` on a variant with meaningful traffic since its last stats reset, the call is **blocked** and returns:

```jsonc
{
  "requiresAck": true,
  "guardrail": { "level": "block", "visitors": 312, "conversions": 18, "paidTraffic": true, "acknowledged": false },
  "message": "This variant has meaningful live traffic …",
  "suggestedAction": "duplicate_variant"
}
```

Tiers (counted since the variant's last stats reset):
- **0 conversions** → no guardrail. Editing is safe — there's no conversion stat to corrupt (covers brand-new variants AND high-traffic-but-zero-conversion losers).
- **A few conversions, low volume, no paid spend** → soft `warn`. The edit proceeds, but the response carries a `guardrail` block — surface it to the user.
- **≥100 visitors OR ≥5 conversions OR any paid-ad traffic** → hard `block` (`requiresAck`). The edit does **not** apply.

**What to do when you get `requiresAck`:**
1. **Default to `duplicate_variant`** + `update_variant` on the new copy. That preserves the live variant's history and starts the iteration on a clean slate.
2. If the user *explicitly* wants to edit the live one anyway, surface the trade-off first, e.g.: *"Variant A has 312 visitors and 18 conversions (including paid traffic) since its last reset. Editing it will blend the new copy into those stats. Want me to (a) duplicate it and edit the copy, or (b) edit the live one anyway?"*
3. **Only after the user picks (b)**, retry `update_variant` with `acknowledge_stat_pollution: true`. **Never set that flag on your own initiative** — the *user* consents, not you. (The escape hatch if they edit anyway: a stats reset via the dashboard gives a clean slate from the edit point forward.)

Every acknowledged edit (and every soft-warn edit that proceeds) is recorded in the workspace audit log with the visitor/conversion counts at edit time — so there's a trail of who took responsibility for the pollution.

---

## 8. Qualification-routed thank-you pages

When a funnel has a qualification rule, you can route qualified vs. unqualified leads to different thank-you pages — qualified gets the high-intent CTA ("book your call now"), unqualified gets a softer touchpoint (downsell, nurture content, polite "we'll follow up"). This protects high-value calendar links from low-intent leads and lets you tailor the post-submit experience to the lead's actual value.

**Recipe:**

```
# Funnel already has a qualification rule. Add a second TY page for unqualified leads:
create_page({
  funnel_id,
  name: "Thank you — qualified",
  slug: "thanks",
  type: "THANK_YOU",
  qualification_audience: "qualified"
})
create_page({
  funnel_id,
  name: "Thank you — unqualified",
  slug: "thanks-unqualified",
  type: "THANK_YOU",
  qualification_audience: "unqualified"
})
# Generate the variants for each as usual via create_variant.
```

**Routing happens automatically.** When a lead submits, the platform evaluates the rule and redirects to the matching audience-specific TY. Order of precedence:

1. TY page tagged with the matching audience → redirect there
2. TY page with no audience tag (= "all") → fall back here
3. No matching TY at all → honor the form's `_next` (existing behavior)

**Constraints:**

- `qualification_audience` is **only valid on `type: "THANK_YOU"` pages**. Setting it on LANDING / QUIZ / FORM errors.
- At most **one TY per audience per funnel** — if you try to create a second `qualified` TY, the API rejects. Update the existing one instead with `update_page`.
- Webhook-back qualification flips (CRM tells us a "qualified" lead is actually unqualified hours later) **don't retroactively re-route** — the user already saw the qualified TY. The qualification record updates, but no redirect happens.

Set on a funnel without a qualification rule? The audience tag is dead config — without a rule, every submit is `qualified=null` and falls through to the "all" TY. Don't set this until the rule exists.

---

## 9. Variant metadata — extras

### Concrete example of the five required fields

For a variant pitching homeowner insurance comparison:

```js
{
  headline: "Cut your homeowner premium 20–40% in under 2 minutes.",
  angle_hypothesis: "Targets the visitor's anxiety about overpaying — frames the existing premium as the active loss, with an embedded savings calculator as the proof point. Bypasses agent friction by promising no calls.",
  value_proposition: "Lower your homeowner premium 20–40% by switching, no agent calls, quote in under 2 minutes.",
  target_audience: "Ontario homeowners 45–65 with existing policies they renewed without shopping.",
  form_factor: "Long-form sales letter with embedded savings calculator + email gate"
}
```

### Bucket fields — still optional, still useful

The four older bucket fields are kept as an additional categorization layer (loose vocabularies, not enforced):

| Field | Vocabulary |
|---|---|
| `headline_type` | `question`, `benefit`, `curiosity`, `urgency`, `social-proof`, `pain-point` |
| `cta_type` | `get-started`, `learn-more`, `get-quote`, `sign-up`, `buy-now`, `book-call`, `download` |
| `angle` | `pain-point`, `aspiration`, `urgency`, `value`, `fomo`, `authority`, `savings` |
| `page_style` | `minimal`, `detailed`, `video`, `testimonial-heavy`, `comparison`, `quiz` |

Use the same vocabulary across a single user's variants — analytics group by exact string match. If you invent a new value, document it back to the user so they can keep it consistent.
