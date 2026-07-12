const { Router } = require("express");
const controller = require("./controller");
const { asyncHandler, authenticate } = require("../../common/middleware");

const router = Router();

// Dispatcher middleware for path routing based on baseUrl
router.use((req, res, next) => {
  const base = req.baseUrl;

  if (base.endsWith("/snack-products")) {
    if (req.method === "GET" && req.path === "/") {
      return controller.productsController.getAll(req, res);
    }
    if (req.method === "POST" && req.path === "/add") {
      return controller.productsController.add(req, res);
    }
    if (req.method === "PUT" && req.path.startsWith("/update/")) {
      req.params.id = req.path.split("/")[2];
      return controller.productsController.update(req, res);
    }
    if (req.method === "DELETE" && req.path.startsWith("/delete/")) {
      req.params.id = req.path.split("/")[2];
      return controller.productsController.delete(req, res);
    }
  }

  if (base.endsWith("/snack-orders") || base.endsWith("/snacks")) {
    if (req.method === "GET" && req.path === "/") {
      return controller.ordersController.getAll(req, res);
    }
    if (req.method === "POST" && req.path === "/order") {
      return controller.ordersController.placeOrder(req, res);
    }
    if (req.method === "POST" && req.path === "/bulk-order") {
      return controller.ordersController.placeBulkOrder(req, res);
    }
    if (req.method === "GET" && req.path.startsWith("/orders/")) {
      req.params.memberId = req.path.split("/")[2];
      return controller.ordersController.getByMember(req, res);
    }
    if (req.method === "GET" && req.path.startsWith("/validate/")) {
      req.params.orderId = req.path.split("/")[2];
      return controller.ordersController.validateSingle(req, res);
    }
    if (req.method === "POST" && req.path === "/validate/bulk") {
      return controller.ordersController.validateBulk(req, res);
    }
    if (req.method === "PUT" && req.path.length > 1 && !req.path.substring(1).includes("/")) {
      req.params.id = req.path.substring(1);
      return controller.ordersController.updateOrder(req, res);
    }
    if (req.method === "DELETE" && req.path.length > 1 && !req.path.substring(1).includes("/")) {
      req.params.id = req.path.substring(1);
      return controller.ordersController.deleteOrder(req, res);
    }
  }

  next();
});

// Explicit standard routes definitions (fallback)
router.get("/orders/:memberId", authenticate, asyncHandler(controller.ordersController.getByMember));
router.get("/validate/:orderId", asyncHandler(controller.ordersController.validateSingle));
router.post("/validate/bulk", asyncHandler(controller.ordersController.validateBulk));
router.post("/order", authenticate, asyncHandler(controller.ordersController.placeOrder));
router.post("/bulk-order", authenticate, asyncHandler(controller.ordersController.placeBulkOrder));

// Products
router.post("/add", authenticate, asyncHandler(controller.productsController.add));
router.put("/update/:id", authenticate, asyncHandler(controller.productsController.update));
router.delete("/delete/:id", authenticate, asyncHandler(controller.productsController.delete));

// Legacy
router.post("/", authenticate, asyncHandler(controller.ordersController.updateOrder));
router.put("/:id", authenticate, asyncHandler(controller.ordersController.updateOrder));
router.delete("/:id", authenticate, asyncHandler(controller.ordersController.deleteOrder));

module.exports = router;
