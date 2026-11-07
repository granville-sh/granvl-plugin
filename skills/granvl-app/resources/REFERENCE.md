# Granvl — Reference

Detailed reference for the MCP surface, schema conventions, runtime behavior, and HTML templates. Read [../SKILL.md](../SKILL.md) first for the high-level mental model and decision tree.

---

## Table of contents

1. [MCP tool reference](#mcp-tool-reference)
2. [Schema model](#schema-model)
3. [Page type semantics](#page-type-semantics)
4. [Runtime page-serving behavior](#runtime-page-serving-behavior)
5. [Form submission pipeline](#form-submission-pipeline)
6. [Conversion-tracking matrix](#conversion-tracking-matrix)
7. [Lead qualification](#lead-qualification)
8. [Variant version history](#variant-version-history)
9. [Session journeys + audience cohorts](#session-journeys--audience-cohorts)
10. [Analytics — what's captured](#analytics--whats-captured)
11. [HTML templates](#html-templates)
12. [Form-validation snippets](#form-validation-snippets)
13. [Common pitfalls](#common-pitfalls)
14. [Error catalog](#error-catalog)

---

## MCP tool reference

All tools require Bearer auth via the user's API key. Per-user scoping is enforced server-side — you cannot see or mutate another user's data even if you guess an ID. **Audit-logged**: every successful call writes a row to `AiActivity` (visible to the user in `/dashboard`).

### Funnels

#### `list_funnels` `{ brand_id?, limit?, cursor? }`

Returns the workspace's funnels, most recently updated first, with embedded page + variant counts. **Use first** in any new conversation. Paged: `limit` defaults to 100 (max 500); the response carries `next_cursor` — when it isn't `null`, call again with `cursor: next_cursor` (same `brand_id`) for the rest.

#### `get_funnel` `{ funnel_id }`

Funnel structure: pages, variants, preview tokens, metadata tags. Cheap way to get IDs you need for downstream calls. **Note**: structure only — for stats use `get_funnel_stats`.

#### `get_funnel_summary` `{ funnel_id }`

Slim navigation payload: `{ id, name, status, domain, pages: [{ id, name, slug, type, variantCount }] }`. No brand kit, no legal URLs, no per-variant metadata — much smaller than `get_funnel`, so it's fast and cheap on context (safe to call repeatedly). Use it to orient — "what's in this funnel?", pick a page/variant to work on. When you're actually going to **build or edit** a variant (and need the brand kit, legal URLs, or full variant metadata), call `get_funnel` instead.

#### `create_funnel` `{ name, funnel_type, platform, description? }`

`funnel_type` and `platform` are both REQUIRED (the call rejects without them — ask the user first; see SKILL.md's platform enum + mapping).

- `funnel_type: "standard"` → 2 pages (LANDING + THANK_YOU). Pick when the funnel collects on-site form submissions that land on a thank-you page.
- `funnel_type: "quiz"` → 3 pages (LANDING + QUIZ + THANK_YOU).
- `funnel_type: "click_through"` → 1 page (LANDING only) and `isClickThrough: true` is set on the funnel. Pick this for ANY single-page funnel where the CTA goes off-site (booking link, checkout, app store, external signup). The serve route auto-tags every external `<a>` with `data-pages-convert` so click conversions track without manual wiring. Picking the wrong type means a leftover Thank You page you'd have to delete — when in doubt about a single-page off-site CTA, choose `click_through`.

Pages come back empty (no variants yet) — call `create_variant` next.

#### `update_funnel` `{ funnel_id, name?, platform?, domain_id?, thank_you_view_conversion?, validate_phone_enabled?, validate_email_enabled?, trusted_form_enabled?, goal? }`

Provide `domain_id: null` to disconnect. No `status` arg — `publish_funnel` / `unpublish_funnel` own status. The other args: `thank_you_view_conversion` (count TY-page arrival as a conversion — for third-party iframe-embed forms that redirect to the TY page, see PAGE-BUILDING §2d), `validate_phone_enabled` / `validate_email_enabled` (silent real-number / real-mailbox checks at submit, inline error, no texted code), `trusted_form_enabled` (TrustedForm snippet + `xxTrustedFormCertUrl` field on every lead for TCPA consent proof) — a submit is held up to 2 s for the cert, and each lead row records cert present / missing (Lead capture tab flag + banner), `goal` ∈ `LEAD | SALE | BOOKING | null` (the funnel's outcome goal — drives which KPIs dashboards lead with). Qualification rules go through `set_qualification_rule`, not here; the integration phone format (E.164 / 10-digit / etc.) is set in the dashboard funnel **Integrations** tab, not via MCP.

#### Two-step confirmation (irreversible tools)

Every delete tool plus `publish_funnel`, `unpublish_funnel`, `publish_website` and `unpublish_website` takes an optional `confirmation_token`. The call **without** one changes nothing and returns:

```json
{ "confirmation_required": true, "executed": false, "tool": "delete_funnel",
  "action": "Delete \"Roof Quiz\"", "summary": "Deletes \"Roof Quiz\" with its 2 pages and 3 variants, and takes it offline at https://roof.example.com immediately. …",
  "irreversible": false, "details": { … }, "confirmation_token": "gct1.…", "expires_at": "…", "next_step": "…" }
```

Show `summary` to the user. Only after they explicitly say yes, repeat the call with the **same arguments** plus `confirmation_token` (10 minutes; bound to workspace + tool + arguments). A bad, expired or mismatched token returns a fresh preview with `token_rejected` and changes nothing. `confirm` is deprecated and ignored.

#### `delete_funnel` `{ funnel_id, confirmation_token? }`

Two-step (above). Takes the funnel offline and removes it with its pages and variants. Funnels with meaningful history are archived (analytics kept); the rest go to the deletion bin. The preview's `summary` says which.

#### `publish_funnel` `{ funnel_id, confirmation_token? }`

Two-step: the first call returns the go-live preview (domain, page and variant counts) and a token; publish with the token after the user's yes.

Validates every variant's HTML, auto-fixes mechanical issues (form-action stripping, missing meta tags, etc.), optimizes (Tailwind precompile + image rehost), bakes, and flips the funnel to `ACTIVE`. Returns `{ liveUrl, validation: { autoFixes, warnings }, budgetViolations? }`. **Archived or deleted funnels are refused** (restore first — funnel Settings → Danger zone); the preview call says so instead of minting a token. Each page's split is its **non-archived** variants only: their weights must sum to 100 — an archived variant's leftover weight neither counts nor blocks. If the funnel is archived, deleted or unpublished while the publish runs, it is refused and nothing goes live. `liveUrl` is only returned when the funnel is live after the publish — never relay a URL from anywhere else. Walk warnings via `update_variant` + re-publish. **`budgetViolations[]` is the speed fix-list** — warn-only checks on the baked bytes (HTML ≤150 KB, images ≤300 KB, zero render-blocking externals, inline JS ≤80 KB), each with a ready `fix`; apply them in the same session and re-publish until empty.

#### `unpublish_funnel` `{ funnel_id, confirmation_token? }`

Two-step. The funnel becomes a draft (`status: DRAFT`) — every live page 404s at once. History preserved; `publish_funnel` puts it back live.

#### `create_preview_link` `{ funnel_id }`

Mints (or refreshes) the funnel's **shareable stakeholder preview URL** — one link covering the whole draft funnel (internal nav works, each page shows its highest-weight variant) on the cookieless preview origin: noindex, zero tracking. Valid 7 days; re-calling **keeps the same URL** and resets the window, so already-shared links never break. Use when the user wants a teammate/client to review a draft ("send this to my client", "get sign-off") — do **not** `publish_funnel` just to show someone work-in-progress. Returns `{ url, expiresAt, created }`.

#### `create_test_link` `{ funnel_id }`

**Test-drive the LIVE funnel without delivering leads.** Returns the live page URLs with a signed `?gv_test` token (24h expiry). Visits through those URLs run the whole real flow — forms, validation, qualification, thank-you redirect, tracking — but nothing is delivered to the user's destinations, no ad-platform/pixel fires happen, and every analytics row is tagged as test. Test mode covers the whole visit (survives the TY redirect). SMS verification is skipped in test mode. Requires an active domain (drafts: use `create_preview_link`). Caveat: a test submit can't prove the CRM field mapping — use `send_test_lead` for the one final delivery check.

#### `cleanup_test_data` `{ funnel_id }`

Deletes every test-drive row for the funnel (tagged analytics events, form-submission audit rows, their lead qualifications) and recomputes the affected rollups. **Call this as the last step of every test session** — deletion is what keeps the funnel's stats clean. A retention cron purges test rows older than 24h as a backstop; don't rely on it.

### Pages

#### `list_pages` `{ funnel_id }`

Pages with slugs, types, variant counts. Lighter than `get_funnel` when you only need the page list.

#### `create_page` `{ funnel_id, name, slug, type, qualification_audience? }`

`type` ∈ `LANDING | QUIZ | THANK_YOU | FORM | MAGNET` (MAGNET = post-conversion lead-magnet content — never a funnel step, never a conversion). Slug must be lowercase alphanumeric + hyphens, OR `"/"` to serve at the connected domain root. Unique within the funnel, and — the root `"/"` included — unique across all LIVE funnels on the same domain (see the error catalog). A root already live on the domain is refused at create/rename/attach; archive or unpublish the other funnel first. `qualification_audience` ∈ `qualified | unqualified` — THANK_YOU pages only, at most one TY per audience per funnel (see PAGE-BUILDING §8). You usually don't need this — `create_funnel` bootstraps the standard pages.

#### `update_page` `{ page_id, name?, slug?, type?, qualification_audience? }`

Renames or changes the page type; `qualification_audience` (`qualified | unqualified | null`) retargets a THANK_YOU page's audience routing. Same slug rules as `create_page` (incl. `"/"` for the domain root). **Changing slug breaks any deep links** — confirm with the user if the funnel is published.

#### `delete_page` `{ page_id, confirmation_token? }`

Two-step. Cascades variants + events for that page (archived instead when it has meaningful traffic).

### Variants

#### `get_page_scaffold` `{ page_type }`

`page_type` ∈ `LANDING | QUIZ | THANK_YOU | MAGNET`. Returns the canonical, contract-perfect HTML skeleton for that page type — guaranteed zero audit warnings and zero publish auto-fixes. **Call this before authoring any new variant** and replace its `REPLACE:` markers with real content, keeping the structure (control-field placement, form shape, `data-step` sections, `<main>`) exactly as given.

#### `create_variant` `{ page_id, name, html_content, headline, angle_hypothesis, value_proposition, target_audience, form_factor, weight?, headline_type?, cta_type?, angle?, page_style?, embedded_widget?, embedded_widget_config?, allow_new_fields? }`

The five attribution fields (`headline` verbatim H1, `angle_hypothesis`, `value_proposition`, `target_audience`, `form_factor`) are **required** — the call rejects without them (see SKILL.md "Variant metadata"). Status defaults to `DRAFT`. `weight` defaults to 50; sums across active variants must reach 100. `embedded_widget` ∈ `calendly | cal_com | hubspot_meetings | acuity | savvycal | tidycal | custom | null` — set it whenever the variant embeds a booking widget (with `custom`, also provide `embedded_widget_config: { originPattern, matcherJs }`); see PAGE-BUILDING §2c.

#### `bulk_create_variants` `{ page_id, variants: [{ name, html_content, headline, angle_hypothesis, value_proposition, target_audience, form_factor, weight?, embedded_widget?, ... }] }`

Same shape as `create_variant`, batched — including the five required attribution fields **per item**. 1–10 variants per call. Faster than N round-trips when generating a fresh test.

#### `update_variant` `{ variant_id, name?, html_content?, weight?, headline?, angle_hypothesis?, value_proposition?, target_audience?, form_factor?, headline_type?, cta_type?, angle?, page_style?, embedded_widget?, embedded_widget_config?, change_summary?, acknowledge_stat_pollution?, allow_new_fields? }`

On a funnel whose primary destination is map-driven (LeadProsper, HubSpot, ActiveCampaign, Lead Distro), a write that ADDS a form field the map does not deliver is refused with the unmapped names (existing names are never respelled either). Fix: use the funnel's existing names, or add the mapping first; `allow_new_fields: true` only for a genuinely new question the CRM should not receive yet. `patch_variant_html` takes the same flag.

**When `html_content` differs from the current value**, a new `VariantVersion` row is written automatically with `source: AI_EDITED`. Provide `change_summary` (one-liner like "Tightened headline; swapped CTA color") so the version timeline tells the iteration story, and re-articulate the attribution fields whenever the edit shifts headline / angle / value-prop / form. `acknowledge_stat_pollution: true` is the guardrail escape hatch — only after the USER explicitly consents (see SKILL.md).

#### `get_variant` `{ variant_id }`

Variant fields + preview URL.

#### `get_variant_html` `{ variant_id }`

**The current HTML.** Use this when the user asks for a small change ("change the headline") — read first, edit, then `update_variant`. Saves regenerating the entire page from scratch and preserves iteration provenance.

#### `delete_variant` `{ variant_id, confirmation_token? }`

Two-step.

This archives (soft-deletes): the variant leaves routing but analytics history is preserved. There is no `status` field on `update_variant` — pause with `set_weights` weight=0, archive with `delete_variant`, activate via `publish_funnel`.

#### `set_weights` `{ page_id, weights: [{ variant_id, weight }] }`

Must list every variant on the page. Weights must sum to exactly 100. `weight: 0` keeps the variant in the routing table but stops sending traffic.

#### `duplicate_variant` `{ variant_id, target_page_id?, name?, weight? }`

Copy a variant (yours or a teammate's) to iterate without disturbing the original — defaults to the same page at `weight: 0` (paused). `target_page_id` enables cross-page/cross-funnel copies; the target page type must match the source's (`TYPE_MISMATCH` otherwise). See PAGE-BUILDING §7.

#### `duplicate_funnel` `{ funnel_id, name?, platform? }`

Clone an entire funnel — all pages + variants, and the whole setup: destinations with field maps and fallbacks, declared form fields, qualification rule, phone / state formats, address autocomplete, validation and TrustedForm toggles, cookie banner, stats settings — as a DRAFT copy owned by the caller. Keeps the source's domain reference (rename slugs or archive the source before publishing the copy). `platform` overrides the copy's channel (defaults to the source's). Nothing to rebuild afterwards; change the form only after the copy has landed, keeping every existing field name.

### Variant version history

#### `list_variant_versions` `{ variant_id, include_html?, limit? }`

Every saved version with provenance. Each row carries `source` (AI_GENERATED / AI_EDITED / HUMAN_EDITED / IMPORTED / BACKFILL), `change_summary`, `created_at`. HTML omitted by default — provide `include_html: true` to fetch it (use for diff-style comparisons).

#### `get_variant_html_at_time` `{ variant_id, timestamp }`

Resolve the HTML a visitor saw at a specific timestamp. Walks the `VariantVersion` timeline and returns the latest snapshot with `created_at <= timestamp`, plus the version's provenance. Use for retrospective inspection: "what did a converting visitor on Tuesday actually see?"

#### `get_variant_history` `{ variant_id, period?, granularity? }`

Change-mapped history: a per-bucket conversion-rate series (with Wilson confidence bands) correlated with the variant's edit markers, answering "did conversions move around an edit?". `period` ∈ `7d | 14d | 30d | 90d` (default 30d), `granularity` ∈ `day | week`. **Correlation surface, not causation** — relay the returned `caveats[]` verbatim.

### Domains

#### `list_brands` `{}`

The workspace's brands: `id`, `name`, `isDefault`, `funnelCount`, `domainCount`. Any `brand_id` arg (create_funnel, create_funnel_from_template, list_funnels, list_domains, update_funnel, the copy + strategy tools) accepts the brand's id OR its name (case-insensitive). Omitted = the default brand.

#### `move_domain_to_brand` `{ domain_id, brand_id, move_funnels? }`

Re-home a domain under another brand (`brand_id` = id, name, or `null` for the default). Organizational only: serving, tracking and connected funnels are untouched. `move_funnels: true` also re-homes every funnel served on the domain (returns `movedFunnels`); without it they stay in their current brand. Needs an OWNER or ADMIN role.

#### `move_creatives_to_brand` `{ ids, brand_id }`

Move ad creatives (1–200 ids from `list_ad_creatives`, `upload_ad_creative` or a video run's `creative_id`) to another brand, as the Creative page's Move to brand does (`brand_id` = id or name; the default brand by its id or name too). Returns `moved`, `skipped` (ids not in this workspace) and `brand { id, name, is_default }`. Folders and strategy are per brand, so each creative leaves its old brand's folder (and with it any auto-test bucket that folder feeds) and drops an angle / ICP stamp from the old brand's strategy. File them in the new brand afterwards with `move_to_folder` (`entity: 'creative'`, the same `brand_id`). Ads, campaigns and results that use the creatives are untouched.

#### `list_folders` `{ kind, brand_id? }`

Folders on one dashboard table: `kind` ∈ `funnel` | `strategy` | `copy` | `creative`.

#### `move_to_folder` `{ entity, ids, folder_id? | folder_name? | remove?, brand_id? }`

File rows (`entity` ∈ `funnel` | `product` | `icp` | `angle` | `copy_line` | `creative`) into a folder. `folder_name` reuses a same-named folder on that table or creates it (`created: true`); `ids: []` makes an empty folder; `remove: true` takes rows out. A row lives in at most one folder. Folders are per brand (`brand_id` = id or name; default brand when omitted): lookups, reuse-by-name and creation all stay inside that brand, rows from another brand are skipped (check `moved`), and a funnel that moves brand is taken out of its old folder. Deleting/renaming folders is dashboard-only.

#### `list_domains` `{ brand_id? }`

Account-level domains + which funnels are connected. `brand_id` narrows to one brand's domains.

#### `create_domain` `{ domain }`

Creates the domain in `PENDING`. The user adds DNS records; you call `verify_domain` to advance it. The response carries `ownershipRecord` + `ingressRecord`, and **sometimes a third block, `edgeRecords`** — present when the root domain is registered with another hosting account. Relay every record verbatim, including `edgeRecords`; without that one the SSL certificate is never issued even though the other two checks succeed.

#### `get_domain` `{ domain_id }`

Verification progress. Don't poll faster than once per ~30 seconds. While `sslStatus` is not `ACTIVE`, the response includes `edgeRecords` + `sslPendingReason` when the edge is still waiting on a record — give the user that record. Also returns `tracking` (what's configured per platform) and `custom_scripts` (the three script slots' current contents + who last edited them).

#### `verify_domain` `{ domain_id }`

Runs our checks (TXT-ownership at `_granville-verify.<domain>` AND routing CNAME/A) and then asks the edge whether it has accepted the domain. Returns `{ verified, status, message }` plus DNS instructions when checks fail. If our checks succeed but the edge still needs its own record, `verified` is `false` and `extraRecords` holds the exact record to add — relay it verbatim and call again after it resolves. Safe to call repeatedly while waiting for propagation.

#### `get_domain_dns_records` `{ domain_id }`

Returns the exact records to publish (TXT ownership + CNAME/A routing). Pair with `verify_domain` after the user has set them.

#### `update_domain_tracking` `{ domain_id, meta_pixel_id?, ga4_measurement_id?, google_ads_conversion_id?, google_ads_conversion_label?, google_tag_id?, google_ads_tracking_mode?, attribution_consent_mode?, trusted_form_default?, tiktok_pixel_id?, google_tag_manager_id?, microsoft_ads_uet_tag_id?, sms_sender_name? }`

`trusted_form_default: true` turns TrustedForm on for EVERY funnel served on the domain (effective = the funnel's `trusted_form_enabled` OR this); use it on lead-selling / TCPA-sensitive domains so no page ships without a cert URL. Read it back with `get_domain → trusted_form_default`. Changing it re-bakes the domain's funnels.

Per-domain ad-platform tracking IDs. Server-side (CAPI / Events API) AND client-side (pixel) are configured together. Provide `null` to clear any field. **Secrets are dashboard-only:** the Meta CAPI access token, GA4 API secret and TikTok Events API token are entered by the user in granvl → Settings → Tracking; the tool rejects them as arguments, and its `configured` summary reports whether each is set.

`google_ads_tracking_mode`: `ga4_import` (GA4 server event imported into Ads) · `gtag_legacy` (granvl fires the AW- conversion tag from the page) · `gtm` (the user's own Tag Manager container fires Google Ads — set `google_tag_manager_id`; granvl loads the container and pushes a `pages_conversion` dataLayer event with `transaction_id`, `value`, `currency` and consent-gated pre-hashed `user_data`, and does NOT load or fire the AW- tag itself). In `gtm` mode the user must build, in GTM: a **Google tag** for their AW- id (Initialization – All Pages, with "Allow user-provided data capabilities" on), a Google Ads Conversion Tracking tag on a Custom Event trigger `pages_conversion` (Value → `value`, Currency → `currency`, Transaction ID → `transaction_id`, and a User-Provided Data variable of type Code returning the `user_data` object, whose keys are already in Google's `sha256_*` format), plus a Conversion Linker on All Pages; and in Google Ads set Enhanced conversions' method to "Google Tag Manager". Leads a funnel withholds from ad platforms arrive as `pages_conversion_unqualified`. Never switch a domain to `gtm` until the user confirms the container's Ads tag is published — otherwise Google Ads conversions stop entirely. `google_tag_id` (GT-) is only needed when the GA4 measurement ID isn't standalone-loadable; `google_ads_tracking_mode` ∈ `ga4_import` (recommended, default behavior) `| gtag_legacy`. `microsoft_ads_uet_tag_id` is a single credential — it drives both the client-side UET pixel and the server-side fire (no separate token). `sms_sender_name` is the brand in SMS verification texts ("Your {name} verification code is: 123456") — letters/numbers/spaces, ≤30 chars, nothing bank/gov/urgent-sounding; `null` returns to the default derived from the hostname (`get_domain` → `sms_sender_name.effective`).

#### `update_domain_scripts` `{ domain_id, head?, body_start?, body_end?, upsert_block? }`

The domain's **custom scripts** — the same three slots as Domain settings → Scripts: `head` (before `</head>`), `body_start` (after `<body>`), `body_end` (before `</body>`). For pixels, chat widgets, consent tools or analytics granvl doesn't support natively (Meta / GA4 / Google Ads / TikTok / Microsoft / GTM belong in `update_domain_tracking`). Injected **verbatim, unsanitized**, into every page on the domain — paste exactly what the vendor gives, `<script>` tags included, and only from sources the user trusts. A slot value replaces the whole slot; `null` clears it; omit slots you aren't touching. Prefer `upsert_block { slot, marker, content }` to add or update one vendor's snippet without disturbing what else is in the slot (`content: null` removes it). Read the current contents first via `get_domain` → `custom_scripts`. `consent_gated { head?, body_start?, body_end? }` makes a slot wait for the visitor's consent (granvl's cookie banner, or the customer's own consent tool calling `window.__gvSetConsent('granted')`) — use it for identity-resolution / retargeting scripts on domains that show a consent banner; without a banner in standard mode consent is granted on arrival, so the slot simply runs. 32 KB per slot; every funnel on the domain rebakes. Owners/admins only.

#### `get_brand_kit` `{ domain_id }`

Read the domain's brand kit (colors, fonts, radius, logo, voice, tagline, `brandMode`) as reference data — bake the values into HTML; nothing is injected at serve time. Returns null when unconfigured. Full shape + usage in PAGE-BUILDING §3b.

#### `update_brand_kit` `{ domain_id, tokens?, name?, logo_url?, voice?, tagline?, brand_mode? }`

Write the brand kit — include only the fields you're changing (`tokens` = `{ colors, fonts, radius }`; upload the logo via `upload_image` first). `brand_mode: true` hard-locks brand styling; only toggle on explicit user request.

#### `test_tracking_pixel` `{ domain_id }`

Fires a synthetic CONVERSION through Meta CAPI / GA4 / TikTok Events API. Returns per-platform success/failure. Validates credentials before relying on real conversions.

### Template library

#### `list_templates` `{ category? }`

granvl-authored, conversion-tested funnel starting points. **Check this before building a funnel from scratch** — instantiating a template is faster and inherits structures that already convert. Returns `{ slug, name, description, category, pageCount, variantCount, previewUrl }` per template.

#### `get_template` `{ slug }`

One template's structure: pages, page types, per-variant metadata (headline/angle/style). No raw HTML — instantiate first, then `get_variant_html` on the copy.

#### `get_template_html` `{ slug, page_slug?, variant_code? }`

One template variant's raw HTML from the blueprint (heavy response; one variant per call; defaults to the first page's first variant). Use it to study or adapt template code without instantiating. If you're building from the template anyway, prefer `create_funnel_from_template` + `get_variant_html` on the copy.

#### `create_funnel_from_template` `{ template_slug, name? }`

Clones the template into the workspace as an unpublished funnel (quota-checked). Then: adapt every variant's copy/images to the user's business + brand kit (`get_brand_kit` → `update_variant`), wire lead delivery (template forms point at the built-in fallback until configured), connect a domain, `publish_funnel`.

### Assets

#### `upload_lead_magnet` `{ source_url? | html? | data?, domain?, funnel_id?, filename?, name?, slug? }`

Add a **PDF or HTML** lead magnet to the workspace's Lead magnets library (the same one as the dashboard's Resources → Lead magnets page). granvl hosts it on a workspace domain at the path `/{slug}` (also `/d/{slug}`), ungated, and counts each time it is served. Provide the file exactly one way: `source_url` (a public URL the granvl server retrieves, max 20 MB), `html` (the full HTML document as a string — for an HTML ebook on disk or one you just wrote), or `data` (base64 PDF/HTML bytes, max 4 MB). Domain: `domain` (hostname or id), or `funnel_id` to use that funnel's domain; a one-domain workspace needs neither. Returns `url` + `type` (`pdf`/`html`). The slug must not collide with a funnel page slug on that domain.

#### `list_lead_magnets` `{ domain?, funnel_id? }`

Every hosted magnet in the workspace library — id, name, slug, `type`, `domain`, full `url`, size, download count. Filter by `domain` or `funnel_id` (that funnel's domain; also returns any legacy per-funnel `/d/{slug}` PDFs under `funnel_downloads`). Check here before uploading a duplicate; link an existing `url` from the thank-you page.

#### `delete_lead_magnet` `{ magnet_id }`

Removes a library magnet; its link 404s immediately. Update thank-you pages that reference it.

#### `start_image_upload` `{ filename, size_bytes }` → `finish_image_upload` `{ storage_key }`

Two-step direct upload for LOCAL image files: `start_image_upload` returns a single-use signed `upload_url` (PUT the raw bytes; up to 25 MB, nothing rides your context window), then `finish_image_upload` runs the same pipeline as `upload_image` (WebP re-encode, EXIF strip, dedup) and returns the permanent CDN URL. For images already on the web, use `upload_image` with `source_url` instead.

### Workspace members

#### `list_workspaces` `{}`

Every workspace the signed-in user belongs to (`id`, `name`, `slug`, `role`) plus `activeWorkspaceId`. Read-only. With none: `{ activeWorkspaceId: null, workspaces: [], next }` — `next` points at `create_workspace`.

#### `create_workspace` `{ name, business_type?, website_url?, allow_additional? }`

Onboarding from the agent: creates a workspace owned by the signed-in user — the dashboard's own transaction (OWNER seat, default brand, first-workspace credits) — and makes it the **active workspace for this connection**, so the next call is scoped to it. Call it when a tool answers `No workspace yet. Call create_workspace …` (that exact text is the error every workspace-scoped tool returns while the connection has none).

- `name` — 2–60 characters, usually the business or brand name.
- `business_type` — `agency` | `business` | `solo`, optional; recorded for the account, not stored in granvl.md.
- `website_url` — optional (`acme.com` or a full URL); normalized and echoed back for the intake. **No brand kit is extracted** from it.
- `allow_additional` — default `false`: if the connection already has a workspace it is returned (`created: false`) and nothing is created or counted. `true` creates another (an agency's next client) and switches to it.

Returns `{ workspace_id, name, created, active: true, website_url?, next }`; `next` says what to do: the intake → `update_workspace_context`, then the first page (SKILL.md "Brand-new workspace"). Refused on API-key connections (a key is bound to one workspace) and for accounts pending approval. At most 5 new workspaces per user per day, shared with the dashboard.

#### `switch_workspace` `{ workspace }`

Make another workspace active for this connection — `workspace` is the id or exact name (case-insensitive) from `list_workspaces`. Membership is verified; the switch takes effect on the **next** call and moves the user's dashboard too, so say which workspace you switched to. Refused on API-key connections (a key is bound to one workspace). Agency pattern: `list_workspaces` → `switch_workspace` → work → switch back when the user asks about another client.

#### `list_team_members` `{}`

Members with role (OWNER / ADMIN / MEMBER), join date, `isYou`, plus pending invitations. **MEMBER** builds, publishes and wires destinations / SMS verification; **ADMIN** adds credentials, domains, API keys, billing, invitations and member roles; **OWNER** is ADMIN plus ownership.

#### `set_team_member_role` `{ membership_id, role }`

OWNER/ADMIN only. Sets ADMIN or MEMBER; the owner's role and your own can't be changed. Confirm with the user before promoting to ADMIN.

### Form integrations

#### `get_form_destinations` `{ funnel_id }`

**Call BEFORE generating any variant with a form** — to learn which fields the destination expects (`fieldShape`, LeadProsper field map), NOT to hardcode wiring. Returns `{ delivery, destinations: [...], domainDestinations: [...], formFields, guidance }`. **`delivery` is where the leads actually go** — read it, not the arrays: `delivery.source` is `funnel` (its own enabled destinations), `domain` (it has none of its own and **inherits the domain's set** — it IS delivered; don't add one), `fallback` (click-through / sale funnel — no destination needed) or `none` (leads reach nobody — warn the user; this includes a funnel whose own destinations are **all disabled**, because a funnel's own set overrides the domain's even when it is all off). `delivery.destinations[]` is the effective list in order (each tagged `level: funnel | domain`), `delivery.summary` says it in one sentence, `delivery.awaitingSetup` counts pasted destinations still missing a value. `destinations[]` is the funnel's **own** rows only; `domainDestinations[]` the domain's. Whatever they contain, **author a bare `<form>`** (no `action`/`method`/vendor hidden fields): granvl wires `delivery.destinations[0]`'s adapter, mirrors submissions to every other destination browser-side, and injects credentials at serve time. Hardcoded actions are stripped at publish (`form_action_stripped`); the live DOM may show `action="/api/form-submit"` while deliveries still reach every vendor — verify with `send_test_lead`, not the DOM.

#### `set_form_destination` `{ funnel_id, input, replace_all? }`

Paste a vendor URL or embed; the extractor parses + saves. **Non-destructive:** updates the funnel's existing destination of the SAME provider in place, or adds a new one alongside the rest (the funnel fans out to all of them) — destinations of other providers are never touched unless you provide `replace_all: true` (call `get_form_destinations` first and confirm with the user before removing anything you didn't add). Provide empty string to disconnect all of the funnel's own destinations (it then inherits its domain's set, if any — the result's `delivery` says which). **Shadowing:** on a funnel whose `delivery.source` is `domain`, the first destination you save gives it its own set, which **replaces the domain's whole fan-out for this funnel** — only do it when the user wants a funnel-specific override. The result names what it shadowed (`shadowedDomainDestinations`, plus a NOTE in `message`); tell the user. `set_leadprosper_destination` / `set_leaddistro_destination` behave the same way. **Klaviyo** (newsletter / waitlist sign-ups on ecommerce pages): paste the public API key (site id / `company_id`) and the list id, e.g. `company_id=AbC123 list_id=XyZ789` — the page subscribes the profile browser → Klaviyo (client subscriptions API, 202 = delivered); only `email` (plus `first_name` / `last_name` / `phone`) is mapped onto the profile, every other input lands as a profile property. **Lead Distro:** paste the Inbound API Specs curl sample (or the spec URL plus the `x-api-key`); missing pieces come back as `meta.requiresSetup` + `meta.missing[]`; for a field map or test leads use `set_leaddistro_destination`. **LeadProsper:** paste the "Get API Specs" curl/JSON sample (carries `lp_campaign_id` + `lp_supplier_id` + `lp_key`); if only the key parses, the response returns `meta.requiresSetup: true` + `meta.missing[]` and asks for the full sample. LeadProsper field names are case-sensitive and `FirstName` + `LastName` are required. A pasted LeadProsper destination has no field map (inputs post under their own names) — for a real map use `set_leadprosper_destination` below.

#### `list_leadprosper_campaigns` `{ campaign_id? }`

The LeadProsper campaigns the workspace's dev API key can see (Settings → Integrations → LeadProsper; `notConnected: true` when missing). Without `campaign_id`: id, name, suppliers (id + nickname, `hasPostingKey`), required fields. With `campaign_id`: the full field list with `required` flags. The posting key never leaves the server.

#### `set_leadprosper_destination` `{ funnel_id, campaign_id, supplier_id, field_mappings, destination_id? }`

Full LeadProsper control — the dashboard mapper over MCP. `field_mappings` is the complete map: `[{ lp_field, form_field }]` where `lp_field` is the campaign's exact, case-sensitive field name and `form_field` is a form input name from `get_form_destinations.formFields`, or `static:<value>` for a constant (e.g. `TargetingSource → static:Meta`), or `name:first` / `name:last` to split a single name input. **Idempotent:** updates the funnel's existing LeadProsper destination in place (or `destination_id`), else adds one alongside the others. Mappings to fields the campaign lacks are dropped and returned in `droppedMappings`; required campaign fields you left out come back in `unmappedRequired` — LeadProsper rejects leads until they are mapped, so fix the map before you finish. `FirstName` + `LastName` are always required and must be separate.

#### `set_leaddistro_destination` `{ funnel_id, campaign_id, supplier_id, api_key, test_lead?, field_mappings?, destination_id? }`

Lead Distro AI (leaddistro.ai) — the three values come from the source's **Inbound API Specs** page (`flo_campaign_id`, `flo_supplier_id`, the `x-api-key`). `field_mappings` is optional: `[{ ld_field, form_field, fallback_form_field? }]` with snake_case Lead Distro names (`first_name`, `last_name`, `phone`, `email`, `state`, `zip_code`, custom fields) and `static:<value>` for constants; omit it to pass every input through under its own name. `test_lead: true` delivers test leads (no billing / routing) while you verify — save again with it off before launch. Required fields you left unmapped come back in `unmappedRequired`. **Idempotent:** updates the funnel's existing Lead Distro destination (or `destination_id`), else adds one. The page posts straight to Lead Distro with the key as the `x-api-key` header (their CORS policy allows it); the verdict (ACCEPTED / UNMATCHED / DUPLICATE) is readable and recorded.

#### `update_form_destination` `{ funnel_id, destination_id, enabled?, label?, sort_order?, hidden_fields?, field_map? }`

`field_map` (ActiveCampaign destinations only) replaces the field mapping — `{ "<form input name>": "<AC field name>" }`; AC's field names + `required` flags are in `get_form_destinations` → `meta.acFields`, the current map in `meta.fieldMap`. Copy a mapping between funnels by reusing the source's `meta.fieldMap` unchanged. The response warns when a required AC field is left unmapped. `{}` clears the map.

Edit a saved destination without re-pasting: `enabled: false` pauses delivery but keeps the config (prefer this over deleting); `label` renames it; `sort_order: 0` makes it the primary (the adapter that owns the submit — others are mirrored browser-side), the rest re-sequence; `hidden_fields` replaces the injected hidden inputs (`{ name, value }` static, `{ name, source: 'cookie', cookie_name }`, `{ name, source: 'page', page_property }`). Only the fields you include change.

#### `delete_form_destination` `{ funnel_id, destination_id, confirmation_token? }`

Two-step. Remove one destination by id; the others stay. If none remain, the funnel inherits its domain's destinations when the domain has any; otherwise forms fall back to the built-in handler and leads are **not delivered anywhere** — the result's `delivery.summary` says which; warn the user when it is nowhere. `update_form_destination` results carry the same `delivery` (disabling the last enabled one sends the funnel nowhere — it does not fall back to the domain's set).

#### `send_test_lead` `{ funnel_id, webhook_url? }`

Fire a synthetic lead (obviously fake values, zero-PII) at the funnel's saved GoHighLevel / Webhook / Zapier destination — the one delivery check a test-drive submit can't do, and what un-sticks GHL's "waiting for a sample request" field mapper. Provide `webhook_url` to test a URL before saving it. Relay the returned field list.

#### `set_sms_verification` `{ funnel_id, enabled }`

Toggle SMS phone verification (texted 6-digit code gates every form submit — filters bots/burners on high-CPL paid traffic). Each verification uses one SMS credit from the team's balance (Billing page); fails OPEN at 0 credits. Surface the returned credit balance when low. Skipped in test mode.

#### `set_funnel_form_fields` `{ funnel_id, fields: [{ name, type, label?, options? }] }`

Declare the typed form-field schema for the funnel (funnel-level — variants share it). Powers the qualification rule UI's dropdown pickers. Call it whenever you build or change a form; each call replaces the full set (empty array clears). `type` ∈ `text | number | email | select | checkbox | radio`; `options` required for select/radio/checkbox.

### Stats

> **Date windows (all stats tools).** Provide `range` (`24h | 7d | 30d | 90d`, default `7d`) for a quick window, **or** an exact span with ISO-8601 `start` / `end` (e.g. `start: "2026-06-01T00:00:00Z"`). When `start`/`end` are present they override `range`; `end` defaults to now. Use this for "since I pushed that edit at 2pm" or a specific date range. Responses carry `windowStartIso` / `windowEndIso`.

#### `get_funnel_stats` `{ funnel_id, range?, start?, end? }`

Visitors, views, conversions, click-throughs, bounces, plus per-variant breakdown over the window. Each variant row has `primaryMetric` (`conversions` | `clickThrus`) — use that to know which number is the optimization target. Sorted by primary metric desc (winner first). **This is the tool for "is this working?"** — `get_funnel` is structure-only.

#### `get_variant_stats` `{ variant_id, range?, start?, end? }`

Single variant's metrics + funnel totals for context.

#### `get_funnel_timeseries` `{ funnel_id, granularity?, range?, start?, end? }`

Trend line — `points[]` of `{ bucket, visitors, conversions, clickThrus, qualifiedConversions, convRatePct }` per **PST calendar day** (`granularity: 'day'`, default) or **ISO week** (`'week'`, Monday-start). Zero-filled across the window, so a no-traffic day is an explicit `0` (use it to spot _when_ traffic dropped). Same counting rules as `get_funnel_stats`, so the series reconciles with the totals. Capped at 400 points (most-recent kept). This is the tool for "plot my conversion rate over 30 days" / "did traffic drop, and when?".

#### `get_workspace_stats` `{ group_by?, range?, start?, end? }`

Portfolio rollup across **all** funnels in the workspace. `group_by: 'funnel'` (default) → one row per funnel; `'platform'` → aggregate by `Funnel.platform` (`GOOGLE_SEARCH`, `META`, … ; `UNSET` for untagged). Each group: `{ key, label, funnelCount, visitors, conversions, clickThrus, qualifiedConversions, convRatePct, qualifiedConvRatePct }`, plus workspace `totals` — `funnelsWithTraffic` (funnels with a visitor in the window; `funnels` is the same number, kept for compatibility) and `funnelsTotal` (every live funnel, traffic or not; this is the count `list_brands` reports). Same counting rules as `get_funnel_stats` (groups reconcile with each funnel's own stats). Top 100 groups. This is the tool for "which funnel converts best?" / "Meta vs Google across everything".

#### `get_analytics_events` `{ funnel_id?, variant_id?, type?, utm_source?, device?, range?, start?, end?, limit? }`

**Forensics / debugging** — individual raw events, newest first. Curated **zero-PII** projection per event: opaque session/visitor IDs, device/browser/OS, coarse geo (country+region), full UTM + click attribution, referer, scroll depth, time on page, conversion type/value/action/quality, and our structured `metadata` — **never** form field values. Filter by `type` (`VIEW | CONVERSION | CLICK_THROUGH | BOUNCE | CUSTOM | FORM_SUBMIT | STEP_VIEW | STEP_COMPLETE`), `utm_source`, `device`, and a window. `limit` default 50, max 500 (`truncated` flag). For _analysis_ prefer the aggregating tools above — reach here to inspect "why didn't this session convert?".

#### `get_funnel_analysis` `{ funnel_id }`

**Read the latest SAVED analysis** written by Granvl's daily run — a stored row, no model call. Returns `{ cause: 'page' | 'traffic' | 'mixed' | 'insufficient_data', headlineFinding, recommendations[] (each tagged `target: 'page' | 'traffic'`), confidence, caveats[], generatedAt }`. Returns `hasAnalysis: false` if the daily run hasn't produced one yet. There is deliberately **no on-demand analysis tool**: you are the model — for a fresh read, reason over `get_funnel_stats` / `get_segmented_stats` / `get_step_funnel` yourself. Granvl never spends its hosted-model budget on the agent's behalf.

#### `record_ad_entities` `{ entities[], source?, note? }`

**Write the user's ad-account state into Granvl** — campaigns/adsets/ads from data read out of the user's own ad account. The stored copy is what spend and tracking reports read from; sync daily. Idempotent batch upsert (max 200/call). **Always include `destination_url` (the ad's final URL) and `configured_utms` (the raw url_tags string) when the source exposes them** — they power Tracking Health (dead-page + broken-UTM detection) and the spend→page join fallback. History is captured server-side: any change to status/URL/UTMs/names is auto-ledgered, and URL/UTM changes roll a validity period so spend joins to what the ad pointed at _on that date_. **When YOU just changed something on the ad platform (paused an adset, edited a URL), report it here with `source: 'agent'` + a short reason in `note`** ("paused — CPQL $84 over 7 days") — that provenance feeds change-mapped analytics.

#### `record_ad_spend` `{ rows[] }`

**Write daily spend facts** — one row per (platform, account, campaign[, adset][, ad], `date` YYYY-MM-DD), prefer ad/adset granularity. Idempotent: re-syncing a date range OVERWRITES, never double-counts — **always re-pull the last 3–7 days** to capture platform restatements. `platform_conversions` is optional and reconciliation-display only (never blended into Granvl's conversion math). Max 500 rows/call; batch longer ranges.

#### `get_ad_entities` `{ platform?, level?, campaign_id?, status? }`

Read the synced ad-account state — Granvl's **persistent memory** of the user's campaigns/adsets/ads (status, destination URLs, configured UTMs, `lastSyncedAt`). **Read from here** when you just need to know what exists. If `lastSyncedAt` is old, offer to run the sync recipe.

It is synced twice a day, so an ad set built minutes ago (or an ad still `IN_PROCESS` / `PENDING_REVIEW` at Meta) is not here yet — read a just-built ad set **live** with `verify_meta_build { adset_id }` (see [META-ADS.md](./META-ADS.md)).

#### `get_tracking_health` `{}`

Per-ad audit verdicts: `dead_destination` (points at a 404 or archived/unpublished Granvl page — **paying for clicks to a dead page**, fix first) · `missing_utms` · `nonconforming_utms` (missing utm_source/utm_campaign) · `missing_ad_id` (campaign-joinable but no `utm_ad_id` — can't attribute to a specific ad/lander variant; fix via the copy-URL template) · `no_destination` · `healthy`. Destination state is re-checked **fresh at read time** (a page archived after the sync is caught). Each entry carries `issues[]` + a `fix` instruction — act on it via the user's ad MCP and record what you changed with `record_ad_entities source='agent'`. Run after every sync; surface non-healthy counts.

#### `get_spend_summary` `{ window_days?, mode? }`

Spend joined to first-party outcomes per campaign + adset (7/30d): spend/impressions/clicks + visitors/conversions/**qualified** + **CPL and CPQL** (cost per qualified lead — the number ad platforms can't give), plus **`revenue` and `roas`** per row and in totals for ecomm funnels (revenue credited as joined views × the lander variant's rollup revenue-per-visitor — off-platform Shopify orders count without over-crediting organic; `roas` null when no spend). `platform_conversions` is reconciliation-only. `joined=false` rows = broken/missing UTMs → `get_tracking_health`. **`mode='recognized'`** ALSO recovers UTM-stripped clicks (iOS/privacy strips `utm_*` off many clicks) by matching the ad's synced destination URL to the granvl page they hit — **deterministic** (we host the page), time-correct, finest unique grain (ad→campaign). Adds `recoveredVisitors`/`recoveredConversions` per row + a `recovery` summary (`strippedShare` = % of attributed visitors that arrived UTM-less). Default `mode='tracked'` (strict). **Always relay freshness** (`lastSyncedAt`/`staleHours`) — if stale >36h, say so and offer a re-sync before quoting numbers.

#### `get_ad_to_lander_performance` `{ window_days?, ad_id?, account_id?, platform?, mode?, rank_by? }`

`rank_by` ∈ `cvr` (default, Wilson lower bound) | `rpv` | `roas` — orders the returned cells by the goal metric (use `rpv`/`roas` for SALE funnels); the confidence-gated winner stays Wilson-CVR regardless.
**THE ad↔lander analysis.** For each ad, the lander **variants** its traffic hit, ranked by conversion rate with a confidence-gated winner. Attribution is **session-resolved** (the ad = the landing click's `utm_ad_id`; a conversion anywhere later in that session counts), so multi-step funnels join correctly. `byAd[]` → `variants[]` (visitors/conversions/qualified/cvr + 95% Wilson band `cvrLow`/`cvrHigh`, allocated CPL), `winnerVariantId` (null until one variant's interval clears the runner-up's — **never crowned on noise**), `verdict`, `projectedExtraLeads` (routing losers→winner at flat spend). `byVariant[]` is the flip (per lander variant, which ads feed it best). Provide `ad_id` to focus one ad — the same ad held constant is a clean experiment, so CVR deltas across variants are attributable to the lander. Needs live ad URLs carrying `utm_ad_id` (`get_tracking_health` flags ads missing it) + synced spend; `hasData=false` otherwise. Relay `lastSyncedAt`.

#### `compare_ad_sets` `{ adset_a, adset_b, window_days?, account_id?, platform?, mode? }`

**AI head-to-head of two ad sets.** Resolves each by adset **id or name** (case-insensitive; unique substring ok) from synced spend joined to first-party outcomes (7/30d), derives each side's metrics (spend, impressions, link clicks, conversions + **CPM, link-CTR, CVR, cost-per-conversion**), then a senior-media-buyer model picks the winner and explains **why** — naming the exact layer (CPM / link-CTR / CVR) that drives the gap, grounded in general Meta diagnostic best-practices (not pooled customer data). Efficiency (CVR + cost-per-conversion) beats raw volume. Returns `a` + `b` (the metrics judged, so you can show the numbers), `comparison` `{ winner: 'a'|'b'|'tie', headline, reasons[], recommendation }`, plus `currency` + `lastSyncedAt`. Both must resolve to **different** ad sets in the window — an ambiguous name throws with the candidate list (provide the adset id). `hasData=false` until spend is synced. Read-only: deterministic metrics + one LLM verdict.

#### `get_ad_health` `{ grain?, window_days?, account_id?, platform?, mode? }`

**Health score (0–100) per ad set / ad / campaign**, benchmarked against the **account's own siblings** (self-benchmark — never Meta's industry benchmark, never pooled across customers). Scores the cost chain — cost-per-conversion, CVR, link-CTR, CPM — as within-account percentiles (1 = your best), blends to a composite, then penalizes a **fatiguing** creative (CPM rising while link-CTR falls, from its own daily trend). `entities[]` is sorted **worst-first** so problems surface: each has `score`, `band` (`healthy`|`ok`|`needs_attention`|`insufficient_data`), `confidence`, a plain-English `headline`, `factors[]` (which layer helped/hurt), `fatigued`, `platform`/`accountId`. Thin entities are scored only on the layers they have volume for (weights renormalize) and flagged low-confidence, not punished. Also returns `counts` per band + freshness. `grain` default `adset`. `hasData=false` until spend is synced.

#### `get_ad_breakdowns` `{ account_id, breakdown_set, since, until, campaign_id?, metric?, limit?, platform? }`

**"What's working" by audience segment** — synced Meta breakdown performance (`breakdown_set`: `AGE_GENDER` | `PLACEMENT` | `REGION` | `DEVICE`) for an account over `since..until` (YYYY-MM-DD), aggregated per segment with spend/impressions/clicks + derived **CTR / CPC / CPM / CPA**. Provide `metric` to rank winners best-first (lowest CPC/CPM/CPA, highest CTR/spend/etc.); `limit` caps the count. Aggregates across campaigns unless `campaign_id` is set. Free read off the rollup. `hasData=false` until the **server-side Meta breakdown sync** (daily cron) has populated it. `reach` is an upper bound (not additive across segments).

#### `get_creative_performance` `{ window_days? }`

**Per-creative performance** — for each bucket creative granvl has run as an ad: aggregated spend / impressions / link CTR / CPC, and (where the ad's landing traffic is attributable) conversions / CPL / revenue / ROAS, summed across every ad + campaign that used it. The "which creative actually works" read — use it to recommend promoting winners and retiring the expensive ones. Ranked by spend; creatives never run as ads come back as `unusedAssetIds`. `window_days` default 30.

#### `upload_ad_creative` `{ name, source_url? | data?, mime?, angle_id?, icp_id?, testing_flow_id? }`

**Upload an ad creative into the workspace's creative bucket** — the library campaigns attach from (either order: upload first, or create the campaign then attach). Distinct from `upload_image` (page assets, re-encoded): creatives are stored **as-is** (ad platforms want original bytes). Exactly one of `source_url` (public http(s) URL, fetched server-side — images **and video up to 100 MB**, the best path for a video you have a URL for) or `data` (base64 for a local file, **≤3 MB** — images in practice). Files **>100 MB (up to 250 MB video) go through the Creatives tab on the Ads page** — tell the user that when a file is too big. Content-hash deduped (identical re-upload returns the existing creative, zero quota). Bytes count against the shared workspace storage quota; the response includes usage.

#### `start_creative_upload` `{ filename, bytes, sha256, mime }` → `finish_creative_upload` `{ storage_key, filename, sha256, mime, … }`

Direct upload for LOCAL creative files — the path for any video on disk and for images over 3 MB. Caps match the dashboard: **images 30 MB, video 250 MB**. Compute `sha256` with `shasum -a 256 <file>` (a hash already in the bucket returns the existing creative, no upload). PUT the raw bytes to `upload_url` with `Content-Type: <mime>` exactly as given in `next_step`, then call `finish_creative_upload` with the `storage_key`. Every upload is sniffed: a file whose bytes are not the declared image/video type is deleted and the call errors — fix the file or the mime, don't retry blindly. `finish` takes the same optional persona stamp / `testing_flow_id` as `upload_ad_creative`.

#### `list_ad_creatives` `{}`

**List the workspace's creative bucket** (uploaded images/videos, newest first) + shared storage usage vs quota. Check what exists before asking the user to upload; use it to pick creatives when building campaigns.

#### `delete_ad_creative` `{ creative_id }`

**Delete one creative from the bucket and free its storage** — e.g. when uploads fail on the storage quota. Two-step confirm like every delete; the reply carries `bytes_freed` and the updated `storage` usage vs quota. **Refused while the creative is in use** — an ad built from it (or the Meta ad it mirrors), a campaign it is attached to, or a saved campaign draft that lists it — with a message naming what holds it: relay that to the user, don't work around it. Its public file URL stops serving once deleted.

### Shopify store (read [SHOPIFY.md](./SHOPIFY.md) first)

#### `get_store_summary` `{ days?, store_id? }`

Daily store numbers for the window and the previous period: revenue (order total − tax, refunds applied), orders, AOV, ad spend (all synced platforms), MER, new-customer orders / share / nCAC, COGS, shipping, payment fees, contribution margin, attributed revenue + coverage, a daily series and a channel split, plus `health` (last webhook / sync, snippet coverage). `days` ∈ 7 | 30 | 90 (default 30). `store_id` only when the workspace has several stores.

#### `get_store_attribution` `{ level?, model?, days?, store_id? }`

Orders / revenue / new-customer orders / spend / contribution per `level` ∈ `channel` (default) | `campaign` | `adset` | `ad` | `page`, under `model` ∈ `lastNonDirect` (default) | `first` | `last`. Spend is joined by the ad ids granvl's URL template carries, falling back to campaign name; `joined: false` rows have no matching spend — report them as unknown, never invent a ROAS. Includes an `unattributed` bucket and `totalOrders` so rows reconcile to the summary.

#### `get_store_products` `{ days?, store_id? }`

Per-product units, orders, revenue, new-customer orders, unit cost and gross margin over the window, with `productUrl` + `imageUrl`. Sorted by revenue.

#### `list_store_products` `{ query?, store_id? }`

The synced catalog (incl. products with no sales): id, title, handle, variants (price / sku / unit cost), `productUrl`, `imageUrl`. The source for Shop-now links on pre-sell pages — use `productUrl` as a PLAIN link; the tracking script appends the ad context + gv_cid at click time.

#### `set_store_costs` `{ store_id?, payment_fee_pct?, payment_fee_fixed?, shipping_cost_per_order?, fallback_cogs_pct? }`

Cost inputs behind contribution margin (defaults 2.9% + $0.30, shipping = what was charged, fallback COGS 0%). Unit costs come from Shopify's Cost per item via the product sync.

#### `get_store_summary` also returns `experiments: { running, concludedLast30d }`

### Storefront A/B tests (read [SHOPIFY.md](./SHOPIFY.md) §5 first)

granvl never writes to the store or the theme; the merchant's Shopify MCP makes theme changes. Writes need EDIT_CONTENT (a CLIENT seat is refused). Every id is workspace-bound: an experiment or store from another workspace is "not found".

#### `create_store_experiment` `{ shop_domain?, store_id?, name, hypothesis?, kind, targeting, variants, allocation? }`

Saves a **DRAFT** (nothing live). `kind`: `content` | `template`. `targeting`: `{ type: 'product'|'collection'|'page', handles? }` (no handles = all), `{ type: 'index' }`, or `{ type: 'path', patterns: ['/blogs/news/*'] }` (content only; never cart / checkout / account / policies / apps). `variants`: control first (`config: {}`), up to 4 in all, integer `weight`s summing to 100; keys are assigned A, B, C, D. Content `config: { ops: [...] }` (max 40; `text {sel,value}`, `attr {sel,name,value}` with name ∈ href / src / srcset / alt / title / class / aria-label, `image {sel,src,srcset?,alt?}`, `show {sel}`, `hide {sel}`, `html {sel,value}` (data-gv-slot targets only), `redirect {to}` (alone, same-store path)). Template `config: { suffix: 'gv-b' }` (`^gv-[a-z0-9-]{1,20}$`, distinct). `allocation` 1–100 (default 100). Returns `{ experiment, snippet_status: { installed, current, last_seen_at, version, tag, where }, next_steps }` — for template tests `next_steps` names `templates/<type>.<suffix>.json`. Errors (nothing saved): a selector with `{ } ; <` or targeting script / iframe / style / the whole page; a `javascript:` / `data:` / `http:` / protocol-relative URL; html with a disallowed tag, attribute, `on*` handler, `style`, comment or unbalanced tag; weights not summing to 100; control config not `{}`; a template test on `path` targeting; several stores and no `shop_domain`.

#### `update_store_experiment` `{ id, name?, hypothesis?, targeting?, allocation?, weights?, variants? }`

`weights` `{ "A": 70, "B": 30 }` (every variant) or a full `variants` list — not both. Refused once concluded / archived. Once a test has run, `variants` must keep the same count and order (keys are positional and the data is keyed by them); set a weight to 0 to stop sending new visitors to a variant. Weight changes affect only visitors not yet assigned (assignments are sticky). On a running test, op / suffix edits go live within ~1 minute and are logged (`live_config_changed: true`); a targeting change re-checks overlap. Returns `{ experiment, config_changed, live_config_changed }`.

#### `set_store_experiment_status` `{ id, status, winner_key?, no_winner?, conclusion? }`

`status`: `running` | `paused` | `concluded` | `archived`. Transitions: draft → running | archived; running ↔ paused; running / paused → concluded | archived; concluded → archived. `running` is refused (409) when the storefront script has never been seen on the store, or when another running experiment covers the same pages (message names it); template tests return a `warnings` line (granvl can't see the theme — check `?view=<suffix>` renders). `concluded` needs `winner_key` (an existing variant) or `no_winner: true`. **`archived` is two-step**: the first call returns `confirmation_required` + a summary + `confirmation_token`; send it again with the token only after the user says yes.

#### `list_store_experiments` `{ shop_domain?, store_id?, status? }`

Experiments (archived hidden unless `status: 'archived'`) with key, kind, status, `targetingSummary`, variants (weights + config), dates, winner; plus each store's storefront `script` status.

#### `get_store_experiment_results` `{ id, range?: { from?, to? } }`

UTC days, `YYYY-MM-DD`; default start → today. Per variant: `exposures`, stamped `orders` / `revenue`, `conversionRate`, `aov`, `revenuePerVisitor`, `newCustomerShare`, `inferred { orders, revenue }` (separate — never add it in), `conversion { probabilityToBeatControl, expectedLift, liftInterval }`, `revenuePerVisitorStats { probabilityToBeatControl, difference, differenceInterval, lift, liftInterval }`, `projectedMer`. Plus `readiness { readiness: 'insufficient'|'ready', daysRun, daysRemainingEstimate, ordersToGo, rule }`, `projected { spend, storeRevenue, currentMer }`, `health { unstampedShare, ordersLast48h, scriptSeenAt, scriptVersion, consentApiFailures24h, status, reasons }`, `notes`. Don't call a winner before `ready`.

### Auto-testing (creative testing engine)

An **auto-test** is a creative bucket tied to one Meta campaign. Once a day the engine counts never-launched creatives in the bucket and, at or above the threshold, launches them as **PAUSED** ad sets in that campaign (up to 5 creatives per ad set, a flat daily budget per set). The human enables them in Ads Manager. Put creatives for **one angle** in one auto-test — the bucket is the unit of the angle.

#### `list_testing_flows` `{ account_id? }`

Every auto-test with its bucket (creatives, how many are waiting vs the threshold, `readyToLaunch`), launch settings, batches launched, and — for generated copy — approved / needs review (edited since its review; the engine reviews it before launch) / awaiting approval / held-by-compliance counts, by the same launch rule `list_copy_lines` returns as `launch`.

#### `create_testing_flow` `{ name, account_id, testing_campaign_id, link_url, copy_source?, primary_text?, headline?, call_to_action?, countries?, ad_format?, min_new_creatives?, max_ads_per_adset?, adset_daily_budget?, testing_max_daily_budget?, autopilot? }`

Creates the auto-test **and its empty bucket**. `copy_source` decides the ad text — a creative test should change one thing, so the default holds copy constant:

- `winners` (default) — the brand's **Active** ad copy + headline from the Copywriting library, angle-matched.
- `rotation` — the Active line pinned, plus up to 4 more library lines Meta rotates and reports on per text.
- `generate` — copy written from the brand voice, the bucket's angle and ICP, and the destination page, **reviewed against Meta's Advertising Standards before it is stored**. Lines land in the library as Paused; the engine launches only after a person approves them (`update_copy_line` with `status: "winner"`), or `autopilot: "full"` approves lines that clear the rules. **Flagged lines are never launched** — relay the reasons to the user. Archived lines are never launched or approved by autopilot. A line whose body is edited (`update_copy_line`) loses its verdict and is reviewed again before its next launch; if it is edited while a launch is running, the edit wins and the next run reviews the new text.
- `custom` — `primary_text` verbatim.

`ad_format` decides how each batch becomes ads: `one_per_creative` (default) builds one ad per creative so the rules can judge each creative; `multi_media` builds ONE Meta multi-media ad per batch carrying all of its creatives (Meta picks the asset per impression; works for lead campaigns). Say the trade-off out loud before choosing `multi_media`: the ad is the reporting unit, so per-creative results and creative-level rules are unavailable. Reading such an ad back: its videos and images sit in `media_sourcing_spec`, so its `asset_feed_spec` shows 0 videos.

#### `update_testing_flow` `{ testing_flow_id, ...any of the above, status? }`

Change thresholds, budgets, autopilot, launch settings, or pause/resume (`status: "active" | "paused"`).

#### `add_creatives_to_testing_flow` `{ testing_flow_id, creative_ids }`

File bucket creatives into the auto-test. Shortcut: `upload_ad_creative` accepts `testing_flow_id` and files in one step. Stamp creatives with `angle_id` / `icp_id` on upload — that is what the copy sources match on.

#### Rule execution (experimental, opt-in)

`update_testing_flow` with `rules_enabled: true` turns on the daily rule run for that auto-test — **only after the user has agreed to the disclaimer**, which you must state plainly: it is experimental; under autopilot it can pause ads and change ad set budgets in their Meta account on its own; outcomes are not guaranteed. Provide `accept_experimental: true` with the same call once they agree. Rules: **kill** (0 conversions and spend ≥ 3× the account's median CPL → pause the ad), **promote** (≥3 conversions at ≤ 0.8× median → scale that ad set +20% in place; winners are never moved or duplicated), **retire** (frequency ≥ 2.5 and CTR down ≥ 30% week over week → pause). With `autopilot: "off"` every verdict is a **proposal**; `"kills"` applies kill/retire on its own; `"full"` applies everything. `list_testing_flows` returns open `proposals`; `decide_testing_flow_action` applies or dismisses one. Every threshold is tunable per auto-test with `update_testing_flow`'s `rule_thresholds` (kill_spend_multiple, kill_fallback_spend, promote_min_conversions, promote_cpl_ratio, retire_frequency, retire_ctr_drop, scale_factor); the response echoes the effective `ruleThresholds`.

**Ceiling mode (ad-set rules).** Set `rule_thresholds.cpl_ceiling` to the user's cost-per-lead ceiling (ask for the number — it is theirs, never assumed) and the three ad-level rules step aside: each **ad set** in the testing campaign is judged against the ceiling over 7 / 14 / 30 days and the set — not a single ad — is **scaled** (≥ `promote_min_conversions` leads in 7 days at or under the ceiling; the budget rises by `scale_factor` at most every `raise_every_days`, default 2), **benched** (a fading winner: under the ceiling over 30 days, over it the last 7 → paused for `bench_days`, default 30) or **switched off** (over the ceiling on both windows after one ceiling's worth of spend). A set with fewer than `untested_impressions` (500) impressions in its first `untested_days` (3) is *untested* and is never switched off. `judge_by` picks what a lead is: `"platform"` (Meta-reported conversions) or `"qualified"` (first-party qualified leads from the qualify webhook / `mark_lead_qualified`). Scaling always waits for a person in the Auto-test drawer; off / bench follow `autopilot` like kills. `get_testing_flow_health { testing_flow_id }` is the weekly review: every set with its numbers and the call the rules make right now (`scale_adset | off_adset | bench_adset | watch | untested | benched`) — read it, walk the user through each set, then decide the open proposals.

#### `write_testing_flow_copy` `{ testing_flow_id }`

Write a batch of ad copy + headlines for the auto-test now (otherwise the engine writes one on its first check when `copy_source` is `generate`). Every line goes through the compliance review; the response lists what was held and why. Spends AI credits.

#### Platform campaign-build tools → per-platform resource files

The campaign-build tool docs live next to their playbooks — read the matching file before any build:

- **Meta** (`create_meta_campaign`, `create_meta_adset`, `update_meta_adset_budget`, `create_meta_ad` (video builds run in the background → `poll_meta_ad_build` → `verify_meta_build`), `poll_meta_ad_build`, `verify_meta_build`, `attach_creatives_to_campaign`, `set_ad_identity`, `list_ad_pixels`, `list_custom_audiences`, `search_ad_interests`, `list_meta_pages`, campaign drafts) → [META-ADS.md](./META-ADS.md). Building from what already runs: `create_meta_adset` `template_adset_id` copies a live ad set's settings and `create_meta_ad` `copy_from_ad_id` a live ad's texts, link and CTA (explicit args win; the reply's `dropped` lists what didn't come across). The Instagram identity is picked from the ad account's own list (`list_meta_pages` → `instagramAccounts`, `source: "ad_account"` first, with `@handle`s) and set with `set_ad_identity` `{ account_id, instagram_account_id }`.
- **Google** (`create_google_search_campaign`, `create_google_ad_group`, `create_google_search_ad`, `create_google_demand_gen_campaign`, `create_google_demand_gen_ad_group`, `create_google_demand_gen_ad`, `create_google_demand_gen_video_ad`, `search_google_locations`, `set_google_location_targeting`, `create_google_custom_segment`, `list_google_audiences`, `attach_google_audiences`, `generate_keyword_ideas`, `add_google_keywords`, `add_google_negative_keywords`, `get_google_search_terms`, `update_google_campaign`) → [GOOGLE-ADS.md](./GOOGLE-ADS.md)
- **Microsoft** (`create_microsoft_search_campaign`, `create_microsoft_ad_group`, `create_microsoft_search_ad`, `add_microsoft_keywords`, `add_microsoft_negative_keywords`; keyword planning: `generate_microsoft_keyword_ideas` (live), `get_microsoft_search_terms` + `get_microsoft_keywords` (synced store); B2B LinkedIn targeting: `search_linkedin_companies`, `list_linkedin_profiles`, `set_microsoft_linkedin_targeting` — bid boosts by company/industry/job function) → [MICROSOFT-ADS.md](./MICROSOFT-ADS.md)

#### Campaign hubs (cross-platform grouping)

A campaign HUB is granvl's grouping layer (dashboard → Campaigns): a named hub links funnels + ad campaigns from any platform so one view rolls up spend, sessions, conversions and KPIs per brand or initiative. Not a platform campaign — hubs link TO those.

- `list_campaign_hubs` `{}` — every hub with link counts + platforms. Check here first when the user mentions a campaign by name.
- `get_campaign_hub` `{ hub_id, range? }` — linked funnels + ad campaigns AND the measurement rollup (7d/30d/90d). The starting point for cross-platform measurement audits.
- `create_campaign_hub` `{ name, description?, funnel_ids?, ad_campaigns? }` — ad campaign refs are `{ platform, account_id, ad_campaign_id }` from `get_ad_entities` (level campaign).
- `update_campaign_hub` `{ hub_id, name?, description?, add_funnel_ids?, remove_funnel_ids?, add_ad_campaigns?, remove_ad_campaigns? }` — add/remove semantics, never replace.
- `delete_campaign_hub` `{ hub_id, confirmation_token? }` — two-step; archives the hub (soft delete, same as the dashboard). Linked funnels and ad campaigns are untouched; only the grouping goes away.

**Offer, don't impose:** after building a funnel and its ad campaigns, OFFER to group them into a hub ("want these grouped under one campaign view?"). Never create a hub as an unrequested side effect.

#### `record_external_conversion` `{ click_id, conversion_type?, value?, currency?, external_id?, occurred_at? }`

**Report an off-platform conversion back into Granvl** — a Shopify/Stripe purchase, a booked call, any downstream sale that happens AFTER the visitor leaves the landing page. `click_id` is the **gv_cid** Granvl appended to the outbound link the visitor clicked (it rides the destination URL → the store carries it through to the order → echo it back here). Attributes the sale to the exact source **variant** AND forwards it to the funnel's ad platforms (Meta/Google/TikTok) with the recovered ad click id. **Idempotent on `external_id`** (the order/charge id) — safe to retry / re-sync; a repeat is a no-op. `value` + `currency` drive revenue & ROAS. **Zero PII** — never send customer identity. Use for any source without a native integration (directly, or via Zapier/Make). Also exposed as `POST /api/conversions/ingest` (same body, Bearer API key) for server-to-server webhooks.

#### `get_page_speed` `{ funnel_id }`

Stored **Lighthouse (PSI) lab reports** per published page: score 0–100, LCP/CLS/TBT, top `opportunities[]` with ms savings. Measured against the **live URL** by an hourly cron after each publish — right after publishing expect `status: 'pending'` (≤1h). **The loop:** publish → read this → score < 90 → apply opportunities (pairs with `publish_funnel`'s `budgetViolations`) via `update_variant` → republish → cron re-scores. Free read. Fast pages lower ad CPC — treat the score as money. **TBT interpretation:** domain-configured ad pixels are interaction-gated and execute outside Lighthouse's measurement window — meaningful TBT means the variant's own inline JS or a hand-pasted third-party script, never the tracking config.

#### `get_daily_brief` `{ date? }`

Read the workspace's **Morning Brief** — one per PST day, written by a daily cron. Free read, no LLM call. Always has the `deterministic` layer (rolling 24h/7d/30d windows vs the prior period, top-moving funnels, yesterday's variant edits + ad changes + agent activity, 7-day spend with CPQL, tracking-health counts, recent analysis headlines); the `narrative` layer (headline, sections, ≤4 recommendations with ready-to-run prompts) is present only when the workspace opted into hosted AI analysis. **Call this at the start of a session to orient** — it's the same brief the user sees on their dashboard, so you and the user share one picture. `hasBrief: false` until the first daily run; mention staleness if `ageHours` > 26.

#### `get_step_funnel` `{ funnel_id, period? }`

Per-step drop-off for a quiz / multi-step funnel (from `data-step` STEP_VIEW events): visitors per step, % retained, drop-off %, dwell, abandons, and `largestDropIndex` — the step to rewrite. `period` ∈ `24h | 7d | 30d | all` (default 7d). `hasData=false` until step events land.

#### `get_segmented_stats` `{ funnel_id, dimension, range?, start?, end? }`

Break the funnel down by ONE dimension → per-bucket `{ visitors, conversions, clickThrus, qualifiedConversions, convRatePct, clickThruRatePct, qualifiedConvRatePct }`, sorted by visitors desc (top 50, `truncated` flag if more). This is the tool for channel / audience / creative questions `get_funnel_stats` can't answer. `dimension` ∈ **attribution** `utmSource | utmMedium | utmCampaign | refererSource | clickSource` · **audience** `device` · **creative (variant metadata)** `headlineType | ctaType | angle | pageStyle`. Unattributed traffic lands in a `(none)`/`(unset)` bucket. Same counting rules as `get_funnel_stats` (TY click-outs excluded from conversions; `clickThrus` = advanced-past-first-page, the right signal for LANDING buckets). Examples: "which `utmSource` converts best?", "mobile vs desktop?", "do `question` headlines beat `benefit`?".

#### `list_insights` `{ funnel_id?, limit? }`

Performance-Feed insights from the rules engine — mobile gaps, scale signals, channel mix, perf flags. Read BEFORE generating new variants so suggestions are informed by past wins/losses.

### Lead qualification

#### `set_qualification_rule` `{ funnel_id, rule }`

Stores `Funnel.qualificationRule` JSON. On every form submit, the rule evaluates against submission data; matching submissions get a `LeadQualification(source: RULE)` row. Provide `null` to clear.

A rule is a **group**. Each group has a combinator (`type: 'all'` = AND, `type: 'any'` = OR), zero or more leaf conditions, and zero or more child groups — at least one of conditions/children must be present. Nesting is bounded at 5 levels.

**Flat rule** (top-level AND/OR over a list of conditions):

```json
{
  "type": "all",
  "conditions": [
    { "field": "role", "op": "equals", "value": "CEO" },
    { "field": "employees", "op": "gte", "value": 100 }
  ]
}
```

**Nested rule** for HubSpot-style mixed boolean logic — `(CEO AND big company) OR (SaaS AND budget)`:

```json
{
  "type": "any",
  "children": [
    {
      "type": "all",
      "conditions": [
        { "field": "role", "op": "equals", "value": "CEO" },
        { "field": "employees", "op": "gte", "value": 100 }
      ]
    },
    {
      "type": "all",
      "conditions": [
        { "field": "industry", "op": "equals", "value": "SaaS" },
        { "field": "budget", "op": "gte", "value": 10000 }
      ]
    }
  ]
}
```

Operators: `equals`, `not_equals`, `contains`, `gte`, `lte`, `gt`, `lt`, `is_truthy`, `is_falsy`, `in`, `not_in`. Field names support dot notation.

> The dashboard rule builder currently only edits **flat** rules. Nested rules render read-only in the dashboard with an "Edit via MCP" prompt to prevent accidental clobber.

#### `get_qualification_rule` `{ funnel_id }`

Returns the rule + two count blocks: `counts` (LeadQualification ledger rows — server-side `/api/form-submit` path and deal-close webhooks) and `conversionCounts` (CONVERSION events by `conversionQuality` — where client-side rule eval on external-destination forms records its verdict). To verify a gate is live on an external-CRM funnel, read `conversionCounts`; the ledger stays 0 there by design.

#### `mark_lead_qualified` `{ session_id, funnel_id, qualified, value?, reason? }`

Manual override (`source: MANUAL`). Webhook updates beat manual; manual beats rule.

#### `get_qualify_webhook_url` `{}`

Returns a deal-close webhook URL bound to the current workspace. Paste into the user's CRM / Zapier; the CRM POSTs back when a deal closes with `{ session_id, qualified, value?, reason? }`. The workspace URL is stored only as a fingerprint: the FIRST call creates it and returns it once — later calls return `url: null` + its prefix and never rotate it (the user rotates from the funnel's Qualification tab). Pass `domain_id` for a domain's own URL, which can be re-read any time.

### Sessions + journeys

#### `list_session_journeys` `{ funnel_id?, funnel_type?, qualified?, converted?, audience_cohort?, closed_only?, stage?, limit?, cursor? }`

One materialized row per session × funnel, newest sessions first (by `startedAt`). Paged: `limit` defaults to 50 (max 500 per page); the response carries `next_cursor` — when it isn't `null`, call again with `cursor: next_cursor` and the **same filters** to walk further back. There's no cap on the total, only on one page. Each row carries:

- **Funnel structure at time of visit**: `funnelType` (`CLICK_THROUGH | SINGLE_LANDING | LEAD_CAPTURE | QUIZ_FUNNEL | FORM_FUNNEL | MULTI_STEP_LEAD | OTHER`), `pageCount`, has{Quiz,Form,ThankYou}, isClickThrough
- **Path**: `pagePath: pageId[]`, `variantPath: variantId[]` (chronological)
- **Outcome**: `converted`, `convertedAt`, `qualified`, `qualifiedAt`, `qualificationSource`, `valueUsd`
- **Engagement**: `durationSec`, `pagesVisited`, `maxScrollDepth`, `bounced`, `isClosed`
- **Audience**: `audienceCohort` (e.g. `mobile_paid_meta`), device, geo, UTM, click attribution

Use for "why is this lead bouncing?" deep dives, cohort stratification, retrospective HTML lookup (pair with `get_variant_html_at_time`).

#### `get_cohort_comparison` `{ funnel_id }`

Pivots session journeys into a cohort × variant grid. Use when the user asks "is this winner real?" — the headline conv rate can hide cohort-mix flips. If a variant beats another in totals but loses on `mobile_paid_meta`, you should NOT promote until cohort-level data resolves.

### Learnings

#### `save_learning` `{ variant_id, title, outcome, notes?, hypothesis?, change_type?, change_summary?, metric?, baseline_value?, result_value? }`

Durable test conclusion. `outcome` ∈ `WINNER | LOSER | INCONCLUSIVE`. Use after declaring a test result. **Capture the experiment, not just the verdict** — fill the structured fields whenever you know them so `get_research_history` (and the future cross-customer pattern library) can reason over them: `change_type` ∈ `HEADLINE | CTA | HERO | COPY | LAYOUT | OFFER | ANGLE | FORM | PRICING | OTHER` (the lever pulled), `change_summary` (the specific change, e.g. "question → benefit headline"), `metric` (e.g. `"conversion_rate"`, `"rpv"`, `"roas"`), `baseline_value`→`result_value` (before→after; the history derives a signed % `lift`), and `hypothesis` (the bet you were testing).

#### `list_learnings` `{ funnel_id?, outcome?, limit? }`

Past lessons, raw + filterable. For the curated "what to repeat / what to avoid" read, prefer `get_research_history`.

#### `get_research_history` `{ funnel_id?, limit? }`

The workspace's research memory — **call BEFORE proposing or generating any experiment.** Returns concluded learnings grouped into `wins` (proven patterns to lean on), `avoid` (known dead ends — do NOT re-test these), and `inconclusive` (fair to revisit), each tagged `source` (`auto` from auto-optimize vs `agent`-authored). Each entry also carries the structured capture when present — `changeType`, `changeSummary`, `metric`, `baselineValue`/`resultValue`, a derived signed `lift` (%), and `hypothesis` — so you can reason over _what was changed and how much it moved_, not just the prose. Omit `funnel_id` for workspace-wide. This is the curated read; `list_learnings` is the raw list.

#### `list_optimization_actions` `{ funnel_id?, window_days?, limit? }`

**What the autonomous optimizer DID** — so you can report it + react. When auto-optimize is enabled on a page, a cron silently pauses underperformers, flags the current leader, and generates fresh variants. This returns those as a chronological `actions[]` feed: each has `type` (`paused` | `leader` | `generated`), `variant` / `pageName` / `funnelId` / `funnelName`, an ISO `at`, and a plain-English `detail` (the reason, or "promote it to start testing"); plus `counts` per type. `window_days` default 7. **Call it at the start of a session and when the user asks "what changed / what did you do?"** — narrate it ("overnight I paused X and shipped two new variants; B is leading"); it's the proof the system works _for_ them and tees up your next move. `hasData=false` when nothing autonomous happened (auto-optimize off, or too little traffic). **Paused platform-wide since 2026-10-28** (`AUTO_OPTIMIZE_ENABLED` off): the crons no longer pause variants or rotate generated ones in, so this list only shows history until it is switched back on; the winner rules in OPTIMIZATION.md and in code are being reconciled first.

#### `get_optimization_suggestions` `{ funnel_id, range? }`

**Deterministic NEXT MOVES for a funnel — it suggests, you act** (no autonomous edits). Runs the same verdict logic as the auto-optimize cron, per page, as advice: `promote_winner` (a variant cleared the bar — ≥50 sessions, leads >2× a loser), `pause_loser` (under half the leader's rate), `start_test` (a page with real traffic but only one variant in rotation). Each has `type`, `severity`, `pageId`/`pageType`, `variantId`/`variantName`, and a plain-English `title` + `detail` + `suggestedAction` (the exact tool to call). **History-aware:** also returns `history` `{ wins, failures }` from the funnel's past learnings, and `start_test`'s action tells you to avoid re-testing known failures — never repeat a dead end. Use when the user asks "what should I do / optimize?" `hasData=false` (with a `message`) when tests are still gathering data or everything's performing. Pairs with `list_optimization_actions` ("what was done") and `analyze_funnel` (the LLM narrative).

### Research library

Foundation documents are the workspace's written research: one document per brand or offer with `##` sections (Product, Market & competitors, Audience & customer voice, Offer, Beliefs & messaging, Research library). They live in folders, carry tags, a status (`template | draft | approved`), a star, and an `agent_context` flag (documents flagged as agent context are handed to agents as workspace context). Every content write keeps a version the user can restore. Evidence rows (`list_research`) can be filed under a document. **Read the library at the start of research or copy work, and write what you learn back into it** — it is the shared memory between the user, the dashboard and every agent.

#### `list_research_documents` `{ brand_id? }`

Folders (with counts) and documents (title, kind `foundation|supporting`, status, folder, tags, section titles, starred, agent_context, updated_at). No content. Omit `brand_id` for the whole workspace.

#### `get_research_document` `{ document_id, format? }`

One document as markdown plus its section list; a report also returns its structured `report` and `coverage` (`{ quotes, competitors, evidenceSources, sources, level: 'thin' | 'fair' | 'solid', below, autoDeepened }`). A supporting file returns its `file_url` and `file_mime` instead. `format: 'html'` returns `html` instead of markdown: a complete, styled, script-free page. **If your host has a browser pane (Claude Code, Codex): write it to a local `.html` file and open it there** — that is how the user reads a report comfortably; summarise the executive summary in chat alongside. Hosts without a browser read the markdown.

#### `create_research_document` `{ title, folder_id?, tags?, markdown?, brand_id?, file_url?, file_mime? }`

New foundation document — seeded with the template when `markdown` is omitted. With `file_url` (an asset you uploaded to this workspace) it becomes a supporting file instead. Returns `id`, `sections` and the dashboard `url`.

#### `update_research_section` `{ document_id, heading, markdown }`

Replace one `##` section's body (case-insensitive heading; a new heading is appended). The preferred edit: small, versioned, leaves the rest untouched.

#### `replace_research_document` `{ document_id, markdown, summary? }`

Replace the whole body. Versioned. Use only when restructuring the document.

#### `update_research_document` `{ document_id, title?, folder_id?, tags?, starred?, status?, agent_context? }`

Metadata only. `folder_id: null` moves it to the library root. Set `status: "approved"` when the user signs the document off; set `agent_context: true` so agents read it as context.

#### `delete_research_document` `{ document_id }`

Deletes the document; linked evidence rows are kept and unlinked. Ask first.

#### `list_research_document_versions` `{ document_id }` · `restore_research_document_version` `{ document_id, version_id }`

Saved versions (newest first, `source` `human|agent|restore`, `summary`, `created_at`) and roll-back. Restoring saves the current text as a version first.

#### `create_research_folder` `{ name, parent_id?, tags?, brand_id? }` · `update_research_folder` `{ folder_id, name?, parent_id?, tags? }` · `delete_research_folder` `{ folder_id }`

Folders nest. Delete only works on an empty folder.

#### `attach_research_evidence` `{ research_id, document_id }`

File an evidence row under a document (`document_id: null` unlinks). The document's Research library section lists it as a source record (E001…).

### Websites

The brand website (docs: Website tier). A fixed roster — Homepage `/`, Services `/services`, About `/about`, Contact `/contact`, one extra page — plus Privacy `/privacy` and Terms `/terms` that don't count. One website per brand. Every page shares one header, footer, navigation and **main website button**; the bake swaps `{{SITE_HEADER}}` and `{{SITE_FOOTER}}` into each page (put them right after `<body>` and right before `</body>`; they're inserted if missing) and `{{SITE_CTA}}` inside the header fragment becomes the button. Websites are deliberately simple: one version per page (no split tests), no ad attribution, at most one `<form>` and only on Contact (or the extra page), no quiz steps. Landing pages stay funnels — on the same domain, at their own slugs; the website owns `/`.

#### `create_website` `{ name, brand_id?, domain_id? }`

Creates the website with an empty roster and a default header / footer built from the brand kit. Refuses a second website on the same brand. Connect a domain here or later with `update_website` — publishing needs one.

#### `get_website` `{ website_id }` · `list_websites` `{}`

The roster (`role`, `status` `not_created | draft | published | changed`, `previewUrl`, `liveUrl`), the layout (header / footer HTML, `navLinks`, `cta`, `theme`, `searchVisible`), domain and publish state. `pagesCreated` of `pageCap`.

#### `create_website_page` `{ website_id, role, html, name? }` · `update_website_page` `{ website_id, role, html, change_summary? }` · `delete_website_page` `{ website_id, role, confirmation_token? }` (two-step)

Pages by role. `html` is the complete document. A page previews at once; on a published website an update waits for `publish_website` (the dashboard shows "Unpublished changes"). The homepage can't be deleted while the site is live.

#### `set_website_layout` `{ website_id, header_html?, footer_html?, nav_links?, theme?, search_visible? }`

The shared appearance. Omitted fields keep their value. `header_html` should contain `{{SITE_CTA}}` where the main button goes; `footer_html` should link `/privacy` and `/terms`. `search_visible: false` adds `noindex` to every page and disallows the domain in robots.txt.

#### `set_website_button` `{ website_id, label, funnel_id | page_id | url }`

The main button: one target. A funnel target links to that funnel's landing page (relative when it shares the domain) and its clicks count as **Funnel clicks** in the website analytics.

#### `publish_website` `{ website_id, confirmation_token? }` · `unpublish_website` `{ website_id, confirmation_token? }`

Both two-step (preview → user yes → token).

Bakes every page live on the domain (homepage + connected domain required) or takes the whole site offline. `robots.txt` and `sitemap.xml` are served per domain automatically.

### Workspace

#### `get_workspace_context` `{}`

The workspace's `granvl.md` memory document: `{ content, updatedAt, empty }`. Call first every session. `empty: true` → run the intake (SKILL.md "START HERE") and save it with `update_workspace_context`. With no workspace at all it answers `{ workspaceId: null, …, empty: true, next }` (no error) — call `create_workspace` first. `list_funnels` does the same (`{ count: 0, funnels: [], next }`).

#### `update_workspace_context` `{ content }`

Whole-file replace of `granvl.md` (≤64 KB). Read, modify, write the complete document back — never a fragment. Workspace-level context only; per-domain brand specifics go through `update_brand_kit`.

### Marketing capabilities

#### `list_capabilities` `{ kind? }`

Returns `{ balance_credits, allowed_regions, default_image_model, video_models_note, models: [{ id, kind, label, region, approx_credits, note }] }` (`default_image_model` only when `kind` is image or omitted; `video_models_note` only when `kind` is video or omitted). Video models are raw-clip models for `generate_video`: their `note` says so and points video ads at `setup_video` — never present them or their prices as video templates. `kind` ∈ image | video | research. Models outside the workspace's allowed regions (default: all, US + EU + SG) are omitted.

#### `generate_image` `{ brief, model?, reference_asset_ids?, use_product_images?, aspect_ratio?, resolution?, funnel_id? }`

Image models: nano-banana-2.1 (default) and gpt-image-2 (when the user asks for ChatGPT's image model). No others. `model` omitted → nano-banana-2.1; the old ids `nano-banana-2` / `nano-banana` resolve to it; any other id is rejected with an error naming the two.

When `reference_asset_ids` is omitted, the brand kit's product images (`update_brand_kit` `product_image_asset_ids`; the funnel's domain kit when `funnel_id` is set, else the active brand's) are attached as references automatically and come back as `product_reference_asset_ids` — the real product is always the reference, never a description of it. `use_product_images: false` opts out.

Generates one image and stores it as a workspace asset. Returns `{ asset_id, url, width, height, model, region, credits_charged, balance_credits, redactions }`. `resolution` ∈ 512 | 1K | 2K | 4K (default 1K). Up to 14 references, all workspace assets. Errors: an image model other than the two, a region the workspace disallows, not enough credits, provider failure (not charged).

#### `generate_video` `{ model, brief, first_frame_asset_id?, reference_asset_ids?, duration_seconds?, aspect_ratio?, resolution?, audio?, funnel_id? }`

**One raw clip only** (a single Seedance / Veo shot from a text / image prompt). NOT the way to make a video ad: for narration, captions, music and a template look use `setup_video`. Call it only when the user explicitly wants one raw clip. Starts an async video job. Returns `{ job_id, status: 'pending', model, region, estimated_seconds, redactions, next }`. `duration_seconds` 4–30 (model-dependent), `resolution` ∈ 480p | 720p | 1080p, `first_frame_asset_id` makes it image-to-video (wins over references).

#### `poll_video_generation` `{ job_id }`

Returns `{ job_id, status: 'pending' | 'completed' | 'failed', model, region, asset_id?, url?, bytes?, credits_charged?, balance_credits?, error? }`. Idempotent; the clip is stored and charged exactly once whoever asks first (poll, webhook or the 5-minute backstop cron). Jobs pending after 2 hours are written off unchanged.

#### `list_video_styles` `{}`

The video templates (styles) for storyboard videos: `{ styles: [{ id, label, summary, image_model, caption_preset }], caption_presets: [{ id, label, summary, mode }] }` — styles `comic-office`, `comic-bright`, `blueprint`, `clay`; caption presets `pill-orange`, `block-caps-yellow`, `karaoke`, `word-by-word`, `hormozi`. Static. For the guided pick (template, voice, music, captions on a card) call `setup_video` instead.

#### `setup_video` `{ picks?, sample_line? }`

**THE entry point for any video request** ("video", "video ad", "video templates"). The guided start. Renders the template picker: four templates, each a bundle of look + narrator + music bed + caption style (`{ templates: [{ id, label, summary, sample_url, palette, caption_preset, voice: { voice_id, model, name }, music_track_id, music_title }], caption_presets, voices (the ElevenLabs narrators — the wizard offers ElevenLabs only), music, usual, picks, sample_line, default_voice_id }`). The user picks a template and taps **Use template**, which walks the short stepper (look → voice → music → captions → review) with that template's voice, music and captions pre-selected to accept or change; Next between steps, Continue on the review step. Only Continue sends: one plain chat message arrives: `Video setup: Clay look, Square size (aspect: 1:1), Brian narrating, Inspiring Piano music, Yellow block caps captions. Ready for the script.` (or `no music`). Map the names back to ids from the setup_video result you already hold (`templates[].id`, `voices[].voice_id` + `model`, `music[].id`, `caption_presets[].id`). Size is chosen on the setup card (1:1 default; 9:16, 4:5); pass it as `aspect`. Parse it, then go straight to the script questions — never re-ask about the look, size or voice — and pass the ids to `create_video_storyboard` (`style_id`, `aspect`, `voice.voice_id` + `voice.model`, `music_track_id`, `caption_preset`). `picks` pre-selects what the user already said in chat (`picks.aspect` for a size they named); `usual` is what the workspace rendered with last time (shown as "your usual", outranks the template default). Call it FIRST for any new video unless the user named a look and a voice themselves. The result's `next` says the card shows the previews; never repeat their URLs as markdown images in chat.

#### `review_video_stills` `{ run_id }` · `approve_video_stills` `{ run_id, approve, style_id?, confirm?, max_credits? }`

The look check, and the one cost confirmation of a video run (render_video draws the first stills without asking). **Every run** pauses in status `review` after its first three stills (poll_video_render returns `status: 'review'` and says so; a run with no more than three beats pauses once with all its stills drawn; nothing more is charged while it waits). Call `review_video_stills` to show them: `{ run_id, status, title, style_id, style_label, aspect, stills: [{ beat_id, line, url }], beats_total, credits_charged, remaining_credits, remaining_parts, estimated_total_credits, suggested_max_credits, max_credits?, switch_credits, templates: [{ id, label, summary, sample_url, look_check_credits }] }`, rendered with **Approve · ~N credits** (N = `remaining_credits`: the remaining stills, motion, voice and render) and **Change the look** (each look shows `look_check_credits`, what redrawing its first stills costs; its button reads **Switch · ~N credits**). The button text is the confirmation: where the host lets the card call tools, the card calls `approve_video_stills { approve: true, confirm: true, max_credits: suggested_max_credits }` (or `{ approve: false, style_id, confirm: true }`) itself, shows the run's progress while it is open (redrawing itself when a switched look pauses for review again) and tells you through model context: "Stills approved for run … (about N more credits approved, max_credits M); the video is being made in the background — …" (or "… it is queued behind N other videos and starts on its own …"), "Stills switched to '…' for run … (about N credits to redraw the first stills)", then "Video run … completed: creative …", "… failed: …" or "Video run … is paused, not failed: …" (a rate limit; see render_video). A run that is not in `review` (failed, paused, already approved) shows no Approve: a failed one shows its error and **Retry render**, a paused one its pause and **Try again** (chat messages for render_video). Don't repeat the call; there is no need to poll alongside the card (it is safe: one advance per run runs at a time). Otherwise the verdict arrives as a chat message naming the call to make ("Approve the look for video run … (approve_video_stills approve: true, confirm: true, max_credits: M — about N more credits). The video is then made in the background; no need to keep polling." or "Switch video run … to the \"Clay\" look (approve_video_stills approve: false, style_id clay, confirm: true …)…"); make that call. Semantics: `approve: true` continues — without `confirm: true` it returns `{ needs_confirmation, estimated_credits (the remaining cost), estimated_total_credits, suggested_max_credits, message }` above the 20-credit line; with it the run is handed to the server and the call answers at once: the remaining stills (three at a time), motion, voice and render are made in the background whether or not the chat stays open (status `stills`, `next` says so — tell the user it takes a few minutes and that they can close the chat; don't poll). Up to 3 runs per workspace are made at a time; a 4th answers `status: 'queued'` with `queued_behind` (how many are ahead) and starts on its own when one finishes; `approve: false, style_id` switches the look and redraws only the first stills without asking (bounded like the first look check, ≤ ~30 credits, returned as `look_check_credits`; the card's **Switch · ~N credits** tap is the confirmation; the check pauses again); `approve: false` alone returns the run to draft. `max_credits` sets the whole-run cap here, as on render_video; an approval whose remaining cost no longer fits the cap is refused with the run still in review. (A switched look's redraw is sent to the server too, but it is still the look check: it needs no slot, is never queued, and stops in `review`.)

#### `create_video_storyboard` `{ title, style_id, aspect?, characters?, character_asset_ids?, music_track_id?, music_volume?, beats: [{ id, line, visual, emphasis?, overlay?, pause?, motion? }], cta: { line, button? }, voice?, caption_preset?, motion_model? }`

Saves a storyboard for a "faceless explainer" ad (one AI still per spoken beat, slow push-in, word-timed captions with a highlighted keyword, stat cards, end card). Returns `{ run_id, status: 'draft', beats, estimated_seconds, estimated_credits, suggested_max_credits, look_check, still_prompts: [{ beat_id, prompt, aspect, supplied }], next }`. Quote `estimated_credits` (stills + a 1-credit critic review each, motion clips at the full clip price, voice, render); pass `suggested_max_credits` (ceil(estimate × 1.15)) as `max_credits` on render_video. Nothing is generated. Beats take `still_asset_id` (a workspace image asset) to use a host-rendered still instead of generating one — no image credits; the critic reviews it and reports, never redraws. Rules: 4–24 beats, ≤30 spoken words per beat, <220 words total; `emphasis` phrases must appear in their `line`; `visual` is subject + action + setting only (the style adds the look; no text in images); numbers go in `overlay` so they render sharp. `aspect` ∈ 1:1 (default) | 9:16 | 4:5 — the size picked on the setup card. `pause` (0–2s) adds silence after a line (a voice break tag). `motion: 'animate'` makes that beat a 5s image-to-video clip from its still (video credits; falls back to the still if the provider refuses) — use on 1–3 hero beats. `caption_preset` overrides the style's default treatment; `motion_model` picks the video model for animated beats (default `seedance-2.5`).

#### `render_video` `{ run_id, confirm?, max_credits?, caption_preset?, skip_look_check? }`

Generates the run: stills (image credits, one per beat, plus the critic), motion clips, the voiceover with word timestamps (voice credits), then the render (render credits). It pauses for the look check after the first stills; the cost is confirmed once, at approve_video_stills. So with the look check on (every run, unless `skip_look_check`), this call never returns `needs_confirmation`: it draws the first three stills without asking (bounded: 3 × the dearest image model plus the critic, about 30 credits with gpt-image-2) and returns the run view in `review` with `look_check_credits` (mention it if useful; no need to ask), `estimated_remaining_credits`, `estimated_total_credits` and `suggested_max_credits`. `skip_look_check: true` (only for a re-render of a look the user already approved; update_video_beat and same-look variants keep the approval themselves) confirms everything that is left in one step instead: above the 20-credit line it returns `{ needs_confirmation, run_id, estimated_credits, estimated_total_credits, suggested_max_credits, look_check, message }` — ask, then call again with `confirm: true` and `max_credits: suggested_max_credits`. The balance must cover the whole run before the first still is drawn. Every still passes a vision critic (text, deformed anatomy, missing subject, wrong character) and is redrawn up to twice with the critique folded into the prompt. `max_credits` is a hard cap on the whole run: pass `suggested_max_credits`, not the bare estimate; a run whose whole estimate is over it is refused up front, and a step that would cross it fails the run with finished work kept (raise it and call again to resume; it also updates while the run waits in review). Re-calling a `failed` run resumes with the finished stills. **Background runs (2026-11-06):** once the look is approved the run belongs to the server — the remaining stills (three at a time), motion, voice and render are made by server-side steps whether or not the chat stays open, so with an approved look (`skip_look_check`, a beat edit, a same-look variant) this call answers at once with `status: 'stills'` and a `next` that says so: tell the user it takes a few minutes and that they can close the chat; don't poll. Up to 3 videos per workspace are made at a time; a 4th answers `status: 'queued'` with `queued_behind` and starts on its own (render_video on a queued run just reports its place). The spend guard's burst and daily-count limits are checked here and at approve_video_stills, once each for the whole remaining estimate, not on every still and voice line. A run that still hits a rate limit mid-way (the daily credit ceiling, a provider's 429) is **paused, not failed**: its status stays, the view carries `paused: { message, retry: 'soon' | 'later' }` and `next` says what happens — `render_video` resumes it at once (it takes a background slot again, or queues when the workspace is full), with every finished still and voice clip kept and not charged again. A `retry: 'soon'` pause also resumes on its own once two minutes have passed; a daily one (`'later'`) waits for render_video. A run that needed more server steps than expected (a safety cap) is paused the same way with "needed more background steps than expected" — render_video continues it. Tell the user it is paused; don't start a new run. Every charged step writes a row to the activity log ("Video run "…": 3 stills drawn, 3/9 done (18 credits incl. 3 critic)", "…: motion clip for beat b5 (128 credits)", "…: narration, 9 lines (19 credits)", "…: rendered, 38s (29 credits; 102 in all)", "…: look check approved (~84 credits to go)").

#### `poll_video_render` `{ run_id }`

Before the look check each call performs the next slice (the first three stills): poll every ~20s; on `review` stop polling and call `review_video_stills` (the rest of the cost is confirmed there). **After the approval the server drives the run and this call is a read** (2026-11-06): it returns the run's progress and never does the work (it may only re-send a lost server step), so there is no need to keep polling — call it when the user comes back or asks. Returns `{ run_id, status: 'draft' | 'stills' | 'review' | 'queued' | 'motion' | 'voice' | 'rendering' | 'completed' | 'failed', title, style, aspect, beats, stills_done, stills_redrawn, motion_done, motion_fallback, voice_ready, look_check: 'required' | 'approved', estimated_seconds, credits_charged, max_credits?, output_url?, creative_id?, output_seconds?, error?, paused?, queued_behind?, next }`. `queued`: the workspace already has 3 videos in the making; `queued_behind` says how many are ahead, and it starts on its own. With `paused` the run hit a rate limit and is not failed: follow `next` (a short limit resumes on its own after two minutes; render_video resumes it now). On `completed` the mp4 is in the creative bucket as `creative_id` — attach it with `attach_creatives_to_campaign` or `add_creatives_to_testing_flow`. The view also carries `style_label` (the look's name) and `motion_beats` (how many beats animate). One advance runs per run at a time (a Redis lock): a call that finds the run busy — the video card or the look-check card polling it — returns its current state without doing work, so overlapping polls never draw or charge a still twice. On MCP Apps hosts the result renders on the creative card (`ui://granvl/creative-review`, `source: 'storyboard'`): stills / motion / narration counts while it works, checking `poll_video_render` itself every 20s before the approval and every 30s after it (where it says the video is being made in the background and the chat can be closed); "Queued" with how many are ahead on a queued run; “Waiting for the look check” on `review` (no polling); the error and **Retry render** on `failed`; “Paused”, the pause and **Try again** on a paused run (polling once a minute while the pause is short); on `completed` a player sized to the aspect with **Download**, **Use as ad creative**, **Make a variant** (create_video_variant) and **Change a beat** (update_video_beat), the last three as chat messages. Don't paste the mp4 URL in chat as a markdown image or link — say it's ready and name the creative id (the `next` hint says so).

#### `list_voices` `{ provider?, gender?, accent? }`

Narrator voices. `provider: 'elevenlabs'` (default) returns a curated eight — four male, four female — plus the workspace's own, for `voice.model` `eleven-v4`; `provider: 'fishaudio'` returns public Fish Audio voices for `fish-drama-3` (directable, preview) / `fish-s2.1-pro`. Each voice carries `provider` and the `model` to pass with it. Bracketed cues inside a beat's `line` ("[warmly]", "[sighs]", "[break]") direct the read on v4 and Fish and are never captioned. Shape: `{ voices: [{ voice_id, name, gender, accent, age, use_case, description, preview_url, source: 'default' | 'workspace' }], default_voice_id }`. Renders as a picker with play buttons on MCP Apps hosts; the user's tap arrives as a chat message naming the voice_id. Pass it as `voice.voice_id` on `create_video_storyboard` or `voice_id` on `create_video_variant`, and save the pick to granvl.md.

#### `list_music_tracks` `{ mood? }`

Background beds: `{ tracks: [{ id, title, mood, summary, bpm, seconds, preview_url }], mood, note }` — always the whole library; `mood` only preselects the picker's chip. Previews are 20-second excerpts streamed from granvl; the full track is only ever mixed into a rendered video and is never downloadable. Pass the id as `music_track_id` (optional `music_volume` 0.05–0.4, default 0.18); the bed ducks under every voice clip and fades out on the end card.

#### `list_caption_presets` `{ run_id?, sample_line?, style_id? }`

The five caption styles: `{ presets: [{ id, label, summary, mode: 'chunk' | 'karaoke' | 'word', max_words, font, size, color, highlight, transform, stroke, position }], sample: { line, emphasis, still_url, aspect, style_id, style_label, palette }, current, run_id }`. Renders as a picker that animates every style over the sample line (with `run_id`: that video's first line and still) so the user watches each one before choosing; the tap arrives as a chat message naming the `caption_preset` id. Pass it as `caption_preset` on `render_video` (works on a draft or a finished run — a finished one goes back to draft and re-renders with every still and voice clip reused, render credits only), or on `create_video_storyboard` / `create_video_variant`. Call it after the storyboard is saved, before `render_video`, unless the user already named a style.

#### `update_video_beat` `{ run_id, beat_id, line?, visual?, emphasis?, overlay?, pause?, motion?, still_asset_id? }`

Edits one beat of a run that is not generating and puts the run back in `draft`. Only what changed is redone on the next `render_video`: a new `visual` redraws that still (and its motion clip), a new `line` re-voices that beat, the rest only re-renders. Returns the run view plus `{ beat_id, will_redraw_still, will_revoice, estimated_credits, suggested_max_credits }` (the cap counts what the run already charged). A run whose look the user approved keeps the approval, so the re-render has no look-check pause. The previous mp4 stays in the creative bucket.

#### `create_video_variant` `{ run_id, title?, style_id?, caption_preset?, cta?, voice_id?, music_track_id?, music_volume?, beats?: [{ id, …beat fields }] }`

A sibling run from an existing one. Beats are matched by id and merged; everything left out is inherited. Any beat whose still / voice / motion comes out identical (same model, prompt, references, line, voice) is reused from the source run — or any other run in the workspace — by content hash and never charged again. Returns the new draft run view plus `{ source_run_id, reusable_stills, reusable_voices, estimated_credits, suggested_max_credits }`. Same style as an approved source: `look_check: 'approved'`, no pause; a new `style_id` gets its own look check. Three hooks on one body: three variants each changing beat `b1`, then `add_creatives_to_testing_flow` with the three `creative_id`s.

#### `list_video_runs` `{ limit?, status? }`

Recent runs in the workspace, newest first, same shape as the poll view: `{ runs, next }`. `status: 'active'` lists only the runs being made or queued (oldest first — the order the queue starts them in); any single status (`queued`, `completed`, …) filters to it. Queued rows carry `queued_behind`. Approved runs are made in the background, up to 3 per workspace at a time. On MCP Apps hosts the card lists them (title, look, length, status — a queued one says Queued) and plays a finished one in the player; the list itself never polls.

#### `delete_video_run` `{ run_id, confirm? }`

Delete a run that never finished (draft, failed, queued — it leaves the queue — or stills drawn but never rendered) — two-step: without `confirm: true` it only reports what would go. A run that is generating is refused (let it finish); a completed run is refused too — its video is a creative in the library, remove it from the creative bucket instead. Stills already stored as assets stay.

#### `research_competitor_ads` `{ brand? | domain? | query?, live_only?, platform?, format?, limit?, previews?, estimate_only? }`

National, US-oriented: English-language ads, relevance-ranked then longest-running; no country or city filter (search the service, never the place); advertisers outside North America dropped by landing domain or locale path (`/en/gb/`, `/en-au/`; a Canadian page is kept); duplicates collapsed (one creative's placements, one advertiser's repeated headline, the same copy under several advertisers — the survivor lists them in `advertisers`). A social short link or unfilled template falls back to a full page URL in the ad's copy for `landing_page`. Charged per result, never per call: only ads new to the workspace (or collected live) are billed, at their share of the pull; ads already saved are free (`list_competitor_ads`). Call with `estimate_only: true` first — returns `{ estimate_only, mode, target, estimated_credits, max_credits, charge_rule, balance_credits, coverage, next }` and runs nothing; `estimated_credits` is "up to N" (every result new). Then returns `{ target, mode, brand, advertiser_matched? (brand/domain only), coverage, collected_live, total, duplicates_collapsed, non_us_dropped, links_unusable, saved_new, saved_already, ads: [{ saved_id, id, brand, headline, body, cta, format, platforms, days_running, started, live, landing_page, thumbnail, media, niches, advertisers? }], landing_pages, credits_charged, why, billed_results, max_credits, cost_credits, balance_credits, provider_log?, next }` plus thumbnail image blocks (max 10). `credits_charged` is the actual charge (0 when every result was already saved; `why` says so, e.g. "all 10 were already saved in this workspace"). Every ad is saved to the workspace (Research → Ads); a re-pull refreshes the row instead of duplicating it. Follow with `save_competitor_insights`.

#### `save_competitor_insights` `{ ads: [{ id, offer?, hook?, angle?, notes? }] }`

`id` is an ad's `saved_id`. Offer and hook are YOUR wording (≤ 300 chars each), never the competitor's copy; `angle` is one of pain-point | aspiration | urgency | value | social-proof | curiosity | authority | comparison. Returns `{ saved, unknown_ids, next }`. Free.

#### `list_competitor_ads` `{ competitor?, platform?, format?, live_only?, starred?, missing_insights?, limit? }`

Returns `{ total, ads: [{ id, competitor, domain, headline, body, cta, format, platforms, days_running, live, landing_page, thumbnail, offer, hook, angle, notes, starred, teardown, pulls, last_seen }], next? }`, longest-running first, scoped to the active brand. Free — check before spending credits on a re-pull.

#### `research_landing_page` `{ url, screenshot?, ad_id?, estimate_only? }`

Returns `{ teardown: { url, final_url, title, meta_description, headline, subheadlines, ctas, form_fields, prices, trust_signals, offer_lines, word_count, rendered_with }, attached_to_saved_ads, has_screenshot, credits_charged, balance_credits, next }` plus a screenshot image block. The teardown is kept on the saved ad given by `ad_id`, else on every saved ad that sends to this page. Priced by the reader that reads the page: 1 credit with web extraction or a plain fetch, 4 with a browser render (a screenshot asks for the browser). `estimate_only: true` returns `{ estimated_credits, read_by, credits_by_reader, min_credits?, max_credits?, credits_range?, balance_credits, next }` — `estimated_credits` is the reader that will run; the range is where a fallback down the chain can land.

#### `start_offer_research` `{ offer?, topic?, mode?, country, city?, vertical?, landing_page_url?, competitor_domains?, questions?, estimate_only? }`

One of `topic` (the niche: "residential roofing") or `offer` (the advertiser's own offer) is required; `mode` is `deep` (default, Parallel ultra) or `standard` (cheaper, shallower). With `estimate_only: true` it ALWAYS prices, and runs and charges nothing — call this first: `{ estimate_only: true, started: false, mode, engine, engine_label?, topic, breakout, estimated_credits, estimated_credits_breakdown, pricing, estimated_minutes, balance_credits, enough_credits, auto_start, auto_start_under_credits, existing?: { document_id, url, created_at, title, mode }, next }`. `auto_start: true` (under 250 credits with enough balance) means start it without asking; `false` means quote the user and wait for a yes. `existing` is a report for the same niche and market under 30 days old, priced beside it (never with `if_exists: 'new'`, never for a breakout): offer it before quoting a new run. A start that runs returns `{ job_id, started: true, status: 'pending', mode, engine, topic, breakout, estimated_credits, estimated_credits_breakdown, price_credits, estimated_minutes, quick_read: { answer, citations } | null, balance_credits, ads_pull, next }`. `started: false` means nothing ran: `status: 'price_changed'` (the price moved past your `quoted_credits`; its own `auto_start` says whether to pass the new one right away and mention it, or quote it and wait for a yes) or `status: 'existing'` (below).

#### `start_niche_research` `{ topic, mode?, country, city?, vertical?, competitor_domains?, questions?, estimate_only? }`

The same run for a niche with no specific offer; identical returns.

Both start tools also take `if_exists` (`'ask'` default | `'new'`): a start (not an estimate) with a report for the same niche and market under 30 days old returns `{ status: 'existing', started: false, existing: { document_id, document_url, title, snapshot_date, mode, sources, quotes, angles[], breakouts: [{ document_id, title }] }, next }` and runs nothing; an `estimate_only` call still prices, with that report beside the price as `existing`. `'new'` runs (and estimates) without offering it.

#### `start_breakout_research` `{ parent_document_id, focus?: 'offer' | 'angle', offer?, angle?, mode?, questions?, estimate_only? }`

A focused child report of an existing report: `focus: 'offer'` with the offer text, or `focus: 'angle'` with one of the parent's angle titles (an unknown title errors and lists them). Inherits the parent's niche, market, keyword table and ad captures (no pulls, so cheaper), defaults to `mode: 'standard'`, files under the parent (`report.header.focus`, `parentDocumentId`). Returns like start_offer_research plus `breakout: { kind, label, parent_document_id }`.

#### `poll_offer_research` `{ job_id }`

Returns `{ job_id, status: 'pending' | 'completed' | 'failed', mode, report?, markdown?, document_id?, document_url?, evidence?: [{ id, title, kind, source_url, supports[] }], evidence_filed?, evidence_sources?, evidence_dropped?, evidence_dropped_reason?, citations_read?, provider_log?, credits_charged?, balance_credits?, error?, elapsed_minutes?, expected_minutes?, check_again_in_seconds?, next? }` (the last four while pending). `evidence` is the rows filed in Research → Evidence for this report (deduped, at most 120) and `evidence_filed` is always its length; `evidence_dropped` counts the candidates not filed, with why in `evidence_dropped_reason` (absent when none); `citations_read` is the deep run's citation rows they were drawn from. `provider_log` is `{ calls, errors, empty, skipped, breaker_skips, status_polls, log_omitted, internal_credits, charged_credits, internal_cost, unavailable?: [{ source, reason, since, next_probe_at?, note }], log: [{ provider, op, section, status, empty, charged, charged_credits, ms, internal_credits, error, http_status, detail, fallback }] }`: `calls` excludes status polls and skips (`calls + skipped = log.length + log_omitted`); `internal_credits` is what the calls cost granvl, never billed — inside a run `charged` is always false and `charged_credits` 0, the run's price is its only charge; `http_status` and `detail` (the provider's own message) explain a failed or skipped call, and `unavailable` names a source that was down or out of quota, its `note` saying how long it has been open and when it next probes ("…; open 18 h (since …), next probe in 27 min" — say so plainly; it is not a timeout). On completion the twelve-section report is already filed as a research document (`document_url`) with its evidence linked; `report` is the structured report (sections `executiveSummary`, `marketSnapshot`, `keywordOpportunity`, `competitors`, `paidAds`, `customerVoice`, `buyerJourney`, `objections`, `messagingAngles`, `compliance`, `gapsAndNextSteps`, `sources`; citations are `refs` into `sources.sources`) and `markdown` its readable projection. `report.paidAds.ads` lists the named competitors' own ads first (pulled by domain once the deep run named them; each card carries `competitorPass: true`, and `fallbacks_used` shows the section as a second pass), then the niche ads. Sections the run could not establish (no keyword data, no ads) say so (`available: false`) rather than guessing.

#### `save_research_evidence` `{ document_id?, items: [{ quote, source_url, platform?, finding?, context?, kind? }] }`

Returns `{ filed, already_had, evidence_ids, document_id }`. One evidence row per item, verbatim quote as body, finding + context as takeaways; idempotent on quote + URL. Free.

#### `deepen_offer_research` `{ job_id? | document_id? | offer, market?, sections?, max_credits? }`

`sections` may mix quote sections (`voice_of_customer`, `objections`, `competitors` — Sonar Pro pinned to Reddit / Trustpilot / Yelp / YouTube, ~2 credits each, only quotes not already in the report come back) and report sections (`more_competitors`, `more_objections`, `compliance` — one Sonar query each; `keywords`, `ads` — re-run granvl's own pulls; `ads` also asks for the report's named competitors' own ads by domain). Returns `{ offer, market, sections: [{ section, heading, added[], markdown, queries }], report_sections?: [{ section, added, notAdded, credits, note }], total_added, queries_run, skipped_for_budget, credits_charged, balance_credits, report_updated, added_to_report, kept_as_evidence_only, document_id, next }`. For a research report every addition lands in the report itself (versioned; a section past its cap keeps the extras as linked evidence and says so); for a foundation document append each quote section's `markdown` under its `heading` with update_research_section.

#### `campaign_preflight` `{ platform: google | meta | microsoft, landing_page_url, daily_budget_usd, campaign_name?, keywords?, negatives?, bid_strategy?, conversion_tracking_confirmed? }`

Returns `{ platform, campaign_name, daily_budget_usd, estimated_monthly_usd, cap_usd, cap_source, bid_strategy, landing_page, checks: [{ id, label, status: pass | warn | fail, detail }], overall: ready | ready_with_warnings | blocked, next }`. Read-only, free; loads the lander once. Renders as a checklist widget in MCP Apps hosts with a “Build it paused” button.

#### `research_keywords` `{ seeds?, country, city?, language?, landing_page_url?, competitor_domains?, limit?, offset?, estimate_only? }`

Returns `{ market, seeds, keywords: [{ keyword, searchVolume, cpc, competition, competitionIndex, lowTopOfPageBid, highTopOfPageBid, concepts? }], returned, offset, total_rows, with_search_volume, with_cpc, data_source, currency: 'USD', note, credits_charged, balance_credits, next }` — top 300 by volume (CPC-bearing first) unless `limit` / `offset`; rows with no volume omitted. `estimate_only: true` returns `{ estimated_credits, tasks, balance_credits }` and runs nothing. Costs a few credits.

#### `classify_keywords` `{ keywords, vertical?, brand_terms?, competitor_terms? }`

Returns `{ high, mid, low, competitor: [{ keyword, intent, reasons }], standard_negatives, message }`. Free, in-process.

#### `build_keyword_plan` `{ offer, keywords: [{ keyword, search_volume?, cpc?, low_top_of_page_bid?, high_top_of_page_bid?, competition? }], market?, vertical?, brand_terms?, competitor_terms?, save_document? }`

Same `plan` shape as plan_search_campaign, plus `research_document_id` when saved and `next`. Free. Plan shape: `themes: [{ name, service, system, keywords: [{ keyword, intent, matchType, searchVolume, cpc, … }], totalVolume, startingCpcUsd, avgCpcUsd, highTopOfPageUsd }]`, `negatives`, `dropped`, `competitorTerms`, `competitorTermsNotFound`, `structure`, `currency: 'USD'`, `cpcNote`. A theme is one service intent on one system (AC Repair, Furnace Installation…) with every spelling inside; past 8 themes the small ones fold into 'Other buying intent'. startingCpcUsd is the median LOW top-of-page bid (bottom of page one), under avgCpcUsd by design — raise toward highTopOfPageUsd when impression share is low.

#### `plan_search_campaign` `{ offer, country, city?, vertical?, language?, landing_page_url?, competitor_domains?, seeds?, brand_terms?, competitor_terms?, save_document?, estimate_only? }`

Returns `{ plan: { structure: 'stag' | 'campaign_per_theme', structureReason, themes: [{ name, totalVolume, startingCpcUsd, keywords: [{ keyword, matchType: 'EXACT' | 'PHRASE', searchVolume, cpc, intent, reasons }] }], negatives, dropped, competitorTerms, totals }, research_document_id, market, seeds, credits_charged, balance_credits, next }`. Costs a few credits; no confirmation.

#### `triage_search_terms` `{ account_id, campaign_id?, days?, vertical?, brand_terms?, competitor_terms? }`

Returns `{ keep, review, negatives_suggested: [{ searchTerm, costUsd, clicks, conversions, intent, reasons, suggested_match, why }], new_theme_candidates, message }`. Read-only.

#### `list_creative_formats` `{ category?, tone?, awareness?, previews?, limit? }`

**STATIC IMAGE ad formats only** — never present them as video templates (videos: `setup_video` / `list_video_styles`). Returns `{ total, formats: [{ slug, name, category, tones, awareness, default_aspect, summary, has_preview, preview_index }], note, next }` plus preview image blocks in `preview_index` order; `next` repeats the image-only routing, says how to handle the card's batch message and says the gallery card shows the previews (never embed their URLs as markdown images in chat). On the card the user can select up to 10 formats (the bar shows "N selected · ~… credits": `credits_per_image` in the card's data, one default-model 1K image) and tap **Generate N images**: one chat message, `Generate one image for each of these formats: <name> (<slug>), … — concept: "<text>"` (no concept clause when they left it empty — ask for one). Render one image per format — one concept, then `get_creative_format` → `compose_creative_brief` → `generate_image` for each — and summarise the set in one message; never ask to confirm each one. Free.

> **MCP Apps:** hosts that declare the `io.modelcontextprotocol/ui` extension (Claude, ChatGPT) render these tools as widgets from `structuredContent`, with inline image blocks omitted for them: `list_creative_formats` (gallery; select several and Generate N images, or Use this format for one), `generate_image` / `upload_image` / `generate_video` / `poll_video_generation` and `poll_video_render` / `list_video_runs` (the creative card — it polls a pending clip or a working run itself, then shows the image or a player), `setup_video` (template picker), `review_video_stills` (look check), `list_voices` / `list_music_tracks` / `list_caption_presets` (pickers), `create_variant` / `duplicate_variant` / `bulk_create_variants` / `get_variant` / `set_weights` (landing-page preview with weight sliders), `plan_search_campaign` / `build_keyword_plan` (keyword plan with switches), `research_competitor_ads` / `list_competitor_ads` (ad cards), `campaign_preflight` (checklist). Taps arrive as chat messages, except where the host lets a card call tools: the image card's Three variations / Try again (`generate_image` with the same model, brief and size, plus the user's note) and Approve (no tool — a note only), and the look check's Approve / Switch (`approve_video_stills`; the button names the cost, so the tap is the confirmation) run from the card and report through model context ("Image approved: …", "Generated 3 variations of …: …", "Regenerated … with note '…': …", "Stills approved for run … (about N more credits approved, max_credits M)", "Stills switched to '…' for run …", "Video run … completed: creative …"). The media is on the card: never repeat an image, preview or mp4 URL in chat. Other hosts get the text and image blocks.

#### `get_creative_format` `{ format }`

Returns `{ slug, name, category, brief, render_notes, tones, awareness, default_aspect, preview_url, next }` plus one preview image block. A static image format; `next` carries the same image-only routing and the no-markdown-image line. Free.

#### `compose_creative_brief` `{ format, offer, angle?, headline?, supporting_text?, audience?, facts?, brand_name?, brand_colors?, brand_voice?, aspect_ratio? , funnel_id?, domain_id?, use_product_images? }`

With product images on the brand kit (`funnel_id` → the funnel's domain kit, `domain_id`, or the active brand's), the prompt gains a PRODUCT section that makes the attached reference the truth for colour, label and shape, and the result carries `reference_asset_ids` — pass them to `generate_image`. Never describe the product's colour or label in `offer` / `angle` when a reference exists; the model follows words over photos.

Returns `{ prompt, aspect_ratio, format, on_image_text, render_here, render_elsewhere }`. Free, in-process.

#### `research_web` `{ query, model?, depth?, domains? }`

Search-grounded answer with citations. Returns `{ answer, citations: [{ url, title? }], model, region, credits_charged, balance_credits, redactions }`. `depth` ∈ low | medium | high. Default model `sonar-pro`.

#### `get_credits` `{}`

The AI pool is the one pool: generate_image / generate_video / the research tools draw from it too.

Credit balances in one read: `sms` (balance / used / granted — one credit per verified code), `validation.email` / `validation.phone` (monthly allowances: included, granted, used, remaining), `ai` (allowance, spent, remaining credits, `resetsAt`, `ok`). `pooledFromAgency: true` means a client workspace drawing on its agency's pool. Top-ups: dashboard → Settings → Billing.

#### `get_skill` `{ skill_id?, since_version?, include?, file? }`

The skill, in three sizes: default (`include: 'index'`) returns `SKILL.md` plus an `index` of `{ path, bytes }`; `file: '<path>'` returns one resource; `include: 'all'` returns every file body (for installing under your `installPaths` entry). `since_version` → `upToDate: true` with no bodies when nothing changed. Read-only; default `skill_id: 'granvl-app'`. Every answer also carries `toolsVersion`, a hash of the live tool set (tool names, argument schemas, annotations: it moves when a deploy adds a tool or changes its arguments). A tool documented here that your client does not list, outside the tiers below, means the host's copy of the tool list is stale: SKILL.md, "Keeping this skill current", says what to tell the user.

**Tool list size.** `tools/list` is tiered: the core tools always; the ad-platform build and live-read tools once the workspace has an ad account connected (or the MCP URL carries `?tools=all`); staff helpers for staff only. A tool you were not shown still works if you call it by name, so a missing tool is never a reason to stop — it is a reason to ask whether an ad account is connected.

**Lookups.** The main reads (`get_funnel`, `get_funnel_summary`, `get_funnel_stats`, `get_form_destinations`, `get_domain`, `get_brand_kit`, `get_domain_dns_records`) accept an id **or** an exact name (funnels) / hostname (domains); an ambiguous name comes back as an error listing the ids. Writes take ids only.

#### `get_activity_log` `{ limit? }`

Recent MCP tool calls. Useful for picking up where a previous Claude session left off.

#### `get_form_submissions_count` `{ funnel_id, range? }`

Count only (zero-PII guarantee). For destinations configured via `set_form_destination`, submissions go directly to the vendor and don't appear here — that's expected.

---

## Data model constraints

The pieces you interact with are Funnel → Page → Variant (with VariantVersion history and AnalyticsEvents), plus account-level Domains, per-funnel FormDestinations, and one LeadQualification / SessionJourney row per (session, funnel). Constraints that change how you call tools:

- **`Domain.domain`** is unique platform-wide. First user to claim wins. Verification (TXT + routing) is required before traffic flows.
- **`Page.slug`** is unique within its funnel only.
- **`AnalyticsEvent.variantId`** is required (never null) — every event ties to which variant served it.
- **`VariantVersion.htmlContent`** snapshots are immutable. Editing a variant always writes a new row, never overwrites.
- **`LeadQualification(sessionId, funnelId)`** is a unique pair. Webhook re-POSTs upsert, so replays are safe.
- **`SessionJourney(sessionId, funnelId)`** unique. Closed sessions (last event > 30 min ago) are frozen.

### Variant metadata

Every `create_variant` / `update_variant` should include:

| Field           | Vocabulary                                                                              |
| --------------- | --------------------------------------------------------------------------------------- |
| `headline_type` | `question`, `benefit`, `curiosity`, `urgency`, `social-proof`, `pain-point`             |
| `cta_type`      | `get-started`, `learn-more`, `get-quote`, `sign-up`, `buy-now`, `book-call`, `download` |
| `angle`         | `pain-point`, `aspiration`, `urgency`, `value`, `fomo`, `authority`, `savings`          |
| `page_style`    | `minimal`, `detailed`, `video`, `testimonial-heavy`, `comparison`, `quiz`               |

Use the same vocabulary across a single user's variants — analytics breakdowns group by exact string match. Document new values back to the user.

---

## Page type semantics

| Type        | What fires                                                                                                                                                                                                                                                                                                                                                                     | Best for                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `LANDING`   | Form-submit listener fires `CONVERSION + action=form_submit` on the source variant at submit time. Internal nav to next page fires `CLICK_THROUGH` (intra-funnel, NOT a conversion).                                                                                                                                                                                           | Main entry pages                                                                           |
| `QUIZ`      | Same as LANDING — form-submit listener fires `CONVERSION + action=form_submit` at the moment the form is submitted.                                                                                                                                                                                                                                                            | Multi-step assessments                                                                     |
| `THANK_YOU` | If the visitor arrives via the `_cv` redirect chain AND no client-side fire from the same visitor on the same funnel landed in the last 24h, fires `CONVERSION + action=form_submit + trigger=ty_page_fallback` on the SOURCE variant (deduped fallback). Outbound `data-pages-convert` clicks on TY itself fire `CONVERSION + action=click_through + trigger=outbound_click`. | Post-conversion confirmation + secondary CTAs (book a call, download)                      |
| `FORM`      | Same as QUIZ — multi-step variant of "form-handler" pages                                                                                                                                                                                                                                                                                                                      | Multi-step forms (financial application, quiz with branching)                              |
| `MAGNET`    | Nothing — MAGNET pages never count as a funnel step or a conversion, never get a form (validator warns `magnet_has_form`), and don't change click-through derivation.                                                                                                                                                                                                          | Post-conversion lead-magnet content (guide, checklist, video page) linked from the TY page |

**Critical: pages do NOT auto-convert on view.** Conversion attribution is `_cv`-driven (see [Runtime page-serving](#runtime-page-serving-behavior)). Old documentation that says "QUIZ/THANK_YOU auto-convert on view" is wrong — the source variant gets the conversion when the visitor arrives at the destination.

### Default 2-page funnel pattern

```
LANDING (form, _next → THANK_YOU)  →  THANK_YOU
        \____ CONVERSION fires here on visitor arrival ____/
```

The form on LANDING has `<input type="hidden" name="_next" value="{{THANK_YOU_URL}}">`. The serve route substitutes the actual thank-you URL at render time AND threads `_cv=<landingVariantId>` through the redirect so the LANDING source variant gets credit.

---

## Runtime page-serving behavior

When a visitor hits `/some-slug` on a custom domain pointed at Granvl:

1. **Variant routing.** Server picks one variant based on weights. A `pages_variant_<pageId>` cookie pins the choice for ~30 days (sticky).
2. **`_cv` attribution (deduped fallback).** If the URL has `?_cv=<sourceVariantId>` AND the destination is a THANK_YOU page, the source variant gets a `CONVERSION + conversionAction=form_submit + metadata.trigger=ty_page_fallback` event — but only if no client-side fire from the same visitor on the same funnel landed within 24h (24h dedup). For non-TY destinations, fires `CLICK_THROUGH` (intra-funnel navigation, NOT a conversion). Cross-funnel `_cv` is dropped.
3. **Visitor + session identity.** Two cookies set on every render: `gv_visitor` (60-day sliding, persistent identity) and `gv_session` (30-min sliding, per-visit). Cookie-blocked visitors fall back to a privacy-preserving, day-bounded fingerprint ID.
4. **Form rewrite + fan-out.** Depends on the funnel's `FormDestination` rows (a funnel can have several):
   - **None configured**: every `<form>` has its `action` and `method` stripped, replaced with `action="/api/form-submit" method="POST"`. Hidden inputs injected: `variantId`, `sessionId`. On LANDING/FORM pages, `_next={{THANK_YOU_URL}}` is auto-injected on the first form when missing. **The fallback endpoint does NOT persist field values — leads are LOST unless a destination is configured.**
   - **Native-POST destination** (Webhook / Formspree / Zapier / GHL Workflow Webhook): the `<form>` action is set to the vendor URL, static/cookie/page hidden fields baked in, `granville_lead_id` / `granville_variant_id` / `granville_funnel_id` stamped onto the form at submit (the lead's unique id, the A/B variant, the funnel) so the vendor can tell which variant produced each lead and echo `lead_id` back via the qualify webhook. Browser submits natively.
   - **Adapter destination** (HubSpot v3 JSON / ActiveCampaign JSONP / LeadProsper `direct_post`): Granvl bakes a small client-side adapter that intercepts submit, builds the vendor's payload shape, and posts directly from the visitor's browser. LeadProsper specifically uses a `mode:'no-cors'` keepalive POST (its `direct_post` returns JSON and isn't CORS-enabled), remapping inputs to the saved LeadProsper field names + attaching `lp_campaign_id`/`lp_supplier_id`/`lp_key`. The visible `<form>` stays normal.
   - **Multiple destinations**: the rendered form is wired to the first; a client-side **keepalive fan-out** mirrors each submission to the remaining destinations. Every destination receives the lead browser-side — Granvl is never in the data path for any of them.
   - **Phone formatting**: the phone field's value is reformatted to `Funnel.integrationPhoneFormat` (E.164 / 10-digit / `(650) 327-1100` / `650-327-1100`) before submit, for all destinations.
5. **Internal-link `_cv` injection.** All same-domain `<a href>` get `_cv=<variantId>` appended automatically — no need to write it yourself.
6. **Template substitution.** `{{THANK_YOU_URL}}` → the funnel's TY URL on the same domain.
7. **Tracking script.** A bootstrap `<script>` is injected before `</body>`. Exposes `window.pagesTrack(eventType, metadata?)`. Posts events to `/api/f` (a first-party path, so tracking is not lost to ad blockers). Captures scroll milestones (25/50/75/100%), Web Vitals (LCP/FCP/CLS/INP), bounce flag, server-side VIEW on first paint, **client-side form-submit listener** (fires `CONVERSION + action=form_submit` at submit time, before navigation, via `sendBeacon` so it survives the navigation), **outbound-click listener** (`CONVERSION + action=click_through` for `data-pages-convert` external links). The same-origin POST path is reachable from custom domains.
8. **GTM injection** (optional). If the domain has `googleTagManagerId` set, the GTM container is injected after `<head>`.
9. **CSP**: served landing pages do NOT carry the dashboard's strict nonce policy (that stricter policy applies only to the dashboard, never to customer pages). By default a served page gets no CSP header; when the domain opts into a CSP allowlist, the generated policy's `script-src` includes inline-script exceptions + script-evaluation exceptions (customer pixels paste inline scripts; GTM and the Tailwind play CDN eval) — the host allowlist is what does the constraining.

**What this means for you**: don't write any of the above yourself. Don't set form `action`/`method`, don't write the tracking script, don't add Tailwind tracking pixels, don't load GTM yourself, don't manually thread `_cv` on internal links.

---

## Form submission pipeline

**Zero-PII by design.** There is nowhere on Granvl's side that could ever hold form-submitted PII. Form CONTENT is never persisted on Granvl servers, regardless of which submission path is used.

`POST /api/form-submit` (the auto-rewritten form action when no external destination is configured) receives form-encoded data. Path:

1. Body capped at 1 MB (oversized → 413).
2. Rate-limited per `(ip, variantId)` — sub-buckets per variant.
3. **Honeypot check**: if any of `_gotcha`, `website`, `url`, `homepage`, `phone_number_2` is non-empty, server fakes success but does nothing.
4. Schema validation: max 50 fields, each value ≤ 10 KB.
5. Variant lookup → must exist and be `ACTIVE`. Inactive → `submitted: false`.
6. **Resolve identity** from `gv_visitor` / `gv_session` cookies (with cookie-blocked fingerprint fallback).
7. **Qualification eval**: if `Funnel.qualificationRule` is set, evaluate it against the submission data **in memory**, then upsert a `LeadQualification(source: RULE)` row with the qualified yes/no result. Non-fatal — failures here never block the submission.
8. **Persist a `FormSubmission` row** containing `visitorId / sessionId / variantId / funnelId / userAgent / referer / ipHash` — but NOT the field values. Audit-trail row only.
9. **Fire a `CONVERSION` event**: `type=CONVERSION + conversionAction=form_submit + metadata.trigger=server_form_submit`. This is the analytics signal that pairs with the FormSubmission audit row.
10. **Optional redirect** to `_next` URL if it matches the funnel's verified domain or `NEXT_PUBLIC_APP_URL`. URLs pointing elsewhere are silently dropped (event still fired; redirect suppressed). The `_cv` query param is auto-threaded.
11. Otherwise return `{ submitted: true }` JSON.

**Important consequence**: a funnel without a configured external form destination will fire conversion events correctly but the lead's contact info goes nowhere. Always recommend `set_form_destination` before the funnel goes live.

For vendor-destination forms (HubSpot/GHL/etc.), the visitor's browser POSTs directly to the vendor — Granvl is never in the data path. Every payload carries `granville_lead_id` (unique per submission — the same id the Lead capture tab shows), `granville_variant_id` and `granville_funnel_id`, so the vendor's automation knows which variant produced the lead and can echo `lead_id` back to `/api/qualify/{token}` when the lead converts downstream. The CONVERSION event fires client-side at submit time via the inlined `sendBeacon` listener, before navigation, so the analytics signal lands even though Granvl sees zero form content.

**HubSpot special case.** HubSpot's v3 integration endpoint requires a JSON body, not form-encoded — so for `provider: 'HUBSPOT'` we bake a small adapter into the served page that intercepts the form's `submit`, builds the `{ fields, context }` shape, threads `hubspotutk` from cookies + `pageUri`/`pageName` from `location` + `document.title`, and `fetch()`s HubSpot directly. You still author a BARE `<form>` (no `action`, no `method`) — the bake wires the adapter and the HubSpot endpoint; the adapter does the transformation client-side. On HubSpot rejection (typically a field-name mismatch — variant's `<input name>` doesn't match a HubSpot form's internal field name) the visitor sees the inline error and an audit row `form_destination.vendor_rejected` is written via `/api/audit/form-destination-failure` so the funnel owner can debug. The `CONVERSION` event fires regardless — intent ≠ vendor uptime.

**LeadProsper special case.** LeadProsper's `direct_post` endpoint returns JSON and isn't CORS-enabled, so it can't be the native form `action` (a native POST would navigate the visitor to raw JSON, and the response is unreadable cross-origin). For `provider: 'LEADPROSPER'` we bake an adapter that, on submit, remaps the visitor's inputs to the campaign's LeadProsper field names (the field map saved at setup), attaches the static `lp_campaign_id`/`lp_supplier_id`/`lp_key` creds, and fires a `mode:'no-cors'` keepalive POST to `direct_post`, then redirects to `_next`. Because the response is opaque we can't read LeadProsper's `ACCEPTED`/`DUPLICATED`/`ERROR` verdict client-side — the lead is still delivered and the `CONVERSION` event still fires (same posture as every vendor: intent ≠ vendor uptime). Setup lives in the dashboard (connect dev API key → pick campaign + supplier → map fields); the supplier `hash` is resolved into `lp_key` server-side. **Field names are case-sensitive; `FirstName` + `LastName` are required.** Phone is auto-formatted to `Funnel.integrationPhoneFormat` (LeadProsper rejects E.164 — default to a US format like `(650) 327-1100`).

---

## Conversion-tracking matrix

All conversions are `type=CONVERSION` rows with `conversionAction` set to `form_submit`, `click_through`, or `embedded_widget`. The `metadata.trigger` is forensic provenance only — never query on it.

| Visitor flow                                                                                            | Page type pattern                          | What fires (action / trigger)                                                                                                                                                                                                                       | What you write in HTML                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lead-gen form → thank-you                                                                               | LANDING + THANK_YOU                        | `CONVERSION + action=form_submit` on LANDING source variant. Fires client-side at submit (`trigger=client_listener`); TY-page chain re-fires (`trigger=ty_page_fallback`) and gets deduped against the listener fire                                | Form on LANDING with no action/method, hidden `_next={{THANK_YOU_URL}}`                                                                                                                                                                                                                        |
| Quiz funnel                                                                                             | LANDING + QUIZ + THANK_YOU                 | `CLICK_THROUGH` on LANDING when visitor goes to QUIZ (intra-funnel nav, NOT a conversion); `CONVERSION + action=form_submit` on QUIZ when the form is submitted                                                                                     | Form on QUIZ with `_next={{THANK_YOU_URL}}`                                                                                                                                                                                                                                                    |
| Multi-step form                                                                                         | LANDING + FORM + THANK_YOU                 | `CLICK_THROUGH` on each upstream nav; `CONVERSION + action=form_submit` on the page hosting the final form when submitted                                                                                                                           | Each form's `_next` points at the next step's URL                                                                                                                                                                                                                                              |
| Click-out to external                                                                                   | LANDING only                               | `CONVERSION + action=click_through + trigger=outbound_click` on the page where the click happened                                                                                                                                                   | `<a href="..." data-pages-convert>...</a>`                                                                                                                                                                                                                                                     |
| Single-page click-through funnel                                                                        | LANDING only (with `isClickThrough: true`) | The outbound click IS the conversion (`action=click_through`)                                                                                                                                                                                       | All external `<a>` are auto-tagged `data-pages-convert`. **Create with `create_funnel({ funnel_type: "click_through" })`** — that single arg sets `isClickThrough: true` AND skips the auto-generated thank-you page. Don't use `funnel_type: "standard"` then delete the thank-you afterward. |
| Post-conversion outbound on TY                                                                          | LANDING + THANK_YOU + outbound CTA         | `CONVERSION + action=form_submit` on LANDING (from the form-submit listener) AND a separate `CONVERSION + action=click_through + trigger=outbound_click` on THANK_YOU (post-arrival outbound). Action-keyed dedup keeps these as two distinct rows. | TY page with `<a href="..." data-pages-convert>`                                                                                                                                                                                                                                               |
| Booking inside an embedded widget (Calendly / Cal.com / HubSpot / Acuity / SavvyCal / TidyCal / custom) | Any page hosting the embed                 | `CONVERSION + action=embedded_widget + metadata.provider=<provider>` on the hosting page's variant, via the auto-injected postMessage listener. Only fires when the variant has `embedded_widget` set. Dedupes independently of the other actions.  | Embed the widget normally in the HTML; provide `embedded_widget` (+ `embedded_widget_config` for `custom`) on `create_variant` / `update_variant` — see PAGE-BUILDING §2c                                                                                                                      |
| Custom event (video, scroll)                                                                            | Any                                        | `window.pagesTrack('CUSTOM', { metadata })`                                                                                                                                                                                                         | Inline script                                                                                                                                                                                                                                                                                  |

Optional metadata on `data-pages-convert`:

```html
<a href="https://calendly.com/..." data-pages-convert data-pages-meta='{"plan":"pro","value":299}'
  >Book a call</a
>
```

---

## Lead qualification

Two paths populate `LeadQualification` rows. Whichever fires last wins.

**Re-submits and dedup (quality promotion).** Conversions dedup to one per visitor + funnel + action per 24h. If a visitor re-submits within that window with a BETTER qualification outcome (unqualified or unrated → qualified), the platform upgrades the original conversion's quality in place: no second conversion row, no ad-platform re-fire. Dashboards and stats reflect the corrected quality automatically. A later WORSE answer never downgrades a qualified conversion.

### Rule-based (synchronous, internal)

User defines `Funnel.qualificationRule` — JSON evaluated against form-submit data **in memory at submit time** (form values travel in the request body, the rule runs, the qualified yes/no result writes a `LeadQualification(source: RULE)` row, then the field values are discarded — zero-PII rule). Same eval runs server-side for `/api/form-submit` fallback submissions and client-side in the browser for external-CRM forms (where the values never leave the visitor's device).

The rule is a tree of groups. Each group has a combinator (`type: 'all'` = AND, `type: 'any'` = OR) plus `conditions` and/or `children` (other groups). A flat rule is the degenerate single-group case; nest for HubSpot-style mixed logic. Bounded at 5 levels deep.

```json
// Flat
{
  "type": "all",
  "conditions": [
    { "field": "role", "op": "equals", "value": "CEO" },
    { "field": "employees", "op": "gte", "value": 100 }
  ]
}

// Nested — (CEO AND big company) OR (SaaS AND budget)
{
  "type": "any",
  "children": [
    { "type": "all", "conditions": [
        { "field": "role", "op": "equals", "value": "CEO" },
        { "field": "employees", "op": "gte", "value": 100 } ]},
    { "type": "all", "conditions": [
        { "field": "industry", "op": "equals", "value": "SaaS" },
        { "field": "budget", "op": "gte", "value": 10000 } ]}
  ]
}
```

Operators: `equals`, `not_equals`, `contains`, `gte`, `lte`, `gt`, `lt`, `is_truthy`, `is_falsy`, `in`, `not_in`. Field names support dot notation (e.g. `address.country`).

### Webhook-back (asynchronous, external)

Every form submission carries `granville_lead_id` (plus `granville_variant_id` / `granville_funnel_id`). The user wires their CRM (or any deal-close automation) to POST back with `lead_id` (or the older `session_id`):

```
POST <the webhook URL from get_qualify_webhook_url>
Content-Type: application/json

{
  "lead_id": "8c1e…",            // granville_lead_id from the payload (or "session_id": "ses_abc123")
  "stage": "Appointment Booked",  // the CRM's OWN pipeline stage name, sent on every pipeline move
  "qualified": true,              // optional once `stage` is sent
  "value": 12000,
  "reason": "Closed-Won — Q4 enterprise plan"
}
```

`get_qualify_webhook_url({ domain_id })` returns the DOMAIN's own postback URL (one per client CRM, scoped to that domain's funnels, rotateable from Settings → Domains → Manage → CRM Quality); without `domain_id` it returns the workspace fallback URL for funnels with no domain — bound to this workspace and returned ONCE, on the call that creates it (later calls give `url: null`; the user rotates it from the dashboard). Never construct this URL by hand.

**Stages (post-submit outcomes).** Two quality signals live on a lead and the dashboard keeps them apart: **fit** (the `qualified` boolean — rule at submit, CRM, or manual) and **outcome** (the furthest CRM stage reached). The CRM sends its own pipeline stage NAME in `stage`; granvl maps it per **domain** to one of ten canonical stages — progress, in order: `CONTACTED → CONVERSATION → BOOKED → NO_SHOW → HELD → QUOTED → WON`; end states: `BAD_CONTACT`, `NOT_FIT`, `LOST`. Common names ("Appt Set", "Showed", "Closed Won", "No Show") map automatically; anything else lands **unmapped** and does not count until mapped — read the map with `get_domain → crm_stages` (unmapped = `stage: null, ignored: false`) and fix it with `set_domain_crm_stages(domain_id, entries: [{ raw_name, stage | ignored }])`, which also re-counts past leads. Stages only move forward (a later "Contacted" after "Booked" is kept in history but does not regress the lead; Won reopens a Lost deal). Conversation and beyond imply `qualified: true`; Bad contact / Not a fit imply `false`. A boolean-only post keeps working and never invents a stage.

### Stats integration

`get_funnel_stats` and `get_variant_stats` include `qualifiedConversions` + `qualifiedConvRatePct` per variant. The funnel's `statsDisplayMode` (`TOTAL | QUALIFIED | BOTH`) tells you which flavor the dashboard renders.

Each variant also carries `stages: { crmReported, fit, reached: { BOOKED, HELD, WON, LOST, … } }` (reached-or-beyond counts, exact for end states) and the funnel carries `stages: { hasCrmData, stagesSeen, leadingMetric, leadingMetricIsAuto, availableLeadingMetrics, totals }`. `leadingMetric` is what the funnel page calls "leading" — `CONVERSION` by default, `FIT` once a rule exists, `BOOKED` once CRM stages arrive, `WON` once a Won arrives, unless one was chosen explicitly (`update_funnel({ leading_metric })`, `null` = back to automatic). Per-lead outcomes: `list_session_journeys({ stage: 'BOOKED' | 'any' | 'none' })` — rows carry `stage`, `stageLabel`, `rawStage`, `stageAt`, `dealValue`, `outcomeReason`.

**When deciding winners**: compare variants on the funnel's `leadingMetric` and say which one you used — booked ÷ visitors beats fit ÷ visitors beats raw conversion rate, and never mix two in one sentence. Fit and outcome can disagree per variant: a high fit rate with a low booked rate means the **rule** is wrong, not the variant — point the user at the qualification rule. Unreported leads are not lost; `crmReported` is the coverage denominator.

---

## Variant version history

Every change to `Variant.htmlContent` writes a new `VariantVersion` row. The current `Variant.htmlContent` always equals the most-recent version. Each version captures:

- `htmlContent` — snapshot
- `source` — `AI_GENERATED | AI_EDITED | HUMAN_EDITED | IMPORTED | BACKFILL`
- `generationPrompt`, `generationModel`, `generationContext` — provenance shown in the version timeline
- `changeSummary` — one-liner of what changed
- `authorUserId`, `createdAt`

### Workflow when editing variants

```
User: "change the headline on Hero v3 to 'Free 30-day trial'"

1.  get_variant_html(variant_id)        ← read current state — DON'T regenerate
2.  Make the targeted change in your context
3.  update_variant({
      variant_id,
      html_content: <edited HTML>,
      change_summary: "Replaced headline with '30-day trial' offer"
    })
```

The new version row gets `source: AI_EDITED`. The `change_summary` shows up in the version timeline UI.

### Retrospective HTML lookup

`get_variant_html_at_time({ variant_id, timestamp })` returns the version that was live at `timestamp`. Use when investigating a specific session: "the visitor that converted on Tuesday — what HTML did they actually see?" Joins via the `SessionJourney.startedAt`.

---

## Session journeys + audience cohorts

An hourly background job materializes one `SessionJourney` row per `(sessionId, funnelId)`. Open sessions (last event < 30 min ago) get rebuilt; closed sessions freeze and never rewrite. The denormalized `funnelType` reflects the funnel's structure when _this_ visit happened.

Each row has the shape described under `list_session_journeys`. Read with `list_session_journeys`.

### Audience cohorts

`audienceCohort` is a derived label: `{device}_{trafficSource}` — e.g. `mobile_paid_meta`, `desktop_organic_search`, `tablet_direct`, `desktop_email`. Bots / AI agents / unknown devices return `null` (excluded from cohort comparisons).

### Cohort comparison

`get_cohort_comparison({ funnel_id })` pivots journeys into a cohort × variant grid. **Use this when validating a winner**: if Hero v3 beats Hero v1 in totals but loses to it on `mobile_paid_meta`, that's a Simpson's-paradox flip — DO NOT promote until cohort-level data resolves.

---

## Analytics — what's captured

Every `AnalyticsEvent` includes:

- **Identity** (privacy-safe): hashed IP (HMAC-SHA256), session ID, returning-visitor flag.
- **Page context**: full URL, path, title, scroll depth, time on page.
- **Device** (parsed from UA): mobile/tablet/desktop, browser name+version, OS name+version.
- **Traffic classification**: `human` / `ai_agent` / `crawler` / `social_preview` / `tool` (38-rule classifier).
- **Web Vitals**: LCP, FCP, CLS, INP (sent on unload).
- **Geo** (derived from request headers): country, region, city, timezone.
- **Referrer**: full URL, parsed domain, classification.
- **Attribution** (canonical UTMs): source, medium, campaign, content, term, ad-group, ad-id, campaign-id, placement, network. Auto-normalized from ~60 alias keys.
- **Click IDs**: gclid, fbclid, ttclid, msclkid, li_fat_id, gbraid/wbraid, twclid, rdt_cid, epik.
- **Raw query params**: captured in full for forensic re-derivation.
- **`schemaVersion`**: bumped when fields are added so future trainers can filter.
- **Conversion fields** (when `type=CONVERSION`): `conversionAction` (`'form_submit' | 'click_through' | 'embedded_widget'`) is the load-bearing attribute — query/group/dedup on this. `conversionQuality` (`'qualified' | 'unqualified' | null`) is populated by the qualification gate. `metadata.trigger` is forensic provenance only (`'client_listener' | 'ty_page_fallback' | 'outbound_click' | 'server_form_submit'`) and not load-bearing.
- **`CLICK_THROUGH` event type** (separate from `CONVERSION + action=click_through`): intra-funnel page navigation only — the visitor moved between pages of the funnel via an internal link. NOT a user-facing conversion.

Raw events stay the single source of truth. Aggregations live in `SessionJourney` (per-session denormalized) — there is no separate per-day rollup table.

---

## HTML templates

### Landing page (form-driven)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Save 40% on Insurance — Get a Quote</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-white text-zinc-900 antialiased">
    <header class="mx-auto max-w-xl px-6 pt-6"><!-- logo / nav — outside <main> --></header>
    <main class="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 class="text-4xl font-semibold tracking-tight md:text-5xl">
        Save 40% on insurance — without the calls.
      </h1>
      <p class="mt-4 text-lg text-zinc-600">Free quote in 60 seconds. No obligation.</p>
      <form class="mx-auto mt-10 flex max-w-sm flex-col gap-3">
        <input
          type="text"
          name="first_name"
          placeholder="First name"
          required
          class="rounded-lg border border-zinc-200 px-4 py-3"
        />
        <input
          type="text"
          name="last_name"
          placeholder="Last name"
          required
          class="rounded-lg border border-zinc-200 px-4 py-3"
        />
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          required
          aria-describedby="email-error"
          class="rounded-lg border border-zinc-200 px-4 py-3"
        />
        <span id="email-error" class="gv-error" role="alert" hidden></span>
        <!-- Consent — Pattern A (real legal URLs from get_funnel → legal;
             skip the checkbox entirely while they're null) -->
        <label class="gv-consent text-left text-sm text-zinc-600">
          <input type="checkbox" name="consent_privacy" required />
          <span>
            I agree to the
            <a href="{privacyPolicyUrl}" target="_blank" rel="noopener">Privacy Policy</a>
            and
            <a href="{termsOfServiceUrl}" target="_blank" rel="noopener">Terms</a>.
          </span>
        </label>
        <!-- Control fields (_next, _gotcha) — DIRECT children of <form> -->
        <input type="hidden" name="_next" value="{{THANK_YOU_URL}}" />
        <input
          type="text"
          name="_gotcha"
          style="position:absolute;left:-9999px"
          tabindex="-1"
          autocomplete="off"
        />
        <button
          type="submit"
          class="mt-2 rounded-lg bg-zinc-900 px-6 py-3 font-semibold text-white"
        >
          Get my free quote
        </button>
      </form>
      <!-- Plus the inline-validation snippet (see "Form-validation snippets"
           below) so required-field errors render inline, not as browser
           tooltips. -->
    </main>
    <footer class="mx-auto max-w-xl px-6 pb-6 text-center text-xs text-zinc-500">
      <!-- legal footer (privacy + terms) — outside <main>; see PAGE-BUILDING §5 -->
    </footer>
  </body>
</html>
```

### Thank-you page (with optional outbound CTA)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>You're set — we'll be in touch</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-zinc-50 text-zinc-900 antialiased">
    <main class="mx-auto max-w-md px-6 py-24 text-center">
      <h1 class="text-3xl font-semibold tracking-tight">You're all set!</h1>
      <p class="mt-3 text-zinc-600">Check your email — your quote arrives within 5 minutes.</p>
      <a
        href="https://calendly.com/your-handle/15min"
        data-pages-convert
        class="mt-8 inline-block rounded-lg bg-zinc-900 px-6 py-3 font-semibold text-white"
      >
        Book a 15-min call →
      </a>
    </main>
  </body>
</html>
```

The Calendly click fires a second CONVERSION on the THANK_YOU variant tagged `conversionAction: 'click_through'` (with `metadata.trigger: 'outbound_click'` for forensics) — surfaces as the page's "ClickThrus" metric. Action-keyed dedup keeps it as a distinct row from the form-submit conversion that landed earlier.

### Quiz page

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Find your fit — 30-second quiz</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-white text-zinc-900 antialiased">
    <main class="mx-auto max-w-lg px-6 py-12">
      <p class="text-sm font-medium text-zinc-500">Question 1 of 5</p>
      <h1 class="mt-2 text-2xl font-semibold">How many homes do you manage?</h1>
      <form class="mt-6 grid gap-2">
        <label class="rounded-lg border px-4 py-3">
          <input type="radio" name="size" value="1-3" class="mr-3" />1–3 properties
        </label>
        <label class="rounded-lg border px-4 py-3">
          <input type="radio" name="size" value="4-10" class="mr-3" />4–10 properties
        </label>
        <label class="rounded-lg border px-4 py-3">
          <input type="radio" name="size" value="10+" class="mr-3" />10+ properties
        </label>
        <input type="hidden" name="_next" value="{{THANK_YOU_URL}}" />
        <button
          type="submit"
          class="mt-4 rounded-lg bg-zinc-900 px-6 py-3 font-semibold text-white"
        >
          Continue →
        </button>
      </form>
    </main>
  </body>
</html>
```

### Click-out CTA (no form)

```html
<a
  href="https://calendly.com/your-handle/15min"
  data-pages-convert
  data-pages-meta='{"source":"strategy-cta"}'
  class="inline-block rounded-lg bg-zinc-900 px-6 py-3 font-semibold text-white"
>
  Find a time →
</a>
```

For this pattern, set `Funnel.conversionType` to `SCHEDULE` (via `update_funnel`) so server-side conversions tag correctly for ad platforms.

---

## Form-validation snippets

Copy-paste these into variants instead of hand-rolling. Skill §1b covers when to use each.

### Consent checkbox — privacy + terms (Pattern A)

Include when the form captures contact info AND the workspace's legal URLs exist — pull `privacyPolicyUrl` / `termsOfServiceUrl` from `get_funnel` → `legal`. URLs still null (first build / preview)? Skip the checkbox rather than linking placeholders; add it when the URLs land, before paid traffic.

```html
<label class="gv-consent">
  <input type="checkbox" name="consent_privacy" required />
  <span>
    I agree to the
    <a href="{privacyPolicyUrl}" target="_blank" rel="noopener">Privacy Policy</a>
    and
    <a href="{termsOfServiceUrl}" target="_blank" rel="noopener">Terms</a>.
  </span>
</label>
```

### Consent checkbox — TCPA SMS opt-in (Pattern B)

ONLY when phone is captured AND the customer plans to send marketing texts. Otherwise omit entirely — don't make it "optional".

```html
<label class="gv-consent">
  <input type="checkbox" name="consent_sms" required />
  <span>
    By providing my phone number I agree to receive marketing text messages from {businessLegalName}
    at the number provided. Message and data rates may apply. Reply STOP to opt out.
  </span>
</label>
```

### Inline validation — replaces the browser default tooltip

Drop this script and the `<span class="gv-error">` pattern on every field. Errors render inline next to the input (matching the variant's design) and clear when the user starts typing.

```html
<div class="gv-field">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" required aria-describedby="email-error" />
  <span id="email-error" class="gv-error" role="alert" hidden></span>
</div>

<!-- ...repeat per field, each with a matching id="X-error" span... -->

<script>
  // Inline validation — replaces the browser's default tooltip with an
  // inline error next to the field. Hooks into every required input on
  // the page; no per-field wiring needed.
  document
    .querySelectorAll('input[required], select[required], textarea[required]')
    .forEach((el) => {
      el.addEventListener('invalid', (e) => {
        e.preventDefault()
        const errorEl = document.getElementById(el.getAttribute('aria-describedby') ?? '')
        if (errorEl) {
          errorEl.textContent = el.validationMessage
          errorEl.hidden = false
        }
      })
      el.addEventListener('input', () => {
        const errorEl = document.getElementById(el.getAttribute('aria-describedby') ?? '')
        if (errorEl) errorEl.hidden = true
      })
    })
</script>
```

**CSS hook**: style `.gv-error` to match the variant (typical: small red text, `margin-top: 4px`). Style `.gv-field` for spacing. Style `.gv-consent` for the checkbox+label layout.

### Self-check checklist

- [ ] Submit empty → does NOT submit, errors render inline (not as browser tooltips)
- [ ] Consent unchecked → does NOT submit
- [ ] Tab through every required field → visible focus state
- [ ] Privacy / terms links → real URLs, open in new tab
- [ ] Every input has a `name` attribute
- [ ] DevTools Network → submission produces a 200 on `/api/f`

---

## Common pitfalls

### "My form's not submitting"

- Check the `<form>` has no `action` attribute. The auto-rewriter only handles standard tag shapes — leave `action`/`method` off entirely.
- Inactive variants reject submissions silently. Publish the funnel (`publish_funnel`) — publishing is what flips variants ACTIVE.

### "My thank-you page isn't being redirected to"

- Use `{{THANK_YOU_URL}}` template token, not a hardcoded URL. The form-submit endpoint validates `_next` against the funnel's verified domain — bad URLs are silently dropped.

### "Conversions aren't tracking"

- Pages don't auto-convert on view. The `_cv` attribution model needs:
  - Form submit: `_next={{THANK_YOU_URL}}` on the form.
  - Outbound click: `data-pages-convert` on the link.
  - Internal link between funnel pages: nothing — the serve route auto-threads `_cv`.
- The `data-pages-convert` attribute is case-sensitive in HTML (`data-Pages-Convert` won't work).

### "I edited the variant but the version timeline shows nothing"

- `update_variant` only writes a new `VariantVersion` row when `html_content` differs from the current value. If you re-saved identical HTML, no version is recorded.
- Provide `change_summary` to label the version (what changed and why, in one line).

### "Qualified rate is 0% but rule should match"

- Qualification rule eval is non-fatal — silent failures don't block submissions but also don't write rows. Check the rule with `get_qualification_rule(funnel_id)` and verify field names match the form's actual field names (case-sensitive).

### "Tailwind classes aren't applying"

- `<script src="https://cdn.tailwindcss.com"></script>` must be in `<head>`.
- The CDN build compiles classes in the browser at runtime; the landing-page CSP permits that.

### "Variant weights aren't taking effect"

- `pages_variant_<pageId>` cookie pins the visitor to their variant for ~30 days. Test in incognito.
- Variant must be `ACTIVE`. `DRAFT` and `PAUSED` get 0 traffic regardless of weight — `publish_funnel` is what activates; weight=0 is what pauses.

### "Pages cache for 60s"

- Edge cache + 5-min stale-while-revalidate. Wait, or test from a fresh URL with a cache-buster query param.

### "Forms work in preview but not on the live domain"

- Preview URLs bypass full validation. Live domain needs: variant `ACTIVE`, funnel has a verified `Domain` connected.

---

## Error catalog

When MCP tools fail, surface the error verbatim — the user often needs the literal validation message.

| Error message                                                                        | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Fix                                                                                                              |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Funnel not found`                                                                   | Wrong ID, or funnel belongs to another user                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `list_funnels`                                                                                                   |
| `Page not found`                                                                     | Page ID invalid OR not in the user's workspace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `get_funnel` for the right page_id                                                                               |
| `Variant not found`                                                                  | Variant ID invalid OR not in the user's workspace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `get_funnel`                                                                                                     |
| `Domain "X" is already registered`                                                   | Someone (or you, in another account) registered it first                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Different hostname                                                                                               |
| `Slug "X" already exists in this funnel`                                             | Page slug collision within a single funnel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Different slug                                                                                                   |
| `The URL "/X" is already used by another funnel ("Y") on this domain`                | Page slugs — the root `/` included — must be unique across all **live** funnels on the same domain (only a published, unarchived page claims its slug — unpublishing or archiving releases the URL). This is NOT a "one funnel per domain" rule — many funnels can share a domain, they just can't share slugs. Raised at the moment of the change (`create_page`, `update_page`, attaching a domain via `update_funnel`), not at publish. Also `Cannot connect this domain: "/X" (used by "Y") is already live on it` when attaching a domain. | Pick a different slug, move the conflicting page to a sub-path, or archive/unpublish the funnel holding the slug |
| `Weights must sum to 100 (got N)`                                                    | `set_weights` math is wrong                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Adjust weights                                                                                                   |
| `Must specify weights for all N variants`                                            | Partial weights update                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Provide every variant's weight                                                                                   |
| `Variant X does not belong to this page`                                             | Mixed page IDs in `set_weights`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Re-fetch with `get_funnel`                                                                                       |
| `confirmation_required: true` (not an error)                                         | First half of the two-step contract for deletes / publish / unpublish — nothing changed                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Show `summary`; after the user's yes, repeat with `confirmation_token`                                           |
| `token_rejected`                                                                     | Token expired (10 min), edited, or issued for different arguments / tool / workspace                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Re-confirm the fresh `summary` with the user and use the new token                                               |
| `Invalid rule shape: <reason>. Expected { type: 'all'\|'any', conditions: [{...}] }` | `set_qualification_rule` rule didn't parse — the reason names the exact path (e.g. `children[1].conditions[0].op="startsWith"`)                                                                                                                                                                                                                                                                                                                                                                                                                 | See [Lead qualification](#lead-qualification) for flat + nested shapes                                           |
| `Invalid ts format — expected ISO 8601`                                              | `get_variant_html_at_time` got bad timestamp                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Use ISO format e.g. `2026-05-04T11:55:00Z`                                                                       |
| `Invalid token` (qualify webhook)                                                    | Wrong `userToken` in the URL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Call `get_qualify_webhook_url` for the current URL                                                               |
| `Internal server error`                                                              | Caught at the top-level handler                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Retry once; if persistent, ask user to check `/dashboard/mcp`                                                    |
| `authorization required` / "granvl tools are unavailable" at client startup          | The client's stored sign-in for granvl is stale or predates the current auth setup. Not a granvl outage.                                                                                                                                                                                                                                                                                                                                                                                                                                        | Tell the user to sign in to granvl again from their client's MCP / connector settings, then start a new thread.  |
| Client reports the granvl server timed out at startup                                | A cold start plus the full tool list can exceed a tight client startup budget.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Retry; if the client exposes a startup-timeout setting, the user can raise it there.                             |

---

## Glossary

| Term                          | Meaning                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Sticky variant assignment** | `pages_variant_<pageId>` cookie pins the visitor to their variant for ~30 days. Prevents flicker.                                                                                                                        |
| **Preview token**             | 128-bit random token per variant; serves the variant's HTML without auth, for QA. In `previewUrl`.                                                                                                                       |
| **`{{THANK_YOU_URL}}`**       | Server-side template token. Substituted with the funnel's TY URL on the active domain.                                                                                                                                   |
| **`_cv` query param**         | Conversion-source-variant. Auto-threaded through internal links + form-submit redirects. The mechanism conversions attribute by.                                                                                         |
| **Honeypot**                  | Hidden form field bots fill but humans don't. Granvl checks `_gotcha`, `website`, `url`, `homepage`, `phone_number_2`.                                                                                                   |
| **Click ID**                  | Platform-specific ID added to ad URLs by the ad network (gclid, fbclid, etc.). Used for server-side attribution + CAPI matching.                                                                                         |
| **`granville_lead_id`**       | Stamped on every vendor-destination submission with `granville_variant_id` / `granville_funnel_id`: the lead's unique id (same as the Lead capture tab), the variant, the funnel. Echo `lead_id` to the qualify webhook. |
| **`ip_address`**              | The visitor's IP, stamped on every vendor-destination submission (fetched from `/api/ip` on the funnel's domain). Map it to LeadProsper's `ip_address` or any CRM field; never stored by granvl.                         |
| **Audience cohort**           | Derived label `{device}_{trafficSource}` — e.g. `mobile_paid_meta`, `desktop_organic_search`. Bots/agents are excluded (return `null`).                                                                                  |
| **AiActivity**                | The user-facing log of every successful MCP tool call. Surfaces in `/dashboard` "Claude Activity" panel.                                                                                                                 |
