/** Simple promise-based confirm for web (replaces Alert.alert with buttons). */
export function confirmDialog(message, { title = "Confirm", confirmLabel = "OK", cancelLabel = "Cancel", destructive = false } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className =
      "fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 animate-fade-in";
    overlay.innerHTML = `
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-elevated animate-slide-up" role="alertdialog">
        <h2 class="text-lg font-bold text-slate-900">${escapeHtml(title)}</h2>
        <p class="mt-2 text-sm text-slate-600 whitespace-pre-wrap">${escapeHtml(message)}</p>
        <div class="mt-6 flex justify-end gap-3">
          <button type="button" data-action="cancel" class="btn-secondary">${escapeHtml(cancelLabel)}</button>
          <button type="button" data-action="confirm" class="${destructive ? "btn-danger" : "btn-primary"}">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;
    const cleanup = (result) => {
      overlay.remove();
      resolve(result);
    };
    overlay.querySelector('[data-action="cancel"]')?.addEventListener("click", () => cleanup(false));
    overlay.querySelector('[data-action="confirm"]')?.addEventListener("click", () => cleanup(true));
    document.body.appendChild(overlay);
  });
}

export function alertDialog(message, { title = "Notice", buttonLabel = "OK" } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className =
      "fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4";
    overlay.innerHTML = `
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-elevated">
        <h2 class="text-lg font-bold text-slate-900">${escapeHtml(title)}</h2>
        <p class="mt-2 text-sm text-slate-600 whitespace-pre-wrap">${escapeHtml(message)}</p>
        <div class="mt-6 flex justify-end">
          <button type="button" data-action="ok" class="btn-primary">${escapeHtml(buttonLabel)}</button>
        </div>
      </div>
    `;
    overlay.querySelector('[data-action="ok"]')?.addEventListener("click", () => {
      overlay.remove();
      resolve();
    });
    document.body.appendChild(overlay);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Drop-in style API similar to React Native Alert.alert */
export const Alert = {
  alert(title, message, buttons) {
    if (!buttons || buttons.length <= 1) {
      const btn = buttons?.[0];
      return alertDialog(message || title, {
        title: message ? title : "Notice",
        buttonLabel: btn?.text || "OK",
      }).then(() => btn?.onPress?.());
    }
    const cancel = buttons.find((b) => b.style === "cancel") || buttons[0];
    const confirm =
      buttons.find((b) => b.style === "destructive") ||
      buttons.find((b) => b !== cancel) ||
      buttons[buttons.length - 1];
    return confirmDialog(message || title, {
      title: message ? title : "Confirm",
      cancelLabel: cancel?.text || "Cancel",
      confirmLabel: confirm?.text || "OK",
      destructive: confirm?.style === "destructive",
    }).then((ok) => {
      if (ok) confirm?.onPress?.();
      else cancel?.onPress?.();
    });
  },
};
