// Platser: rum, bokhyllor och hyllplan — namn, ordning och kapacitet.

import { h, mount, promptBox, confirmBox, busyButton, toast } from "../lib/dom.js";
import * as store from "../store.js";
import { KIND } from "../labels.js";

export function render(root) {
  const draw = () => {
    const tree = store.locationTree();
    mount(root,
      h("a.back", { href: "#/mer" }, "‹ Mer"),
      h("header.view-head", h("h1", "Platser")),
      h("p.muted.small", "Hyllplan numreras uppifrån. Ange gärna ungefär hur många böcker som ryms per plan — det gör förslagen under Ordna bättre."),
      h("div.row.wrap",
        busyButton("+ Rum", async () => {
          const name = await promptBox("Namn på rummet");
          if (name) await store.addLocation({ name, kind: "room" });
        }, { class: "ghost" }),
        busyButton("+ Bokhylla", () => addBookcaseFlow(null), { class: "ghost" }),
        busyButton("+ Lös plats", async () => {
          const name = await promptBox("Namn (t.ex. ”Nattduksbordet”)");
          if (name) await store.addLocation({ name, kind: "spot" });
        }, { class: "ghost" })),
      tree.length ? h("ul.tree", tree.map(node)) : h("p.empty", "Inga platser än."));
  };

  const node = (l) => {
    const n = store.copiesAt(l.id).length;
    const kids = store.childrenOf(l.id);
    return h("li.node", { style: { marginLeft: `${l.depth * 1.1}rem` } },
      h("div.row.between",
        h("div",
          h("strong", l.name), " ",
          h("span.muted.small", `${KIND[l.kind]}${n ? ` · ${n} böcker` : ""}${l.capacity ? ` · ryms ${l.capacity}` : ""}`)),
        h("div.row",
          h("a.small", { href: `#/hylla?loc=${l.id}` }, "Visa"),
          h("details.menu",
            h("summary.small", "⋯"),
            h("div.menu-body",
              h("button.link", { onclick: async () => { const v = await promptBox("Nytt namn", l.name); if (v) store.updateLocation(l.id, { name: v }); } }, "Byt namn"),
              l.kind === "shelf" || l.kind === "spot" ? h("button.link", {
                onclick: async () => {
                  const v = await promptBox("Ungefär hur många böcker ryms?", String(l.capacity ?? ""));
                  if (v !== undefined) store.updateLocation(l.id, { capacity: Number(v) > 0 ? Number(v) : null });
                },
              }, "Ange kapacitet") : null,
              l.kind === "room" ? h("button.link", { onclick: () => addBookcaseFlow(l.id) }, "Lägg till bokhylla här") : null,
              l.kind === "bookcase" ? h("button.link", {
                onclick: () => store.addLocation({ name: `Plan ${kids.length + 1}`, kind: "shelf", parent_id: l.id }),
              }, "Lägg till plan underst") : null,
              h("button.link", { onclick: () => move(l, -1) }, "Flytta upp"),
              h("button.link", { onclick: () => move(l, 1) }, "Flytta ned"),
              h("button.link.danger-text", {
                onclick: async () => {
                  const msg = `Ta bort ${l.name}${kids.length ? " och allt under" : ""}? Böckerna finns kvar men blir utan plats.`;
                  if (await confirmBox(msg, "Ta bort", true)) store.deleteLocation(l.id);
                },
              }, "Ta bort"))))));
  };

  async function move(l, dir) {
    const sibs = store.childrenOf(l.parent_id);
    const i = sibs.findIndex((s) => s.id === l.id);
    const j = i + dir;
    if (j < 0 || j >= sibs.length) return;
    [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
    for (const [k, s] of sibs.entries()) if (s.position !== k) await store.updateLocation(s.id, { position: k });
  }

  draw();
  return store.onChange(draw);
}

export async function addBookcaseFlow(parentId) {
  const name = await promptBox("Namn på bokhyllan");
  if (!name) return;
  const n = Number(await promptBox("Antal hyllplan", "5"));
  await store.addBookcase(name, Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 5, parentId);
  toast(`${name} skapad.`, "ok");
}
