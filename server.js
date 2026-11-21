require("dotenv").config();

const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const path = require("path");
const db = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const itemRoutes = require("./routes/itemRoutes");
const requestRoutes = require("./routes/requestRoutes");
const ratingRoutes = require("./routes/ratingRoutes");

const app = express();

app.disable("x-powered-by");

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({
    extended: true,
    limit: "1mb"
}));

const sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    clearExpired: true,
    checkExpirationInterval: 900000,
    expiration: 86400000
});

app.use(
    session({
        name: "borrowbox.sid",
        secret: process.env.SESSION_SECRET,
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 86400000
        }
    })
);

app.use(express.static(
    path.join(__dirname, "public")
));

app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/ratings", ratingRoutes);

app.get("/api/dashboard", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const userId = req.session.user.user_id;

        const [[myListings]] = await db.execute(
            `SELECT COUNT(*) AS total
             FROM items
             WHERE user_id = ?`,
            [userId]
        );

        const [[borrowed]] = await db.execute(
            `SELECT COUNT(*) AS total
             FROM borrow_requests
             WHERE borrower_id = ?
             AND status = 'APPROVED'`,
            [userId]
        );

        const [[lent]] = await db.execute(
            `SELECT COUNT(*) AS total
             FROM borrow_requests
             WHERE owner_id = ?
             AND status = 'APPROVED'`,
            [userId]
        );

        const [[pending]] = await db.execute(
            `SELECT COUNT(*) AS total
             FROM borrow_requests
             WHERE owner_id = ?
             AND status = 'PENDING'`,
            [userId]
        );

        res.json({
            success: true,
            stats: {
                listings: myListings.total,
                borrowed: borrowed.total,
                lent: lent.total,
                pending: pending.total
            }
        });

    } catch (error) {
        console.error("Dashboard:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load dashboard."
        });
    }
});

app.get("/api/profile", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const [users] = await db.execute(
            `SELECT
                user_id,
                full_name,
                email,
                phone,
                location,
                bio,
                created_at
             FROM users
             WHERE user_id = ?`,
            [req.session.user.user_id]
        );

        res.json({
            success: true,
            profile: users[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to load profile."
        });
    }
});

app.put("/api/profile", async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({
                success: false,
                message: "Login required."
            });
        }

        const {
            full_name,
            phone,
            location,
            bio
        } = req.body;

        if (!full_name?.trim() || !location?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Name and location are required."
            });
        }

        await db.execute(
            `UPDATE users
             SET full_name = ?,
                 phone = ?,
                 location = ?,
                 bio = ?
             WHERE user_id = ?`,
            [
                full_name.trim(),
                phone || null,
                location.trim(),
                bio || null,
                req.session.user.user_id
            ]
        );

        req.session.user.full_name = full_name.trim();

        res.json({
            success: true,
            message: "Profile updated successfully."
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to update profile."
        });
    }
});

app.get("/api/health", async (req, res) => {
    try {
        await db.query("SELECT 1");

        res.json({
            success: true,
            message: "BorrowBox server and MySQL are running."
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Database connection failed."
        });
    }
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found."
    });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        await db.query("SELECT 1");

        app.listen(PORT, () => {
            console.log(`BorrowBox running at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("Unable to connect to MySQL:", error.message);
        process.exit(1);
    }
}

startServer();