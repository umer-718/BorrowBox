
const db = require("../config/db");
const bcrypt = require("bcryptjs");

exports.register = async (req, res) => {
    try {
        const {
            full_name,
            email,
            password,
            location
        } = req.body;

        if (
            !full_name?.trim() ||
            !email?.trim() ||
            !password ||
            !location?.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "All required fields must be completed."
            });
        }

        if (full_name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid name."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const [existing] = await db.execute(
            "SELECT user_id FROM users WHERE email = ?",
            [normalizedEmail]
        );

        if (existing.length) {
            return res.status(409).json({
                success: false,
                message: "Email is already registered."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await db.execute(
            `INSERT INTO users
            (full_name, email, password, location)
            VALUES (?, ?, ?, ?)`,
            [
                full_name.trim(),
                normalizedEmail,
                hashedPassword,
                location.trim()
            ]
        );

        // Do not create a login session during registration.
        res.status(201).json({
            success: true,
            message: "Account created successfully. Please log in.",
            redirect: "/login.html"
        });

    } catch (error) {
        console.error("Register error:", error);

        res.status(500).json({
            success: false,
            message: "Registration failed."
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email?.trim() || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const [users] = await db.execute(
            "SELECT * FROM users WHERE email = ?",
            [email.trim().toLowerCase()]
        );

        if (!users.length) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const user = users[0];

        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        req.session.user = {
            user_id: user.user_id,
            full_name: user.full_name,
            email: user.email
        };

        res.json({
            success: true,
            message: "Login successful.",
            redirect: "/dashboard.html"
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Login failed."
        });
    }
};

exports.logout = (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                success: false,
                message: "Logout failed."
            });
        }

        res.clearCookie("borrowbox.sid");

        res.json({
            success: true,
            redirect: "/login.html"
        });
    });
};

exports.me = async (req, res) => {
    res.json({
        success: true,
        user: req.session.user || null
    });
};
