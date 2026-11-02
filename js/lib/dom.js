// Små DOM-hjälpare. Ingen ramverksberoende kod — varje vy bygger sina
// element med h() och byter innehåll med mount().

/**
 * h("div.card#id", { onclick, class, ...attrs }, ...barn)
 * Barn kan vara strängar, element, arrayer eller null/false (hoppas över).
 * Strängar blir alltid textnoder, så användardata kan aldrig tolkas som HTML.
 */
export function h(tag, props, ...children) {
  if (props == null || typeof props !== "object" || props instanceof Node || Array.isArray(props)) {
    children.unshift(props);
    props = {};
  }
  const [, name = "div", rest = ""] = tag.match(/^([a-z0-9-]*)(.*)$/i);
  const el = document.createElement(name || "div");
  for (const part of rest.match(/[.#][^.#]+/g) ?? []) {
    if (part[0] === ".") el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.classList.add(...String(v).split(/\s+/).filter(Boolean));
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "value" || k === "checked" || k === "selected" || k === "disabled") el[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  append(el, children);
  return el;
}

function append(el, kids) {
  for (const c of kids) {
    if (c == null || c === false || c === true) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Ersätter allt innehåll i root. */
export function mount(root, ...children) {
  root.replaceChildren();
  append(root, children);
  return root;
}

export const $ = (sel, root = document) => root.querySelector(sel);

/** Kort meddelande längst ned. */
export function toast(msg, kind = "info", ms = 3500) {
  const box = $("#toasts");
  const t = h("div.toast", { class: kind, role: "status" }, msg);
  box.append(t);
  setTimeout(() => t.classList.add("out"), ms);
  setTimeout(() => t.remove(), ms + 400);
}

/** Visar ett fel på ett begripligt sätt och loggar detaljerna. */
export function showError(e, prefix = "Något gick fel") {
  console.error(e);
  toast(`${prefix}: ${e?.message ?? e}`, "error", 7000);
}

/**
 * Bottenark/dialog. content är ett element eller en funktion (close) => element.
 * Returnerar ett Promise som löses med det värde close() anropas med.
 */
export function sheet(content, { title } = {}) {
  return new Promise((resolve) => {
    const dlg = h("dialog.sheet");
    const close = (val) => { dlg.close(); dlg.remove(); resolve(val); };
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(undefined); });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) close(undefined); });
    const body = typeof content === "function" ? content(close) : content;
    mount(dlg, h("div.sheet-inner",
      h("header.sheet-head",
        title ? h("h2", title) : h("span"),
        h("button.icon", { "aria-label": "Stäng", onclick: () => close(undefined) }, "✕")),
      body));
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function confirmBox(message, okLabel = "OK", danger = false) {
  return sheet((close) => h("div.stack",
    h("p", message),
    h("div.row.end",
      h("button.ghost", { onclick: () => close(false) }, "Avbryt"),
      h("button", { class: danger ? "danger" : "", onclick: () => close(true) }, okLabel))));
}

export function promptBox(label, value = "", okLabel = "Spara") {
  return sheet((close) => {
    const input = h("input", { value, "aria-label": label });
    const form = h("form.stack", {
      onsubmit: (e) => { e.preventDefault(); close(input.value.trim()); },
    }, h("label", label, input), h("div.row.end", h("button", { type: "submit" }, okLabel)));
    setTimeout(() => input.focus(), 50);
    return form;
  });
}

/** Knapp som visar "arbetar…" och spärras medan ett async-jobb pågår. */
export function busyButton(label, fn, props = {}) {
  const btn = h("button", {
    ...props,
    onclick: async (e) => {
      if (btn.disabled) return;
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = props.busyLabel ?? "Arbetar…";
      try { await fn(e); } catch (err) { showError(err); } finally {
        btn.disabled = false;
        if (btn.isConnected) btn.textContent = old;
      }
    },
  }, label);
  return btn;
}

export function select(options, value, onchange, props = {}) {
  return h("select", { ...props, onchange: (e) => onchange(e.target.value) },
    options.map(([v, label]) => h("option", { value: v, selected: v === value }, label)));
}

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" }) : "";

export const kr = (n) => `${Math.round(n).toLocaleString("sv-SE")} kr`;

/** Omslag från Open Library via ISBN — exakt rätt upplaga, eller en neutral platshållare. */
export function cover(isbn, title = "", size = "M") {
  const ph = h("div.cover.placeholder", { "aria-hidden": "true" }, (title || "?").slice(0, 1).toUpperCase());
  if (!isbn) return ph;
  const img = h("img.cover", {
    src: `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg?default=false`,
    alt: "", loading: "lazy",
    onerror: () => img.replaceWith(ph),
  });
  return img;
}
