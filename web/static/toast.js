/* CAPHY toasts - one small stack for action confirmations ("Armed.",
   "Disarmed." + Undo) and, later, new alerts. Look and timings were
   approved in docs/motion_preview.html (Oct 28).

   Why a shared file: before this, only the Live page had a toast (its own
   toast() + #webtoast, still there), so arming from the sidebar on any
   other page gave no feedback at all. Named caphyToast / .ctoast so it
   never clashes with that older one.

   Motion is transform/opacity only: rise + fade in (260 ms), fade + drop
   out (200 ms), the rest of the stack slides into place (FLIP) instead of
   jumping. The countdown line is a scaleX. The timer pauses on hover and
   keyboard focus so Undo can't vanish under the cursor. */
(function () {
  const MAX = 3;
  const ICON_OK = '<svg class="ic" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const ICON_PERSON = '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
  let stack = null;

  function reduced() {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function getStack() {
    if (stack && stack.isConnected) return stack;
    stack = document.createElement("div");
    stack.className = "ctoasts";
    stack.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
    return stack;
  }

  // FLIP: remember where each toast was, let the DOM change, then slide it
  // from the old spot to the new one with a transform only
  function flip(els, change) {
    const before = new Map(els.map(function (el) { return [el, el.getBoundingClientRect().top]; }));
    change();
    if (reduced()) return;
    before.forEach(function (top, el) {
      if (!el.isConnected) return;
      const dy = top - el.getBoundingClientRect().top;
      if (!dy) return;
      el.style.transition = "none";
      el.style.transform = "translateY(" + dy + "px)";
      requestAnimationFrame(function () {
        el.style.transition = "transform .28s var(--ease)";
        el.style.transform = "";
        el.addEventListener("transitionend", function () { el.style.transition = ""; }, { once: true });
      });
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  // opts: text, sub, action (button label), onAction, ms (default 4000),
  // tier (makes it an alert toast: tier colour on the left edge, like .arow)
  function caphyToast(opts) {
    const box = getStack();
    const el = document.createElement("div");
    el.className = "ctoast" + (opts.tier ? " alert t" + opts.tier : "");
    // Tier 3 interrupts a screen reader; everything else waits its turn
    // (the stack itself is aria-live=polite)
    if (opts.tier >= 3) el.setAttribute("role", "alert");
    el.innerHTML = (opts.tier ? ICON_PERSON : ICON_OK) +'<div class="msg">' + esc(opts.text) + (opts.sub ? "<small>" + esc(opts.sub) + "</small>" : "") + "</div>" +
      (opts.action ? '<button type="button" class="act">' + esc(opts.action) + "</button>" : "") +
      '<button type="button" class="x" aria-label="Dismiss">&times;</button><span class="life"></span>';
    const ms = opts.ms || 4000;
    const life = el.querySelector(".life");
    let left = ms, started = 0, timer = 0, anim = null, paused = true;

    // hover and keyboard focus can overlap, so only the first pause / last
    // resume counts - otherwise the countdown loses time twice
    function run() {
      if (!paused || el.matches(":hover") || el.contains(document.activeElement)) return;
      paused = false;
      started = performance.now();
      timer = setTimeout(close, left);
      if (!reduced()) anim = life.animate([{ transform: "scaleX(" + left / ms + ")" }, { transform: "scaleX(0)" }], { duration: left, fill: "forwards" });
    }
    function pause() {
      if (paused) return;
      paused = true;
      clearTimeout(timer);
      left -= performance.now() - started;
      if (anim) { life.style.transform = "scaleX(" + Math.max(left, 0) / ms + ")"; anim.cancel(); anim = null; }
    }
    function close() {
      clearTimeout(timer);
      if (el.classList.contains("out")) return;
      el.classList.add("out");
      setTimeout(function () {
        flip([...box.children].filter(function (t) { return t !== el; }), function () { el.remove(); });
      }, reduced() ? 0 : 200);
    }
    el.querySelector(".x").onclick = close;
    if (opts.action) el.querySelector(".act").onclick = function () { if (opts.onAction) opts.onAction(); close(); };
    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", run);
    el.addEventListener("focusin", pause);
    el.addEventListener("focusout", run);

    // newest at the bottom; the oldest goes once there are more than MAX
    flip([...box.children], function () {
      box.appendChild(el);
      while (box.children.length > MAX) box.firstElementChild.remove();
    });
    // two frames so the starting (hidden) state is painted before .in
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("in"); }); });
    run();
    return { close: close };
  }

  window.caphyToast = caphyToast;
  // shared so a page can slide its own lists the same way (Overview's
  // Recent Alerts uses it when a new alert row arrives)
  window.caphyFlip = flip;
})();
