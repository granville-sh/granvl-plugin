# Creative

Read this before you make a set of ad creatives: static images, storyboard
videos, raw clips, or a script the advertiser films. SKILL.md ("Images and
static ad creative", "Video") has the tool flow; this file covers what goes
into a creative, how to check it, size it, name it and test it.

[COPYWRITING.md](./COPYWRITING.md) applies to every word on an image or in a
script, and the restricted-category rules in SKILL.md apply to what an image
shows and what a script says: a creative runs under its campaign's
`ad_category`.

---

## 1. The concept card

Write one card per concept before anything is rendered, and show the set to
the user. Render only what they approve; when they already said to go ahead
("make five and build the ads"), render without asking again. A set is 3 to
5 cards that differ in angle, hook type or format. Two cards that differ only
in wording are one concept.

```
concept:         <short name, snake_case>
angle:           <the strategy Angle>      icp: <the ICP>
hook_type:       <one value from the hook vocabulary, section 2>
awareness:       unaware | problem | solution | product
format:          <format slug> at <aspect>
headline:        "<exact on-image text, 3 to 8 words>"
supporting line: "<exact text>" (optional)
cta:             <the true commitment: Get a quote, Check eligibility, Book a call>
facts used:      <each verified fact and its source, or none>
category notes:  <the ad_category and what it rules out here>
name:            <the creative name, section 8>
```

Where the fields go: `format` → `get_creative_format`; the angle, headline,
supporting line, facts and aspect → `compose_creative_brief` (`angle`,
`headline`, `supporting_text`, `facts`, `aspect_ratio`); `name` → the
upload's file name; the Angle and ICP ids → `angle_id` / `icp_id` on the
upload.

Example, for a mortgage brokerage (`ad_category: CREDIT_LENDING`, confirmed
with the user):

```
concept:         renewal_compare_first
angle:           Compare first      icp: Homeowners whose fixed term ends within a year
hook_type:       timely_local
awareness:       problem
format:          calendar-punch at 4:5
headline:        "2027 renewals: compare before you sign"
cta:             Compare options
facts used:      none on the image
category notes:  no age, gender or ZIP targeting; no rate on the image unless
                 the user gives the rate, the APR and the terms
name:            mortgage_renewal_compare_first_timely_local_calendar_punch_4x5_v1
```

The headline talks about the market, not the reader, which keeps it clear of
Meta's personal-attributes rule. Its ad body, with a blank line between
paragraphs (a bracketed note means the claim needs a source or the user's
confirmation before it runs, or it comes out):

```
2027 renewals: compare before you sign.

Many fixed terms signed in 2022 come up for renewal next year, and the options have changed since then. [source needed]

Answer five questions and a broker walks you through what is available. Comparing does not commit you to anything. [confirm with the user]
```

---

## 2. The hook vocabulary

The hook is the headline on an image, the opening of an ad body, or the first
beat of a video. Give every concept one `hook_type`, written exactly as below:
the value goes into names and copy-line rationales.

| hook_type | What it is | Fits (awareness) | Watch for |
|---|---|---|---|
| `question_situation` | A question about a situation or the market ("What changes when a fixed term renews?") | problem | Meta: never ask about the reader's own traits ("Are you in debt?", "your bad credit"). Ask about the situation. |
| `problem_in_action` | The friction as it happens: a leak spreading, a pile of paperwork | problem | No staged damage or health scares. Show the real thing, or label an illustration. |
| `result_first` | Opens on what the customer gets (the quote, the report, the inspection), then explains | solution, product | Show the deliverable, never a promised saving, approval or outcome. |
| `contrast` | Before and after, with and without, the usual way and this one | solution | Both sides must be true; label an illustration. Meta restricts before-and-after images for health, so skip it there. |
| `number` | One verified number carries it: a fee, a deadline, a count | problem, solution | Only numbers the user gave you (`facts`). A rate needs the APR and the terms. |
| `myth_fact` | Names a common belief and corrects it | problem | The correction needs a source. |
| `timely_local` | A date, a season, a rule change or a place | any | Verify the date or rule. Name a city or region, never a ZIP code, for housing, credit, banking, debt relief and employment. |
| `proof` | A real review, count, rating or award | product | Documented and permissioned only. Never an AI face or voice as a customer. |
| `open_loop` | Starts a question the ad answers in its first lines | unaware, problem | The answer must arrive in the ad. No bait. |
| `audience_callout` | Names who it is for by situation or job ("For roofers who quote from the truck") | any | Never by age, family status, health, finances or any other personal attribute. |
| `objection_first` | Answers the reason people hold off ("A quote does not commit you") | solution, product | True only. No "guaranteed approval", no "bad credit OK". |
| `demo` | Shows the thing itself: the form, the report, the product in use | product | The real screen or the brand kit's product images, never an invented interface. |

For a video the hook is beat 1: under 12 words, and it must work with the
sound off (the caption carries it). Write three hooks for one body and make
them with `create_video_variant`, changing only the first beat (section 9).

---

## 3. Check every image before it becomes a creative

`generate_image` returns a preview of the render with its result. Look at
each one before `upload_ad_creative` or a build uses it (with your own image
model, look at your render before `upload_image`):

- Every word on it matches the text you composed, spelled right. An extra or
  garbled word means Try again, with a note naming the fix.
- No invented contact or identity details: phone numbers, URLs, social
  handles, emails, street addresses, licence or registration numbers. If the
  ad needs one, use the user's real one, written into the on-image text.
- No marks you were not given: other companies' logos, government seals,
  "approved" or "certified" badges, star ratings, review counts.
- The wordmark, the colours and the product match the brand kit (its logo
  and product images).
- Nobody who reads as a real customer giving a testimonial.
- No broken hands or faces, and no AI gloss (glowing edges, plastic skin,
  robots) unless the format asks for it.
- The aspect fits where it will run (section 7).
- The image makes the same claim as the copy it runs with.

Fix what fails before it reaches the bucket, then tell the user in one line
what you checked.

---

## 4. Write spoken lines the way they should be said

The voice reads each beat's `line` exactly, and the captions show it exactly.

- Put the figure in `overlay` (drawn sharp) and say it in words in `line`:
  overlay "$1,200 a year", line "That is about twelve hundred dollars a year."
- Spell out anything a voice can misread: rates ("six point four nine
  percent"), ranges ("two to three days"), times ("by nine a.m."), slashes
  ("twenty-four seven"). Phone numbers go on the end card, never in the voice.
- A rare brand or place name: listen to the finished video. If it is misread,
  a respelling would show in the captions too, so move the name instead: say
  "our team" in the line and put the name in `overlay` or the end card, with
  `update_video_beat` on that beat only.
- No quotation marks in a line. The only directions are the bracketed cues
  the voice supports ("[warmly]", "[break]"), which are never captioned.
- Rates, prices and guarantees in a script follow the ad-copy rules: the
  user's verified numbers only, with the terms the category requires.

---

## 5. Video lengths

A storyboard runs at about 150 spoken words a minute, plus a short tail per
beat, plus an end card of about 2.6 seconds. `pause` adds its own seconds.

| Length | Spoken words | Beats | Use |
|---|---|---|---|
| 15 s | about 20 to 25 | 4 | Stories, Reels and Shorts, retargeting, one idea |
| 30 s | about 55 to 60 | 6 to 8 | The default for cold prospecting |
| 45 s | about 90 to 95 | 9 to 11 | Explaining a process |
| 60 s | about 120 to 130 | 12 to 15 | Considered purchases (mortgage, solar) |

Check `estimated_seconds` on the storyboard before `render_video`, and trim
lines rather than speeding the voice up.

---

## 6. Briefing a raw clip (`generate_video`)

One shot, briefed in six short parts, in this order:

1. **Frame and device:** "vertical 9:16, handheld phone footage at chest
   height".
2. **Subject and setting:** "a roofer's gloved hands lifting a cracked
   shingle, overcast daylight".
3. **Camera:** "slight handheld sway, slow push-in, no gimbal moves, no cuts".
4. **Action** across the clip's length (Veo 3.1: 4 to 8 seconds; Seedance
   2.5: up to 30).
5. **Audio:** `audio` is on by default; describe the ambience and say "no
   voice", or pass `audio: false` when the clip will sit under a voice-over.
6. **Look and avoid:** "no on-screen text, no logos, no watermarks, no extra
   people, no distorted hands, no glow or halo, no lens flare".

`aspect_ratio` takes '16:9', '9:16', '1:1', '4:3', '3:4' or '21:9' (no 4:5).
Use `first_frame_asset_id` when the shot must start from the real product.
No real person's likeness without documented consent, nobody speaking as a
customer, and no text in the clip: captions and cards are the storyboard's
job.

---

## 7. Sizes by placement

Render a concept once for each placement it runs in, rather than letting the
platform crop it.

- **Meta feeds:** 4:5 (1080x1350) first; 1:1 (1080x1080) also works.
- **Meta Stories and Reels:** 9:16 (1080x1920). Keep text, faces and the offer
  out of roughly the top 250 px and bottom 340 px, where Meta draws the
  profile and the buttons (check Meta's current guidance when it matters).
- **Google Demand Gen image ads:** landscape 1.91:1, square 1:1, portrait 4:5
  (1080x1350) and vertical 9:16 (1080x1920, at least 600x1067); every ad
  needs at least one landscape or square image, up to 20 across the ratios,
  plus a square logo of at least 128x128.
- **Storyboard videos:** 1:1, 4:5 or 9:16 (no 16:9).

Most library formats default to 1:1, so pass `aspect_ratio` to
`compose_creative_brief` ('1:1', '4:5', '9:16') and to `generate_image`. On
Meta, put each ratio where it fits with `create_meta_adset`
`placement_formats`: `['feeds']` for the 4:5 and 1:1 versions,
`['stories_reels']` for 9:16. Leave both `placement_formats` and
`placements` out for automatic placements.

---

## 8. Name every creative

Name each creative before it is uploaded, by the convention in SKILL.md
"Naming": `{offer}_{angle}_{hook_type}_{format}_{aspect}_v{n}`, all lowercase
with single underscores, the format slug written with underscores
(`calendar-punch` → `calendar_punch`), the aspect as `1x1`, `4x5`, `9x16`,
`16x9` or `191x1`. A one-ad-per-creative Meta ad takes the creative's file
name as its name, so the file name is the ad name. Stamp `angle_id` and
`icp_id` on the upload.

---

## 9. Test one thing at a time

- **Hook test:** the same angle, format and copy, three hook types. On Meta,
  one testing flow per angle (`create_testing_flow`, `copy_source: 'winners'`,
  the default, holds the copy constant; `ad_format: 'one_per_creative'` so
  each creative is judged on its own).
- **Format test:** the same concept and hook, three formats.
- **Video hook test:** three `create_video_variant` runs from one source,
  each changing only the first beat (`beats: [{ id: <its id, usually 'b1'>,
  line }]`), then `add_creatives_to_testing_flow` with their `creative_id`s.

Judge on granvl's own leads, and on qualified leads where the funnel has a
rule (`get_creative_performance`, `get_ad_to_lander_performance`), not on the
platform's conversion count alone, and only once each creative has had a
fair share of the spend (the testing flow's rules, or
[OPTIMIZATION.md](./OPTIMIZATION.md)). Then `save_learning` on the landing
variant the ads sent traffic to: the hook types or formats compared in
`change_summary`, the metric and both numbers. Record losers and
inconclusive tests too. A test result is evidence for this brand and this
audience, never a promise for the next one.

---

## 10. UGC the advertiser films

granvl does not make AI presenter videos: no AI person speaking to camera,
and no AI face or voice presented as a customer or as the advertiser. For a
lead-gen brand the strongest UGC is the owner, broker, agent or installer on
their own phone. granvl writes it, they film it, granvl files and tests it.
One kit per concept:

1. **The script, 30 to 45 seconds:**
   - Hook (0 to 3 s): a line from the hook vocabulary, straight to camera.
     Write three; they film all three.
   - Problem (3 to 10 s): the situation in customers' own words (the
     research report's customer voice).
   - How it works (10 to 25 s): what happens after the tap, in plain steps.
   - CTA (the last 5 s): the true commitment, and only what is true.
2. **Shot list:** a selfie at eye level near a window; two or three shots of
   the real work (the job site, the office, the paperwork, the quiz on a
   phone); a screen recording of the form when the lander is a quiz.
3. **Delivery notes:** the phone held vertical (9:16), a quiet room, one line
   per take, the hook read three ways, anything important kept in the middle
   of the frame (feeds can crop vertical video). Feeds play muted: ask them to
   add captions in their phone's video editor before sending the files.
4. **Required lines:** their name, and any licence or registration line their
   regulator requires. Ask the user for the exact wording; never guess it.
5. **Upload:** `start_creative_upload` → PUT the file → `finish_creative_upload`
   with a conventional `filename` (one file per hook, e.g.
   `mortgage_renewal_compare_first_question_situation_ugc_9x16_v1.mp4`),
   `angle_id`, `icp_id`, and `testing_flow_id` to file it into the hook test
   (its ad sets use automatic placements). In an ad set you build yourself,
   `placement_formats: ['stories_reels']` keeps 9:16 files in Stories and
   Reels.

Never script anyone to pose as a customer, and never write results they
cannot document. A spokesperson says "we" and "our clients". A testimonial is
a real customer's own words, used with their permission.
