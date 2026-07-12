const { Router } = require("express");
const controller = require("./controller");
const { asyncHandler, authenticate, authorize, validate } = require("../../common/middleware");
const { createMemberSchema, updateMemberSchema } = require("./validation");

const router = Router();

router.get("/", authenticate, authorize("admin", "manager"), asyncHandler(controller.getAll));
router.get("/split-members", authenticate, asyncHandler(controller.getSplit));
router.get("/due-month", authenticate, authorize("admin", "manager"), asyncHandler(controller.getDueMonth));
router.get("/:id", authenticate, asyncHandler(controller.getById));
router.post("/", authenticate, authorize("admin", "manager"), validate(createMemberSchema), asyncHandler(controller.create));
router.put("/:id", authenticate, authorize("admin", "manager"), validate(updateMemberSchema), asyncHandler(controller.update));
router.delete("/:id", authenticate, authorize("admin", "manager"), asyncHandler(controller.delete));

module.exports = router;
