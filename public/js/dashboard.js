
let currentUser = null;

document.addEventListener("DOMContentLoaded", initializeDashboard);

async function initializeDashboard() {
    // Do not run dashboard initialization on other pages.
    const itemForm = document.getElementById("itemForm");

    if (!itemForm) return;

    try {
        currentUser = await checkAuth();

        if (!currentUser) return;

        setText("welcomeUser", `Hello, ${currentUser.full_name}`);

        setHTML("homeIcon", icon("home"));
        setHTML("searchIcon", icon("search"));
        setHTML("packageIcon", icon("package"));
        setHTML("plusIcon", icon("plus-circle"));
        setHTML("requestIcon", icon("handshake"));
        setHTML("userIcon", icon("user"));

        document.querySelectorAll(".sidebar button[data-tab]")
            .forEach(button => {
                button.addEventListener("click", () => {
                    switchTab(button.dataset.tab);
                });
            });

        itemForm.addEventListener("submit", saveItem);

        const profileForm = document.getElementById("profileForm");

        if (profileForm) {
            profileForm.addEventListener("submit", saveProfile);
        }

        const searchInput = document.getElementById("dashboardSearch");

        if (searchInput) {
            searchInput.addEventListener("keydown", event => {
                if (event.key === "Enter") {
                    loadDashboardItems();
                }
            });
        }

        await loadDashboard();

        switchTab("overview");

    } catch (error) {
        console.error("Dashboard initialization error:", error);
        showMessage(error.message, "error");
    }
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value ?? "";
    }
}

function setHTML(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.innerHTML = value ?? "";
    }
}

function getElement(id) {
    const element = document.getElementById(id);

    if (!element) {
        throw new Error(`Required HTML element not found: #${id}`);
    }

    return element;
}

function switchTab(tab) {
    document.querySelectorAll(".tab-content").forEach(section => {
        section.hidden = true;
    });

    document.querySelectorAll(".sidebar button").forEach(button => {
        button.classList.remove("active");
    });

    const section = document.getElementById(tab);

    if (!section) return;

    section.hidden = false;

    const button = document.querySelector(
        `.sidebar button[data-tab="${tab}"]`
    );

    if (button) button.classList.add("active");

    if (tab === "overview") loadDashboard();
    if (tab === "browse") loadDashboardItems();
    if (tab === "listings") loadMyListings();
    if (tab === "requests") loadRequests();
    if (tab === "profile") loadProfile();
}

async function loadDashboard() {
    try {
        const data = await api("/api/dashboard");

        setText("totalListings", data.stats.listings);
        setText("totalBorrowed", data.stats.borrowed);
        setText("totalLent", data.stats.lent);
        setText("totalPending", data.stats.pending);

    } catch (error) {
        showMessage(error.message, "error");
    }
}

function itemCard(item, mine = false) {
    const image = item.image_url
        ? escapeHTML(item.image_url)
        : "/icons/package.svg";

    return `
        <article class="item-card">

            <img
                src="${image}"
                class="item-image"
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
                    ${icon("map-pin", 15)}
                    ${escapeHTML(item.location)}
                </div>

                <p class="item-price">
                    ${Number(item.daily_price) === 0
                        ? "Free to borrow"
                        : `PKR ${Number(item.daily_price).toFixed(2)} / day`}
                </p>

                <p class="muted" style="font-size:12px;margin-top:8px">
                    Deposit: PKR ${Number(item.deposit).toFixed(2)}
                </p>

                ${mine ? `
                    <p class="muted" style="margin-top:8px">
                        Status: ${escapeHTML(item.status)}
                    </p>
                ` : ""}

            </div>

            <div class="card-footer">

                ${mine ? `
                    <button class="btn btn-light"
                        onclick="editItem(${Number(item.item_id)})">
                        ${icon("edit", 15)}
                        Edit
                    </button>

                    <button class="btn btn-danger"
                        onclick="deleteItem(${Number(item.item_id)})">
                        ${icon("trash-2", 15)}
                        Delete
                    </button>
                ` : `
                    <button class="btn btn-primary"
                        onclick="borrowItem(${Number(item.item_id)})">
                        Borrow Request
                    </button>
                `}

            </div>

        </article>
    `;
}

async function loadDashboardItems() {
    const container = document.getElementById("dashboardItems");

    if (!container) return;

    try {
        const searchInput = document.getElementById("dashboardSearch");
        const search = searchInput?.value || "";

        const params = new URLSearchParams({ search });

        const data = await api(`/api/items?${params}`);

        const availableItems = (data.items || []).filter(
            item => Number(item.user_id) !== Number(currentUser.user_id)
        );

        if (!availableItems.length) {
            container.innerHTML = `
                <div class="empty-state">
                    No available items found.
                </div>
            `;
            return;
        }

        container.innerHTML = availableItems
            .map(item => itemCard(item))
            .join("");

    } catch (error) {
        container.innerHTML = `
            <div class="empty-state">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

async function loadMyListings() {
    const container = document.getElementById("myListings");

    if (!container) return;

    try {
        const data = await api("/api/items/mine");

        if (!data.items || !data.items.length) {
            container.innerHTML = `
                <div class="empty-state">
                    You haven't published any items yet.
                </div>
            `;
            return;
        }

        container.innerHTML = data.items
            .map(item => itemCard(item, true))
            .join("");

    } catch (error) {
        container.innerHTML = `
            <div class="empty-state">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

async function saveItem(event) {
    event.preventDefault();

    const form = document.getElementById("itemForm");

    if (!form) return;

    const itemId = getElement("editingItemId").value;

    const body = {
        title: getElement("itemTitle").value.trim(),
        description: getElement("itemDescription").value.trim(),
        category: getElement("itemCategory").value,
        condition_status: getElement("itemCondition").value,
        location: getElement("itemLocation").value.trim(),
        daily_price: getElement("itemPrice").value,
        deposit: getElement("itemDeposit").value,
        image_url: getElement("itemImage").value.trim()
    };

    try {
        if (itemId) {
            const existing = await api(`/api/items/${itemId}`);

            body.status = existing.item.status;
        }

        const data = await api(
            itemId ? `/api/items/${itemId}` : "/api/items",
            {
                method: itemId ? "PUT" : "POST",
                body: JSON.stringify(body)
            }
        );

        showMessage(data.message || "Item saved successfully.");

        resetItemForm();

        await Promise.all([
            loadMyListings(),
            loadDashboard()
        ]);

        switchTab("listings");

    } catch (error) {
        showMessage(error.message, "error");
    }
}

async function editItem(id) {
    try {
        const data = await api(`/api/items/${id}`);
        const item = data.item;

        if (Number(item.user_id) !== Number(currentUser.user_id)) {
            throw new Error("You cannot edit another user's item.");
        }

        getElement("editingItemId").value = item.item_id;
        getElement("itemTitle").value = item.title || "";
        getElement("itemDescription").value = item.description || "";
        getElement("itemCategory").value = item.category || "";
        getElement("itemCondition").value = item.condition_status || "GOOD";
        getElement("itemLocation").value = item.location || "";
        getElement("itemPrice").value = item.daily_price ?? 0;
        getElement("itemDeposit").value = item.deposit ?? 0;
        getElement("itemImage").value = item.image_url || "";

        setText("itemFormHeading", "Edit Item");

        const submitButton = document.querySelector(
            "#itemForm button[type='submit']"
        );

        if (submitButton) {
            submitButton.textContent = "Save Changes";
        }

        const cancelButton = document.getElementById("cancelEdit");

        if (cancelButton) {
            cancelButton.hidden = false;
        }

        switchTab("add");

    } catch (error) {
        showMessage(error.message, "error");
    }
}

function resetItemForm() {
    const form = document.getElementById("itemForm");

    if (!form) return;

    form.reset();

    // setText("editingItemId", "");
    getElement("editingItemId").value = "";

    setText("itemFormHeading", "Publish New Item");

    const submitButton = document.querySelector(
        "#itemForm button[type='submit']"
    );

    if (submitButton) {
        submitButton.textContent = "Publish Item";
    }

    const cancelButton = document.getElementById("cancelEdit");

    if (cancelButton) {
        cancelButton.hidden = true;
    }
}

async function deleteItem(id) {
    if (!confirm("Are you sure you want to delete this item?")) {
        return;
    }

    try {
        const data = await api(`/api/items/${id}`, {
            method: "DELETE"
        });

        showMessage(data.message || "Item deleted successfully.");

        await Promise.all([
            loadMyListings(),
            loadDashboard()
        ]);

    } catch (error) {
        showMessage(error.message, "error");
    }
}

async function borrowItem(itemId) {
    const pickup = prompt("Enter pickup date (YYYY-MM-DD):");

    if (!pickup) return;

    const returning = prompt("Enter return date (YYYY-MM-DD):");

    if (!returning) return;

    const message = prompt("Write a message to the owner:") || "";

    try {
        const data = await api(`/api/requests/${itemId}`, {
            method: "POST",
            body: JSON.stringify({
                pickup_date: pickup,
                return_date: returning,
                message
            })
        });

        showMessage(data.message);

        await Promise.all([
            loadDashboardItems(),
            loadDashboard()
        ]);

    } catch (error) {
        showMessage(error.message, "error");
    }
}

async function loadRequests() {
    const container = document.getElementById("requestList");

    if (!container) return;

    try {
        const data = await api("/api/requests");

        if (!data.requests || !data.requests.length) {
            container.innerHTML = `
                <div class="empty-state">
                    No borrowing requests found.
                </div>
            `;
            return;
        }

        container.innerHTML = data.requests.map(request => {
            const isOwner =
                Number(request.owner_id) === Number(currentUser.user_id);

            const isBorrower =
                Number(request.borrower_id) === Number(currentUser.user_id);

            let actions = "";

            if (isOwner && request.status === "PENDING") {
                actions = `
                    <button class="btn btn-success"
                        onclick="updateRequest(${Number(request.request_id)},'APPROVE')">
                        Approve
                    </button>

                    <button class="btn btn-danger"
                        onclick="updateRequest(${Number(request.request_id)},'REJECT')">
                        Reject
                    </button>
                `;
            }

            if (isBorrower && request.status === "PENDING") {
                actions = `
                    <button class="btn btn-danger"
                        onclick="updateRequest(${Number(request.request_id)},'CANCEL')">
                        Cancel Request
                    </button>
                `;
            }

            if (isOwner && request.status === "APPROVED") {
                actions = `
                    <button class="btn btn-success"
                        onclick="updateRequest(${Number(request.request_id)},'RETURN')">
                        Confirm Return
                    </button>
                `;
            }

            const participant = isOwner
                ? `Borrower: ${escapeHTML(request.borrower_name)}`
                : `Owner: ${escapeHTML(request.owner_name)}`;

            return `
                <div class="panel" style="margin-bottom:16px">

                    <div class="section-heading">
                        <h3>${escapeHTML(request.item_title)}</h3>

                        <span class="status ${escapeHTML(request.status)}">
                            ${escapeHTML(request.status)}
                        </span>
                    </div>

                    <p class="muted">${participant}</p>

                    <p style="margin-top:12px">
                        Pickup: ${formatDate(request.pickup_date)}
                    </p>

                    <p>
                        Return: ${formatDate(request.return_date)}
                    </p>

                    <p class="muted" style="margin-top:8px">
                        ${escapeHTML(request.message || "No message provided")}
                    </p>

                    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:15px">
                        ${actions}
                    </div>

                    ${request.status === "RETURNED" ? `
                        <button class="btn btn-light"
                            style="margin-top:15px"
                            onclick="rateRequest(${Number(request.request_id)})">
                            Rate ${isOwner ? "Borrower" : "Owner"}
                        </button>
                    ` : ""}

                </div>
            `;
        }).join("");

    } catch (error) {
        container.innerHTML = `
            <div class="empty-state">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

async function updateRequest(id, action) {
    if (!confirm(`Are you sure you want to ${action.toLowerCase()} this request?`)) {
        return;
    }

    try {
        const data = await api(`/api/requests/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ action })
        });

        showMessage(data.message);

        await Promise.all([
            loadRequests(),
            loadDashboard()
        ]);

    } catch (error) {
        showMessage(error.message, "error");
    }
}

async function rateRequest(requestId) {
    const rating = prompt("Enter your rating from 1 to 5:");

    if (!rating) return;

    const comment = prompt("Write a review:") || "";

    try {
        const data = await api(`/api/ratings/${requestId}`, {
            method: "POST",
            body: JSON.stringify({
                rating,
                comment
            })
        });

        showMessage(data.message);

    } catch (error) {
        showMessage(error.message, "error");
    }
}

async function loadProfile() {
    try {
        const data = await api("/api/profile");
        const profile = data.profile;

        const fields = {
            profileName: profile.full_name,
            profileEmail: profile.email,
            profilePhone: profile.phone,
            profileLocation: profile.location,
            profileBio: profile.bio
        };

        Object.entries(fields).forEach(([id, value]) => {
            const element = document.getElementById(id);

            if (element) {
                element.value = value || "";
            }
        });

    } catch (error) {
        showMessage(error.message, "error");
    }
}

async function saveProfile(event) {
    event.preventDefault();

    const body = {
        full_name: getElement("profileName").value,
        phone: document.getElementById("profilePhone")?.value || "",
        location: getElement("profileLocation").value,
        bio: document.getElementById("profileBio")?.value || ""
    };

    try {
        const data = await api("/api/profile", {
            method: "PUT",
            body: JSON.stringify(body)
        });

        currentUser.full_name = body.full_name;

        setText("welcomeUser", `Hello, ${body.full_name}`);

        showMessage(data.message);

    } catch (error) {
        showMessage(error.message, "error");
    }
}
