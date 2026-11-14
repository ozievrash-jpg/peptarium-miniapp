async function loadProducts() {
    const grid = document.getElementById("products-grid");
    const message = document.getElementById("catalog-message");

    if (!grid || !message) return;

    try {
        const response = await fetch("products.json");

        if (!response.ok) {
            throw new Error("Ошибка загрузки каталога");
        }

        const data = await response.json();

        const manufacturer = data.manufacturers.find(
            item => item.id === "zpch"
        );

        const products = manufacturer?.products || [];

        const categories = manufacturer?.categories || [];
        const categoriesGrid = document.getElementById("categories-grid");

        if (categoriesGrid) {
            if (categories.length === 0) {
                const notice = document.createElement("p");
                notice.className = "notice";
                notice.textContent = "Категории готовятся к публикации.";
                categoriesGrid.append(notice);
            } else {
                categories.forEach(category => {
                    const button = document.createElement("button");
                    button.className = "category-button";
                    button.textContent = category.name;
                    button.type = "button";
                    button.addEventListener("click", () => {
                        document.querySelectorAll(".category-button")
                            .forEach(b => b.classList.remove("active"));
                        button.classList.add("active");
                    });
                    categoriesGrid.append(button);
                });
            }
        }


        if (products.length === 0) {
            message.textContent =
                "Каталог ZPCH готовится к публикации. " +
                "Проверенная информация о продукции появится позже.";
            return;
        }

        message.textContent =
            `Найдено позиций: ${products.length}`;

        products.forEach(product => {
            const card = document.createElement("article");
            card.className = "product-card";

            const info = document.createElement("div");
            info.className = "product-info";

            const title = document.createElement("h3");
            title.className = "product-title";
            title.textContent = product.name || "Без названия";

            const description = document.createElement("p");
            description.className = "product-description";
            description.textContent = product.description || "";

            info.append(title, description);
            card.append(info);
            grid.append(card);
        });

    } catch (error) {
        message.textContent =
            "Не удалось загрузить каталог. Попробуйте позже.";
        console.error(error);
    }
}

document.addEventListener("DOMContentLoaded", loadProducts);
