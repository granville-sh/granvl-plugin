# Granvl — Local Dashboards (the dashboard kit)

When the user asks for a **dashboard, report, command center, or briefing** about their granvl data, build it as a LOCAL, single-purpose web page using the granvl dashboard kit in this skill. Do not build it inside granvl and do not reach for a charting framework.

**Strictly user-initiated.** Only build a dashboard when the user explicitly asks for one. Never create one proactively, never bolt one onto an unrelated task, and never pitch one mid-task; answering a stats question with the stats tools is almost always what the user wants.

The model: **you are the data pipeline.** Pull the numbers with granvl MCP read tools, bake them into the page as a snapshot, stamp when the snapshot was taken, and re-generate whenever the user asks (or on a schedule if your runtime supports scheduled tasks). No live wiring, no API keys in the page.

## The kit (in this skill under `resources/dashboard-kit/`)

| File | What it is |
|---|---|
| `granvl.css` | A direct port of the app's factory design system: same tokens (`--c-*`, `--fs-*`), same card, table, chip and stat recipes as the dashboard. |
| `charts.js` | Two dependency-free SVG chart helpers: `gvkBars()` (grouped bars) and `gvkLine()` (sparkline). |
| `index.html` | A complete example command center. Start by copying it and replacing the data. |

**Copy the three files into the user's local project** (e.g. `./granvl-dashboard/`), then edit your copies freely. The files belong to the user's project, not to granvl; there is no package to install or update. Open with any static server or directly in the browser; there is no build step.

## Building one

1. **Ask what decisions the dashboard should drive** if it isn't obvious. A good board leads with a thesis (see the example's "Fix the signal. Then scale what works."), not a wall of numbers.
2. **Pull real data** via the read tools: `get_spend_summary`, `get_funnel_stats`, `get_funnel_timeseries`, `get_segmented_stats`, `get_ad_breakdowns`, `get_tracking_health`, `get_qualification_rule`, keyword/search-term reads, etc. Never invent numbers.
3. **Bake the numbers into the HTML** (snapshot). Put the generation time in the `gvk-stamp` element — every dashboard MUST show when its data is from.
4. **Write the narrative.** Markdown-free prose in `.sub`, `.note`, `.callout`, and a `.checklist` decision queue with P0/P1/P2 priorities. Your analysis is what makes this better than a BI tool.
5. **Keep it one page, zero dependencies.** System fonts only, no CDN scripts, no chart libraries. Everything the page needs ships in the three files.

## Refreshing

- On request ("refresh my dashboard"): re-run the same reads, rewrite the data + stamp + narrative in place.
- If your runtime supports scheduled/background tasks, offer to re-generate on a cadence (daily before work is a good default). The stamp keeps staleness honest either way.

## Style rules

- granvl brand voice: warm, short, **no em dashes**.
- Semantic color only: green = healthy, amber = attention, red = broken, blue = neutral metric. Never decorate with red.
- Deltas get `.delta.up|.down`. Tables use `class="num"` for numeric columns.
- It should look like granvl. Resist restyling the tokens unless the user asks; DO extend with new components when the data calls for it.
