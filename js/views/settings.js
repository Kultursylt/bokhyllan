// Mer: bibliotek, hushåll, installera appen, säkerhetskopia och konto.

import { h, mount, promptBox, busyButton, toast, confirmBox } from "../lib/dom.js";
import { sb } from "../lib/supabase.js";
import * as store from "../store.js";
import { canInstall, install } from "../pwa.js";

export function render(root) {
  const draw = async () => {
    const lib = store.state.library;
    const owner = store.state.role === "owner";
    const inviteUrl = `${location.origin}${location.pathname}?kod=${lib.join_code}`;
    const libs = await store.memberships().catch(() => []);

    mount(root,
      h("header.view-head", h("h1", "Mer")),

      h("a.card.row.between", { href: "#/platser" }, h("span", "🗂  Platser — rum, bokhyllor, hyllplan"), h("span", "›")),

      canInstall() ? h("section.card.stack",
        h("h2", "Installera appen"),
        h("p.muted.small", "Lägg Bokhyllan på hemskärmen så öppnas den som en egen app."),
        h("button", { onclick: install }, "Installera")) : null,

      h("section.card.stack",
        h("h2", "Biblioteket"),
        h("div.row.between", h("strong", lib.name),
          h("button.small.ghost", { onclick: async () => { const v = await promptBox("Namn på biblioteket", lib.name); if (v) store.renameLibrary(v); } }, "Byt namn")),
        h("p.muted.small", "Bjud in hushållet: de skapar konto med koden nedan (eller öppnar länken) och delar då samma bibliotek."),
        h("div.row.between",
          h("code.joincode", lib.join_code),
          h("button.small", {
            onclick: async () => {
              const text = `Gå med i vårt bibliotek i Bokhyllan: ${inviteUrl}`;
              if (navigator.share) navigator.share({ text }).catch(() => {});
              else { await navigator.clipboard.writeText(text); toast("Inbjudan kopierad."); }
            },
          }, "Dela inbjudan")),
        owner ? busyButton("Byt kod", async () => {
          if (await confirmBox("Gamla koden slutar fungera. Befintliga medlemmar påverkas inte.", "Byt kod")) await store.rotateJoinCode();
        }, { class: "small ghost" }) : null,
        libs.length > 1 ? h("label", "Byt bibliotek",
          h("select", { onchange: (e) => store.switchLibrary(e.target.value).then(() => location.hash = "#/hylla") },
            libs.map((m) => h("option", { value: m.library_id, selected: m.library_id === lib.id }, m.libraries?.name ?? m.library_id)))) : null,
        busyButton("Gå med i ett annat bibliotek med kod", async () => {
          const code = await promptBox("Inbjudningskod");
          if (code) { await store.joinLibrary(code); toast("Du är nu med i biblioteket.", "ok"); location.hash = "#/hylla"; }
        }, { class: "link" })),

      h("section.card.stack",
        h("h2", "Säkerhetskopia"),
        h("p.muted.small", "Ladda ned hela katalogen. CSV öppnas i Excel/Numbers/Google Sheets."),
        h("div.row",
          h("button.ghost", { onclick: () => download("bokhyllan.csv", store.exportCsv(), "text/csv") }, "CSV"),
          h("button.ghost", { onclick: () => download("bokhyllan.json", store.exportJson(), "application/json") }, "JSON"))),

      h("section.card.stack",
        h("h2", "Konto"),
        h("p.muted", store.state.user?.email),
        h("button.ghost", { onclick: async () => { await sb.auth.signOut(); location.reload(); } }, "Logga ut")),

      h("p.muted.small.center", "Bokdata: Libris (Kungliga biblioteket) och Open Library. Omslag: Open Library."));
  };

  draw();
  const off = store.onChange(draw);
  window.addEventListener("pwa-installable", draw);
  return () => { off(); window.removeEventListener("pwa-installable", draw); };
}

function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
