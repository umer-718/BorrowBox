async function api(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json();

    if (!response.ok) {
        if (response.status === 401) {
            window.location.href = "/login.html";
        }

        throw new Error(data.message || "Something went wrong.");
    }

    return data;
}

function showMessage(message, type = "success") {
    const box = document.getElementById("message");

    if (!box) {
        alert(message);
        return;
    }

    box.textContent = message;
    box.className = `message ${type}`;
    box.style.display = "block";

    setTimeout(() => {
        box.style.display = "none";
    }, 4000);
}

function icon(name, size = 20) {
    const allowed = [
        "home", "search", "plus-circle", "package",
        "handshake", "clock", "check-circle",
        "x-circle", "star", "user", "log-out",
        "calendar", "map-pin", "book-open",
        "wrench", "menu", "edit", "trash-2",
        "arrow-left", "arrow-right", "send", "filter"
    ];

    if (!allowed.includes(name)) return "";

    return `
        <img
            src="/icons/${name}.svg"
            width="${size}"
            height="${size}"
            alt=""
            class="icon"
        >
    `;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function formatDate(date) {
    if (!date) return "-";

    return new Date(`${date}T00:00:00`).toLocaleDateString();
}

async function logout() {
    try {
        await api("/api/auth/logout", {
            method: "POST"
        });

        window.location.href = "/login.html";

    } catch (error) {
        showMessage(error.message, "error");
    }
}

async function checkAuth() {
    const data = await api("/api/auth/me");

    if (!data.user) {
        window.location.href = "/login.html";
        return null;
    }

    return data.user;
}