# UI update notes (brand-refresh)

Marl's UI/UX pass on the web console - motion, responsive, interactive.
One section per change, newest last, so Kem can review or revert each
commit on its own. Screenshots are in `docs/screenshots/`.

How each change was tested: `python app.py`, signed in with the local test
account, checked in Chrome at the widths listed (390 / 768 are the phone
checks - no sideways scrolling allowed).

## Summary (for Kem)

All on `brand-refresh`, one commit per section, nothing pushed or merged.
Detection, tier logic and alert rules are untouched. The only server-side
changes are UI-facing: `unread` added to `/api/state` (§23), and the
minimise hook in the two desktop launchers (§19).

| Area | Sections |
|---|---|
| Motion | toasts §4, alert toast §6, page transitions §7, count-up §8, skeletons §9 |
| Interactive | tier meter §10, snapshot stepping §12, keyboard shortcuts §13, Live hold-to-disarm §5 |
| Phones | bottom tab bar §14, History cards §15, Live camera swipe §16 |
| Quality | accessibility §17, hidden-tab pause §18, desktop window + minimise fix §19, dark scrollbars §20 |
| New look | shell §24, Overview §25, Live §26, other pages §27 |
| Fixes | tile width §1, overlays under header §11, Settings descriptions §21, server-down banner §22, live bell count §23 |

**Needs a decision** (see "Noticed, not changed" at the end):
- Should Overview's meter use the thresholds saved in Settings? (Marl)
- The tier wording differs between Overview and Settings. (Kem)

**Not tested:**
- A second real camera. Live swipe was tested with stand-ins.
- A real screen reader. Roles, names and live text were checked directly.
- The packaged .exe build.
- Live video crop with a camera on.

**Final regression run (Oct 29, after the last commit):**
- Passed: toast 21/21, alert toast 18/18, count-up 9/9, skeletons 15/15,
  tier meter 13/13, snapshots 22/22, shortcuts 17/17, Live hold 11/11,
  tab bar 23/23, cards 12/12, swipe 20/20, keyboard/a11y 27/27,
  hidden-tab pause 17/17, fixes §21-23 20/20.
- Re-run separately after low memory cut the first run short: status
  light (§2) 12/12, markup audit clean on every page and Settings tab at
  1440 and 390, desktop window 19/19. The desktop test's first retry
  failed because the real mouse was over the window (a real pointerleave
  cancels a hold). The pass was with the window moved off-screen.

**Demo path:**
1. Overview: the count-up, then Arm (toast), then hold to disarm (Undo).
2. Live: hold to disarm, then fullscreen.
3. Alert History: arrow keys or swipe through snapshots, then `/` to search.
4. Settings: drag the tier meter.
5. Phone width: the tab bar, then History cards.
6. `?` for the shortcuts.

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

## 11. Fix: full-screen overlays were under the header (Oct 29)

- **What:** `.content` now only gets its `view-transition-name` while a
  transition is running (`html:active-view-transition .content{...}`).
- **Why:** change 7 gave `.content` the name permanently, and a
  view-transition-name makes the element its own stacking context. Every
  full-screen overlay that lives inside a page (Alert History's snapshot
  viewer, Live fullscreen, the Settings password overlay) was then trapped
  under the header's `z-index:500` - the header icons sat on top of the
  snapshot viewer's zoom/Exit buttons. Found by the viewer test in 12.
- **Files:** `web/templates/base.html`
- **Tested:** page-transition suite again on plain Chrome 156 (13/13, old
  and new page still both animate); `.content` has no name at rest; the
  viewer's zoom button is the top element at its own position.

## 12. Alert History: step through snapshots (Oct 29)

- **What:** the existing snapshot viewer (zoom, pan, Esc) can now move to
  the next/previous snapshot: <- / -> keys, a swipe (touch or mouse drag)
  when not zoomed in, or the side buttons. "3 / 12" next to the title.
  The list is every visible row with a snapshot on the current page and
  filter, top to bottom; it stops at the ends. The new image slides 24px
  and fades in (220 ms), neighbours are preloaded. Zoomed in, a drag still
  pans. Dialog role, labels and image alt added.
- **Why:** plan item (Oct 31, "snapshot lightbox with arrow keys / swipe").
  The viewer already existed, so this extends it instead of adding a
  second one.
- **Files:** `web/server.py` (`history()`: data-snap/data-title on View
  buttons, viewer markup, script, styles)
- **Tested:** opens on the clicked one ("1 / n", no Prev); -> / <- step
  with new image + title and the slide-in; stops at both ends; Prev button;
  swipe left/right step and keep the viewer open; a mostly vertical drag
  doesn't step; zoomed, a drag pans; a plain backdrop click and Esc still
  close; keys do nothing while closed; rows hidden by the tier filter are
  skipped; reduced motion = no slide; 390px buttons on screen, no
  sideways scroll; no page errors. 22/22. Page 1 only had 2 real
  snapshots, so the test gave 5 more rows View buttons in the browser only.
- **Screenshot:** none committed - the only snapshots show a real person.

## 13. Keyboard shortcuts (Oct 29)

- **What (every page):** `A` arms; **hold** `A` for 1.2 s to disarm (the
  arm buttons show the same fill as a mouse hold; let go early and a toast
  says "Hold A for a second to disarm"; switching windows mid-hold
  cancels). `/` jumps to the search box (Alert History). `Esc` now also
  closes the account menu, clears toasts and leaves the search box (dialogs,
  drawer and snapshot viewer already closed on Esc). `?` lists the
  shortcuts in a toast. `aria-keyshortcuts` on the arm buttons and search.
- **Why:** Oct 31 plan item. Disarm keeps the hold rule so a stray keypress
  can never turn the system off. Shortcuts are ignored while typing in a
  field, with Ctrl/Alt/Cmd, on key-repeat, while offline (A) and while a
  dialog or the snapshot viewer is open, so they never fight page keys.
- **Files:** `web/static/statuslight.js`, `web/templates/base.html` and
  `web/server.py` (aria-keyshortcuts only)
- **Tested:** A arms; tap A while armed = fill + hint, still armed; hold A
  disarms with Undo; blur mid-hold = no disarm; A ignored with a dialog
  open and in the snapshot viewer; Esc still closes the dialog; Ctrl+A
  doesn't arm; ? toast; Esc closes menu + toasts; / does nothing without a
  search box; / focuses Alert History search, typing "aaa" there doesn't
  arm, Esc leaves it; no page errors. 17/17. Armed state restored.
- **Screenshot:** `docs/screenshots/13-shortcuts-help.png`

## 14. Phone tab bar (Nov 1 item, done Oct 29)

- **What:** at 600px and below, a bottom tab bar: Overview · Live · **Arm**
  · Alerts · More. Arm is the same `.hold` button as the sidebar's (tap
  arms, 1.2 s hold disarms, Undo toast); its label reads "Arm"/"Armed" and
  the shield turns the status colour when armed. Alerts carries the unread
  badge. More opens the existing drawer (Activity, Logs, Settings, status,
  account) and is highlighted on those pages. The header's menu button and
  bell hide at this width (the bar has both). The active tab gets a short
  bar in the status colour. Content, toasts and the drawer foot leave room
  for the bar (+ iPhone home-indicator inset where reported).
- **Why:** thumb reach; arming is the main phone action so it gets the
  middle slot. 601-900px keeps the drawer + menu button as before.
- **Files:** `web/templates/base.html` (tab bar markup, More opens the
  drawer), `web/static/statuslight.js` (Arm tab label/state),
  `web/static/style.css` (tab bar block at the end)
- **Tested (390px, touch):** bar/menu button/bell visibility at 390, 600,
  601, 768, 1440; correct tab active on all 6 pages; content ends above the
  bar and no sideways scroll on all 6; active bar in the status colour; tap
  Arm arms + toast above the bar; short press doesn't disarm; hold disarms
  with Undo; More opens the drawer, a drawer link navigates and closes it,
  tapping outside closes it; badge matches; no page errors. 23/23.
- **Screenshots:** `docs/screenshots/14-tabbar-armed-390.png`,
  `docs/screenshots/14-tabbar-more-390.png`

---

## 15. Alert History as cards on phones (Nov 1 item, done Oct 29)

- **What:** at 600px and below, each alert row is a card. Line 1 is the
  thumbnail, event name and sub line, with Delete on the right. Line 2 is
  camera · distance. Line 3 is the time, with View on the right. The
  column header row is hidden. In Select mode the checkbox sits on the
  left and tapping anywhere on a card selects it, as before.
- **Before:** the 6-column table scrolled sideways inside its panel, so
  Time, View and Delete sat off-screen at 390px.
- **How:** CSS only (a grid on the existing `<tr>`/`<td>`). The markup and
  JS are unchanged, so select mode, delete, filter/page swaps and the
  snapshot viewer work as they did. 601px and up is the table as before.
- **Files:** `web/server.py` (`history()` page `<style>`, one media block)
- **Tested:** cards at 390/600, the table at 601/768/1440, and no sideways
  scroll at any of them. View/Delete stay on-screen on every card. Camera
  and time line up under the event text. Select mode: the checkbox shows,
  a tap selects, and everything still fits. A tier filter swap keeps the
  cards. View opens the snapshot viewer. The empty state is full width.
  No page errors. 12/12. Delete wasn't run against real alerts; it only
  removes DOM rows, which the layout doesn't depend on.
- **Screenshots:** `docs/screenshots/15-history-cards-390.png`,
  `docs/screenshots/15-history-cards-select-390.png` (cropped above the
  first real snapshot thumbnail)

---

## 16. Live: swipe between cameras (Nov 1 item, done Oct 29)

- **What:** on Live, swipe the main feed sideways to go to the next or
  previous camera. The feed follows your finger, and the new camera slides
  in from the side it came from (transform/opacity, 280 ms). At the first
  or last camera the feed moves only a little and springs back; it doesn't
  wrap around. Dots under the feed (1000px and narrower, only when there
  is more than one camera) show which camera you're on, and tapping a dot
  jumps to that camera. ← → do the same on any width. The camera name is
  read out when it changes (`aria-live`).
- **Why:** on a phone the Cameras list is far below the feed. Swiping
  goes through the same `selectCam()` as the list, so REC, the Close/Open
  button and the loading overlay all follow.
- **Limits:** touch/pen only (a mouse drag does nothing). Short drags
  (under 50px), mostly-vertical drags and drags that start on a button are
  ignored. Vertical scroll and pinch-zoom stay with the browser
  (`touch-action:pan-y pinch-zoom`). Arrow keys follow the same rules as
  the other shortcuts (not while typing, with Ctrl/Alt/Cmd, or with a
  dialog open), via a new `caphyKeysFree(e)` in statuslight.js. The `?`
  help now says "← → snapshots or cameras". With reduced motion it still
  switches, with no slide.
- **Files:** `web/server.py` (`live()`: dots markup, the swipe / dots /
  arrow-key script, styles), `web/static/statuslight.js` (`caphyKeysFree`,
  help text)
- **Tested:** this laptop has one camera, so two stand-in cameras were
  added to the page in the test (their feeds are a blank image, which is
  why the screenshot says "Camera Loading..."). One camera: no dots, and a
  swipe does nothing. Three cameras at 390px: three dots, no sideways
  scroll. The feed follows the finger. Swiping left or right switches, and
  the name and dot follow. At either end there is no wrap and the feed
  springs back. A 30px drag and a vertical drag don't switch. Tapping a
  dot jumps to it. At 1440px the dots are hidden and the arrow keys work,
  but not while a dialog is open. A mouse drag doesn't switch. The slide
  runs for 280 ms, and doesn't run with reduced motion. `?` mentions
  cameras. No page errors. 20/20. **Not tested with two real cameras**;
  worth a quick check on a machine that has them.
- **Screenshot:** `docs/screenshots/16-live-camera-dots-390.png`

---

## 17. Accessibility pass (Nov 2 item, done Oct 29)

Found with a keyboard + markup audit of all 6 pages and all 8 Settings tabs
at 1440 and 390px (Tab through every stop; buttons/links without a name;
images without alt; fields without a label; focus with no visible ring;
focus landing on something hidden).

- **Hold buttons now work from the keyboard.** Was: `.hold` only listened
  for pointer presses, so with Enter/Space the Arm buttons did nothing and
  **"Hold to silence" couldn't be used at all**. Now Space/Enter on a
  focused hold button is the same as pressing it: a tap arms, holding the
  key 1.2 s disarms or silences, letting go early or moving focus away
  cancels. Holding Space doesn't scroll the page.
- **Status changes are spoken.** A hidden `role=status` region says
  "Status: Threat · siren on" etc. when the LEVEL changes (not on every
  poll, not on page load, not for arm/disarm, which the toast already
  says). The offline banner is `role=status` too.
- **Skip link.** The first Tab shows "Skip to content" top left; Enter
  jumps past the 8 sidebar stops.
- **Drawer (≤900px).** Was: the closed drawer's 8 links were still in the
  Tab order, off-screen. Now it's `visibility:hidden` when closed (flips
  after the slide-out, so the animation is unchanged). Opening it by
  keyboard moves focus to its first link; Esc closes it and returns focus
  to Menu / More.
- **Account button** was a `<div onclick>`: no keyboard focus, no name. Now
  a real `<button>` (same 38x38 look) with `aria-expanded`; Esc closes the
  menu.
- **Confirm dialog** is now `role=dialog` + `aria-modal`, labelled by its
  title. Focus moves into it; **danger dialogs start on Cancel**, so a stray
  Enter can't clear history. Tab stays on its two buttons; closing returns
  focus to what opened it.
- **Names and labels:** camera feeds have alt "<camera> live view" (Live
  updates it on switching); thumbnails next to a name have `alt=""`; the
  History search, the Detection sliders, the tier boxes, the two switches,
  camera names, display name and the password fields got labels (password
  fields also `autocomplete`). The camera slot selects lost an inline
  border that hid the focus border. Switches show a focus ring on the
  track (the real checkbox is invisible). The bell says the unread count.
- **Files:** `web/templates/base.html`, `web/static/statuslight.js`,
  `web/static/style.css`, `web/server.py`
- **Tested:** the audit again (clean on every page/tab at both widths), plus
  27/27 behaviour checks: skip link shows and lands in the content; Account
  by Enter/Esc and by mouse; dialog focus, Tab trap, Esc returns focus,
  nothing cleared; Enter arms; a 0.4 s Space tap doesn't disarm; a 1.4 s
  Space hold disarms; Space arms without scrolling; focus leaving mid-hold
  cancels; status change announced once and not repeated; Space-hold on
  "Hold to silence" silences (siren and state were **stood in** in the
  test, the real siren never sounded); drawer at 390 and 768: never in the
  Tab order when closed, focus in on open, Esc slides it out and returns
  focus; More by mouse still works; Live alt text. Re-ran the earlier
  tab bar (23/23), cards (12/12), swipe (20/20), Live hold (11/11),
  shortcuts (17/17) and toast (21/21) tests. Two of those needed test
  updates, not code fixes: the toast test still tapped the Menu button
  that the tab bar hides at 390px, and the shortcuts test expected focus
  on the page after clicking Account (it's a real button now, so it keeps
  focus). Also fixed a timing slip in the toast test: it checked the other
  tab's 4 s toast after a slow screenshot.
- **Not tested with a real screen reader** (NVDA/Narrator); the checks
  read the roles, names and live-region text directly.
- **Screenshot:** `docs/screenshots/17-skip-link.png`

---

## 18. Performance: hidden tabs stop polling and streaming (Nov 2 item, done Oct 29)

- **What:** while a tab is hidden (minimised window, another tab in front):
  - the status poll (2 s), the online check (8 s), Live's camera/log
    poll (1.5 s) and state poll (2 s), Activity's 4 s poll and Logs' 1.5 s
    tail all **skip**, and each runs **once straight away** when the tab
    is shown again, so nothing looks stale;
  - every camera video `<img>` (Overview tiles, Live main feed and
    thumbnails) **drops its MJPEG stream** and reconnects when shown.
    A tab opened in the background doesn't start streaming until it's
    looked at.
- **Why:** each viewer's video costs the laptop a JPEG encode per frame,
  and every poll is a request to the laptop that's also running YOLO. Was:
  plain `setInterval` and always-on streams, so a forgotten tab cost the
  same as one being watched.
- **How:** `caphyEvery(fn, ms)` in base.html's `<head>` (inline so the
  pages' own inline scripts can use it) replaces those `setInterval`s.
  `pauseFeeds()` in statuslight.js parks each feed's `src` in
  `data-feed-src` and puts back a 1px blank, on the same visibilitychange
  that already closes the alert stream. Left as is: History's own alert
  stream (idle until an alert arrives, and it drives the "new alerts"
  banner) and the Settings OTP countdown. `console.html` (the old /console
  page) wasn't touched.
- **Files:** `web/templates/base.html`, `web/static/statuslight.js`,
  `web/server.py` (Live, Activity, Logs scripts)
- **Tested (17/17):** headless Chrome can't really hide a tab, so the test
  overrides `document.hidden` and fires `visibilitychange`. On Overview
  and Live: hidden parks every feed, and the laptop's established
  connections on :5000 drop **2 -> 0** (the video and the alert stream
  really close). There are zero state/health/stats/logs/video requests
  in 7.5 s hidden. When shown, each poll fires at once, the feeds
  reconnect with the right src, and the connections come back. Activity
  and Logs stop while hidden and fire at once when shown. Opened hidden:
  parked until shown. No page errors. Re-ran the alert (18/18), Live
  (11/11), keyboard (27/27) and swipe (20/20) tests. A real minimise is
  checked in the pywebview window (next section).

---

## 19. Desktop window (pywebview) check + fix: minimising now pauses too (Nov 2 item, done Oct 29)

- **How it was tested:** pywebview isn't installed in `.venv` (and isn't in
  `requirements.txt`), so it went into the test folder only; `.venv` is
  untouched. A small harness opens the window with the **same
  `create_window()` arguments and `_WindowApi`** as `caphy_desktop.py`
  (frameless, 1200x800, js_api), with a throwaway WebView2 profile, so
  your real desktop sign-in wasn't touched. Playwright drove the real
  window through WebView2's debug port. WebView2 here is Edge 156.
- **Works in the window:** the CAPHY title bar and `pywebview.api`; all 6
  pages render with no sideways scroll at the window's size; page
  transitions run; Arm click, the 1.2 s hold disarm, and the Armed /
  Disarmed+Undo toasts; keyboard shortcuts; no page errors.
- **Found:** minimising the window did **not** pause anything. WebView2
  keeps reporting `visibilityState: "visible"` while minimised, so the
  hidden-tab pause from section 18 never kicked in. A minimised console
  kept polling and pulling MJPEG.
- **Fix:** `caphy_desktop.py` has a new `_wire_minimize_pause(window)`.
  It passes pywebview's `minimized` / `restored` / `maximized` events to
  the page through `caphySetAppHidden()`, and both launchers call it
  (`desktop_launcher.py` imports it). In base.html, `caphyIsHidden()` =
  `document.hidden` or "the app window is minimised". `caphyEvery()` and
  statuslight.js use it, and a minimise re-fires `visibilitychange` so it
  goes down the same path as a tab switch.
- **Files:** `caphy_desktop.py`, `desktop_launcher.py`,
  `web/templates/base.html`, `web/static/statuslight.js`
- **Tested (19/19, in the real window):** everything above, plus:
  - The title bar's minimise button really minimises (`IsIconic`).
  - Minimised: the page is told, Live's feeds are parked, there are 0
    requests in 5 s, and the laptop's connections go 2 -> 0.
  - Restored: polls and video come back.
  - Maximised, then minimised from the taskbar: it pauses, and resumes
    when it comes back maximised. pywebview sends no "restored" event in
    that case, which is why `maximized` is hooked too.
  - Not run: the packaged .exe (needs a PyInstaller build) and
    `Start_CAPHY.bat`. Both go through the same helper.
- **Screenshot:** `docs/screenshots/19-desktop-window-overview.png`

---

## 20. Dark scrollbars and form controls (`color-scheme:dark`) (Oct 29)

- **What:** `color-scheme:dark` on `:root`, so the browser's own parts
  (scrollbars, `<select>` lists, native checkboxes and pickers) draw dark.
- **Why:** found in the desktop window test. A light-grey Windows
  scrollbar ran down the side of the dark console, and in any browser on
  long pages.
- **Files:** `web/static/style.css`
- **Tested:** the desktop window again (19/19): the scrollbar is now a
  dark track with a grey thumb. The login page looks unchanged (its
  inputs keep their own colours), `color-scheme` computes to `dark`, and
  there are no page errors.

---

## 21. Fix: Settings descriptions at body size (Oct 29)

- **What:** `.fdesc` (small grey description) is now styled everywhere,
  not only inside `.field`. The toggle rows on Detection ("Brightens dark
  camera images automatically.") and two lines on the Users tab were
  rendering at body size.
- **Files:** `web/static/style.css`
- **Tested:** the toggle-row descriptions are 12px `--muted`; the field
  descriptions are unchanged (12px, 10px gap below).
- **Screenshot:** `docs/screenshots/21-settings-toggle-desc.png`

---

## 22. Fix: "server down" no longer says "You're offline - Local Mode" (Oct 29)

- **What:** the top bar now has two wordings. With no internet it says
  "You're offline - Local Mode" (as before). When the server can't be
  reached it says "**Can't reach CAPHY** - check that the laptop is on and
  CAPHY is running. This page reconnects by itself.", in offline's gray.
  The server-down bar follows the gray status light exactly (3 missed
  polls, about 6 s), so the bar and logo always agree. On phones, where
  the sidebar status text is out of sight, this bar is the only words
  that say what's wrong.
- **Why:** `caphyCheckOnline()` treated "couldn't ask `/api/health`" as "no
  internet", which pointed people at their Wi-Fi when the laptop or
  CAPHY was actually off.
- **Files:** `web/templates/base.html` (second line in the bar;
  `caphyCheckOnline()` no longer shows the Local Mode bar when it can't
  ask), `web/static/style.css` (`html[data-level="offline"] .offlinebar`)
- **Tested:** no internet (stand-in `/api/health`) shows the Local Mode
  wording; online shows no bar. Server really stopped: about 6 s later
  the logo goes gray and the bar says "Can't reach CAPHY" with a gray
  line. It fits at 390px. Server restarted: the bar goes away.
- **Screenshot:** `docs/screenshots/22-server-down-390.png`

---

## 23. Fix: the bell / Alerts-tab count is live (Oct 29)

- **What:** `/api/state` now carries `unread` (the same
  `count_alerts(include_dismissed=False)` the page header used), and
  statuslight.js updates the header bell and the phone Alerts tab badge
  on every poll: it adds, changes or removes the badge, shows "99+" from
  100, and keeps the bell's `aria-label` in step ("Alert History, 7
  unread").
- **Why:** the badge was only counted when the page was drawn, so a new
  alert, or a delete from the phone, never changed it until you
  navigated.
- **Files:** `web/server.py` (`_unread_count()`, used by `page()` and
  `/api/state`), `web/static/statuslight.js` (`setBadges`)
- **Tested:** the real count matches the badge (48). With stand-in counts
  49 / 0 / 7 / 150 at 1440 and 390, the visible badge reads 49 / none /
  7 / 99+ and the aria-label follows. It goes back to the real count
  after. The phone app ignores the extra field.
- **Screenshot:** `docs/screenshots/23-live-badge.png`

---

## 24. Command-center look, part 1: the shared shell (Oct 29)

The new look Marl approved in `docs/mockup_command_center.html`, built into
the shared layout so every page gets it. The design rules are unchanged:
flat surfaces, status colours only for status, white-on-ink buttons, the
1.2 s hold.

- **Status strip (header):**
  - A status pill, e.g. "CLEAR · ARMED".
  - A **Ctrl+K** command bar button.
  - A live clock.
  - The bell and account buttons, as before.
  - The camera-count pill moved out; the sidebar already shows the count.
  - As the strip narrows, the subtitle goes first (under 1280px), then the
    clock and the button's label (under 1100px).
- **Phones:** the sidebar is hidden there, so the status-light logo sits
  top-left in the header. The pill drops "· ARMED"; the logo ring and the
  Arm tab already show it.
- **Sidebar:** MONITOR / SYSTEM sections. Alert History carries the unread
  count, which stays live. The "G then a letter" hints show on hover.
- **Status edge:** a thin frame round the screen in the status colour.
  It's faint when clear, stronger when watching or offline, and breathes
  during a threat (opacity only).
- **Incident card** (the old red siren bar, reworked): it shows during a
  threat or while the siren sounds, under the strip on every page. It
  reads "TIER 3 · THREAT · SIREN ON", then "Person detected at Front
  door", then "1.8 m away · Front door", with **View live** and
  **Hold to silence**. The silence button only appears while the siren is
  on.
- **Command bar** (`static/cmdk.js`): Ctrl+K or the header button.
  - It covers the pages, every Settings tab, Tier 3 / today / last-24-h
    alerts, Arm, and Log out. Typing a date searches alerts.
  - **Disarm only explains the hold**; nothing in it sounds the siren.
  - Keyboard: ↑↓ Enter Esc; focus stays in it and goes back to where you
    were.
  - **G then O / L / H / Y / S / E** jumps to Overview / Live / History /
    Activity / Logs / Settings. Alerts is H because A alone arms.
- **`--dim` raised** from #625E6E to #827E8E, so small grey text now meets
  4.5:1 everywhere. This was in the approved mockup.
- A minimised desktop window also pauses the CSS loops (the edge, the
  logo).
- **Files:** `web/templates/base.html`, `web/static/style.css` (the
  COMMAND-CENTER SHELL block), `web/static/statuslight.js`,
  `web/static/cmdk.js` (new), `web/server.py` (`NAV_KEYS`,
  `_STRIP_WORD`, `cmdk.js` in `CSS_VER`)
- **Tested (22/22):**
  - All 6 pages at 1440, 768 and 390: no sideways scroll, the header
    fits, and the logo is top-left on phones.
  - The pill matches `/api/state`; the clock ticks; the sections and
    count are right; the edge is in the status colour.
  - Command bar: Ctrl+K opens with focus in the box; "tier 3" + Enter
    goes to the filter; a date offers an alert search; Esc closes; the
    header button works; "users" goes to the Users tab. "Arm system"
    arms, and "Disarm system" doesn't disarm.
  - G L and G H jump; G O while typing in search does nothing.
  - Incident card (stand-in state, so the real siren never sounded): the
    text is right, there's no silence button without the siren, it
    appears with the siren, and the edge breathes. It fits at 390 and
    goes away after.
  - The minimise pause works.
  - Re-run: markup audit clean, status light 12/12, keyboard 27/27, tab
    bar 23/23, fixes 20/20.
- **Screenshots:** `docs/screenshots/24-shell-1440.png`, `-threat.png`,
  `-cmdk.png`, `-390.png`

---

## 25. Command-center look, part 2: Overview (Oct 29)

- **Status hero:** the sentence is the status ("WATCHING · TIER 2",
  "Someone at Cam 0.", "3.1 m · recording a short clip"), and the big
  logo copy is gone. The sidebar/header logo is the one status light.
  The quick actions sit on the right: **Snapshot all** (every camera
  that's on; it says so if they're all off) and an Arm button that works
  like the sidebar one (click arms, 1.2 s hold disarms).
- **Camera wall:**
  - Every camera has corner brackets and "CAM 01 · name" on the video.
  - REC sits clear of the bracket.
  - A **PERSON · 3.1 m · T2** chip and a status-colour border appear on
    the camera that sees someone. The box round the person is still the
    detector's own drawing on the frame.
  - Clicking a tile opens Live.
  - An off camera keeps its brackets and name over the "Camera off"
    cover.
- **Distance radar** (replaces the flat meter bar):
  - The 10 m in front of the camera as a half circle, with rings at the
    Tier 1 / Tier 3 boundaries. The zones are tinted by what each tier
    means.
  - A dot shows the person, plus a line such as "Person 3.1 m from Cam 0
    · Tier 2". It moves closer as they do.
  - The sweep stops when the cameras are off or the page is offline.
  - It uses the same `config.py` thresholds the meter did (still the open
    question about using the Settings values).
- **Last 24 hours:**
  - One bar per real hour, ending now. The top edge shows the worst tier
    in that hour (yellow / red); the bars themselves are neutral counts.
  - Hover or focus shows "17:00 · 9 alerts".
  - **Clicking a bar opens Alert History for that hour**
    (`?q=2026-10-29T17`).
  - Also fixed: the old chart grouped by hour-of-day against a UTC "now"
    while the timestamps are local, so its hours could be shifted.
- **Recent alerts:** now include the camera name. Live-added rows match.
- **Files:** `web/server.py` (`dashboard()`), `web/static/style.css`
  (the COMMAND-CENTER OVERVIEW block)
- **Tested (14/14):**
  - Hero: no second logo, quick actions present.
  - One tile per camera, with 4 brackets and the label; REC clear of the
    bracket.
  - 24 bars ending "now"; hover tooltip; clicking the 17:00 bar opens
    History with that hour's 9 alerts.
  - Hero Arm: click arms, the hold disarms, and the label follows.
  - Snapshot all with the camera off says so.
  - Stand-in states: a person at 3.1 m shows the dot, the text and the
    chip on that tile; at 1.5 m the dot moves toward the camera; with
    nobody, the dot and chip go.
  - No sideways scroll at 768 or 390; no page errors.
  - Re-run: count-up 9/9, alert toast 18/18 (its expected row text now
    includes the camera), status light 12/12.
- **Screenshots:** `docs/screenshots/25-overview-1440.png`, `-watch.png`,
  `-390.png`

---

## 26. Command-center look, part 3: Live overlay (Oct 29)

- **What:**
  - The main feed gets the camera wall's corner brackets and
    "CAM 01 · name" on the video.
  - The two detection factors are chips at the bottom left (**F1
    MOTION**, **F2 PERSON**); each lights up with a status-colour edge
    when it fires.
  - While someone is in view, the distance shows big at the bottom
    right with what that tier does ("2.7 m", "TIER 2 · CLIP", the same
    words as Overview's meter), and the feed border and brackets turn the
    status colour.
  - It all follows a camera switch (list, swipe, dots, ← →) and starts
    clear for the new camera.
- **Why:** it was a floating "DETECTION" box over the top-left of the
  picture. Now the picture stays clear and reads like a CCTV monitor.
- **Files:** `web/server.py` (`live()` markup + `showDetection()`; poll()
  calls it), `web/static/style.css` (the COMMAND-CENTER LIVE block)
- **Tested (8/8):**
  - 4 brackets and the label; the old box is gone.
  - A stand-in `/api/stats` person at 2.7 m Tier 2 lights both chips,
    shows "2.7 m / TIER 2 · CLIP" and the border. Motion only lights F1
    alone, with no distance.
  - Switching to a stand-in second camera shows "CAM 02 Garage", cleared.
  - At 768 and 390 the overlay stays inside the feed, with no sideways
    scroll. No page errors.
  - Re-run: Live hold 11/11, swipe 20/20.
- **Screenshot:** `docs/screenshots/26-live-overlay.png` (stand-in
  person; the camera was off)

---

## 27. Command-center look, part 4: the other pages (Oct 29)

- **What:** the shared pieces every page uses, in the console style.
  - Panel headings and table headers are small mono uppercase labels
    ("LIVE LOG", "EVENT · CAMERA · DISTANCE"). The History count stays
    white inside its label.
  - The active filter pill is filled white: it's an action, not a status.
  - Tier and REC tags are square mono chips.
  - Settings' active tab gets the sidebar's status-colour edge (a bottom
    bar when the tab list scrolls sideways on narrow screens).
  - Section labels inside Settings ("THREE-TIER DISTANCE THRESHOLDS") are
    mono.
- **Old-brand leftovers removed:** 10 teal tints (`rgba(63,215,196,…)`)
  on History (icon tiles, View hover, selected rows, the new-alerts
  banner), Live (state chips, Open All hover), Logs' filter buttons and
  the Google sign-in note are now neutral.
- **Files:** `web/static/style.css` (the COMMAND-CENTER PAGES block),
  `web/server.py` (the teal tints)
- **Tested:** History, Activity, Logs and Settings at 1440 and 390 with
  no sideways scroll and no errors (10/10). Re-run: History cards 12/12,
  tab bar 23/23, keyboard 27/27, snapshot viewer 22/22.
- **Screenshots:** `docs/screenshots/27-settings-1440.png`,
  `-logs-1440.png`, `-activity-390.png`. No History screenshot: its
  thumbnails are real snapshots.

---

## Noticed, not changed

- In the offline state the Camera-off overlay disappears (offline state has
  no camera list), leaving a plain black box. Same as before the cleanup.
- Phone, drawer open: a toast sits over the drawer's arm button for its
  4 s (x closes it). The Nov 1 bottom tab bar replaces the drawer anyway.
- In the 340px alert toast the "camera · distance · time" line wraps to two
  lines when View is shown. Readable; cutting it would hide the time.
- Overview's meter (now the radar, §25) always shows the config defaults (4.5 / 2.5 m, fixed
  55/20/25 band widths), not the thresholds saved in Settings - after
  changing them in Settings the two meters disagree.
- Tier wording differs: Overview's meter says "Tier 1 · snapshot, Tier 2 ·
  clip, Tier 3 · siren"; Settings' cards say "Record event only / Take a
  snapshot and notify / Record video, sound siren, and notify". Which is
  right is Kem's call (detection rules).
- Live: the Cameras list tiles are `<div onclick>`, so they can't be
  reached by Tab. The ← → keys (section 16) now cover switching cameras
  from the keyboard; making the tiles buttons would also need their nested
  fullscreen button moved.
- The sidebar logo (click = logo animation) isn't keyboard-reachable; it's
  decorative, and the status it shows is also in the text under it.
