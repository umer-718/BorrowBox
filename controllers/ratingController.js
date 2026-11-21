const db = require("../config/db");

exports.createRating = async (req, res) => {
    try {
        const requestId = Number(req.params.requestId);
        const reviewerId = req.session.user.user_id;

        const { rating, comment } = req.body;

        const score = Number(rating);

        if (
            !Number.isInteger(score) ||
            score < 1 ||
            score > 5
        ) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5."
            });
        }

        const [requests] = await db.execute(
            `SELECT *
             FROM borrow_requests
             WHERE request_id = ?
             AND status = 'RETURNED'
             AND (borrower_id = ? OR owner_id = ?)`,
            [requestId, reviewerId, reviewerId]
        );

        if (!requests.length) {
            return res.status(403).json({
                success: false,
                message: "Only participants in completed borrowings can rate."
            });
        }

        const request = requests[0];

        const revieweeId =
            request.borrower_id === reviewerId
                ? request.owner_id
                : request.borrower_id;

        if (revieweeId === reviewerId) {
            return res.status(400).json({
                success: false,
                message: "You cannot rate yourself."
            });
        }

        await db.execute(
            `INSERT INTO ratings (
                request_id,
                reviewer_id,
                reviewee_id,
                rating,
                comment
            )
            VALUES (?, ?, ?, ?, ?)`,
            [
                requestId,
                reviewerId,
                revieweeId,
                score,
                comment?.trim() || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Rating submitted successfully."
        });

    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "You have already rated this borrowing."
            });
        }

        console.error("Rating error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to submit rating."
        });
    }
};

exports.getUserRatings = async (req, res) => {
    try {
        const userId = Number(req.params.userId);

        const [ratings] = await db.execute(
            `SELECT
                r.*,
                u.full_name AS reviewer_name
             FROM ratings r
             JOIN users u ON u.user_id = r.reviewer_id
             WHERE r.reviewee_id = ?
             ORDER BY r.created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            ratings
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to load ratings."
        });
    }
};