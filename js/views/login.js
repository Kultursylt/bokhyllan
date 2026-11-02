// Inloggning och nytt konto. Med en inbjudningskod hamnar man direkt i
// hushållets gemensamma bibliotek.

import { h, mount, toast, showError } from "../lib/dom.js";
import { sb } from "../lib/supabase.js";

export function render(root, { onLogin }) {
  let mode = "login";
  const code = new URLSearchParams(location.search).get("kod") ?? "";

  const draw = () => {
    const email = h("input", { type: "email", autocomplete: "email", required: true });
    const pw = h("input", { type: "password", autocomplete: mode === "login" ? "current-password" : "new-password", required: true, minlength: 6 });
    const join = h("input", { value: code, placeholder: "Valfritt", autocapitalize: "characters" });
    const btn = h("button", { type: "submit" }, mode === "login" ? "Logga in" : "Skapa konto");

    const form = h("form.card.stack", {
      onsubmit: async (e) => {
        e.preventDefault();
        btn.disabled = true;
        try {
          if (mode === "login") {
            const { error } = await sb.auth.signInWithPassword({ email: email.value, password: pw.value });
            if (error) throw error;
            onLogin();
          } else {
            const { data, error } = await sb.auth.signUp({
              email: email.value, password: pw.value,
              options: { data: { join_code: join.value.trim() }, emailRedirectTo: location.origin + location.pathname },
            });
            if (error) throw error;
            if (data.session) onLogin();
            else toast("Kontot är skapat. Bekräfta via länken i mejlet och logga sedan in.", "info", 9000);
          }
        } catch (err) {
          showError(err, mode === "login" ? "Inloggningen misslyckades" : "Kontot kunde inte skapas");
        } finally {
          btn.disabled = false;
        }
      },
    },
      h("label", "E-post", email),
      h("label", "Lösenord", pw),
      mode === "signup" ? h("label", "Inbjudningskod från hushållet", join) : null,
      btn,
      h("button.link", { type: "button", onclick: () => { mode = mode === "login" ? "signup" : "login"; draw(); } },
        mode === "login" ? "Inget konto? Skapa ett" : "Har redan konto? Logga in"),
      mode === "login" ? h("button.link", {
        type: "button",
        onclick: async () => {
          if (!email.value) return toast("Skriv din e-post först.");
          const { error } = await sb.auth.resetPasswordForEmail(email.value, { redirectTo: location.origin + location.pathname });
          error ? showError(error) : toast("Återställningslänk skickad.");
        },
      }, "Glömt lösenordet?") : null,
    );

    mount(root,
      h("section.login",
        h("div.brand", h("span.logo", "▥"), h("h1", "Bokhyllan")),
        h("p.lead", "Fotografera dina hyllor. Varje bok verifieras mot Libris och får en plats, ett värde och en plan."),
        form));
  };
  if (code) mode = "signup";
  draw();
}
