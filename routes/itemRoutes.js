const express = require("express");
const router = express.Router();

const item = require("../controllers/itemController");
const { isAuthenticated } = require("../middleware/auth");

router.get("/", item.getItems);
router.get("/mine", isAuthenticated, item.getMyItems);
router.get("/:id", item.getItem);

router.post("/", isAuthenticated, item.createItem);
router.put("/:id", isAuthenticated, item.updateItem);
router.delete("/:id", isAuthenticated, item.deleteItem);

module.exports = router;