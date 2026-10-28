/* CAPHY status light - keeps the logo (and anything else styled off
   html[data-level]) in step with the laptop's real state.

   Levels come from /api/state's `level` (computed once in server.py's
   _status_light so the web console and the phone always agree):
     clear (violet) / watch (yellow) / threat (red)
   plus "offline" (gray), which only the client can know: it's set when
   this page can no longer reach the CAPHY server at all.

   Also wires every .hold button: disarm and silence need a 1.2 s press
   so they can never be an accidental click. */
(function () {
  var root = document.documentElement;
  var fails = 0;
  var HOLD_MS = 1200;

  function apply(st) {
    root.dataset.level = st.level || "clear";
    root.dataset.armed = st.armed ? "true" : "false";
    root.dataset.siren = st.siren_active ? "true" : "false";

    var txt = document.getElementById("lvlTxt");
    if (txt) txt.textContent = describe(st);
    var meta = document.getElementById("sirenMeta");
    if (meta) {
      var d = st.distance ? " · " + st.distance + " m" : "";
      meta.textContent = st.tier ? "Tier " + st.tier + d : "manual";
    }
    var arm = document.getElementById("sideArmBtn");
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
    return st.armed ? "Clear · armed" : "Clear";
  }

  function poll() {
    fetch("/api/state", { cache: "no-store", credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      .then(function (st) { fails = 0; apply(st); })
      .catch(function () {
        // one missed poll is a blip; three in a row (~6 s) means the
        // server is gone, so the eye closes and the logo goes gray
        if (++fails >= 3) apply({ level: "offline" });
      });
  }

  function post(url, body) {
    return fetch(url, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then(poll, poll);
  }

  var actions = {
    disarm: function () { return post("/api/arm", { on: false }); },
    silence: function () { return post("/api/siren/silence"); }
  };

  document.addEventListener("pointerdown", function (e) {
    var btn = e.target.closest(".hold");
    if (!btn) return;
    var act = btn.dataset.act;
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

  window.caphyStatusPoll = poll;
  poll();
  setInterval(poll, 2000);
})();
