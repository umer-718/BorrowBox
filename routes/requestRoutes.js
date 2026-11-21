const express = require("express");
const router = express.Router();

const request = require("../controllers/requestController");
const { isAuthenticated } = require("../middleware/auth");

router.get("/", isAuthenticated, request.getMyRequests);

router.post(
    "/:itemId",
    isAuthenticated,
    request.createRequest
);

router.patch(
    "/:id",
    isAuthenticated,
    request.updateRequest
);

module.exports = router;