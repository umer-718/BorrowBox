
document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    // LOGIN
    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const button = loginForm.querySelector("button");

            if (button) {
                button.disabled = true;
                button.textContent = "Logging in...";
            }

            const form = new FormData(loginForm);

            const body = {
                email: form.get("email"),
                password: form.get("password")
            };

            try {
                const data = await api("/api/auth/login", {
                    method: "POST",
                    body: JSON.stringify(body)
                });

                showMessage(data.message);

                window.location.href = data.redirect || "/dashboard.html";

            } catch (error) {
                showMessage(error.message, "error");

                if (button) {
                    button.disabled = false;
                    button.textContent = "Login";
                }
            }
        });
    }

    // REGISTRATION
    if (registerForm) {
        registerForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const button = registerForm.querySelector("button");

            if (button) {
                button.disabled = true;
                button.textContent = "Creating account...";
            }

            const form = new FormData(registerForm);

            const body = {
                full_name: form.get("full_name"),
                email: form.get("email"),
                password: form.get("password"),
                location: form.get("location")
            };

            try {
                const data = await api("/api/auth/register", {
                    method: "POST",
                    body: JSON.stringify(body)
                });

                showMessage(data.message);

                // New users must log in manually.
                window.location.href = "/login.html";

            } catch (error) {
                showMessage(error.message, "error");

                if (button) {
                    button.disabled = false;
                    button.textContent = "Create Account";
                }
            }
        });
    }
});
