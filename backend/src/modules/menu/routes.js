const { Router } = require("express");
const controller = require("./controller");
const { asyncHandler, authenticate } = require("../../common/middleware");

const router = Router();

router.get("/", asyncHandler(controller.getAll));
router.get("/by-date", asyncHandler(controller.getByDate));
router.post("/", authenticate, asyncHandler(controller.create));
router.put("/:id", authenticate, asyncHandler(controller.update));
router.delete("/:id", authenticate, asyncHandler(controller.delete));

module.exports = router;
