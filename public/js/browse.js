
async function loadItems() {
    const grid = document.getElementById("itemGrid");

    if (!grid) {
        console.error("Missing HTML element: #itemGrid");
        return;
    }

    const search = document.getElementById("search")?.value?.trim() || "";
    const category = document.getElementById("category")?.value || "";
    const location = document.getElementById("location")?.value?.trim() || "";

    const params = new URLSearchParams({
        search,
        category,
        location
    });

    grid.innerHTML = `
        <div class="empty-state">Loading items...</div>
    `;

    try {
        const data = await api(`/api/items?${params}`);

        console.log("Browse API response:", data);

        if (!data.success) {
            throw new Error(data.message || "Unable to load items.");
        }

        if (!Array.isArray(data.items)) {
            throw new Error("Invalid API response: items must be an array.");
        }

        if (!data.items.length) {
            grid.innerHTML = `
                <div class="empty-state">
                    <h3>No items found</h3>
                    <p>Try a different search or category.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = data.items.map(item => {
            const image = item.image_url
                ? escapeHTML(item.image_url)
                : "/icons/package.svg";

            return `
                <article class="item-card">

                    <img
                        class="item-image"
                        src="${image}"
                        alt="${escapeHTML(item.title)}"
                        onerror="this.onerror=null;this.src='/icons/package.svg'"
                    >

                    <div class="item-body">

                        <h3>${escapeHTML(item.title)}</h3>

                        <p class="muted">
                            ${escapeHTML(item.category)}
                            ·
                            ${escapeHTML(item.condition_status)}
                        </p>

                        <div class="item-meta">
                            <span>
                                ${icon("map-pin", 15)}
                                ${escapeHTML(item.location)}
                            </span>

                            <span>
                                ${icon("user", 15)}
                                ${escapeHTML(item.owner_name || "Unknown")}
                            </span>
                        </div>

                        <p class="item-price">
                            ${Number(item.daily_price) === 0
                                ? "Free to borrow"
                                : `PKR ${Number(item.daily_price).toFixed(2)} / day`}
                        </p>

                        <p class="muted">
                            Deposit: PKR ${Number(item.deposit || 0).toFixed(2)}
                        </p>

                    </div>

                    <div class="card-footer">

                        <span>
                            Owner rating:
                            ${item.owner_rating != null
                                ? Number(item.owner_rating).toFixed(1) + "/5"
                                : "New"}
                        </span>

                        <a
                            href="/login.html?item=${encodeURIComponent(item.item_id)}"
                            class="btn btn-light"
                        >
                            View Item
                        </a>

                    </div>

                </article>
            `;
        }).join("");

    } catch (error) {
        console.error("Browse items error:", error);

        grid.innerHTML = `
            <div class="empty-state">
                <h3>Unable to load items</h3>
                <p>${escapeHTML(error.message)}</p>
                <button class="btn btn-primary" onclick="loadItems()">
                    Try Again
                </button>
            </div>
        `;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadItems();

    ["search", "category", "location"].forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.addEventListener(
                element.tagName === "INPUT" ? "input" : "change",
                loadItems
            );
        }
    });
});
