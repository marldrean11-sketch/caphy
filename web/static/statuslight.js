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

  // "1 of 2 cameras watching · 1 off" - same wording as cams_text() in
  // server.py, so the sidebar, header and Overview never disagree
  function camText(st) {
    const total = st.cams_total || 0, on = st.cams_on || 0, online = st.cams_online || 0;
    if (!total) return "No cameras set up";
    const t =online + " of " + total + " camera" + (total !== 1 ? "s" : "") + " watching";
    return total - on ? t + " · " + (total - on) + " off" : t;
  }
  window.caphyCamText = camText;

  function apply(st) {
    root.dataset.level = st.level || "clear";
    root.dataset.armed = st.armed ? "true" : "false";
    root.dataset.siren = st.siren_active ? "true" : "false";

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
    disarm: function () { return post("/api/arm", { on: false }); },
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

  // "Turn on" on a Camera off overlay
  function resumeCam(idx) { return post("/api/camera/" + idx + "/resume"); }
  window.caphyResumeCam = resumeCam;

  window.caphyStatusPoll = poll;
  poll();
  setInterval(poll, 2000);
})();
