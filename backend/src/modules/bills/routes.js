const { Router } = require("express");
const controller = require("./controller");
const { asyncHandler, authenticate } = require("../../common/middleware");

const router = Router();

// member-monthly-due endpoints
router.get("/:memberId/current", authenticate, asyncHandler(controller.getCurrentByMemberId));
router.get("/:memberId/history", authenticate, asyncHandler(controller.getHistoryByMemberId));
router.get("/:memberId", authenticate, asyncHandler(controller.getByMemberId));

module.exports = router;
