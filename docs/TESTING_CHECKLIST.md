# brand-refresh: testing checklist

Hi Kem - this is Marl's UI/UX pass (motion, phone layout, interactive,
accessibility). Everything is on the `brand-refresh` branch, one small
commit per change, so each one can be reviewed or reverted on its own.
Detection, tier logic and alert rules are not touched.

- **What changed and why:** `docs/UI_UPDATE_NOTES.md`. The summary at the
  top has the section index (§1-§23) and the demo path. Screenshots are
  in `docs/screenshots/`.
- **Server-side changes (both UI-facing):** `/api/state` now also returns
  `unread` (§23). Both desktop launchers pass minimise/restore to the
  page (§19).
- **Questions for you:** see "Needs a decision" in the notes summary
  (tier wording on Overview vs Settings, and the Overview meter using
  saved thresholds).

## Setup

```powershell
git fetch
git checkout brand-refresh
.\.venv\Scripts\Activate.ps1
python app.py
```

Open http://127.0.0.1:5000 and press **Ctrl+F5** once so the new CSS/JS
load. Sign in with your normal account. Optional: a local test account
that needs no Firebase. Put `caphy_dev_login.json` in the project root
containing `{"email": "...", "password": "..."}`. It only works from
127.0.0.1, and deleting the file turns it off. It is never committed.

Phone layout: F12, then Ctrl+Shift+M, at **390px** and **768px**. Or open
`http://<laptop-IP>:5000` from a real phone on the same Wi-Fi.

## Every page (desktop width)

- [ ] **Page transitions:** click between pages. Only the content fades
  and rises; the sidebar and header stay put. (§7)
- [ ] **Arm toast:** click **Arm system** in the sidebar. You get the
  "Armed." toast with the siren/phone-alert rule line. (§4)
- [ ] **Hold to disarm:** hold the same button about 1.2 s. "Disarmed."
  appears with **Undo**, and Undo arms again. A short press does
  nothing. (§4)
- [ ] **Shortcuts:** `A` arms; holding `A` disarms; `?` lists the
  shortcuts; `Esc` closes menus and toasts. (§13)
- [ ] **Skip link:** first **Tab** on a page shows "Skip to content" top
  left, and Enter skips the sidebar. (§17)
- [ ] **Account button:** Tab to the account icon, Enter opens the menu,
  Esc closes it. (§17)
- [ ] **Bell count:** it changes on its own when alerts come in or are
  deleted, with no reload. (§23)
- [ ] **Dark scrollbar** down the right side. (§20)
- [ ] **Server down:** stop `app.py` with the page open. After about 6 s
  the logo goes gray and the top bar says **"Can't reach CAPHY"**, not
  "You're offline - Local Mode". Restart and it clears. (§22)

## Overview

- [ ] **Count-up:** the stat numbers count up on load. (§8)
- [ ] **New alerts:** a toast appears on any page, with **View** going to
  History. Recent Alerts and the counts update without a reload. (§6)
- [ ] **Camera tile:** fills its column on a wide screen. Please also
  check the video crop with the camera on. (§1)

## Live Camera

- [ ] **Arm button:** needs the 1.2 s hold to disarm, like the
  sidebar. (§5)
- [ ] **Switching cameras:** with 2+ cameras, ← → switch. On a phone,
  swipe the video sideways; the dots under it show which camera is on
  screen. This was only tested with stand-in cameras, so please try it
  with two real ones. (§16)

## Alert History

- [ ] **Snapshot viewer:** **View** a snapshot, then ← → (or ‹ ›) step
  through them; the counter reads "3 / 12"; Esc closes. (§12)
- [ ] **Search shortcut:** `/` jumps to the search box. (§13)
- [ ] **Row fade:** after a tier filter or page change the rows fade up
  in turn. (§9)
- [ ] **Clear History dialog:** focus starts on **Cancel**, Tab stays in
  the dialog, Esc closes it. (§17)

## Activity

- [ ] **Loading skeleton:** on a slow load, gray placeholder rows show
  first, then the real rows fade in. (§9)

## Settings -> Detection

- [ ] **Tier meter:** drag the two handles. The bands and the Tier 1 /
  Tier 3 boxes follow, typing in a box moves its handle, and nothing
  saves until **Save**. (§10)
- [ ] **Toggle descriptions:** the lines under the toggles are small
  gray text, not body size. (§21)

## Phone (390px)

- [ ] **Bottom tab bar:** Overview · Live · **Arm** · Alerts (badge) ·
  More. A tap arms, a hold disarms, and More opens the menu. (§14)
- [ ] **Alert History cards:** each alert is a card, with Delete top
  right and View bottom right. Select mode still works. (§15)
- [ ] **No sideways scrolling** on any page, at 390 or 768.
- [ ] **768px menu:** the drawer opens from the menu button, and Tab
  doesn't go into the menu while it's closed. (§17)

## Background / desktop

- [ ] **Hidden tab:** switch to another tab, then come back. It updates
  straight away and the feed reconnects. While hidden, the laptop sends
  it no video or polls. (§18)
- [ ] **Desktop window:** needs `pip install pywebview` (not in
  requirements). Stop `app.py`, then run `python caphy_desktop.py`.
  Minimise on Live, then restore; the feed reconnects. The title bar
  buttons work. (§19)

## Not tested yet

- Live swipe with two real cameras
- The video crop with the camera on
- A real screen reader (Narrator / NVDA)
- The packaged .exe build

If something looks off, note the page, the screen width and what you
saw, and the notes section number if you know it.
