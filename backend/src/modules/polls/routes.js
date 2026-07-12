const { Router } = require("express");
const controller = require("./controller");
const { asyncHandler, authenticate } = require("../../common/middleware");

const router = Router();

router.get("/list", authenticate, asyncHandler(controller.listRecent));
router.get("/", authenticate, asyncHandler(controller.getByDate));
router.post("/", authenticate, asyncHandler(controller.create));
router.put("/:id", authenticate, asyncHandler(controller.update));
router.delete("/:id", authenticate, asyncHandler(controller.delete));
router.post("/:id/vote", authenticate, asyncHandler(controller.vote));

module.exports = router;
