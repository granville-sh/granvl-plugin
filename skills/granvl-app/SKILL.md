---
name: granvl-app
description: Build, deploy, A/B test, and optimize landing pages and paid campaigns on Granvl via MCP. Use before Granvl page, campaign, copy, research, or performance work so task-specific resources, warehouse boundaries, approval gates, and runtime conventions are loaded only when relevant.
---

# Granvl — App Skill

You are operating against an **AI-native landing page platform**. The user has connected you to Granvl via MCP. You can create funnels, add pages, draft variants, set traffic weights, build ad campaigns, and read performance data — without ever leaving the conversation.

**Read this skill before generating page HTML or calling any MCP tool.** The platform has specific runtime conventions: forms are auto-rewritten at serve time, tracking is auto-injected, certain template tokens are substituted server-side, and per-funnel tracking secrets (CAPI, GA4) are kept off the client. If you ignore these, the pages still serve but tracking, A/B routing, conversion attribution, or auto-optimization will silently break.

## Your tool list is tiered — a missing tool is a signal, not a dead end

`tools/list` does not show every tool. What you see depends on the workspace:

- **Core tools** (funnels, pages, variants, domains, brand kit, delivery, stats, learnings, workspace context, credits) — always listed.
- **Ad-platform tools** (`create_meta_campaign`, `create_google_search_campaign`, `create_microsoft_search_campaign`, `create_tiktok_campaign`, keyword / audience / location lookups, creatives, testing flows) — listed once the workspace has an ad account connected on the dashboard's Ads page, or when the MCP URL carries `?tools=all`.
- **Staff helpers** — staff only; you will never need them.

So: if the user asks for a Meta / Google / Microsoft / TikTok campaign and you do not see those tools, **do not say granvl can't do it**. Step zero is connecting the ad account (Settings → Ads, or the Ads page) — tell the user that, then reconnect / refresh the tool list. A tool you were not shown still runs if you call it by name, so calling `create_meta_campaign` on a workspace that just connected works even before the list refreshes. `get_ad_data_status` tells you which platforms are connected.

The skill itself is the same shape: `get_skill` returns SKILL.md plus an index of resource files; fetch a resource with `get_skill({ file: 'resources/META-ADS.md' })` the moment a task needs it.

---

## HARD RULE — MCP tools only. Never drive the dashboard UI.

**Never use computer use, browser automation, or GUI clicking to create, edit, configure, or delete ANYTHING in Granvl.** Not funnels, pages, variants, traffic weights, domains, form destinations, tracking settings, campaigns, API keys, or workspace settings — **every write goes through the Granvl MCP tools** (or the documented HTTP API with an API key). The dashboard is the _user's_ surface. Agent-driven clicks bypass the platform's validation, guardrails, HTML bake pipeline, and audit trail, and can silently corrupt state the tools would have protected.

- A task seems to need the UI? It doesn't — find the MCP tool (decision tree below, or `resources/REFERENCE.md`). If no tool exists for it, **say so and let the user do it in the dashboard themselves.** Never click it into existence.
- **Sole exception — explicit visual testing.** If the user _explicitly asks_ you to test or verify something in a browser ("run through the quiz with the browser", "check how it renders on mobile"), you may open pages, look, and submit _test_ data as instructed. Even then it is **read-and-test only**: never change a setting, never create or edit anything through the UI, and return to MCP for any fix the test reveals.

This file holds the rules that always apply. Task-specific depth lives in resource files, and reading the right one is a **required step**, not optional background:

- **Before generating or editing any variant HTML** → STOP and read [resources/PAGE-BUILDING.md](./resources/PAGE-BUILDING.md) (forms, quizzes, embeds, styling, brand kit, a11y, performance, legal footer, validator codes). Do not author page HTML from memory.
- **Before any Meta campaign work** → STOP and read [resources/META-ADS.md](./resources/META-ADS.md).
- **Before any Google Ads work (Search or Demand Gen)** → STOP and read [resources/GOOGLE-ADS.md](./resources/GOOGLE-ADS.md).
- **Before any Microsoft Ads work** → STOP and read [resources/MICROSOFT-ADS.md](./resources/MICROSOFT-ADS.md).
- **Before any TikTok Ads work** → STOP and read [resources/TIKTOK-ADS.md](./resources/TIKTOK-ADS.md).
- **Before any work for a Shopify / ecommerce customer** (pre-sell pages that click out to a store, store revenue / margin / attribution questions) → STOP and read [resources/SHOPIFY.md](./resources/SHOPIFY.md).
- **Before deep tool-arg / schema / error questions** → read [resources/REFERENCE.md](./resources/REFERENCE.md).
- **Before customer/ICP/offer research or writing copy** → read [resources/COPYWRITING.md](./resources/COPYWRITING.md). Use the bounded strategy/copy brief tools when available; preserve Product + ICP + Angle + CopyLine lineage.
- **Asked to delete or get rid of copy** → there is no delete: `update_copy_line` with `status: 'archived'` on each line. It leaves the Copywriting library (hidden by default, restorable from the Archived filter) and automatic tests stop using it; ads already running are not changed. Tell the user it left the library.
- **Before analyzing performance or proposing tests** → read [resources/OPTIMIZATION.md](./resources/OPTIMIZATION.md).
- **When the user EXPLICITLY asks for a dashboard / report / command center** → read [resources/DASHBOARDS.md](./resources/DASHBOARDS.md) and build it locally with the granvl dashboard kit (`resources/dashboard-kit/`) — never from scratch, never with a chart framework. Dashboards are strictly user-initiated: do NOT build one, or offer to build one, as a side effect of other work.
- **Before making a set of ad creatives** (static images, videos, a UGC script the advertiser films) → read [resources/CREATIVE.md](./resources/CREATIVE.md).
- **For golden-path conversation scripts** → read [resources/EXAMPLES.md](./resources/EXAMPLES.md).

---

## HARD RULE — irreversible actions need the user's yes, and the server checks

`delete_funnel`, `delete_page`, `delete_variant`, `delete_website_page`, `delete_lead_magnet`, `delete_form_destination`, `delete_campaign_hub`, `delete_campaign_draft`, `delete_research_document`, `delete_research_folder`, `publish_funnel`, `unpublish_funnel`, `publish_website` and `unpublish_website` are **two-step**:

1. Call the tool with its normal arguments. **Nothing changes.** The response is `{ confirmation_required: true, executed: false, action, summary, irreversible, details, confirmation_token, expires_at, next_step }` — `summary` says exactly what would happen (names, page/variant counts, live domain, whether it can be undone).
2. Show the user that `summary` and ask. **Only after the user explicitly says yes**, call the same tool again with **the same arguments** plus `confirmation_token`. The token is valid 10 minutes and only for this workspace, this tool and these exact arguments; a mismatched, expired or edited token returns a fresh preview (`token_rejected`) and changes nothing.

Never send a token the user did not approve, never reuse one for a different target, and drop it if they say no. `confirm: true` is deprecated and authorizes nothing.

## Confirming the skill is loaded (onboarding verification)

If the user asks you to confirm the skill is installed — e.g. **"Granvl: confirm the skill is installed"** — reply with a message that **begins with the exact phrase `Granvl skill ready`**, then one short line naming what you can now do (build, deploy, A/B test, and optimize landing pages via the Granvl MCP tools). That exact opening phrase is the signal the onboarding flow tells users to look for — it's how they know the skill actually loaded rather than just self-attesting a checkbox. Lead with it verbatim; don't embellish the opening phrase.

---

## Keeping this skill current — `get_skill`

If you got this skill through the granvl plugin, it updates with the plugin — nothing to do. The Granvl MCP also exposes **`get_skill`**, which returns the canonical bundle, for clients that keep their own copy:

- Optionally, at the start of a session, call `get_skill` with `since_version` set to the version you last saw. `upToDate: true` → you're current, carry on. By default the response is SKILL.md plus a file index; fetch a resource with `get_skill({ file: 'resources/PAGE-BUILDING.md' })` when a task needs it, or `include: 'all'` to install every file.
- Otherwise the response carries `version` and `files[]` (each `{ path, content }`). You can read the files straight from the response. If your client keeps a local copy, `installPaths` names the directory for your client (`claude`, `codex`, `other`); writing there is optional and never required to use granvl.
- It's read-only — `get_skill` never edits the server's skill.
- **The skill names a tool your tool list doesn't have?** Unless it is a tiered tool (the ad-platform tools before an ad account is connected, or a staff helper; see the top of this file), your host cached granvl's tool list when the connector was added and the list has changed since; `toolsVersion` in every `get_skill` answer names the live set. Tell the user once to refresh the granvl connector (claude.ai: Settings → Connectors → granvl → refresh, or remove and re-add it; ChatGPT: the granvl connector's settings), then keep working with the tools you have: say it once per conversation, never retry or loop on it.

---

## Tool list freshness

<!-- Maintainers: every PR that adds, renames or removes an MCP tool updates the date and the list below (public tools only: a tool listed only once ads or a store are connected would read as stale), then runs `pnpm build:plugin`. get_skill's `version` is a hash of these files, so the edit is the version bump. -->

Tools last changed: **2026-11-19**. Recently added (always listed):

- `update_domain_legal` (2026-11-18)
- `create_workspace` (2026-11-02)

Recently added with video (listed only where `setup_video` is; if `setup_video` is not in your list either, video is not on for this workspace yet and there is nothing to refresh):

- `create_ugc_presenters`, `create_ugc_video` (2026-11-19)

Changed the same day: `setup_video` takes `kind` / `brief` / `script`, `render_video` takes `redo_clip`, and `list_video_runs` / `poll_video_render` report the `clips` and `captions` statuses. The presenter brief of `create_ugc_presenters` and `setup_video` also takes `country` (an older tool list without it still works: the presenter is American). With an older tool list the setup card still asks Slideshow or UGC. Changed 2026-11-20: the brief also takes `look`, the photo style (`washed` Old phone, `natural` Everyday phone, `clean` New phone); an older tool list without it still works: a new presenter gets `washed`, the look as before. Its `motion` also takes `seated` (in a parked car, at a table); an older tool list offers only `walking` and `standing`. Also changed 2026-11-20: `setup_video` takes `template`, a UGC presenter template's id from the Ad templates page (`ugc-…`), and `picks.style_id` takes the same ids; an older tool list still works through `picks.style_id`.

On your first turn, alongside `get_workspace_context`, check these names against the tools you actually have. One missing means your connector loaded granvl's tool list before it shipped: tell the user once, in plain words, that granvl has new tools their connection hasn't loaded and ask them to refresh the granvl connector (claude.ai: Settings → Connectors → granvl → refresh, or remove and re-add it, then start a new chat; ChatGPT: the granvl connector's settings; Claude Code: restart the session). Then carry on with the tools you have: never block the task on it, and don't repeat it in the same conversation. If the request needs the missing tool itself, say this action needs the refresh and offer the dashboard path meanwhile (legal links: Settings → Domains → Manage → About).

---

## START HERE — get your bearings every session

**Before anything else — building, editing, advising — call `get_workspace_context`.** It returns the workspace's `granvl.md`: a CLAUDE.md-style memory file (business type, brands/domains in play, audience, voice, accumulated CRO learnings). Read it, follow it, keep it current with `update_workspace_context` (whole-file replace: read, modify, write the complete doc back). When it comes back `empty`, run the intake below and save the result before building (no workspace at all → the first case below). Then call `list_funnels`, and `get_brand_kit` for the domain you're about to touch.\*\* Together they tell you what's already live and what this customer looks and sounds like. Building without reading them is how a generic page happens.

Same first turn: the **Tool list freshness** check above, once per conversation.

Brand specifics — colors, fonts, logo, voice — live in the **brand kit**, per domain. Durable CRO findings live in **learnings** (`save_learning` / `list_learnings`), per funnel. Those two are your memory between sessions; keep them fed.

### No workspace yet → create it from here, then carry on

If any tool answers **"No workspace yet"** — the user's first contact with granvl is you, so `get_workspace_context`, `list_funnels` and `list_workspaces` come back empty with that `next` — ask one line: _"What's the business called, and its website if it has one?"_ Then call `create_workspace({ name, website_url?, business_type? })` (`business_type`: `agency` | `business` | `solo`, when they've said). It becomes the active workspace for this connection, so go straight on to the intake below and the first page. Never send them to the dashboard to make one.

- Call it only on that answer. With a workspace already active it returns that one (`created: false`) and creates nothing; `allow_additional: true` is for an agency adding a client.
- It does not extract a brand kit from the website: use the site in the intake (name, voice, look) and fill the brand kit once there's a domain.
- Refused on API-key connections (a key is bound to one workspace).

### Fresh workspace → run the intake ("grill me")

When `list_funnels` returns nothing, **don't silently proceed with a generic build.** Pause and ask a tight intake set, in one or two turns — not an interrogation:

1. **What kind of operation is this?** — an **agency** (multiple brands across multiple domains), a **single business**, or a **solo founder/creator**?
2. **Name + one-liner** — what's the business called, and what does it do?
3. **Industry / vertical** and **who you're selling to**.
4. **Voice / tone** — three words is plenty ("modern, trustworthy, premium").
5. **Primary goal** for most pages — leads, sales, signups, bookings?

Compose a clean `granvl.md` from the answers and save it with `update_workspace_context`; put brand colors, fonts, logo and voice into the domain's brand kit via `update_brand_kit`. Append durable learnings to `granvl.md` over time — it is read at the start of every session.

### Brand-new workspace → build a first page immediately (don't just talk)

When it's a **fresh workspace** — `list_funnels` returns nothing — the user is almost certainly sitting on the onboarding **"build"** screen waiting to see something real. After the tight intake, **build and ship one simple page so they get the "it's live" moment in seconds.**

Sequence — keep it fast, one of each, minimal back-and-forth:

1. `create_funnel` (`funnel_type: "standard"`) — name it after their business/offer; set `platform` from what they told you (omit if unknown). This auto-bootstraps a `LANDING` and a `THANK_YOU` page — grab the **LANDING** page's `id` from the response (no `create_page` needed).
2. `create_variant` on that LANDING page — one clean, on-brand hero: headline + subhead + a single primary CTA + one supporting section. If a brand kit exists (`get_brand_kit`), pull its colors/fonts — one extracted from the user's website (Settings → Brand kits) carries `sourceUrl` and `screenshots[]` for look-and-feel; otherwise take the look from their site or use tasteful defaults. Keep it genuinely simple — a strong first draft, not a finished site.
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

## Marketing capabilities — generation and research on granvl credits

granvl can run image generation, video generation, and cited web research for the workspace, billed in **Tool credits** — the workspace's one pool for everything the agent runs through granvl (provider price plus a small margin, charged only on success). Always talk about costs in credits; never translate credits into dollars or cents. This is so the user has one bill instead of seven API accounts. Rules:

- **`list_capabilities` first.** It returns the models this workspace may use (its region settings hide some), each model's region and rough price, and the balance. Pick from that list; a model that isn't there is not allowed here.
- **Cards show the media — never paste a media URL in chat.** On hosts with MCP Apps (Claude, ChatGPT), generated images, the format gallery, the video setup picker, the stills review and finished videos show on their cards. Never embed an image, preview, asset or mp4 URL as a markdown image (chat hosts render a broken placeholder), and don't paste the mp4 as a link either: name it (asset id, `creative_id`) and link the asset library (`asset_library_url`) if needed.
- **Widgets in Claude and ChatGPT (MCP Apps).** Many results render as cards: images and raw clips (`generate_image`, `upload_image`, `generate_video`, `poll_video_generation`) and storyboard runs (`poll_video_render`, `list_video_runs`) on the creative card; the format gallery; the video setup picker, the stills review and the voice / music / caption pickers; landing-page previews with weight sliders and a change box; keyword plans with switches and “Build with these”; competitor ad cards with “Borrow this angle”; the campaign pre-flight checklist. Where the host lets a card call tools, some buttons **act** and tell you through model context: the image card's Three variations (three `generate_image` calls, “Generated 3 variations of …: …”), Try again (“Regenerated … with note '…': …”) and Approve (a note only, “Image approved: …”), and the look check's Approve / Switch (`approve_video_stills`, then the card polls the render: “Stills approved for run … (about N more credits approved, max_credits M)”, “Stills switched to '…' for run …”, “Video run … completed: creative …”). Treat those notes as done work: don't redo the call, use the ids they name, and summarise the result in a sentence. Every other tap — and an acting button on a host that can't run the call — arrives as a chat message (“Video setup: …”, “Use voice …”, “Set traffic weights on page …”, “Pre-flight approved …”): act on it as the user's instruction. The format gallery's **Generate N images** is one such message (“Generate one image for each of these formats: Notes app (notes-app), … — concept: "…"”): render one image per named format — one concept (ask if none was given), then get_creative_format → compose_creative_brief → generate_image for each — and summarise the set in one message, never asking to confirm each one.
- **Confirm big spends.** A call estimated over 20 credits — a large image, the rest of a video at `approve_video_stills`, a `render_video` whose look is already approved — returns `needs_confirmation` with `estimated_credits`. Tell the user the number, get a yes, call again with `confirm: true` (for a video, plus `max_credits: suggested_max_credits`). A card button that names the cost (the image card's yes, the look check's **Approve · ~N credits**) is that yes. The look-check stills and a look switch are drawn without asking (≤ ~30 credits). Cheap research runs without asking.
- **Say the cost.** Every result carries `credits_charged` and `balance_credits`; mention them when the user asks or when a balance is running low. The user-facing name is **Tool credits** — one pool for generation, research and hosted AI; the full history is at Settings → AI / MCP → Credit history. If a call fails with `code: 'insufficient_credits'` ("This workspace is out of tool credits: it needs about N more…"), relay that sentence as it is (it says how many and where: Dashboard → Settings → Billing, or the agency's owner for a client workspace) — never retry in a loop. "granvl can't make this right now" (`code: 'temporarily_unavailable'`) is granvl's side, not the user's credits: say so plainly, nothing was charged, try again later; never tell them to add credits for it.
- **When a spend is refused, stop and explain.** The spend guard can refuse with: "Your role in this workspace cannot spend credits" (only owners, admins and members can — ask an admin), "faster than allowed" (a burst limit; wait a few minutes), "daily allowance of … calls" or "daily capability spending limit" (a per-workspace ceiling that resets as earlier spend ages out; an owner can ask support to raise it). Relay the message, do not retry in a loop, and do not route around it with a different tool or model.
- **Content rules (Terms §7):** no real person's likeness or voice without their documented consent, nothing involving minors, no deceptive endorsements or impersonation, no political campaign material. Don't strip watermarks or content credentials. Disclose AI-generated content where the platform requires it.
- **Regions.** Every model shows where it is served (US; Singapore for Seedance). All regions are on by default; a workspace owner can turn one off in Settings → AI / MCP, after which its models disappear from list_capabilities. Never work around a region refusal by picking the same model elsewhere.

### Images and static ad creative

- **Two image models: nano-banana-2.1 (the default — `model` is optional) and gpt-image-2 (when the user asks for ChatGPT's image model). No others**; any other id is rejected.
- **`generate_image`** `{ brief, model?, reference_asset_ids?, use_product_images?, aspect_ratio?, resolution?, funnel_id? }` (the brand kit's product images are attached as references by default — set them once with `update_brand_kit` `product_image_asset_ids`) → a workspace asset (id + CDN URL) you can drop into variant HTML or push as an ad creative. **Only the brief, your chosen reference assets, and the settings reach the provider** — nothing from the workspace rides along, so put everything the image needs in the brief (brand colours, product, style). Contact details and credential links are stripped.
- **Where images get rendered depends on your host.** If you are ChatGPT or Codex (an OpenAI client), you have your own image generation: render the composed prompt with it, then `upload_image` the result so it lives in the workspace — do NOT spend granvl credits on `generate_image`. If you are Claude, Grok, or any client without native image generation, render with `generate_image` on granvl credits. Either way the brief comes from `compose_creative_brief` first, and the uploaded or generated asset shows in the creative-review card. Video is granvl on every host (below).
- **Ad creative starts from the library.** For any static image ad (never a video — these are not video templates): `list_creative_formats` (on MCP Apps hosts a gallery card — the user selects up to 10 formats and taps **Generate N images**, one chat message naming them and maybe a concept: an instruction to render one image per format without confirming each, as above; or opens one and taps “Use this format”, a message naming just it; other hosts get the previews inline. Either way ask the user which ones they like, or pick 3–5 that fit the offer's awareness level and the brand's tone; it pages 20 at a time and `by_category` says what else exists — filter by `category` Awareness | Conversion | Punch & Mockup or `awareness`, and page with `offset`, before saying the library lacks something), `get_creative_format` for the full brief, write the concept yourself (angle, exact headline, supporting line, only verified facts), then `compose_creative_brief` → one render-ready prompt. Render it with `generate_image` on granvl credits, or with your own image tool and `upload_image` the file. Vary angles AND formats across a set; never ten versions of one idea.
- **A set starts from concept cards; read [resources/CREATIVE.md](./resources/CREATIVE.md) first.** One card per concept (angle, hook type, awareness, format and aspect, exact on-image text, verified facts, category notes, name), shown to the user before any credits are spent. Before a render becomes a creative, check it: the words match, nothing invented (phone numbers, URLs, handles, licence numbers, seals, badges, star ratings), the wordmark and product match the brand kit, the aspect fits the placement (4:5 for Meta feeds, 9:16 for Stories and Reels). Then upload it under its conventional name (see "Naming") with `angle_id` / `icp_id`.

### Video

- **Routing — read this before any video request.** "video" / "video ad" / "make some videos" / "explainer" / "video templates" / "show me the templates" (for a video) → **`setup_video` first**, then the storyboard flow below. `list_creative_formats` is the STATIC IMAGE ad library and Seedance / Veo are clip models, not templates: never present either as a video template, and never quote a raw clip's price as the cost of a video ad. `generate_video` only when the user explicitly wants one raw clip.
- **The storyboard flow** — a 30–75s "faceless" explainer ad: one illustrated still per spoken line, slow push-in, word-timed captions with a highlighted keyword, stat cards, end card. Never build one by prompting `generate_video` clip by clip.
  1. **`setup_video`** — the template picker card: four templates, each a look + narrator + music bed + caption style. The user picks one, taps **Use template** and walks the short stepper (look → voice → music → captions → review) with the template's picks pre-selected; **Continue** sends one chat message: "Video setup: Clay look, Square size (aspect: 1:1), Brian narrating, Inspiring Piano music, Yellow block caps captions. Ready for the script." Map the names to ids from the result (`templates[].id`, `voices[].voice_id` + `model`, `music[].id`, `caption_presets[].id`), then go straight to the script questions (subject, offer, audience, numbers) — never re-ask the look, size, voice, music or captions. Size is chosen on the setup card (1:1 default; 9:16, 4:5); pass it as `aspect` (a size the user already named goes in as `picks.aspect`). Skip it only when the user already named a look and a voice; `list_video_styles`, `list_voices`, `list_music_tracks` and `list_caption_presets` then cover whatever is left. Save the narrator to granvl.md.
  2. **`create_video_storyboard`** with those picks (`style_id`, `aspect`, `voice`, `music_track_id`, `caption_preset`) and the script as beats: hook as a question or pain → specifics with numbers in `overlay` → reframe → CTA beat; `pause` after the hook; recurring characters described once in `characters` (for the same people in every still, generate one character sheet with `generate_image` and pass it as `character_asset_ids`); 1–3 hero beats `motion: 'animate'` for real motion (a full Seedance clip, ~128 credits each; falls back to the still). It returns `estimated_credits` (one still plus a 1-credit critic review per beat, the motion clips, the voice, the render) and `suggested_max_credits` (the estimate + 15%). Nothing is generated yet.
  3. **`render_video { run_id, max_credits: suggested_max_credits }`** — don't ask first. It draws the first three stills for the look check (≤ ~30 credits, returned as `look_check_credits` — mention it if useful), and **every run** then waits in `status: 'review'` (if it comes back still drawing, poll `poll_video_render` until `review`). Pass `suggested_max_credits`, never the bare estimate: `max_credits` caps the whole run, and a normal provider overrun would stop it mid-way. The balance must cover the whole run before the first still.
  4. **`review_video_stills { run_id }`** — the look check and the one cost question. The card shows the stills with **Approve · ~N credits** (N = the rest of the video) and **Change the look** (**Switch · ~N credits** redraws the new look's first stills without asking, then checks again). The tap is the user's confirmation: the card calls `approve_video_stills` itself and shows the progress. Without the card, tell the user the remaining cost and, on a yes, call `approve_video_stills { run_id, approve: true, confirm: true, max_credits: suggested_max_credits }` (a switch: `approve: false, style_id`).
  5. **Hand-off — the server finishes it.** From the approval on, the rest of the video (the remaining stills three at a time, motion, voice, the render) is made on the server in the background, whether or not the chat stays open. Tell the user it takes a few minutes and that they can close the chat; **don't keep polling** — after the approval `poll_video_render` is a read that only reports progress. Up to 3 videos per workspace are made at once, so the user can start the next video right away; a 4th comes back `queued` (`queued_behind` = how many are ahead) and starts on its own. A paused run (a rate limit) resumes on its own after a short limit; `render_video` resumes it now. A paused or queued run needs no polling at all (the server and the card handle it), and every `poll_video_render` call renders another card. **Other videos are using the credits:** the workspace's credits are held for the videos already being made, so a new one that does not fit beside them is refused before anything is spent (`code: 'insufficient_credits'`, the sentence names what the others will use: wait for them, or add credits), and a run that runs short part-way comes back `paused.code: 'insufficient_credits'` with its finished work kept; `render_video` resumes it after the top-up. **`paused.unavailable: true`** is granvl's own side (not the user's credits, presenter or script): the run resumes on its own and nothing is charged for the failed attempts; say exactly that and never tell the user to add credits. To stop a paused run instead, `delete_video_run` (confirm=true) stops and deletes it, charging nothing more and keeping what was already made. When the user comes back (or asks), call `poll_video_render` once: on MCP Apps hosts it renders on the creative card — progress while it works, then a player with **Download**, **Use as ad creative**, **Make a variant** and **Change a beat**. Say it's ready and name the `creative_id` — the mp4 is in the creative bucket for `attach_creatives_to_campaign` / `add_creatives_to_testing_flow`.
- **Variants and edits are cheap.** `create_video_variant` (a new hook in beat 1, CTA, style or caption preset) reuses every unchanged still and voice clip — three hooks on one body cost one body plus three hooks; `update_video_beat` fixes one beat and re-renders only what it touches; `render_video { caption_preset }` on a finished run re-renders with render credits only (`list_caption_presets { run_id }` animates the five styles on the video's own first line). Beat edits and same-look variants keep the look approval (a new `style_id` gets its own look check), so their `render_video` has no review pause and confirms the remaining cost itself: above 20 credits it returns `needs_confirmation` — ask, then call again with `confirm: true` and `max_credits: suggested_max_credits`. `skip_look_check: true` does the same for re-rendering a look the user already approved; never on a new look. Stills pass a vision critic and are redrawn when they show text or broken anatomy.
- **ChatGPT / Codex (native image generation): don't spend granvl credits on the stills.** `create_video_storyboard` returns `still_prompts` (the exact prompt per beat); render each with your own image model at the storyboard's aspect, `upload_image` it, attach the ids with `update_video_beat { still_asset_id }`, then `render_video` — only the critic review, the voice and the render use credits.
- **One raw clip: `generate_video`** `{ model, brief, first_frame_asset_id?, reference_asset_ids?, duration_seconds?, aspect_ratio?, resolution?, audio?, funnel_id? }` → a `job_id` — only when the user explicitly wants a single Seedance / Veo shot (no narration, captions, music or template look). Poll **`poll_video_generation`** `{ job_id }` every ~20 seconds until `status` is `completed` (the card polls it too; the clip is charged once, on completion — a failed or expired job is free). Tell the user it takes a minute or three.
- **UGC or a talking-head video: a generated presenter.** granvl makes UGC presenter ads: a generated, fictional person talks to camera in a phone-selfie video with captions (9:16; one or more clips joined with plain jump cuts). Open **`setup_video { kind: 'ugc', brief, script }`** with a draft presenter that fits the offer (an ordinary, made-up person: age and look, clothes, where they are, what they do while talking, what is heard around them, their voice in words) and a draft script; the card walks presenter → three candidates → framing, script and captions → one cost confirmation → the video, and makes the calls itself. Without the card: `create_ugc_presenters` (three candidates under one confirmation, then `action: 'pick'`; `action: 'far'` for the waist-up framing) → `create_ugc_video` (spends nothing; returns the split and the estimate) → `render_video { run_id }` (asks once for the cost; then `confirm: true` and `max_credits: suggested_max_credits`) → made in the background → `poll_video_render` later. A saved presenter (on the card, or `create_ugc_presenters { action: 'list' }`) skips straight to the video.
  - **Templates:** the Ad templates page has four UGC presenter templates, in this order: `ugc-driveway-wide` (UGC · driveway, wide), `ugc-truck` (UGC · in the truck), `ugc-job-site` (UGC · job site), `ugc-kitchen` (UGC · kitchen). A prompt copied from the page names one: open `setup_video { picks: { style_id: '<id>' } }` (or `template: '<id>'`) and follow its `next`. The draft is a starting point, not the user's ad: ask what they sell, then fit the presenter and the script to their business (`setup_video` again with the same id plus your brief fields and script). When the user wants UGC but has no clear idea yet, offer one of the four.
  - **Photo style (`look`):** saved with the presenter, so its candidates, its far photo and every clip share it. `washed` (Old phone: grainy, soft, a little washed out) is the default and what every presenter made before the styles has; `natural` (Everyday phone) is grainy and soft with natural colour; `clean` (New phone) is grainy and soft with bright, rich colour. Leave `look` out (a template's draft carries its own) unless the user asks for another style or picks one on the card; another style for a saved presenter means new candidates.
  - **Seated:** `motion: 'seated'` for a presenter sitting down: in a parked car or truck, at a table. In a vehicle, name it in `place` ("in the driver's seat of his parked pickup truck") so the clips get the closed-car sound; seated anywhere else sounds like the room or the street around them.
  - **Far framing (waist up):** make the far photo first. The card offers it on the Video step; without the card, `create_ugc_presenters { action: 'far', presenter_id }`, then `create_ugc_video { framing: 'far' }`.
  - **Country and accent:** the presenter is American and in the United States by default. Set the brief's `country` ("the United Kingdom", "Canada", "Australia") when the user names a country or market, or when the script or business points to one (£ or A$, "colour", place names, the workspace context), and write the matching accent into `voice` (American by default, British for the United Kingdom); the photos' streets, houses and vehicles follow the country.
  - **Guardrails (the tools enforce them):** the person is always generated: there is no way to use a photo, URL or file of a person, never describe a real or famous person or who they look or sound like, and there is no voice sample or cloning. No first-person results or testimonials ("I saved $400", "changed my life") and no expert poses ("as a doctor", "I'm a licensed adviser"): the presenter talks to the viewer about the offer ("you just answer a few questions…"), never as a customer, an expert or a named person at the business. Tell the user once that the person is generated and that they turn on the ad platform's AI label when they launch it.
  - **The script:** the user's own, or your draft for them to edit; length comes from the script (no length setting; `create_ugc_video` says the limits and refuses with one plain sentence to show the user). Write it the way people talk: contractions, short sentences, numbers as words ("fifteen years"), "Honestly," as a lead-in, one clip's worth per group of sentences, the call to action last.
  - **After:** a clip that comes out wrong (refused, a sentence left out, a number or the last line said differently) is made again once automatically; if one still does not work the ad is made from the others and `ugc.dropped` names it: say so plainly. Small wording changes are fine and the captions follow what was said. `render_video { run_id, redo_clip: n }` makes one clip again (asks for its cost); `render_video { run_id, caption_preset }` changes the captions (`list_caption_presets { run_id }` shows the UGC styles). When the user wants their own people on camera, the film-it-yourself kit is still the way (CREATIVE.md section 10). With a shell and files (Claude Code, Cowork, Codex), a finished ad can also be trimmed or joined on the user's machine when these options are not enough: [CREATIVE.md](./resources/CREATIVE.md) section 11.
  - **When the video service is down:** the run is not failed. It comes back with `paused.outage: true` and keeps its status; every clip already made is kept and nothing is charged for the failed attempts. It tries again on its own (every few minutes at first, for up to about an hour and a half) and finishes when the service is back. Tell the user exactly that, in those plain words: it is the video service, not their presenter or script. Don't start a new run and don't make a new presenter; `render_video { run_id }` tries again now if they ask. If it still fails after that, the error says the service was down: tell them to try again later (`render_video` on the failed run keeps the clips that worked). **A line the service will not make** is different: while the service is making other clips it tries that line again a minute and a half later, three times in all, then leaves it out (`ugc.dropped` names it, `ugc.declined: true`; a one-clip run fails with "The video service would not make this line after three tries, although it was making other videos…"). The service is working: never tell the user it is down. Offer to try again first, since that often works (`render_video { run_id }` on the failed run, or `render_video { run_id, redo_clip: n }` on a finished one). If it keeps happening, offer a reworded line that says the same thing more plainly (it sometimes declines lines about loans, insurance or other regulated offers) and make a new run with `create_ugc_video`, the same presenter and the reworded script. Nothing is charged for the failed tries.
- **Say numbers in words.** A beat's `line` is read and captioned exactly: the figure goes in `overlay`, the words in `line` ("That is about twelve hundred dollars a year."), and phone numbers go on the end card. Video lengths and raw-clip briefs: CREATIVE.md sections 4 to 6.

### Research and campaign planning

- **`research_web`** `{ query, model?, depth? }` → an answer with source URLs. Use it for competitor offers, pricing, audience language, regulation. Save what matters into a research document; results are for this workspace, never bulk-exported or republished raw.
- **Competitor ads and landers.** `list_competitor_ads` first (free — what the workspace already has). Then `research_competitor_ads` — `query` with the service ('ac repair', 'hvac replacement') for 'what ads are running for X' and for format / angle research (every advertiser, the default; national, US-oriented, English-language ads — there is no location filter, so search the service, never the city; call with `estimate_only: true` first and tell the user it costs up to that), `brand` / `domain` only when the user names a competitor — returns what they are running longest-first with each ad's landing page and thumbnails inline, and SAVES every ad to Research → Ads. It is charged per result, never per call: only ads new to the workspace (or collected live) cost credits — ads it already saved are free, so `credits_charged` can be less than the estimate or 0, and `why` says which ("all 10 were already saved…"); say the actual charge, not the estimate. Right after, tell the user you are filing insights, then file your own wording of each ad's **offer** and **hook** plus an angle with `save_competitor_insights` (use each ad's `saved_id`; re-word, never paste their copy — that is what the user sees on the cards). `research_landing_page` tears down any page with a screenshot (1 credit when web extraction reads it, 4 with a browser render; `estimate_only` first says which); pass `ad_id` so the teardown attaches to the saved ad. Use all of this inside deep research and whenever the user names a competitor. Media stays on the provider's URLs.
- **Research first; small runs start themselves.** When the user wants a campaign for an offer, or asks to research a niche, and the workspace has no approved research document for it (check `list_research_documents` → `get_research_document`, free), call `start_offer_research` (an offer) or `start_niche_research` (a niche with no specific offer) with `estimate_only: true` (free, starts nothing) to get the credits, the minutes and `auto_start`. If `existing` came back, offer it first (the three paths under **Already researched?** below). Otherwise read `auto_start`: when `true` (under 250 credits — $2.50 — with the balance to cover it), start right away — call it again without estimate_only, passing `quoted_credits` — and tell the user in one line: "Running deep research on this now — about M minutes, N credits — buyer psychology, their words from reviews and Reddit, competitors, keyword demand, the ads running, objections." When `false` (250 credits or more, or not enough credits), ask instead: "I can run deep research on this first — buyer psychology, their exact words from reviews and Reddit, competitors, keyword demand, the ads running, objections — it takes about M minutes and N credits. Want me to?" and start only on a yes. A `price_changed` reply carries its own `auto_start`: `true` → call again with the new `quoted_credits` and mention the new price; `false` → quote it and wait. An `engine: 'fallback'` estimate still gets its one-line "this is a fallback report" heads-up — information, not a question. (`mode: 'standard'` is the cheaper, shallower run when they want a quick read.) Once it starts (it returns `started: true` and the `job_id`; show the `quick_read` immediately), `poll_offer_research` about every 2 minutes (each pending reply says how long it has run and when to check again). Every run comes back as the same twelve-section research report — executive summary, market snapshot, keyword opportunity, competitors & offers, paid ads & landing pages, customer voice, buyer journey, objections, messaging angles, compliance, gaps & next steps, sources — and it is FILED for you: the completed poll carries `document_id` / `document_url`, the structured `report`, and every cited quote and source is already an evidence row linked to it. Do not create a document yourself; open the link, summarise the executive summary in three sentences, and if `report.customerVoice.quotes` is thin (fewer than ~8) run `deepen_offer_research { job_id }` right away — Sonar Pro pinned to Reddit / Trustpilot / Yelp / YouTube, 10–15 credits, no confirm — which adds the new quotes to the report itself. Same tool when the user asks for more voice, objections or competitor detail later. **Already researched?** If a report for the niche and market is under 30 days old, the `estimate_only` call returns it beside the price as `existing: { document_id, url, created_at, title, mode }` (a start returns it as `status: 'existing'` instead of running) — offer it before the price, as three paths (never a second niche run): use it (`get_research_document`), go deeper in place (`deepen_offer_research { document_id, sections }` with `more_competitors`, `more_objections`, `compliance`, `keywords`, `ads` or the quote sections — each grows its section of the same report), or break out (`start_breakout_research { parent_document_id, focus: 'offer' | 'angle', offer | angle }` — a focused child report under the parent that reuses its keyword table and ads, standard mode, a few minutes). Only on an explicit "start over" pass `if_exists: 'new'`. On no, or when the user brought their own docs, build from what you have. The campaign build itself stays modular: strategy brief, copy, creatives, campaign tools — pull in whichever parts fit. When the report lands, read `coverage` in the result: a `thin` or `fair` level means the floors (10 quotes, 3 competitors, 15 evidence sources) were not all met even after the automatic passes — say so and offer `deepen_offer_research`. If your host has a browser pane, call `get_research_document { format: 'html' }`, write it to a local .html file and open it there so the user reads the full report formatted.
- **Pick the entry point, don't force the kickoff.** The Search workflow is also available in parts: `research_keywords` (numbers only), `classify_keywords` (intent on any list, free), `build_keyword_plan` (themes + negatives + structure from rows you already have, free). If the user brought a keyword list, classify or build from it; if they only want data, research; if they are starting from nothing, run the full plan.
- **`plan_search_campaign`** `{ offer, country, city?, vertical?, landing_page_url?, competitor_domains?, … }` is THE way to do Google Search keyword work when it is available: one call returns buying-intent themes (one service intent on one system — AC Repair, Furnace Installation — spellings inside) with exact + phrase keywords, a starting CPC per theme (the median low top-of-page bid, deliberately under the average CPC; raise on low impression share), day-one negatives, the campaign structure, and a saved research document. Call it with `estimate_only: true` first when the user asks what it costs. Build from its `next` instruction — and if the Google campaign tools are not in your list, Google Ads is not connected: say so and hand over the document, never improvise around it. Numbers are USD from Google Ads data. Then **`triage_search_terms`** `{ account_id, days? }` on a schedule (every 3 days) sorts the live search-term report into keep / review / suggested negatives — show the suggestions, never add negatives without the user's OK. If these tools are not in your list, fall back to the GOOGLE-ADS.md research recipe.
- **Pre-flight before any build.** After the plan and before create_google_search_campaign / create_meta_campaign / create_microsoft_search_campaign, call `campaign_preflight` { platform, landing_page_url, daily_budget_usd, keywords, negatives, bid_strategy, conversion_tracking_confirmed }. Show the checklist; build only on the user's go-ahead; fix failures first, never build around them.

Credits: `get_credits` answers "how many credits do I have" (SMS verification, email / phone validation allowances, the AI pool and when it resets). Top-ups are on the dashboard Billing page.

---

## TL;DR — Mental model

| Concept               | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Funnel**            | A campaign container. One funnel ≈ one ad campaign or one product offer. Optionally connected to a domain, with a conversion type, an optional qualification rule, and one or more pages. **Many funnels can share one domain** — they're disambiguated by page slug, which must be unique across all funnels on that domain. That includes the root slug `'/'` — one live funnel owns a domain's root at a time. To swap the live root page, archive or unpublish the old funnel first (a released slug is free to claim); a `/` still live on the domain is refused at create/rename/attach time. |
| **Page**              | A URL path inside a funnel. Type is `LANDING`, `QUIZ`, `THANK_YOU`, `FORM`, or `MAGNET` (post-conversion lead-magnet content — see Lead magnets below). Conversions fire client-side **at the moment of the action** (form submit / converting click), not on TY-page arrival — the `_cv`-redirect chain is a deduped fallback. `CLICK_THROUGH` events are intra-funnel page navigation only (not user-facing conversions).                                                                                                                                                                         |
| **Variant**           | One HTML version of a page. Multiple variants per page = A/B test. Each has a `weight` (0–100) and traffic-routing is server-side and sticky.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **VariantVersion**    | Every change to `htmlContent` writes a snapshot row with provenance (`AI_GENERATED` / `AI_EDITED` / `HUMAN_EDITED` / `IMPORTED`) + the prompt that produced it. Read past versions with `list_variant_versions`.                                                                                                                                                                                                                                                                                                                                                                                    |
| **Domain**            | A custom hostname (e.g. `quote.example.com`). Account-level — a funnel connects to at most one domain, but a single domain can host multiple funnels (each funnel's pages live at distinct slugs).                                                                                                                                                                                                                                                                                                                                                                                                  |
| **AnalyticsEvent**    | Every visit, conversion, scroll milestone, bounce, web vital, and bot hit. Auto-enriched with geo, device, UTMs, click IDs, traffic type, visitor identity. CONVERSION rows carry structured `conversionAction` (`'form_submit' \| 'click_through'`) and `conversionQuality` (`'qualified' \| 'unqualified' \| null`).                                                                                                                                                                                                                                                                              |
| **LeadQualification** | One row per `(sessionId, funnelId)` saying whether the lead was qualified — by rule (form-submit match), by webhook (CRM deal-close echo), or manual flip. Closes the {variant, audience, outcome} loop with downstream quality data.                                                                                                                                                                                                                                                                                                                                                               |
| **SessionJourney**    | One materialized row per session per funnel — funnel structure at the time of visit, the path taken, audience features, outcome, qualification, deal value. Read with `list_session_journeys`.                                                                                                                                                                                                                                                                                                                                                                                                      |
| **AiActivity**        | Audit feed of every successful tool call you make. Surfaces in the user's dashboard "Claude Activity" panel — narrate well.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

---

## Ad accounts — sync, Tracking Health, spend questions

Granvl is the **persistent warehouse for the user's historical ad-account data**. Data arrives through Granvl-managed syncs:

1. The user connects Meta or Google Ads on the dashboard's Ads page.
2. Granvl syncs campaigns, spend, creatives, and search evidence server-side into the warehouse.
3. Agents answer historical performance, optimization, and analytics questions only from Granvl reads. If a read is empty, stale, or failed, call the data-status tool and report its exact reason and remedy. **Never fall back to a live platform read or agent ETL for history.**

Live platform connections remain available for an explicitly approved CREATE workflow: account identity, pixels, conversion actions, interest/audience lookup, Keyword Planner discovery, and campaign writes under the one-switch status rule. These calls are rate-limited and purpose-bounded; they are not a way around missing warehouse history.

Note on **Campaigns** (the granvl grouping hubs that link funnels + ad campaigns into one view): `create_campaign_hub` / `update_campaign_hub` build and link them (see REFERENCE.md "Campaign hubs"); the dashboard's `/dashboard/campaigns` shows them. Offer a hub after a build, never create one unasked. Folders are a different thing: see "File a brand's assets" below for filing everything you build.

### Sync and action boundary

- If history is unavailable, surface the connection/sync reason and send the user to the Ads connection or sync remedy returned by Granvl. Do not import history yourself.
- Campaign creation and updates go through Granvl's guarded tools only. They enforce tenant scope, API quotas, budget limits, and the one-switch status rule. When a guardrail refuses a request, relay the limit to the user; do not look for another way to make the same change.
- When building pages/links, follow the workspace UTM convention (`utm_source`, `utm_campaign`, `utm_adgroup` at minimum) so the warehouse can join spend to first-party outcomes.

### Answering spend + optimization questions

The decision tree below routes each question to its tool. Universal habits:

- **Always relay freshness, per account** on spend answers. `get_spend_summary` returns `accountFreshness[]` (one entry per connected ad account) and `freshnessCaveat`: when it is not null, say it in your own words before quoting totals (name the account and the day its spend stops) and offer Sync now on that platform's Ads page. `state: 'no_recent_spend'` means the account synced recently and simply spent nothing (paused campaigns): say that, never call it broken. `staleHours` is the newest sync of anything, so one fresh account can hide a stale one; don't rely on it alone. `get_ad_data_status` carries the same per-account fields and reads `PARTIALLY_STALE` when some accounts are behind. Rows with `joined: false` mean broken tracking → point at `get_tracking_health`. `mode='recognized'` also recovers UTM-stripped clicks by matching the ad's destination URL to the granvl page it hits.
- **Start sessions with `list_optimization_actions` and/or `get_daily_brief`** and lead with what changed: "overnight I paused Variant A and shipped two fresh variants; C is leading at 4.1%". This is how the user _sees_ the product working — don't leave it silent.
- **Call `get_research_history` before proposing or generating any new variant/experiment.** It returns `wins` (repeat these), `avoid` (never re-test these), and `inconclusive`, with structured `changeType` / `metric` / `lift` capture. Never burn a test on a known loser.
- **Record what tests teach with `save_learning`** — capture the experiment, not just the verdict: `change_type`, `change_summary`, `metric` + `baseline_value`→`result_value`, `hypothesis`. Log losers and inconclusives too.

---

## Paid ads — universal invariants (all platforms)

granvl can build ad campaigns on Meta, Google (Search + Demand Gen), Microsoft (Bing) and TikTok directly from the conversation. The platform tools appear in your list once an ad account is connected (see "Your tool list is tiered" above) — if they are missing, connecting the account is step zero. These invariants hold on EVERY platform (server-enforced — don't fight them):

- **One switch, always — the status rule (server-decided, 2026-11-09).** There is exactly ONE paused switch above anything granvl creates, and granvl never enables anything inside something that is or has been live:
  - **A new campaign is always created PAUSED.** It is the switch.
  - **An ad set / ad group created inside a campaign that is new and off** (paused right now, created by granvl, never delivered) is created **ACTIVE** (Google ENABLED, Microsoft Active), and so are the ads and keywords inside it. The human flips only the campaign to go live.
  - **An ad set / ad group created inside any other campaign** (live, has ever delivered — even if paused now — not created by granvl, or anything granvl cannot read) is created **PAUSED** and becomes the switch; the ads and keywords you then create inside it go in **ACTIVE** behind it.
  - **An ad or keyword added to an existing ad set / ad group** that is not provably new and off is created **PAUSED**.
  - The server decides from what it reads at creation time (the platform's live status, granvl's own creation record, delivery history); no argument can ask for ACTIVE, and any check that fails or cannot be read means PAUSED. Every create result carries `status` / `ad_status`, `status_reason` and `status_decision` (`off_switch` = the switch to flip) — relay them, and close every build by telling the user exactly which switch to flip and where.
  - **TikTok is the exception: every level is created PAUSED** (campaign, ad group and ad, each read back from TikTok and paused again if TikTok lists it otherwise). There is no one-switch rule there, so the user switches on the campaign, its ad group and its ads in TikTok Ads Manager; every TikTok create result says so in `go_live`.
  - There is still **no tool that activates, enables or unpauses anything**. You may pause; going live is always the human's action in the platform's own ads manager. The auto-test engine and the dashboard's Meta launcher still create everything paused.
- **Names follow one convention** (see "Naming" below): campaigns `Title_Case_With_Underscores`, everything else `lowercase_with_underscores`, never an em or en dash. The server turns an em or en dash in a name into a hyphen on the way in, writes the name otherwise as passed, never renames what already exists, and flags a campaign / ad set / ad group / ad name that is off the convention with `naming_note`.
- **Budget guardrail:** daily budgets (and bids) are capped at min(the workspace admin's cap, granvl's **$200/day** platform ceiling) before any write. An over-cap request returns the cap in the error — relay it, NEVER work around it.
- **Budget raises are capped at 20% per change** (platform ceiling; an account's guardrail can only be lower), and every raise is a proposal a workspace member approves — you never apply one. Scaling a winner is a series of ≤20% steps, each approved; a bigger jump is the user's to make in the platform's Ads Manager. Do not split one raise into several proposals to get around it.
- **Plain URLs, never pre-tagged:** granvl applies each platform's UTM template automatically so spend joins first-party conversions. Every destination URL you provide stays plain.
- **Pages before ads:** final URLs on granvl domains must be LIVE — publish first.
- **BROAD match keywords require `allow_broad_match: true`** — set only after the user explicitly chooses broad despite your warning.
- **Max Conversions bidding requires `confirm_conversion_tracking: true`** — set only after the USER confirms conversion tracking is wired (Google: GA4-imported conversion action; Microsoft: a UET goal with volume). Never set it unprompted.
- **Restricted ad categories (all platforms).** Every build carries an `ad_category`: CREDIT_LENDING, BANKING_INVESTING, INSURANCE, HEALTH_INSURANCE, DEBT_RELIEF, HOUSING, EMPLOYMENT, HEALTH, ADDICTION_TREATMENT, POLITICAL, GAMBLING, ALCOHOL, DATING, LOCAL_SERVICES_VERIFIED (locksmith, garage door) or NONE. **You classify the offer and declare it; granvl does not run its own AI classifier.**
  - **Decide it before the first campaign build for an offer.** Read the offer research, the product and the live landing page, then pick what the advertiser sells (not words in passing: "no credit card required" on a software page is NONE): credit and lending, mortgages and financed or leased solar included → CREDIT_LENDING; banking and investing → BANKING_INVESTING; insurance → INSURANCE; health insurance, Medicare and ACA included → HEALTH_INSURANCE; debt relief, credit repair included → DEBT_RELIEF; housing, cash-offer home buying and rentals included → HOUSING; employment and recruiting → EMPLOYMENT; health (clinics, med spa, weight loss, telehealth) → HEALTH; addiction treatment → ADDICTION_TREATMENT; political → POLITICAL; gambling → GAMBLING; alcohol → ALCOHOL; dating → DATING; locksmith or garage door → LOCAL_SERVICES_VERIFIED; anything else → NONE. When unsure between two, pick the stricter. Tell the user the pick and the reason in one line ("Declaring HOUSING: the page buys houses for cash.").
  - **Pass `ad_category` on every campaign create** (`create_meta_campaign`, `create_google_search_campaign`, `create_google_demand_gen_campaign`, `create_microsoft_search_campaign`, `create_tiktok_campaign`), NONE included. On TikTok it is recorded, but granvl holds no verified TikTok category rules yet, so it limits nothing there and the result says so. The schema leaves it optional, the server does not: it is inherited only when the ad account's brand or the funnel of `landing_page_url` already declares one (`ad_category.inherited_from` says so). Undeclared, the build is refused before anything is created once enforcement is on; today it goes ahead with `ad_category.declared: false` and the same text as a warning. Then offer to save it on the funnel (`update_funnel` with `ad_category`; `create_funnel` takes it too) so later builds inherit it. Ad sets, ad groups, ads and audiences read the campaign's stored category and don't need it.
  - **The keyword cross-check only tightens.** granvl checks the landing page, the research, the product, your keywords and ad copy against a word list (free, no model). A declared NONE on a page that plainly says "mortgage" builds as CREDIT_LENDING, and `ad_category.warnings` / `ad_category.detection` show the evidence. You can't pass a looser value to get around it; if the check is wrong, tell the user a workspace Owner or Admin can dismiss it in granvl's dashboard, and don't rewrite the page or the copy to dodge it. The platform makes the final call.
  - On Meta it becomes `special_ad_category` (pass `ad_category` and leave `special_ad_category` out; if you pass both they must agree). On Google and Microsoft it limits targeting:
  - **Housing, employment, credit, banking, debt relief:** no age, gender, parental or marital targeting and no ZIP codes (Canadian FSAs like M5J are fine on Google; `search_google_locations` / `search_microsoft_locations` mark postal results with `restricted_for`). Microsoft also restricts insurance this way and bans income targeting for financial and insurance ads.
  - **Insurance and health insurance on Google:** age and gender targeting stay available (Google doesn't name insurance), but the category is sensitive: be aware of it and keep the targeting justified by the offer.
  - **Debt relief, health, addiction, gambling, alcohol** are sensitive-interest categories on Google: Customer Match, remarketing lists, lookalikes and optimized targeting aren't supported and Demand Gen may not serve. Lists and lookalikes are the customer's to build in their own account; granvl attaches what exists, relays the platform's own answer if it refuses, and never uploads lists.
  - **Refused:** political ads on Google and Microsoft; credit repair on Google; bail bonds and third-party tech support; US debt relief on Google unless an Owner or Admin confirmed non-profit credit counselling status; debt-relief and addiction lead generation on Microsoft.
  - **Certification categories** (Google US health insurance, LegitScript addiction treatment, Google locksmith / garage door verification, gambling, dating) return `attestations_needed`: tell the user a workspace Owner or Admin confirms it in granvl, at Settings → Compliance. You can't confirm it.
  - You may tighten a category but never loosen one (a looser value is ignored with a warning); the user sets a brand's or funnel's category in its Ad category setting, and only an Owner or Admin can loosen one or dismiss a detected one there. Every result carries `ad_category { value, source, restrictions, warnings, attestations_needed, detection }` (campaign creates add `declared` and `inherited_from`): read the warnings to the user. The Google and Microsoft ad tools also return `copy_warnings` (a copy review for the platform and the category, plus the landing-page disclosures for credit and lending): read them to the user and fix the copy where they apply; the ad is built either way. While the roll-out switch is on warn, would-be refusals come back as warnings starting "Not enforced yet"; treat them as refusals. When granvl refuses, relay the reason and don't look for another route. This is not legal advice, and the platform makes the final call.
  - On a Meta special-ad-category campaign Meta fixes the audience, and granvl refuses any adjustment before writing: no location exclusions (target provinces / states with `region_keys` instead), age stays 18–65+, gender `all`, no `interest_ids`.
- **Microsoft limits:** negative keywords are PHRASE/EXACT only; country targeting currently US / CA / GB / AU only.
- **After a guarded platform write,** rely on Granvl's audited write path and next warehouse sync. Do not manually re-record the entity.

Per-platform playbooks and build flows are a **required read** — before creating anything on a platform, STOP and read the matching resource; do not proceed from memory:

- **Meta (Facebook / Instagram)** — Guided Campaign Build (campaign → ad set → ad), creatives, CTAs, copy rotation, Advantage+ enhancements, special ad categories → **read [resources/META-ADS.md](./resources/META-ADS.md) first.**
- **Google Search + Demand Gen** — STAG / SANG playbooks, bidding recipes, keyword research, audiences, the weekly negatives loop → **read [resources/GOOGLE-ADS.md](./resources/GOOGLE-ADS.md) first.**
- **Microsoft Ads (Bing) Search** — Google's sibling with cheaper clicks; UET tracking; platform differences → **read [resources/MICROSOFT-ADS.md](./resources/MICROSOFT-ADS.md) first.**
- **TikTok** — video-first, creative-led; every level created paused; plain landing URLs; library videos only → **read [resources/TIKTOK-ADS.md](./resources/TIKTOK-ADS.md) first.**

---

## Decision tree — which MCP tool, when

```
User intent                              → Tool sequence
──────────────────────────────────────────────────────────
(start of EVERY session, before anything)→ list_funnels            (what's live — see "START HERE")
A tool says "No workspace yet"            → create_workspace        (ask the business name; becomes active)
"Which workspace am I in?" / agency with → list_workspaces         (every workspace + which is active)
several client workspaces                  switch_workspace        (by id or name; scopes every later call)
                                           get_brand_kit           (who they are, per domain)
                                           # no funnels? run the intake, then build

"Remember this about our brand"           → update_brand_kit        (colors, fonts, logo, voice)
"Note that <CRO learning>"                 save_learning            (per funnel; read with list_learnings)

"Build my website" / "brand site"         → create_website        (one per brand; roster of fixed roles)
"Add an About page to the site"            create_website_page  (role: HOME|SERVICES|ABOUT|CONTACT|EXTRA|PRIVACY|TERMS;
                                           [read resources/PAGE-BUILDING.md]  put {{SITE_HEADER}} / {{SITE_FOOTER}} in the HTML)
"Change the site header / colors / menu"   set_website_layout   (shared by every page; {{SITE_CTA}} = main button)
"Make the site button go to <funnel>"      set_website_button
"Put the site live"                        update_website (domain_id) → publish_website
                                           # Websites are NOT funnels: no variants,
                                           # no split tests, one form max (Contact).
                                           # Landing pages stay funnels on the same domain.

"Build me a landing page for X"          → ASK shape + platform first → see "Before building"
"Create something for <topic>"             create_funnel        (with funnel_type + platform)
"Make a page about <X>"                    [read resources/PAGE-BUILDING.md]
                                           create_variant       (variant HTML on the relevant page)
                                           [user reviews preview]
                                           publish_funnel       (activates + bakes HTML)
                                           move_to_folder       (file the funnel in the brand's
                                                                 campaign folder — unasked)
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
(after building anything for a brand)    → file it, unprompted: list_folders → move_to_folder
                                           (funnels, creatives, copy lines, strategy),
                                           move_creatives_to_brand first for a non-default
                                           brand's creatives, research folders via
                                           create_research_folder / update_research_document.
                                           See "File a brand's assets as you build them".

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
"Is Google rejecting or limiting ads?"   → get_ad_health      (`policy`: Google's flags + verification)
"Log a Shopify/Stripe sale back in"      → record_external_conversion  (idempotent on order id)

"Build me a Meta / Facebook / Instagram  → read resources/META-ADS.md FIRST, then
 campaign"                                 the Guided Campaign Build:
                                           create_meta_campaign →
                                           create_meta_adset → create_meta_ad →
                                           verify_meta_build → file the creatives +
                                           copy lines in the brand's campaign folder.
                                           Campaign PAUSED = the one switch; ad sets
                                           + ads in a NEW campaign go in ACTIVE
                                           behind it (server-decided, see "One
                                           switch"). Human flips the campaign.

"Build a Google Search / Demand Gen      → read resources/GOOGLE-ADS.md FIRST
 campaign"                                 (STAG / SANG playbooks + the two
                                           3-step build flows): campaign →
                                           ad group → ad. Campaign PAUSED = the one
                                           switch; ad groups / ads / keywords in a
                                           NEW campaign go in ENABLED behind it.
                                           Research keywords FIRST with
                                           generate_keyword_ideas (volume + CPC
                                           from Keyword Planner) instead of
                                           guessing.

"Build a Microsoft / Bing campaign"      → read resources/MICROSOFT-ADS.md FIRST:
                                           create_microsoft_search_campaign →
                                           create_microsoft_ad_group →
                                           create_microsoft_search_ad. Same STAG
                                           playbook as Google Search; same
                                           one-switch rule (campaign PAUSED).

"Build a TikTok campaign"                → read resources/TIKTOK-ADS.md FIRST:
                                           create_tiktok_campaign →
                                           create_tiktok_ad_group →
                                           list_tiktok_identities →
                                           create_tiktok_ad (library videos) →
                                           verify_tiktok_build. EVERY level is
                                           PAUSED; the user switches all three
                                           on in TikTok Ads Manager.

"Build a pre-sell / advertorial page for   → read resources/SHOPIFY.md FIRST:
 my Shopify product"                        list_store_products → create_funnel
                                           ({ funnel_type: "click_through" }) →
                                           create_variant with productUrl as a
                                           PLAIN link + data-pages-convert.
"How did the store do? Which ads make    → get_store_summary / get_store_attribution
 money? Best products?"                    / get_store_products (read SHOPIFY.md
                                           for the pinned metric definitions)

"What's going on in my account?"         → get_daily_brief    (the Morning Brief —
"Anything I should know today?"            free read; same brief the user sees.
                                           Good first call of a session to orient.)
"What did the optimizer do?"             → list_optimization_actions (narrate it)
"What should I do next?"                 → get_optimization_suggestions
"Find me keywords for HVAC / <offer>"     → plan_search_campaign   (DEFAULT for a generic ask: it
"Best keywords for <vertical> in <city>"    researches with keyword data, filters to buying
"Plan / set up a Google Search campaign"    intent, clusters themes, sets CPC + negatives, saves
                                           the plan; then build from its `next`)
"Just give me search volume for <terms>"  → research_keywords      (numbers only, no plan)
"Are these keywords any good?"            → classify_keywords      (free; intent + reasons on
"Which of these should be negatives?"       any list the user brought)
"Here are my keywords, structure them"    → build_keyword_plan     (free; themes + match types +
                                           CPC + negatives from rows you already have)
"Review my search terms / add negatives"  → triage_search_terms    (read-only suggestions; the
"Set up the weekly negatives check"         user approves, THEN add_google_negative_keywords;
                                           schedule it every 3 days)
"Make me an image / ad creative / hero"   → list_creative_formats → get_creative_format → compose_creative_brief
                                           → ChatGPT / Codex: render with your own image model + upload_image
                                           → Claude / Grok / others: generate_image (granvl credits)
"Just generate this image"               → ChatGPT / Codex: your own image model + upload_image
                                           → others: list_capabilities → generate_image (confirm if > 20 credits)
"Make a video / video ad / explainer"     → setup_video FIRST (template card: Use template → stepper)
"Show me the video templates"              → create_video_storyboard (quote estimated_credits)
                                           → render_video (max_credits = suggested_max_credits; no question:
                                             it draws the first 3 stills, then the run waits in review)
                                           → review_video_stills (the ONE cost question: Approve · ~N on the card)
                                           → made in the background: tell the user a few minutes,
                                             chat can close, no polling (3 at a time, then `queued`)
                                           → poll_video_render later → plays on the card; name the creative_id
                                           # variants: create_video_variant / update_video_beat
                                           # NEVER list_creative_formats (static images) or raw-clip prices
"Just one raw clip (Seedance / Veo shot)" → list_capabilities → generate_video → poll_video_generation
                                           (only when the user explicitly wants a single raw clip)
"Make N static ads for <offer>"           → read resources/CREATIVE.md FIRST → N concept cards → user approves
                                           → per card: get_creative_format → compose_creative_brief (aspect_ratio)
                                           → render → check the image → upload_ad_creative (conventional
                                             name, angle_id, icp_id) → file them in the campaign folder
"Make me UGC / a talking-head video"      → setup_video { kind: 'ugc', brief, script }: a generated presenter
                                           (the card: presenter → pick → script → one confirmation → video)
                                           → no card: create_ugc_presenters → pick → create_ugc_video → render_video
                                           # never a real person, a testimonial or an expert pose; AI label at launch
                                           → their own people on camera: the film-it-yourself kit (CREATIVE.md section 10)
                                           → their files: start_creative_upload → PUT → finish_creative_upload
"Research <competitor / market / offer>"  → research_web           (cited; save to a research doc)
"Make me a campaign for <offer>" (no doc) → list_research_documents → start_offer_research (estimate_only first; auto-starts under 250 credits)
                                           → quick_read now → poll_offer_research (the report is filed for you)
                                           → then the modular build (brief / copy / creatives / campaign tools)
"Do deep research on <offer>"            → same (estimate_only first; auto-starts under 250 credits)
"Research the <niche> market"            → start_niche_research (estimate_only first; auto-starts under 250 credits) → poll_offer_research → open document_url
"Go deeper on <section> of that report"  → deepen_offer_research { document_id, sections: [...] }   (in place, no new run)
"Research <offer> / <angle> from it"     → start_breakout_research { parent_document_id, focus, offer | angle } → poll_offer_research
"What ads is <competitor> running?"       → list_competitor_ads → research_competitor_ads (estimate_only first; brand or domain) → save_competitor_insights → research_landing_page on their landers
"What ads are running for <niche>?"      → research_competitor_ads (estimate_only first; query: the service — national, US; never the city) → save_competitor_insights → research_landing_page on the longest-running landers
"Tear down / look at this landing page"  → research_landing_page
"What have we already tried?"            → get_research_history (BEFORE proposing tests)

"What do we know about <brand/offer>?"   → list_research_documents → get_research_document
"Write up / file this research"            update_research_section  (one ## section at a time)
"Start a foundation doc for <offer>"       create_research_document (template, then fill sections)
"Save this source / quote"                 save_research_evidence { document_id, items } (creates + links); attach_research_evidence only re-files an existing row
"Organise the research library"            create_research_folder / update_research_document (folder, tags, status)
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

"Add our privacy policy / terms links"    → update_domain_legal    (privacy_policy_url, terms_of_service_url,
                                                                  business_legal_name; "/privacy-policy"
                                                                  on the domain is fine)

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
"Hook this up to Lead Distro"             → set_leaddistro_destination (campaign + source ids + x-api-key
                                                                  from the Inbound API Specs page; test_lead while verifying)
"Pause / rename / reorder a destination" → update_form_destination (enabled, label, sort_order 0 = primary,
"Change the hidden fields it sends"                               hidden_fields)
"Map / copy ActiveCampaign fields"       → get_form_destinations (meta.acFields = AC's fields + required flags,
                                           meta.fieldMap = current map) → update_form_destination({ field_map })
                                           # { "<form input name>": "<AC field name>" }. To copy a mapping to
                                           # another funnel, read the source's meta.fieldMap and provide it as-is.
                                           # Map every required AC field or AC rejects the lead.
"Remove this integration"                → delete_form_destination (one by id; two-step: preview → user yes → token)

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

"TrustedForm on every page of a domain"   → update_domain_tracking (trusted_form_default: true; funnel OR
                                                                  domain; get_domain → trusted_form_default)

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
3. **Wire lead delivery** — template forms point at the built-in fallback until a destination is configured (`get_form_destinations` / `set_form_destination`; LeadProsper with a field map: `set_leadprosper_destination`; Lead Distro: `set_leaddistro_destination`).
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

The platform belongs in the `platform` field **only** (it renders in its own column everywhere and is editable later). Name funnels after the **business / offer / angle**, never the traffic source. ✅ `name: "perkpoint_benefits_savings", platform: "META"` · ❌ `name: "perkpoint_meta_benefits_savings"`. Applies to `update_funnel` renames, page slugs, and variant names too.

### Naming

One convention for every name you choose, in granvl and on the ad platforms (owner decision, 2026-11-10); it replaces every earlier naming rule. People search these names in Ads Manager, sort them in sheets and match them by eye, so they have to look alike.

- **Campaigns:** Title_Case words joined by underscores: `Roof_Replacement_Storm_Season`, `Mortgage_Renewal_CA`.
- **Everything else:** lowercase words joined by single underscores, with no spaces, hyphens or other punctuation: ad sets and ad groups, ads, creatives and their file names, audiences, copy-line batch labels, folders, testing flows, funnels, pages and variants, video run titles. `ad_set`, `ad_comic_video`, `roof_replacement_feeds`.
- **Creatives and ads** are built from their parts in a fixed order: `{offer}_{angle}_{hook_type}_{format}_{aspect}_v{n}`, e.g. `roof_replacement_storm_season_timely_local_calendar_punch_4x5_v1`. The fields use underscores inside too, so the order is what keeps a name readable and sortable: keep every field, in this order. Write the aspect as `1x1`, `4x5`, `9x16`, `16x9` or `191x1`. A one-per-creative Meta ad takes its creative's file name as its name (more in [resources/CREATIVE.md](./resources/CREATIVE.md)).
- **Audiences:** `{brand}_{icp}_{kind}_{theme}_v{n}`, the ICP left out for a brand-level audience: `acme_homeowners_search_roof_repair_v1`.
- **Not names:** URL slugs keep hyphens, form field names follow the form contract below, headlines, ad copy, a page's `<title>` and research document titles are prose, and brand and workspace names are the business's own. None of them ever contain an em or en dash either.
- **What exists keeps its name.** Never rename anything to fit the convention, and reuse an existing folder by the exact name it already has (`list_folders` first; `folder_name` matches the whole name).
- **What the server does:** it turns an em or en dash in a campaign / ad set / ad group / ad name into a hyphen before it reaches Meta, Google, Microsoft or TikTok (names only, never ad copy) and writes the name otherwise as you passed it. A campaign / ad set / ad group / ad name off the convention comes back with `naming_note { given, suggested, note }`: keep a name the user chose, and use the convention for the next one. Names granvl makes up itself (launcher defaults, audience drafts, video variant titles) already follow it.

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
10. **Legal footer: never block a build on it.** If `get_funnel` → `legal.privacyPolicyUrl` is set, every variant links it in the footer; if it's null, build anyway and skip the footer links — NEVER ship a placeholder link (`#`, `/privacy`, example.com) and never stop a first build or preview to demand legal pages. The requirement lands at **custom-domain publish / paid-traffic time**: ad platforms reject landing pages without a discoverable privacy policy, and publish injects a plain fallback footer if the URLs exist but you omitted them. When the user moves to publish on a custom domain or run ads, that's the moment to get their URLs: they add them in Settings → Domains → Manage → About, or they give them to you and you set them with `update_domain_legal` (a path like `/privacy-policy` on the domain is fine).

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
- **Webhook-back** (asynchronous): every submission carries `granville_lead_id` (plus `granville_variant_id` / `granville_funnel_id`, so the CRM knows which variant produced the lead); the user's CRM/Zapier POSTs `{ lead_id, stage, qualified?, value? }` to the workspace's qualify URL on every pipeline move — `stage` is the CRM's own stage name, mapped per domain to Contacted → Conversation → Booked → No show → Held → Quoted → Won / Bad contact / Not a fit / Lost (`get_domain → crm_stages`, `set_domain_crm_stages` for names that came in unmapped). `get_qualify_webhook_url()` returns URL + setup notes.
- **Manual flips**: `mark_lead_qualified(session_id, funnel_id, qualified, value?, reason?)` — use sparingly.

**Declare form schemas with `set_funnel_form_fields`** whenever you build or change a form — the rule UI then offers real dropdowns instead of field names guessed from your HTML.

**Optimization implication:** compare variants on the funnel's `leadingMetric` from `get_funnel_stats` (booked rate once the CRM reports, fit rate once a rule exists, else conversion rate) and name it. Fit and outcome are two signals: a variant with a high fit rate and a low booked rate means the rule needs tightening, not that the variant lost. Qualified vs. unqualified leads can also route to different thank-you pages (`qualification_audience` on TY pages) — recipe in [resources/PAGE-BUILDING.md](./resources/PAGE-BUILDING.md) §8.

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

## File a brand's assets as you build them — without being asked

Everything you create for a brand ends the build **filed in that brand's folders**: the user should open the Funnels, Creative, Copywriting, Strategy and Research pages and find the new work grouped under the campaign it belongs to, not loose at the top level. Do it as part of the build, unprompted, then say in one line what you filed where.

**The convention**

1. **Brand first.** Every asset belongs to the right brand before it goes in a folder (`list_brands`; ask which brand when there are several and the user did not say). Folders are **per brand**: a folder is only found or created inside the brand you pass, and items from another brand are skipped.
2. **Then one campaign / offer folder inside the brand**, named after the campaign or offer by the naming convention (`mortgage_protection_ca`, `spring_promo`; see "Naming"). Use the **same folder name** on every table (funnels, creatives, copy, strategy), so one campaign reads the same everywhere.
3. **Reuse before you create.** Check what exists first and reuse a folder under the exact name it has, whatever its style (`list_folders { kind, brand_id }`; research folders come back from `list_research_documents { brand_id }`). `move_to_folder` with `folder_name` already reuses a same-named folder on that table and creates it only when there is none.
4. **Never move what the user already filed.** File only what you created in this build (or what the user asked you to file). An item that already sits in a folder stays there; a creative inside an auto-test bucket stays there too (a creative folder IS the auto-test's bucket, and moving it takes it out of the test).
5. Folders are organizational only: they never change serving, tracking, stats or what an ad campaign runs.

**The tools, per asset**

| Asset | File it with |
| --- | --- |
| Funnel (its landing pages and variants live inside it, so filing the funnel files them) | Create it in the brand (`create_funnel` / `create_funnel_from_template` with `brand_id`; `update_funnel { brand_id }` re-homes one), then `move_to_folder { entity: "funnel", ids, folder_name, brand_id }`. |
| Domain the funnel serves on | `move_domain_to_brand { domain_id, brand_id, move_funnels: true }` only when the domain sits in the wrong brand (confirm first; owner / admin only). |
| Ad creatives | `upload_ad_creative` (and the direct upload) take no brand: a creative lands in the **default brand**. For another brand, `move_creatives_to_brand { ids, brand_id }` first, then `move_to_folder { entity: "creative", ids, folder_name, brand_id }`. Stamp `angle_id` / `icp_id` on upload. A creative uploaded with `testing_flow_id` is already filed in that auto-test's bucket. |
| Copy lines | `create_copy_lines { brand_id, batch, lines }`, then `move_to_folder { entity: "copy_line", ids: copy_line_ids, folder_name, brand_id }`. |
| Products, ICPs, angles | `move_to_folder { entity: "product" \| "icp" \| "angle", ids, folder_name, brand_id }` (the Strategy page's folders). |
| Research documents | Reuse a research folder or `create_research_folder { name, brand_id, parent_id? }`, then create the document with `folder_id` (`create_research_document`) or move it with `update_research_document { document_id, folder_id }`. A report `start_offer_research` filed for you can be moved into the campaign folder the same way when it sits at the library root. |
| Lead magnets | **No folder or brand tool over MCP**: a lead magnet is grouped by the domain it is served on. Host it on the brand's domain (`upload_lead_magnet` with that `domain` or `funnel_id`) and leave it there. |
| Campaign hubs | Not a folder: **offer** to group the funnel with its ad campaigns (`create_campaign_hub`), never create one unasked. |

Renaming or deleting a folder is dashboard-only.

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
- TikTok Ads → [resources/TIKTOK-ADS.md](./resources/TIKTOK-ADS.md) **(required before any TikTok build)**
- Shopify stores — pre-sell pages, store attribution, margin → [resources/SHOPIFY.md](./resources/SHOPIFY.md) **(required before any ecommerce work)**
- Tool args, schema, serve runtime, error catalog → [resources/REFERENCE.md](./resources/REFERENCE.md)
- A/B sizing, CRO patterns, diagnosis playbooks → [resources/OPTIMIZATION.md](./resources/OPTIMIZATION.md)
- Ad creatives (concept cards, hooks, the image check, sizes, video scripts, UGC kits, finishing a UGC video locally) → [resources/CREATIVE.md](./resources/CREATIVE.md) **(required before any set of creatives)**
- Golden-path scripts → [resources/EXAMPLES.md](./resources/EXAMPLES.md)
