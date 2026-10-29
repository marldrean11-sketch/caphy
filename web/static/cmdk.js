/* CAPHY command bar (Ctrl+K) and "G then a letter" page jumps.

   Why: the console has 6 pages and 8 Settings tabs; typing "tier 3",
   "users" or "arm" gets there faster than hunting through menus, and the
   same box searches alerts by date. Approved in
   docs/mockup_command_center.html.

   Rules it keeps:
   - Disarming is never one keystroke here - the 1.2 s hold stays the only
     way (the command just says how).
   - Nothing that sounds the siren.
   - Same key rules as the other shortcuts (caphyKeysFree, statuslight.js):
     not while typing, with modifiers, or with a dialog open.
   Plain JS, built on first open so pages that never use it pay nothing. */
(function () {
  function today() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function arm() {
    fetch("/api/arm", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: true }) })
      .catch(function () {}).then(function () { if (window.caphyStatusPoll) window.caphyStatusPoll(); });
  }
  function say(text, sub) { if (window.caphyToast) window.caphyToast({ text: text, sub: sub, ms: 6000 }); }

  const CMDS = [
    { g: "Actions", t: "Arm system", k: "A", run: arm },
    { g: "Actions", t: "Disarm system", hint: "hold to disarm", run: function () {
        say("Disarming needs the hold.", "Hold the Arm button, or hold A, for a second.");
      } },
    { g: "Actions", t: "Keyboard shortcuts", k: "?", run: function () {
        say("Keyboard shortcuts", "Ctrl K commands · A arm · hold A disarm · / search · G then O L H Y S E pages · Esc close");
      } },
    { g: "Go to", t: "Overview", k: "G O", href: "/" },
    { g: "Go to", t: "Live camera", k: "G L", href: "/live" },
    { g: "Go to", t: "Alert History", k: "G H", href: "/history" },
    { g: "Go to", t: "Activity", k: "G Y", href: "/activity" },
    { g: "Go to", t: "System Logs", k: "G S", href: "/logs" },
    { g: "Go to", t: "Settings", k: "G E", href: "/settings" },
    { g: "Find", t: "Tier 3 alerts", href: "/history?tier=3" },
    { g: "Find", t: "Alerts today", href: function () { return "/history?q=" + today(); } },
    { g: "Find", t: "Alerts in the last 24 hours", href: "/history?range=24h" },
    { g: "Find", t: "Who armed or disarmed", href: "/activity" },
    { g: "Settings", t: "Detection and tier distances", href: "/settings?tab=detection" },
    { g: "Settings", t: "Cameras", href: "/settings?tab=cameras" },
    { g: "Settings", t: "Alerts and notifications", href: "/settings?tab=alerts" },
    { g: "Settings", t: "Storage and sync", href: "/settings?tab=storage" },
    { g: "Settings", t: "Connect phone", href: "/settings?tab=device" },
    { g: "Settings", t: "Offline mode", href: "/settings?tab=offline" },
    { g: "Settings", t: "Users and password", href: "/settings?tab=users" },
    { g: "Account", t: "Log out", href: "/logout" }
  ];

  let pal = null, input = null, list = null, items = [], sel = 0, opener = null;

  function build() {
    pal = document.createElement("div");
    pal.className = "cmdkpal";
    pal.innerHTML =
      '<div class="cmdkbox" role="dialog" aria-modal="true" aria-label="Command bar">' +
      '<div class="cmdkin"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>' +
      '<input type="text" role="combobox" aria-expanded="true" aria-controls="cmdkList" aria-autocomplete="list" ' +
      'aria-label="Search or run a command" placeholder="Try: arm, tier 3, users, 2026-10-28" autocomplete="off" spellcheck="false"></div>' +
      '<div class="cmdklist" id="cmdkList" role="listbox"></div>' +
      '<div class="cmdkfoot"><span>&uarr;&darr; move</span><span>Enter run</span><span>Esc close</span></div></div>';
    document.body.appendChild(pal);
    input = pal.querySelector("input");
    list = pal.querySelector(".cmdklist");
    input.addEventListener("input", function () { sel = 0; render(); });
    list.addEventListener("click", function (e) { const b = e.target.closest("[data-i]"); if (b) run(+b.dataset.i); });
    list.addEventListener("mousemove", function (e) {
      const b = e.target.closest("[data-i]");
      if (b && +b.dataset.i !== sel) { sel = +b.dataset.i; mark(); }
    });
    pal.addEventListener("click", function (e) { if (e.target === pal) close(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); mark(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
      else if (e.key === "Enter") { e.preventDefault(); run(sel); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === "Tab") e.preventDefault();      // focus stays in the box
    });
  }

  function match(c, q) {
    const hay = (c.g + " " + c.t).toLowerCase();
    return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function render() {
    const q = input.value.trim().toLowerCase();
    items = CMDS.filter(function (c) { return !q || match(c, q); });
    // anything that looks like a date (or part of one) also searches alerts
    if (/^\d{4}(-\d{1,2}){0,2}( \d{1,2})?$/.test(q)) items.unshift({ g: "Find", t: 'Alerts on "' + q + '"', href: "/history?q=" + encodeURIComponent(q) });
    sel = Math.min(sel, Math.max(0, items.length - 1));
    let g = "", html = "";
    items.forEach(function (c, i) {
      if (c.g !== g) { g = c.g; html += '<div class="cmdkg" role="presentation">' + g + "</div>"; }
      html += '<div class="cmdkitem" role="option" id="cmdk' + i + '" data-i="' + i + '">' + c.t.replace(/</g, "&lt;") +
        (c.k ? "<kbd>" + c.k + "</kbd>" : c.hint ? '<span class="cmdkhint">' + c.hint + "</span>" : "") + "</div>";
    });
    list.innerHTML = html || '<div class="cmdkg">No matches</div>';
    mark();
  }
  function mark() {
    list.querySelectorAll(".cmdkitem").forEach(function (el) {
      const on = +el.dataset.i === sel;
      el.classList.toggle("sel", on);
      el.setAttribute("aria-selected", on ? "true" : "false");
      if (on) el.scrollIntoView({ block: "nearest" });
    });
    input.setAttribute("aria-activedescendant", items.length ? "cmdk" + sel : "");
  }
  function open() {
    if (!pal) build();
    opener = document.activeElement;
    input.value = ""; sel = 0; render();
    pal.classList.add("show");
    input.focus();
  }
  function close() {
    if (!pal || !pal.classList.contains("show")) return;
    pal.classList.remove("show");
    if (opener && opener.focus) opener.focus();
  }
  function run(i) {
    const c = items[i];
    if (!c) return;
    close();
    if (c.run) { c.run(); return; }
    location.href = typeof c.href === "function" ? c.href() : c.href;
  }
  window.caphyCommandBar = open;

  const btn = document.getElementById("cmdkBtn");
  if (btn) btn.addEventListener("click", open);

  // G then a letter jumps to a page (like Gmail); the letters are shown
  // next to the sidebar links. Alerts is H (History), not A - A alone arms.
  const JUMP = { o: "/", l: "/live", h: "/history", y: "/activity", s: "/logs", e: "/settings" };
  let gAt = 0;
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (pal && pal.classList.contains("show")) close(); else open();
      return;
    }
    if (!window.caphyKeysFree || !window.caphyKeysFree(e)) return;
    const k = e.key.toLowerCase();
    if (k === "g") { gAt = Date.now(); return; }
    if (gAt && Date.now() - gAt < 1200 && JUMP[k]) { gAt = 0; e.preventDefault(); location.href = JUMP[k]; }
    else gAt = 0;
  });
})();
