/* CAPHY motion helpers - count-up numbers and staggered row fade-ins.
   Look and timings were approved in docs/motion_preview.html (Oct 28).

   Why: Overview's stat numbers and freshly loaded lists used to just
   appear. A short count-up / fade-up makes it clear something was loaded
   or changed, without costing anything on the laptop that's running YOLO:
   text updates in requestAnimationFrame (stops when the tab is hidden) and
   opacity/transform only. Reduced motion skips all of it. */
(function () {
  function reduced() {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // Count el's number from what it shows now to `to` over `ms` (ease-out).
  // A newer call on the same element cancels the older one.
  function caphyCountTo(el, to, ms) {
    if (!el) return;
    to = Math.round(+to) || 0;
    const from = parseInt(el.textContent, 10) || 0;
    const token = (el._countToken || 0) + 1;
    el._countToken = token;
    if (reduced() || document.hidden || from === to) { el.textContent = to; return; }
    const t0 = performance.now();
    function step(now) {
      if (el._countToken !== token) return;
      const p = Math.min((now - t0) / ms, 1);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Fade the first `max` elements up one after another, 40 ms apart.
  // Capped so a 200-row list doesn't take seconds to finish appearing.
  function caphyStagger(els, max) {
    if (reduced()) return;
    [...els].slice(0, max || 12).forEach(function (el, i) {
      el.classList.remove("fadeup");
      void el.offsetWidth;   // restart the animation if it already ran
      el.style.animationDelay = (i * 40) + "ms";
      el.classList.add("fadeup");
    });
  }

  // every [data-count] number counts up from 0 once, as the page loads
  // (server already rendered the real value, so without JS it's just right)
  function countUpPage() {
    document.querySelectorAll("[data-count]").forEach(function (el) {
      const to = parseInt(el.dataset.count, 10);
      if (isNaN(to) || reduced() || document.hidden) return;
      el.textContent = "0";
      caphyCountTo(el, to, 600);
    });
  }

  window.caphyCountTo = caphyCountTo;
  window.caphyStagger = caphyStagger;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", countUpPage);
  else countUpPage();
})();
