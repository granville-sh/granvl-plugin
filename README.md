# granvl plugin

granvl is an AI-native landing-page and performance-analytics platform. This plugin connects your agent (Claude, ChatGPT, Codex, Cursor) to a granvl workspace and teaches it how to use the platform well.

## What it contains

- **MCP connector** — the remote granvl MCP server at `https://app.granvl.com/api/mcp` (Streamable HTTP, OAuth 2.1 with PKCE). It is the only thing the plugin connects to. Sign in with your granvl account when the client asks; every tool call is scoped to the workspace you choose.
- **granvl-app skill** — the usage guide the agent reads before building: page-building rules, form and conversion-tracking conventions, the Google / Meta / Microsoft campaign playbooks, and how to read granvl's analytics. Skill version: `1.0.0-2665889f7901`.

Nothing in this plugin runs locally: no scripts, no hooks, no local servers. The skill is documentation; the connector is a URL.

## What the agent can do once connected

Create funnels and pages, write and publish page variants, split traffic between variants, read first-party analytics (visitors, conversions, qualified leads, ad spend joined to outcomes), configure lead delivery to your CRM, and build **paused** Google Ads, Meta and Microsoft Ads campaigns for you to review and enable in the ads manager. Destructive actions (delete, unpublish, pausing a live campaign) are marked so your client asks before running them.

## Data

Lead contact details never pass through granvl: forms post from the visitor's browser directly to the CRM or destination you configure. granvl stores first-party analytics events and the lead's non-identifying answers for 180 days. Ad-platform credentials are entered in the granvl dashboard, never through a tool. Privacy policy: https://app.granvl.com/privacy · Terms: https://app.granvl.com/terms · Support: support@granvl.com

## Requirements

A granvl account (https://app.granvl.com). New workspaces get a free trial.

## Source

This folder is generated from the granvl application repository by `scripts/build-plugin.mjs`; edit the skill there, not here.
