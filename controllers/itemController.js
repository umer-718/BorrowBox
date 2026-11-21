const db = require("../config/db");

exports.getItems = async (req, res) => {
    try {
        const {
            search = "",
            category = "",
            location = ""
        } = req.query;

        let sql = `
            SELECT
                i.*,
                u.full_name AS owner_name,
                u.location AS owner_location,
                (
                    SELECT ROUND(AVG(r.rating), 1)
                    FROM ratings r
                    WHERE r.reviewee_id = i.user_id
                ) AS owner_rating
            FROM items i
            JOIN users u ON u.user_id = i.user_id
            WHERE i.status = 'AVAILABLE'
        `;

        const values = [];

        if (search.trim()) {
            sql += ` AND (
                i.title LIKE ?
                OR i.description LIKE ?
                OR i.category LIKE ?
            )`;

            const term = `%${search.trim()}%`;
            values.push(term, term, term);
        }

        if (category) {
            sql += " AND i.category = ?";
            values.push(category);
        }

        if (location.trim()) {
            sql += " AND i.location LIKE ?";
            values.push(`%${location.trim()}%`);
        }

        sql += " ORDER BY i.created_at DESC";

        const [items] = await db.execute(sql, values);

        res.json({
            success: true,
            items
        });

    } catch (error) {
        console.error("Get items:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load items."
        });
    }
};

exports.getMyItems = async (req, res) => {
    try {
        const [items] = await db.execute(
            `SELECT *
             FROM items
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [req.session.user.user_id]
        );

        res.json({ success: true, items });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to load your listings."
        });
    }
};

exports.getItem = async (req, res) => {
    try {
        const itemId = Number(req.params.id);

        if (!Number.isInteger(itemId) || itemId < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid item."
            });
        }

        const [items] = await db.execute(
            `SELECT
                i.*,
                u.full_name AS owner_name,
                u.location AS owner_location,
                u.bio AS owner_bio,
                (
                    SELECT ROUND(AVG(r.rating), 1)
                    FROM ratings r
                    WHERE r.reviewee_id = i.user_id
                ) AS owner_rating
             FROM items i
             JOIN users u ON u.user_id = i.user_id
             WHERE i.item_id = ?`,
            [itemId]
        );

        if (!items.length) {
            return res.status(404).json({
                success: false,
                message: "Item not found."
            });
        }

        res.json({
            success: true,
            item: items[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to load item."
        });
    }
};

exports.createItem = async (req, res) => {
    try {
        const {
            title,
            description,
            category,
            condition_status,
            location,
            daily_price,
            deposit,
            image_url
        } = req.body;

        if (
            !title?.trim() ||
            !description?.trim() ||
            !category ||
            !location?.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Complete all required fields."
            });
        }

        const price = Number(daily_price || 0);
        const securityDeposit = Number(deposit || 0);

        if (
            !Number.isFinite(price) ||
            !Number.isFinite(securityDeposit) ||
            price < 0 ||
            securityDeposit < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid price or deposit."
            });
        }

        const allowedConditions = [
            "NEW",
            "LIKE_NEW",
            "GOOD",
            "FAIR"
        ];

        if (!allowedConditions.includes(condition_status || "GOOD")) {
            return res.status(400).json({
                success: false,
                message: "Invalid item condition."
            });
        }

        if (image_url && !/^https?:\/\/\S+$/i.test(image_url)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid image URL."
            });
        }

        const [result] = await db.execute(
            `INSERT INTO items (
                user_id,
                title,
                description,
                category,
                condition_status,
                location,
                daily_price,
                deposit,
                image_url
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.session.user.user_id,
                title.trim(),
                description.trim(),
                category,
                condition_status || "GOOD",
                location.trim(),
                price,
                securityDeposit,
                image_url || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Item published successfully.",
            itemId: result.insertId
        });

    } catch (error) {
        console.error("Create item:", error);

        res.status(500).json({
            success: false,
            message: "Unable to publish item."
        });
    }
};

exports.updateItem = async (req, res) => {
    try {
        const itemId = Number(req.params.id);
        const userId = req.session.user.user_id;

        const {
            title,
            description,
            category,
            condition_status,
            location,
            daily_price,
            deposit,
            image_url,
            status
        } = req.body;

        const [items] = await db.execute(
            "SELECT * FROM items WHERE item_id = ? AND user_id = ?",
            [itemId, userId]
        );

        if (!items.length) {
            return res.status(404).json({
                success: false,
                message: "Listing not found."
            });
        }

        const price = Number(daily_price);
        const securityDeposit = Number(deposit);

        const validConditions = ["NEW", "LIKE_NEW", "GOOD", "FAIR"];
        const validStatuses = ["AVAILABLE", "UNAVAILABLE"];

        if (
            !title?.trim() ||
            !description?.trim() ||
            !category ||
            !location?.trim() ||
            !Number.isFinite(price) ||
            !Number.isFinite(securityDeposit) ||
            price < 0 ||
            securityDeposit < 0 ||
            !validConditions.includes(condition_status) ||
            !validStatuses.includes(status)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid listing information."
            });
        }

        if (image_url && !/^https?:\/\/\S+$/i.test(image_url)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid image URL."
            });
        }

        const [active] = await db.execute(
            `SELECT request_id
             FROM borrow_requests
             WHERE item_id = ?
             AND status = 'APPROVED'`,
            [itemId]
        );

        if (active.length && status === "UNAVAILABLE") {
            return res.status(409).json({
                success: false,
                message: "This item has an active borrowing."
            });
        }

        await db.execute(
            `UPDATE items
             SET title = ?,
                 description = ?,
                 category = ?,
                 condition_status = ?,
                 location = ?,
                 daily_price = ?,
                 deposit = ?,
                 image_url = ?,
                 status = ?
             WHERE item_id = ? AND user_id = ?`,
            [
                title.trim(),
                description.trim(),
                category,
                condition_status,
                location.trim(),
                price,
                securityDeposit,
                image_url || null,
                status,
                itemId,
                userId
            ]
        );

        res.json({
            success: true,
            message: "Listing updated successfully."
        });

    } catch (error) {
        console.error("Update item:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update listing."
        });
    }
};

exports.deleteItem = async (req, res) => {
    try {
        const itemId = Number(req.params.id);
        const userId = req.session.user.user_id;

        const [active] = await db.execute(
            `SELECT request_id
             FROM borrow_requests
             WHERE item_id = ?
             AND status IN ('PENDING', 'APPROVED')`,
            [itemId]
        );

        if (active.length) {
            return res.status(409).json({
                success: false,
                message: "Cancel or complete active requests before deleting."
            });
        }

        const [result] = await db.execute(
            `DELETE FROM items
             WHERE item_id = ? AND user_id = ?`,
            [itemId, userId]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Listing not found."
            });
        }

        res.json({
            success: true,
            message: "Listing deleted successfully."
        });

    } catch (error) {
        console.error("Delete item:", error);

        res.status(500).json({
            success: false,
            message: "Unable to delete listing."
        });
    }
};