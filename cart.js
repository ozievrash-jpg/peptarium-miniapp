// PEPTARIUM — локальная корзина. Не осуществляет оплату или отправку заказов.
(function () {
  "use strict";

  const STORAGE_KEY = "peptarium_cart_v1";
  const MAX_QTY = 99;
  const state = { items: [], products: new Map() };
  const button = document.getElementById("cart-toggle");
  const count = document.getElementById("cart-count");
  if (!button || !count) return;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function rub(amount) {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency", currency: "RUB", maximumFractionDigits: 0
    }).format(amount);
  }

  function isPrice(value) {
    return Number.isSafeInteger(value) && value > 0 && value <= 99999999;
  }

  function readStorage() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw.slice(0, 100).filter(item =>
        item && typeof item.pid === "string" && typeof item.vid === "string" &&
        Number.isInteger(item.qty) && item.qty >= 1 && item.qty <= MAX_QTY
      );
    } catch (_) { return []; }
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items)); }
    catch (_) { /* браузер может запрещать хранение */ }
  }

  function key(pid, vid) { return `${pid}\u0000${vid}`; }

  function setCatalog(data) {
    state.products.clear();
    for (const m of data.manufacturers || []) {
      for (const p of m.products || []) {
        if (p.hidden === true) continue;
        const variants = new Map();
        for (const v of p.variants || []) {
          if (isPrice(v.price_rub)) variants.set(v.id, { product: p, variant: v });
        }
        state.products.set(p.id, variants);
      }
    }
    // Удаляем скрытые или более не продаваемые варианты и объединяем дубликаты.
    const deduped = new Map();
    for (const item of state.items) {
      if (!state.products.get(item.pid)?.has(item.vid)) continue;
      const k = key(item.pid, item.vid);
      if (deduped.has(k)) {
        deduped.get(k).qty = Math.min(MAX_QTY, deduped.get(k).qty + item.qty);
      } else deduped.set(k, { pid: item.pid, vid: item.vid, qty: item.qty });
    }
    state.items = [...deduped.values()];
    persist();
    render();
  }

  function add(pid, vid) {
    if (!state.products.get(pid)?.has(vid)) return false;
    const item = state.items.find(i => i.pid === pid && i.vid === vid);
    if (item) item.qty = Math.min(MAX_QTY, item.qty + 1);
    else state.items.push({ pid, vid, qty: 1 });
    persist();
    render();
    return true;
  }

  function modify(pid, vid, delta) {
    const index = state.items.findIndex(i => i.pid === pid && i.vid === vid);
    if (index < 0) return;
    const qty = state.items[index].qty + delta;
    if (qty <= 0) state.items.splice(index, 1);
    else state.items[index].qty = Math.min(qty, MAX_QTY);
    persist(); render();
  }

  const shade = el("div", "cart-shade");
  shade.hidden = true;
  const drawer = el("section", "cart-drawer");
  drawer.hidden = true;
  drawer.id = "peptarium-cart-dialog";
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-label", "Корзина PEPTARIUM");
  const head = el("div", "cart-drawer-head");
  head.append(el("h2", "", "Корзина"));
  const close = el("button", "cart-close", "✕");
  close.type = "button";
  close.setAttribute("aria-label", "Закрыть корзину");
  head.append(close);
  const listing = el("div", "cart-list");
  const foot = el("div", "cart-footer");
  drawer.append(head, listing, foot);
  document.body.append(shade, drawer);
  let lastFocus = null;

  function toggle(open) {
    if (open) lastFocus = document.activeElement;
    shade.hidden = !open;
    drawer.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("cart-open", open);
    if (open) close.focus();
    else if (lastFocus?.focus) lastFocus.focus();
  }

  button.addEventListener("click", () => toggle(drawer.hidden));
  close.addEventListener("click", () => toggle(false));
  shade.addEventListener("click", () => toggle(false));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !drawer.hidden) toggle(false);
    if (event.key === "Tab" && !drawer.hidden) {
      const focusable = [...drawer.querySelectorAll("button:not(:disabled)")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  function render() {
    const number = state.items.reduce((total, i) => total + i.qty, 0);
    count.textContent = String(number);
    button.setAttribute("aria-label", `Корзина, товаров: ${number}`);
    listing.replaceChildren();
    foot.replaceChildren();
    if (!state.items.length) {
      listing.append(el("p", "cart-empty", "Здесь пока пусто. Выбери товар в каталоге."));
    }
    let total = 0;
    for (const item of state.items) {
      const found = state.products.get(item.pid)?.get(item.vid);
      if (!found) continue;
      const { product, variant } = found;
      total += variant.price_rub * item.qty;
      const line = el("article", "cart-item");
      const info = el("div", "cart-item-info");
      info.append(el("strong", "", product.name), el("span", "cart-item-dose", variant.label));
      info.append(el("span", "cart-item-price", `${rub(variant.price_rub)} за ед.`));
      const controls = el("div", "cart-item-controls");
      const minus = el("button", "qty-button", "−");
      minus.type = "button";
      minus.setAttribute("aria-label", `Уменьшить количество ${product.name}`);
      minus.addEventListener("click", () => modify(item.pid, item.vid, -1));
      const qty = el("span", "cart-qty", String(item.qty));
      const plus = el("button", "qty-button", "+");
      plus.type = "button";
      plus.disabled = item.qty >= MAX_QTY;
      plus.setAttribute("aria-label", `Увеличить количество ${product.name}`);
      plus.addEventListener("click", () => modify(item.pid, item.vid, 1));
      const deleteButton = el("button", "remove-button", "Удалить");
      deleteButton.type = "button";
      deleteButton.addEventListener("click", () => modify(item.pid, item.vid, -item.qty));
      controls.append(minus, qty, plus, deleteButton);
      line.append(info, controls);
      listing.append(line);
    }
    const totalLine = el("div", "cart-total");
    totalLine.append(el("span", "", "Итого"), el("strong", "", rub(total)));
    foot.append(totalLine);
    foot.append(el("p", "cart-disclaimer",
      "Корзина сохраняет выбранные позиции только в этом браузере. Оформление заказа и онлайн-оплата пока не подключены."));
    if (state.items.length) {
      const clear = el("button", "cart-clear", "Очистить корзину");
      clear.type = "button";
      clear.addEventListener("click", () => { state.items = []; persist(); render(); });
      foot.append(clear);
    }
  }

  state.items = readStorage();
  render();
  window.PeptariumCart = { setCatalog, add, rub, isPrice };

  fetch("products.json", { cache: "no-store" }).then(response => {
    if (!response.ok) throw new Error("Нет данных каталога");
    return response.json();
  }).then(setCatalog).catch(error => console.warn("PEPTARIUM: корзина не смогла загрузить каталог", error));
})();
