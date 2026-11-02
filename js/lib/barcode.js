// ISBN-skanner med kameran. Chrome på Android har inbyggd streckkodsläsare
// (BarcodeDetector); där den saknas (t.ex. Safari på Mac) skriver man in
// numret för hand i samma ruta.

import { h, sheet } from "./dom.js";

export const hasDetector = "BarcodeDetector" in window;

/** Öppnar skannern. Löses med ett ISBN-sträng, eller undefined om man avbryter. */
export function scanIsbn() {
  let stream = null;
  let stopped = false;
  const stop = () => {
    stopped = true;
    stream?.getTracks().forEach((t) => t.stop());
  };

  return sheet((close) => {
    const done = (v) => { stop(); close(v); };
    const video = h("video.scanner", { playsinline: true, muted: true, autoplay: true });
    const status = h("p.muted", hasDetector ? "Rikta kameran mot streckkoden på baksidan." : "Kameraskanning stöds inte i den här webbläsaren — skriv in ISBN.");
    const input = h("input", { inputmode: "numeric", placeholder: "978…", "aria-label": "ISBN" });
    const form = h("form.row", {
      onsubmit: (e) => { e.preventDefault(); if (input.value.trim()) done(input.value.trim()); },
    }, input, h("button", { type: "submit" }, "Sök"));

    if (hasDetector) start(video, status, done).then((s) => { stream = s; if (stopped) stop(); });
    return h("div.stack", hasDetector ? video : null, status, form);
  }, { title: "Skanna ISBN" }).finally(stop);

  async function start(video, status, done) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = s;
      const detector = new window.BarcodeDetector({ formats: ["ean_13"] });
      const tick = async () => {
        if (stopped) return;
        try {
          const codes = await detector.detect(video);
          const hit = codes.find((c) => /^97[89]\d{10}$/.test(c.rawValue));
          if (hit) { navigator.vibrate?.(60); done(hit.rawValue); return; }
        } catch { /* videon inte redo än */ }
        setTimeout(tick, 250);
      };
      video.addEventListener("loadeddata", tick, { once: true });
      return s;
    } catch (e) {
      status.textContent = "Kameran gick inte att starta (" + e.message + "). Skriv in ISBN i stället.";
      video.remove();
      return null;
    }
  }
}
