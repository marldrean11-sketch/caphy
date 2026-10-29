# UI update notes (brand-refresh)

Marl's UI/UX pass on the web console - motion, responsive, interactive.
One section per change, newest last, so Kem can review or revert each
commit on its own. Screenshots are in `docs/screenshots/`.

How each change was tested: `python app.py`, signed in with the local test
account, checked in Chrome at the widths listed (390 / 768 are the phone
checks - no sideways scrolling allowed).

---

## 1. Overview camera tile fills its column (Oct 28)

- **What:** `.feedtile .feedwrap` gets `width:100%`.
- **Why:** `aspect-ratio:16/9` turns `max-height:440px` into a hidden
  max-width of ~782px. On screens 1920px and wider the feed stopped short
  and left an empty gap beside it. Now the tile fills the column; height
  still caps at 440px, so `object-fit:cover` crops the top/bottom of the
  frame a little instead.
- **Files:** `web/static/style.css`
- **Tested:** 390, 768, 1024, 1440 (no change - already filled), 1920 and
  2560 (fixed: 782px -> 1038px / 1465px). Only the "Camera off" state was
  checked; live video crop still to be eyeballed with a camera on.
- **Screenshots:** `docs/screenshots/01-tile-width-before.png`,
  `docs/screenshots/01-tile-width-after.png` (1920px)

## 2. statuslight.js cleanup (Oct 28)

- **What:** `var` -> `const`/`let`; `poll()` and `post()` from `.then`
  chains to `async/await`; `caphyResumeCam` is a named function. Still an
  IIFE, so only the `window.caphy*` functions are global.
- **Why:** match Kem's JS style. No behaviour change.
- **Files:** `web/static/statuslight.js`
- **Tested (browser, scripted):** level / armed / sidebar + header counts /
  Camera-off overlays match `/api/state`; one click arms; a 0.4 s press does
  not disarm; a 1.2 s hold does; `caphyResumeCam` posts then re-polls; with
  the server stopped the page stays put through 2 missed polls and goes gray
  ("Can't reach CAPHY") after the 3rd. No page errors.
- **Screenshot:** `docs/screenshots/02-statuslight-offline.png`

## 3. Motion preview approved (Oct 28)

- **What:** `docs/motion_preview.html`, a standalone page (open it in
  Chrome, no server) showing the Oct 30 motion ideas on a cut-down
  Overview: 1 action toasts with Undo, 2 new-alert toast, 3 status light
  (existing), 4 page transition, 5 count-up numbers, 6 loading skeletons.
- **Why:** agree the look and timings once before wiring anything into
  `web/static`. Marl approved all six as shown.
- **Files:** `docs/motion_preview.html` (reference only - not loaded by the app)
- **Tested:** 1440 / 768 / 390, every demo plus reduced motion, no page
  errors, no sideways scroll.

## 4. Arm / disarm toasts (Oct 29)

- **What:** new shared `web/static/toast.js` (`window.caphyToast`) + a
  toast block in `style.css`. `statuslight.js` toasts whenever the armed
  state flips in `/api/state`: "Armed." / "Disarmed.", each with one line on
  what that means. The tab that did the 1.2 s disarm hold also gets **Undo**
  (6 s, re-arms - one click, like arming).
- **Why:** arming from the sidebar gave no feedback on any page. Driven by
  the state, not the click, so arming from the phone, voice or the Live page
  button shows up on every open page too. Wording follows the real rules in
  `server.py` (Tier 3 sirens even when disarmed; arming adds Tier 2 siren and
  pushes for every tier).
- **Files:** `web/static/toast.js` (new), `web/static/style.css`,
  `web/static/statuslight.js`, `web/templates/base.html` (loads it),
  `web/server.py` (`_css_version()` hashes toast.js too, so Ctrl+F5 isn't
  needed after it changes). Preview wording corrected to match.
- **Kept apart:** the Live page's own `toast()` / `#webtoast` is untouched;
  the new one is named `caphyToast` / `.ctoast` so they can't clash.
- **Tested (browser, scripted):** no toast on page load; arm toast; 0.4 s
  press does nothing; hold -> Disarmed + Undo; hovering pauses the countdown;
  Undo re-arms; a second tab gets the toast without Undo; a disarm from
  outside the page (API call, like the phone) toasts without Undo; server
  down and back up gives no false toast; 390px + reduced motion shows the
  toast instantly, inside the screen, no sideways scroll. No page errors.
- **Screenshots:** `docs/screenshots/04-toast-disarm-1440.png`,
  `docs/screenshots/04-toast-armed-390.png`

## 5. Live page Arm button: hold to disarm (Oct 29)

- **What:** the Live page's Arm button is now a `.hold` button handled by
  `statuslight.js`, like the sidebar: one click arms, disarm needs the
  1.2 s hold. Label reads "Hold to disarm" while armed. `toggleArm()` is
  gone; a small `caphy:state` listener updates the label right away.
- **Why:** it disarmed on a single tap, against the design rule. Now its
  disarm also gets the Undo toast.
- **Files:** `web/server.py` (`live()` markup + script),
  `web/static/style.css` (`.ctrlbtn.hold`: drops the 150px min-width)
- **Tested:** label/active state, one click arms (label updates in ~0.2 s),
  0.4 s press does nothing, 1.3 s hold disarms, Undo re-arms, button the same
  86 x 44 px as before, 390px no sideways scroll, no page errors.

## 6. New-alert toast on every page (Oct 29)

- **What:** `statuslight.js` opens the existing `/api/alerts/stream` on
  every page. Each new alert (not the `{event:"changed"}` delete/dismiss
  messages) fires a `caphy:alert` event and a toast: "Tier 3 · Person
  detected" / "Front door · 2.4 m away · 10:11:01", tier colour on the left
  edge, **View** opens Alert History (not shown on that page). Tier 3 stays
  10 s and is announced to screen readers (`role="alert"`); Tier 1-2 stay
  6 s. On Overview the row slides into Recent Alerts (others slide down,
  max 5) and "alerts today" / "alerts in total" go up by one.
- **Why:** before, a new alert only showed up live on Alert History (as a
  banner); on every other page you'd only see it after a reload.
- **Cost:** the stream is closed while the tab is hidden and reopened when
  it's visible again - each open stream holds a server thread on the laptop
  that's also running YOLO. Alerts that arrive while hidden don't toast;
  Overview's list catches up on the next reload, as before.
- **Files:** `web/static/statuslight.js`, `web/static/toast.js` (alert
  variant, `caphyFlip` shared), `web/static/style.css`, `web/server.py`
  (`dashboard()`: ids on the list and counts + the `caphy:alert` listener;
  row markup mirrors `alerts_html` - keep them in step)
- **Tested (browser, scripted, stream stood in by the test so no camera
  was needed):** real stream opens; `changed` ignored; Tier 3 toast text /
  red / role=alert / View, gone after 10 s; row on top + counts +1; burst of
  4 -> 3 toasts, list stays 5, counts +4; View -> /history; no View on
  History; toast on Live; hide closes / show reopens the stream; 390px fits,
  no sideways scroll; no page errors. Not yet seen with a real detection.
- **Screenshots:** `docs/screenshots/06-alert-toast-burst-1440.png`,
  `docs/screenshots/06-alert-toast-390.png`

## 7. Page transitions (Oct 29)

- **What:** moving between pages, only the page body moves: the old one
  fades out (160 ms), the new one rises 8px and fades in (280 ms). Sidebar,
  header and siren bar stay still. Back/forward and the phone drawer links
  do it too. Off with reduced motion. Cross-page View Transitions API - no
  JS; browsers without it just navigate as before.
- **Why it's in `base.html`, not `style.css`:** with the rules in the
  stylesheet, Chrome skipped nearly every transition. A Chrome trace showed
  "ViewTransition opt-in disabled" ~2 ms after `style.css` finished loading:
  the opt-in is checked the moment the new page may first paint, and the
  linked sheet's rules weren't always registered yet. An inline `<style>` in
  `<head>` is applied as it's parsed, so it's always in time. Second fix:
  `<link rel="expect" href="#pageEnd" blocking="render">` holds the new
  page's first paint until the body is parsed (marker `<div id="pageEnd">`
  right after `.content`) - without it the new snapshot was empty and only
  the old page faded.
- **Files:** `web/templates/base.html` (inline block + rel=expect + marker),
  `web/static/style.css` (pointer comment only)
- **Tested:** plain Chrome 156 (driven over CDP - Playwright's own Chrome
  launch turns off PaintHolding, which these transitions need, so it gave
  false failures): all 6 pages transition with only the page old/new
  animating at 160/280 ms, Back (restored from back/forward cache) too,
  phone drawer link, reduced motion = no transition, no page errors. Ran
  twice, 13/13 both times. Laptop's WebView2 is 156 (same engine); not yet
  tried inside the pywebview window (Nov 2 item).
- **Screenshot:** `docs/screenshots/07-page-transition-mid.png` (120 ms in:
  sidebar/header already on the new page, old body fading behind the new)

## 8. Count-up numbers (Oct 29)

- **What:** new `web/static/motion.js`. Any element with `data-count`
  counts up from 0 once as the page loads (600 ms, ease-out). Used on
  Overview's "alerts today", "alerts in total" and "waiting to sync"
  (not the camera count - that's live status). A new alert now ticks
  those up (300 ms) instead of jumping; `data-count` holds the real
  target, so an alert arriving mid-count-up still ends exactly +1.
- **Why:** approved preview item 5. The server still renders the real
  number, so without JS (or with reduced motion, or in a hidden tab) it's
  simply the right value straight away.
- **Files:** `web/static/motion.js` (new; also has `caphyStagger`, used by
  the next change), `web/templates/base.html` (loads it), `web/server.py`
  (`data-count` on the stat row, tick in the `caphy:alert` listener,
  `_css_version()` hashes motion.js)
- **Tested:** counts through ~20 in-between values, never goes down, lands
  on the server value ~470 ms after DOMContentLoaded (ease-out rounds to
  the final number before 600 ms); alert mid-count-up ends +1; reduced
  motion shows the real value from the first frame; no page errors.
  Alert-toast tests re-run: 18/18.

## 9. Loading skeletons + rows fade up (Oct 29)

- **What:** Activity starts with 6 flat skeleton rows shaped like activity
  rows (time, icon, line) that breathe (opacity .45-1, 900 ms) instead of
  "Loading...". On a filter change the skeleton only appears if the answer
  takes over 150 ms. When a load finishes the first 12 rows fade up 40 ms
  apart (`caphyStagger`); the 4 s poll doesn't re-stagger (its new rows
  already slide in). Alert History: after a Last 24h / Include
  acknowledged / page change swaps the table, the visible rows fade up the
  same way. `aria-busy` is set while the skeleton shows.
- **Why:** approved preview item 6. Opacity only, no shimmer (needs a
  gradient). Alert History has no skeleton on purpose: it already dims the
  table while loading, and the local fetch is usually so quick that a
  skeleton would just flash. Also fixed on the way: a failed Activity load
  used to leave "Loading..." up for good (empty catch); it now says it
  couldn't load.
- **Files:** `web/static/style.css` (`.skelrow`, `.fadeup`),
  `web/server.py` (`activity()` markup + script, `history()` swap)
- **Tested:** server HTML has the skeleton + aria-busy; skeleton breathes
  while a (deliberately slowed) load runs, rows replace it with 0/40/80 ms
  delays (max 12); slow filter shows it, fast filter never flashes it; a
  real arm/disarm row arrives by poll with `.fresh` and no re-stagger;
  failed load shows the message; History swap rows fade up; reduced
  motion = still skeleton, no stagger; 390px no sideways scroll; no page
  errors. 15/15.
- **Screenshots:** `docs/screenshots/09-activity-skeleton-1440.png`,
  `docs/screenshots/09-activity-skeleton-390.png`

## 10. Settings: tier distance meter with drag handles (Oct 29)

- **What:** above the three tier cards, the same 10 m -> camera meter as
  Overview, with two white drag handles for the Tier 1 and Tier 3
  boundaries. Dragging resizes the bands live, shows each range in its
  band, updates the Tier 2 card's "2.5-4.5 m" text and fills the two
  boxes. Typing in a box moves its handle. Tier 3 always stays at least
  0.5 m inside Tier 1. Arrow keys move a focused handle 0.1 m. When
  someone is in view, their live distance shows as a marker on the meter,
  so you can stand at the door and set the line by eye.
- **Why:** the plan said "live distance meter while dragging the tier
  sliders", but there were no sliders - just two typed boxes and a Tier 2
  range that only updated after saving. The form still posts the same
  `tier1` / `tier3` boxes (the handles have no `name`), so saving and
  detection are unchanged.
- **Files:** `web/server.py` (`settings()`: meter markup + script),
  `web/static/style.css` (`.tmeter`, `.thandle`)
- **Tested:** band edges land on the saved distances (+-2 px); dragging
  Tier 1 to ~6 m moves box, Tier 2 text and band edge; Tier 3 can't cross
  Tier 1; arrow keys; typing moves the handle; live marker at 3.1 m;
  Save would post the new values (POST intercepted - nothing was saved,
  so your real thresholds are unchanged); 390px fits, no sideways scroll;
  no page errors. 13/13.
- **Screenshots:** `docs/screenshots/10-tier-meter-1440.png`,
  `docs/screenshots/10-tier-meter-390.png`

---

## Noticed, not changed

- When the server is down, the top banner says "You're offline - CAPHY is
  running in Local Mode", which reads like an internet problem rather than
  "server unreachable". Cause: `caphyCheckOnline()` in
  `web/templates/base.html` sets `online = false` when `/api/health` itself
  can't be reached, so "server down" and "no internet" show the same bar.
- In the offline state the Camera-off overlay disappears (offline state has
  no camera list), leaving a plain black box. Same as before the cleanup.
- Phone, drawer open: a toast sits over the drawer's arm button for its
  4 s (x closes it). The Nov 1 bottom tab bar replaces the drawer anyway.
- The header bell's unread count doesn't go up on a new alert (server-drawn
  in `page()`); only Overview's two counts are live.
- In the 340px alert toast the "camera · distance · time" line wraps to two
  lines when View is shown. Readable; cutting it would hide the time.
- Overview's meter always shows the config defaults (4.5 / 2.5 m, fixed
  55/20/25 band widths), not the thresholds saved in Settings - after
  changing them in Settings the two meters disagree.
- Tier wording differs: Overview's meter says "Tier 1 · snapshot, Tier 2 ·
  clip, Tier 3 · siren"; Settings' cards say "Record event only / Take a
  snapshot and notify / Record video, sound siren, and notify". Which is
  right is Kem's call (detection rules).
- Settings: the toggle descriptions ("Brightens dark camera images
  automatically.") render at body size, not the small grey `.fdesc` size.