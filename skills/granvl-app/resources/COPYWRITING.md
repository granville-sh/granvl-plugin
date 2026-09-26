# Copywriting

Required before you write a headline, a subheadline, or ad copy — on a page,
in an ad, or into the library.

Source: granvl's copywriting framework, asset playbooks for landing pages and
ads-and-social. This file is the operating subset, not the whole framework.

---

## The library comes first

Copy lives in the workspace, not in the conversation. Before writing anything:

1. `list_copy_lines` — read what exists. A `winner` is proven reusable; a
   `testing` line is a live hypothesis, not house truth.
   Reusing or adapting one beats inventing a fifth variation of it.
2. `list_copy_lines` filtered by `angle_id` / `icp_id` when you know which
   argument you are writing for.
3. Write. Then `create_copy_lines` to save the set, with a rationale per line.

Lines you save land as `testing`, tagged agent-written. Only warehouse-backed
experiment results can promote a line to `winner`; unpromising or retired lines
become `archived`. Do not mark your own work `winner`.

---

## The opening rule

**The first three lines have to earn the fourth.**

This is the one rule that is enforced in code, not just advised. A reader is
served a truncated preview before "See more", so on most impressions those
three lines ARE the ad. `create_copy_lines` rejects an `ad_primary` whose
opening is a single run-on line.

An opening fails when it:

- greets ("Hey business owners!")
- names the brand before giving the reader a reason to care
- restates the offer the ad is about to make
- only makes sense after reading the rest
- front-loads a qualifier the reader has not asked for yet

An opening works when, by line three, the reader knows this is about them,
what tension it names, and that the next line is worth the second it costs.

Write bodies with real line breaks. Blank lines do not count as one of your
three — the split skips them, exactly as `openingLines()` does.

---

## Structure

### Ads

```
audience or situation cue
→ tension, desire, or governing idea
→ one promise or useful insight
→ support signal
→ accurate CTA
```

- **One concept per ad.** Two ideas in one body is two ads.
- Short is not context-free. Keep the qualification that keeps the promise
  true — omitting the material term is not brevity.
- The text and the creative must make the SAME claim. Never imply a
  before/after, an endorsement, a customer, or a product behaviour the asset
  does not actually show.
- Ad copy earns attention and sets an accurate expectation for the
  destination. It rarely completes the whole argument — that is the page's job.

### Landing hero

Between headline and subheadline, a reader must be able to answer:

1. Is this for me?
2. What is it?
3. What useful progress does it support?
4. What do I do next?
5. What material qualification must I know now?

**Never write a vague headline that the rest of the page has to decode.**

Section headings carry the skim argument: someone who reads only the headings
should still get the case. Button copy states the true commitment — `Apply`,
`Book`, `Pay`, `Join waitlist` — not `Get started` when the commitment differs.

---

## Rationale is not optional

Every saved line needs one sentence on what it is doing: which objection it
answers, which promise it makes, which reader it is for.

A line without its argument is not reusable — six months later nobody can
tell whether it underperformed because the claim was wrong or the wording
was. The rationale is also what a human reads when deciding whether to test it.

---

## Claims

- A claim needs support that exists. If the proof is not in the Product,
  the ICP research, or the Angle, do not write the claim.
- Market evidence is not product proof. "Most lenders repriced this month"
  is a market fact; "we saved customers $200/mo" is a product claim and needs
  the product's own evidence.
- Regulated categories (finance, housing, employment, health) carry
  qualification requirements. Keep them in the copy, not in a footnote you
  hope survives the crop.

---

## Tools

| Tool                | Use                                                                     |
| ------------------- | ----------------------------------------------------------------------- |
| `list_copy_lines`   | Read the library. Filter by kind, surface, status, angle, ICP, or text. |
| `create_copy_lines` | Save a batch. Needs kind, surface, body, rationale per line.            |
| `update_copy_line`  | Edit a line, or set status. Retire rather than delete what has run.     |

`list_copy_lines` returns `opening_three_lines` for every row, so you can
judge an ad body the way a reader meets it without re-deriving the split.

Kinds: `headline`, `subheadline` (surface `landing`); `ad_primary`,
`ad_headline`, `ad_description` (surface `ad`).

Hard limits enforced by granvl: ad headline **30 characters**, ad description
**90 characters**. Validate the complete batch before saving or building.

When copy is used on a page, pass its ids as `copy_line_ids` to
`create_variant` / `update_variant`. When it is used in a campaign, retain the
ids in each review cell and pass their union to `save_campaign_draft`. Lineage
is what lets later warehouse performance update the right hypothesis.
