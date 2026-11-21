const express = require("express");
const router = express.Router();

const rating = require("../controllers/ratingController");
const { isAuthenticated } = require("../middleware/auth");

router.post(
    "/:requestId",
    isAuthenticated,
    rating.createRating
);

router.get(
    "/user/:userId",
    rating.getUserRatings
);

module.exports = router;