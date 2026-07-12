const { Router } = require("express");
const controller = require("./controller");
const { asyncHandler, authenticate, validate } = require("../../common/middleware");
const { loginSchema, registerSchema, refreshTokenSchema, changePasswordSchema } = require("./validation");

const router = Router();

// Admin Auth
router.post("/register", validate(registerSchema), asyncHandler(controller.registerAdmin));
router.post("/send-otp", asyncHandler(controller.sendOtp));
router.post("/verify-otp", asyncHandler(controller.verifyOtp));
router.post("/reset-password", asyncHandler(controller.resetPassword));

// Member Auth (Unauthenticated)
router.post("/member-send-otp", asyncHandler(controller.sendMemberOtp));
router.post("/member-verify-otp", asyncHandler(controller.verifyMemberOtp));
router.post("/member-reset-password", asyncHandler(controller.resetMemberPassword));

// Member Auth (Authenticated)
router.post("/member-change-password", authenticate, validate(changePasswordSchema), asyncHandler(controller.changeMemberPassword));

// Login
router.post("/login", validate(loginSchema), asyncHandler(controller.loginAdmin));
router.post("/member-login", validate(loginSchema), asyncHandler(controller.loginMember));
router.post("/member-login-phone", asyncHandler(controller.loginMemberPhone));
router.post("/member-logout", authenticate, asyncHandler(controller.logoutMember));

// Extra
router.get("/admin-account-bounds", authenticate, asyncHandler(controller.adminAccountBounds));
router.get("/me", authenticate, asyncHandler(controller.me));
router.post("/refresh", validate(refreshTokenSchema), asyncHandler(controller.refresh));

module.exports = router;
