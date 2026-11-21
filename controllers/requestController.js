const db = require("../config/db");

exports.createRequest = async (req, res) => {
    let connection;

    try {
        const itemId = Number(req.params.itemId);
        const borrowerId = req.session.user.user_id;

        const {
            pickup_date,
            return_date,
            message
        } = req.body;

        if (
            !Number.isInteger(itemId) ||
            itemId < 1 ||
            !pickup_date ||
            !return_date
        ) {
            return res.status(400).json({
                success: false,
                message: "Complete the borrowing information."
            });
        }

        const pickup = new Date(`${pickup_date}T00:00:00Z`);
        const returning = new Date(`${return_date}T00:00:00Z`);

        if (
            Number.isNaN(pickup.getTime()) ||
            Number.isNaN(returning.getTime()) ||
            pickup.toISOString().slice(0, 10) !== pickup_date ||
            returning.toISOString().slice(0, 10) !== return_date ||
            return_date < pickup_date
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid borrowing dates."
            });
        }

        if (pickup_date < new Date().toISOString().slice(0, 10)) {
            return res.status(400).json({
                success: false,
                message: "Pickup date cannot be in the past."
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [items] = await connection.execute(
            `SELECT *
             FROM items
             WHERE item_id = ?
             FOR UPDATE`,
            [itemId]
        );

        if (!items.length) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Item not found."
            });
        }

        const item = items[0];

        if (item.user_id === borrowerId) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "You cannot borrow your own item."
            });
        }

        if (item.status !== "AVAILABLE") {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "This item is currently unavailable."
            });
        }

        const [overlapping] = await connection.execute(
            `SELECT request_id
             FROM borrow_requests
             WHERE item_id = ?
             AND status IN ('PENDING', 'APPROVED')
             AND pickup_date <= ?
             AND return_date >= ?`,
            [itemId, return_date, pickup_date]
        );

        if (overlapping.length) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "This item already has a request for those dates."
            });
        }

        const [duplicate] = await connection.execute(
            `SELECT request_id
             FROM borrow_requests
             WHERE item_id = ?
             AND borrower_id = ?
             AND status IN ('PENDING', 'APPROVED')`,
            [itemId, borrowerId]
        );

        if (duplicate.length) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "You already have an active request for this item."
            });
        }

        const [result] = await connection.execute(
            `INSERT INTO borrow_requests (
                item_id,
                borrower_id,
                owner_id,
                pickup_date,
                return_date,
                message
            )
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                itemId,
                borrowerId,
                item.user_id,
                pickup_date,
                return_date,
                message || null
            ]
        );

        await connection.commit();

        res.status(201).json({
            success: true,
            message: "Borrowing request sent successfully.",
            requestId: result.insertId
        });

    } catch (error) {
        if (connection) await connection.rollback();

        console.error("Create request:", error);

        res.status(500).json({
            success: false,
            message: "Unable to send borrowing request."
        });

    } finally {
        if (connection) connection.release();
    }
};

exports.getMyRequests = async (req, res) => {
    try {
        const userId = req.session.user.user_id;

        const [requests] = await db.execute(
            `SELECT
                br.*,
                i.title AS item_title,
                i.image_url,
                i.location AS item_location,
                i.daily_price,
                borrower.full_name AS borrower_name,
                owner.full_name AS owner_name,
                i.user_id AS item_owner_id
             FROM borrow_requests br
             JOIN items i ON i.item_id = br.item_id
             JOIN users borrower ON borrower.user_id = br.borrower_id
             JOIN users owner ON owner.user_id = br.owner_id
             WHERE br.borrower_id = ? OR br.owner_id = ?
             ORDER BY br.created_at DESC`,
            [userId, userId]
        );

        res.json({
            success: true,
            requests
        });

    } catch (error) {
        console.error("Get requests:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load requests."
        });
    }
};

exports.updateRequest = async (req, res) => {
    let connection;

    try {
        const requestId = Number(req.params.id);
        const userId = req.session.user.user_id;
        const { action } = req.body;

        const allowed = [
            "APPROVE",
            "REJECT",
            "CANCEL",
            "RETURN"
        ];

        if (!allowed.includes(action)) {
            return res.status(400).json({
                success: false,
                message: "Invalid request action."
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [requests] = await connection.execute(
            `SELECT *
             FROM borrow_requests
             WHERE request_id = ?
             FOR UPDATE`,
            [requestId]
        );

        if (!requests.length) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Request not found."
            });
        }

        const request = requests[0];

        const [items] = await connection.execute(
            `SELECT item_id
             FROM items
             WHERE item_id = ?
             FOR UPDATE`,
            [request.item_id]
        );

        if (action === "APPROVE") {
            if (request.owner_id !== userId) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message: "Only the owner can approve this request."
                });
            }

            if (request.status !== "PENDING") {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: "Only pending requests can be approved."
                });
            }

            const [overlapping] = await connection.execute(
                `SELECT request_id
                 FROM borrow_requests
                 WHERE item_id = ?
                 AND request_id <> ?
                 AND status = 'APPROVED'
                 AND pickup_date <= ?
                 AND return_date >= ?`,
                [
                    request.item_id,
                    requestId,
                    request.return_date,
                    request.pickup_date
                ]
            );

            if (overlapping.length) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: "Another request has already been approved for these dates."
                });
            }

            await connection.execute(
                `UPDATE borrow_requests
                 SET status = 'APPROVED'
                 WHERE request_id = ?`,
                [requestId]
            );
        }

        if (action === "REJECT") {
            if (
                request.owner_id !== userId ||
                request.status !== "PENDING"
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message: "You cannot reject this request."
                });
            }

            await connection.execute(
                `UPDATE borrow_requests
                 SET status = 'REJECTED'
                 WHERE request_id = ?`,
                [requestId]
            );
        }

        if (action === "CANCEL") {
            if (
                request.borrower_id !== userId ||
                request.status !== "PENDING"
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message: "Only your pending request can be cancelled."
                });
            }

            await connection.execute(
                `UPDATE borrow_requests
                 SET status = 'CANCELLED'
                 WHERE request_id = ?`,
                [requestId]
            );
        }

        if (action === "RETURN") {
            if (
                request.owner_id !== userId ||
                request.status !== "APPROVED"
            ) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message: "Only the owner can complete an approved return."
                });
            }

            await connection.execute(
                `UPDATE borrow_requests
                 SET status = 'RETURNED'
                 WHERE request_id = ?`,
                [requestId]
            );
        }

        await connection.commit();

        res.json({
            success: true,
            message: `Request ${action.toLowerCase()} successful.`
        });

    } catch (error) {
        if (connection) await connection.rollback();

        console.error("Update request:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update request."
        });

    } finally {
        if (connection) connection.release();
    }
};