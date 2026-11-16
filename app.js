// PEPTARIUM: каталог ZPHC. Варианты и пути к фото берутся из products.json.
(function () {
  "use strict";

  const grid = document.getElementById("products-grid");
  const message = document.getElementById("catalog-message");
  const categoryContainer = document.getElementById("categories-grid");
  const searchInput = document.getElementById("catalog-search-input");
  if (!grid || !message || !categoryContainer || !searchInput) return;

  const state = { products: [], category: "all", search: "" };
  const cards = new Map();

  function textEl(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    return element;
  }

  function formatComposition(items) {
    if (!Array.isArray(items) || !items.length) return "";
    return items.map(item => `${item.name} — ${item.mg} мг`).join(" · ");
  }

  function updateMedia(container, product, variant) {
    container.replaceChildren();
    if (!variant.image) {
      const empty = textEl("div", "photo-placeholder", "");
      empty.append(
        textEl("span", "placeholder-symbol", "▧"),
        textEl("span", "placeholder-main", "Фото готовится"),
        textEl("span", "placeholder-description", `Упаковка ${variant.label} ещё не добавлена`)
      );
      container.append(empty);
      return;
    }
    const image = document.createElement("img");
    image.className = "product-photo";
    image.src = variant.image;
    image.alt = `${product.name} — ${variant.label}, фотография упаковки`;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      // Отсутствующий файл никогда не заменяем фотографией другой дозировки.
      container.replaceChildren(
        textEl("div", "photo-placeholder", "Фотография временно недоступна")
      );
    }, { once: true });
    container.append(image);
  }

  function makeProductCard(product) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const card = document.createElement("article");
    card.className = "product-card";
    card.dataset.category = product.category || "single";
    const media = textEl("div", "product-image", "");
    const info = textEl("div", "product-info", "");
    const title = textEl("h3", "product-title", product.name);
    const description = textEl("p", "product-description", product.description || "");
    info.append(title, description);

    const variantDetails = textEl("div", "variant-details", "");
    const compositionText = formatComposition(product.composition);
    if (compositionText) {
      info.append(textEl("p", "composition", `Состав: ${compositionText}`));
    }
    const variantsBlock = textEl("div", "variants", "");
    if (variants.length > 1) {
      const groupLabel = textEl("div", "variants-label", "Варианты упаковки");
      const buttons = textEl("div", "variant-buttons", "");
      variants.forEach((variant, i) => {
        const button = textEl("button", "variant-button", variant.label);
        button.type = "button";
        button.setAttribute("aria-pressed", i === 0 ? "true" : "false");
        if (i === 0) button.classList.add("active");
        button.addEventListener("click", () => {
          buttons.querySelectorAll("button").forEach(b => {
            b.classList.remove("active");
            b.setAttribute("aria-pressed", "false");
          });
          button.classList.add("active");
          button.setAttribute("aria-pressed", "true");
          selectVariant(product, variant, media, variantDetails);
        });
        buttons.append(button);
      });
      variantsBlock.append(groupLabel, buttons);
    }
    info.append(variantsBlock, variantDetails);
    card.append(media, info);
    if (variants.length) selectVariant(product, variants[0], media, variantDetails);
    return card;
  }

  function selectVariant(product, variant, media, details) {
    updateMedia(media, product, variant);
    details.replaceChildren();
    details.append(
      textEl("span", "selected-dose", variant.label),
      textEl("span", "packaging", variant.packaging || "Комплектация уточняется")
    );
  }

  function matches(product) {
    if (state.category !== "all" && product.category !== state.category) return false;
    if (!state.search) return true;
    const tokens = [
      product.name, product.description,
      ...(product.variants || []).flatMap(v => [v.label, v.packaging]),
      ...(product.composition || []).map(c => c.name)
    ];
    const normalized = tokens.filter(Boolean).join(" ").toLocaleLowerCase("ru").replace(/\./g, ",");
    return normalized.includes(state.search);
  }

  function updateResults() {
    let shown = 0;
    state.products.forEach(product => {
      const visible = matches(product);
      const card = cards.get(product.id);
      if (card) card.hidden = !visible;
      if (visible) shown++;
    });
    message.textContent = shown === 0 ? "Ничего не найдено" : `Показано: ${shown} из ${state.products.length}`;
  }

  function renderCategories(categories) {
    categoryContainer.replaceChildren();
    const list = Array.isArray(categories) && categories.length
      ? categories : [{ id: "all", name: "Все товары" }];
    list.forEach(category => {
      const button = textEl("button", "category-button", category.name);
      button.type = "button";
      const active = category.id === state.category;
      if (active) button.classList.add("active");
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.addEventListener("click", () => {
        state.category = category.id;
        categoryContainer.querySelectorAll("button").forEach(b => {
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
        });
        button.classList.add("active");
        button.setAttribute("aria-pressed", "true");
        updateResults();
      });
      categoryContainer.append(button);
    });
  }

  async function loadProducts() {
    try {
      const response = await fetch("products.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const manufacturer = (data.manufacturers || []).find(item => item.id === "zpch");
      if (!manufacturer) throw new Error("Производитель не найден");
      state.products = (manufacturer.products || []).filter(product => product.hidden !== true);
      grid.replaceChildren();
      state.products.forEach(product => {
        const card = makeProductCard(product);
        cards.set(product.id, card);
        grid.append(card);
      });
      renderCategories(manufacturer.categories);
      const params = new URLSearchParams(window.location.search);
      searchInput.value = params.get("q") || "";
      state.search = searchInput.value.trim().toLocaleLowerCase("ru").replace(/\./g, ",");
      searchInput.addEventListener("input", () => {
        state.search = searchInput.value.trim().toLocaleLowerCase("ru").replace(/\./g, ",");
        updateResults();
      });
      updateResults();
    } catch (error) {
      message.textContent = "Не удалось загрузить каталог. Обнови страницу.";
      console.error("PEPTARIUM catalog error:", error);
    }
  }

  loadProducts();
})();
