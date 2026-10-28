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