const jwt = require("jsonwebtoken");
const config = require("../config");
const prisma = require("../database/prisma");

/**
 * Authenticate JWT token from Authorization header.
 * Sets req.auth, req.user, and req.member (if member).
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    const role = typeof decoded.role === "string" ? decoded.role.trim().toLowerCase() : decoded.role;
    req.auth = { token, id: decoded.id, role };

    if (role === "member") {
      // For members, decoded.id is the Student (member) ID
      const student = await prisma.student.findUnique({
        where: { id: decoded.id },
        include: { user: true },
      });

      if (!student || !student.user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      // Enforce single-session token
      if (student.user.activeSessionToken && student.user.activeSessionToken !== token) {
        return res.status(401).json({
          success: false,
          message: "Session expired. You have logged in on another device.",
        });
      }

      req.member = student;
      req.user = student.user;
    } else {
      // For admin/manager, decoded.id is the User ID
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      req.user = user;
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
}

/**
 * Role-based authorization middleware.
 * Usage: authorize("admin", "manager")
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
