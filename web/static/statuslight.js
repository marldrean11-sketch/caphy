/* CAPHY status light - keeps the logo (and anything else styled off
   html[data-level]) in step with the laptop's real state.

   Levels come from /api/state's `level` (computed once in server.py's
   _status_light so the web console and the phone always agree):
     clear (violet) / idle (violet, eye closed: cameras switched off) /
     watch (yellow) / threat (red)
   plus "offline" (gray), which only the client can know: it's set when
   this page can no longer reach the CAPHY server at all.

   Also wires every .hold button: disarm and silence need a 1.2 s press
   so they can never be an accidental click. */
/* Was: var + .then chains. Now const/let + async/await to match the rest
   of Kem's JS; behaviour is unchanged. Still wrapped in an IIFE so only
   the window.caphy* functions below are global. */
(function () {
  const root = document.documentElement;
  let fails = 0;
  const HOLD_MS = 1200;
  // armed state from the last real (non-offline) poll; null until the first
  // one, so loading a page never toasts
  let lastArmed = null;
  // when THIS tab finished a disarm hold - only that tab gets Undo
  let disarmedHereAt = 0;
  const UNDO_WINDOW_MS = 10000;

  // "1 of 2 cameras watching · 1 off" - same wording as cams_text() in
  // server.py, so the sidebar, header and Overview never disagree
  function camText(st) {
    const total = st.cams_total || 0, on = st.cams_on || 0, online = st.cams_online || 0;
    if (!total) return "No cameras set up";
    const t = online +" of " + total + " camera" + (total !== 1 ? "s" : "") + " watching";
    return total - on ? t + " · " + (total - on) + " off" : t;
  }
  window.caphyCamText = camText;

  function apply(st) {
    root.dataset.level = st.level || "clear";
    root.dataset.armed = st.armed ? "true" : "false";
    root.dataset.siren = st.siren_active ? "true" : "false";
    // offline has no armed field (it reads as false), so it must not count
    // as a change - otherwise reconnecting would toast "Armed." out of nowhere
    if (st.level !== "offline") {
      const armedNow = !!st.armed;
      if (lastArmed !== null && armedNow !== lastArmed) announceArm(armedNow);
      lastArmed = armedNow;
    }

    const txt = document.getElementById("lvlTxt");
    if (txt) txt.textContent = describe(st);
    if (st.level !== "offline") {
      const sc = document.getElementById("sideCams");
      if (sc) sc.textContent = camText(st);
      const hc = document.getElementById("hdrCams");
      if (hc) hc.textContent = (st.cams_online || 0) + " / " + (st.cams_total || 0) + " CAM";
    }
    // per-camera REC badges and "Camera off" overlays (data-*-cam = index
    // into st.cameras)
    const cams = st.cameras || [];
    document.querySelectorAll("[data-rec-cam]").forEach(function (el) {
      const c = cams[+el.dataset.recCam];
      el.classList.toggle("show", !!(c && c.rec_active));
    });
    document.querySelectorAll("[data-off-cam]").forEach(function (el) {
      const c = cams[+el.dataset.offCam];
      el.classList.toggle("show", !!(c && !c.on));
    });
    const meta = document.getElementById("sirenMeta");
    if (meta) {
      const d = st.distance ? " · " + st.distance + " m" : "";
      meta.textContent = st.tier ? "Tier " + st.tier + d : "manual";
    }
    const arm = document.getElementById("sideArmBtn");
    if (arm) {
      arm.classList.toggle("armed", !!st.armed);
      arm.querySelector(".lbl").textContent = st.armed ? "Hold to disarm" : "Arm system";
    }
    document.dispatchEvent(new CustomEvent("caphy:state", { detail: st }));
  }

  // Toast on ANY arm/disarm - sidebar, Live page button, phone app or voice -
  // because every open page sees the flip in /api/state. Wording matches the
  // siren / push rules in server.py (Tier 3 sirens even when disarmed;
  // arming adds Tier 2 siren and pushes for every tier).
  function announceArm(armed) {
    if (!window.caphyToast) return;
    if (armed) {
      window.caphyToast({ text: "Armed.", sub: "Siren from Tier 2, phone alerts for every tier." });
      return;
    }
    const mine = Date.now() - disarmedHereAt < UNDO_WINDOW_MS;
    disarmedHereAt = 0;
    window.caphyToast({
      text: "Disarmed.", sub: "Siren and phone alerts on Tier 3 only.",
      // Undo = arm again, which is one click anyway, so it's never risky
      action: mine ? "Undo" : null, ms: mine ? 6000 : 4000,
      onAction: function () { post("/api/arm", { on: true }); }
    });
  }

  // ---- new alerts, on every page ----
  // /api/alerts/stream already pushes each alert the moment it's saved; it
  // also carries {event:"changed"} for deletes/dismissals, which aren't new
  // alerts. Each new one becomes a "caphy:alert" event (so a page can add
  // its own row) plus a toast. The stream is closed while the tab is
  // hidden: a toast nobody sees is wasted, and each open stream holds a
  // server thread on the laptop that's also running YOLO.
  let stream = null;

  function onAlertMsg(ev) {
    let a = null;
    try { a = JSON.parse(ev.data); } catch (e) { return; }
    if (!a || a.event === "changed" || a.id == null) return;
    document.dispatchEvent(new CustomEvent("caphy:alert", { detail: a }));
    announceAlert(a);
  }

  function announceAlert(a) {
    if (!window.caphyToast) return;
    const tier = a.tier || 1;
    const time = String(a.timestamp || "").slice(11, 19);
    const sub = [a.camera, a.distance_m != null ? a.distance_m + " m away" : "", time]
      .filter(Boolean).join(" · ");
    const onHistory = location.pathname.indexOf("/history") === 0;
    window.caphyToast({
      tier: tier, text: "Tier " + tier + " · " + (a.event || "Person detected"), sub: sub,
      // Tier 3 stays longer: it's the one that matters if you glanced away
      ms: tier >= 3 ? 10000 : 6000,
      action: onHistory ? null : "View",
      onAction: function () { location.href = "/history"; }
    });
  }

  function openStream() {
    if (stream || !window.EventSource) return;
    stream = new EventSource("/api/alerts/stream");
    stream.onmessage = onAlertMsg;
  }
  function closeStream() {
    if (stream) { stream.close(); stream = null; }
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) closeStream(); else openStream();
  });

  function describe(st) {
    if (st.level === "offline") return "Can't reach CAPHY";
    if (st.level === "threat") return st.siren_active ? "Threat · siren on" : "Threat";
    if (st.level === "watch") {
      if (st.tier) return "Watching · Tier " + st.tier;
      return st.cams_down === 1 ? "A camera is down" : st.cams_down + " cameras down";
    }
    if (st.level === "idle") return st.cams_total ? "Cameras are off" : "No cameras";
    return st.armed ? "Clear · armed" : "Clear";
  }

  async function poll() {
    try {
      const r = await fetch("/api/state", { cache: "no-store", credentials: "same-origin" });
      if (!r.ok) throw r.status;
      const st = await r.json();
      fails = 0;
      apply(st);
    } catch (e) {
      // one missed poll is a blip; three in a row (~6 s) means the
      // server is gone, so the eye closes and the logo goes gray
      if (++fails >= 3) apply({ level: "offline" });
    }
  }

  // re-polls whether the POST worked or not, so the UI always shows the
  // server's real state rather than what we hoped it did
  async function post(url, body) {
    try {
      await fetch(url, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
    } catch (e) {}
    return poll();
  }

  const actions = {
    disarm: function () { disarmedHereAt = Date.now(); return post("/api/arm", { on: false }); },
    silence: function () { return post("/api/siren/silence"); }
  };

  document.addEventListener("pointerdown", function (e) {
    const btn = e.target.closest(".hold");
    if (!btn) return;
    let act = btn.dataset.act;
    if (act === "arm") {
      // arming is never dangerous, so it's a normal click; only disarming holds
      if (root.dataset.armed !== "true") { post("/api/arm", { on: true }); return; }
      act = "disarm";
    }
    btn.classList.add("holding");
    btn.addEventListener("pointerleave", cancel, { once: true });
    btn._holdTimer = setTimeout(function () {
      btn.classList.remove("holding");
      if (actions[act]) actions[act]();
    }, HOLD_MS);
  });
  function cancel() {
    document.querySelectorAll(".hold.holding").forEach(function (b) {
      b.classList.remove("holding");
      clearTimeout(b._holdTimer);
    });
  }
  ["pointerup", "pointercancel"].forEach(function (ev) {
    document.addEventListener(ev, cancel, true);
  });

  // ---- keyboard shortcuts (every page) ----
  //   A    arm; HOLD A for 1.2 s to disarm - same rule as the buttons, so a
  //        stray keypress can never turn the system off
  //   /    jump to the page's search box (Alert History)
  //   Esc  also closes the account menu, clears toasts and leaves the search
  //        box (dialogs, the drawer and the snapshot viewer already close)
  //   ?    list these in a toast
  // Ignored while typing in a field, with Ctrl/Alt/Cmd, or while a dialog
  // is open, so they never fight the page's own keys.
  let keyHoldTimer = 0;
  function typing(t) {
    return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }
  function dialogOpen() {
    return !!document.querySelector("#appModal.show, #logoModal.open, .snapmodal.show");
  }
  function armButtons() { return document.querySelectorAll('.hold[data-act="arm"]'); }
  function endKeyHold() {
    if (!keyHoldTimer) return false;
    clearTimeout(keyHoldTimer); keyHoldTimer = 0;
    armButtons().forEach(function (b) { b.classList.remove("holding"); });
    return true;
  }
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Escape") {
      const menu = document.getElementById("profileMenu");
      if (menu) menu.classList.remove("show");
      document.querySelectorAll(".ctoast .x").forEach(function (x) { x.click(); });
      if (typing(e.target)) e.target.blur();
      return;
    }
    if (typing(e.target) || dialogOpen() || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "a") {
      if (root.dataset.level === "offline") return;
      e.preventDefault();
      if (root.dataset.armed !== "true") { post("/api/arm", { on: true }); return; }
      armButtons().forEach(function (b) { b.classList.add("holding"); });
      keyHoldTimer = setTimeout(function () {
        keyHoldTimer = 0;
        armButtons().forEach(function (b) { b.classList.remove("holding"); });
        actions.disarm();
      }, HOLD_MS);
    } else if (e.key === "/") {
      const box = [...document.querySelectorAll('.searchbox input, input[type="search"]')]
        .find(function (i) { return i.offsetParent !== null; });
      if (box) { e.preventDefault(); box.focus(); box.select(); }
    } else if (e.key === "?") {
      if (window.caphyToast) window.caphyToast({
        text: "Keyboard shortcuts", ms: 8000,
        sub: "A arm · hold A to disarm · / search · Esc close · ← → snapshots"
      });
    }
  });
  document.addEventListener("keyup", function (e) {
    if (e.key.toLowerCase() !== "a") return;
    // let go too early: say how, instead of silently doing nothing
    if (endKeyHold() && window.caphyToast) window.caphyToast({ text: "Still armed.", sub: "Hold A for a second to disarm." });
  });
  // switching windows mid-hold must not leave a disarm pending
  window.addEventListener("blur", endKeyHold);

  // "Turn on" on a Camera off overlay
  function resumeCam(idx) { return post("/api/camera/" + idx + "/resume"); }
  window.caphyResumeCam = resumeCam;

  window.caphyStatusPoll = poll;
  poll();
  if (!document.hidden) openStream();
  setInterval(poll, 2000);
})();
