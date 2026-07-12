const { z } = require("zod");

const createMemberSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  nameMr: z.string().trim().optional(),
  roomOwnerName: z.string().trim().min(1, "Room owner name is required"),
  roomOwnerNameMr: z.string().trim().optional(),
  phone: z.string().trim().min(10, "Phone number must be at least 10 digits"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  joiningDate: z.string().optional().or(z.date().optional()),
  status: z.enum(["Active", "Inactive"]).optional().default("Active"),
  mealPlan: z.enum(["Lunch", "Dinner", "Both"]).optional().default("Lunch"),
});

const updateMemberSchema = z.object({
  name: z.string().trim().optional(),
  nameMr: z.string().trim().optional(),
  roomOwnerName: z.string().trim().optional(),
  roomOwnerNameMr: z.string().trim().optional(),
  phone: z.string().trim().min(10).optional(),
  email: z.string().email("Invalid email format").optional(),
  password: z.string().min(6).optional(),
  joiningDate: z.string().optional().or(z.date().optional()),
  status: z.enum(["Active", "Inactive"]).optional(),
  mealPlan: z.enum(["Lunch", "Dinner", "Both"]).optional(),
});

module.exports = {
  createMemberSchema,
  updateMemberSchema,
};
