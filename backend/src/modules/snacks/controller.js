const snackRepository = require("./repository");

function resolveSnackOrderTotal(orderDoc) {
  const chargedRaw = orderDoc?.chargedAmount;
  if (chargedRaw !== null && chargedRaw !== undefined) {
    const charged = Number(chargedRaw);
    if (Number.isFinite(charged) && charged >= 0) return charged;
  }
  const qty = Number(orderDoc?.quantity || 0);
  const price = Number(orderDoc?.snackProduct?.price || 0);
  return qty * price;
}

function mapOrderToClient(o) {
  if (!o) return null;
  const pricePerItem = Number(o.snackProduct?.price || 0);
  const totalPrice = resolveSnackOrderTotal(o);
  return {
    id: o.id,
    _id: o.id,
    studentId: o.studentId,
    snackId: o.snackId,
    quantity: o.quantity,
    chargedAmount: o.chargedAmount,
    date: o.date,
    isOutsideCustomer: o.isOutsideCustomer,
    customerName: o.customerName,
    customerNameMr: o.customerNameMr,
    billSplitRequestId: o.billSplitRequestId,
    commonOrderId: o.commonOrderId,
    purchaseReference: o.purchaseReference,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    snackItem: o.snackProduct?.name || "",
    snackItemMr: o.snackProduct?.nameMr || o.snackProduct?.name || "",
    pricePerItem,
    totalPrice,
    memberName: !o.isOutsideCustomer ? o.student?.name : undefined,
    memberNameMr: !o.isOutsideCustomer ? o.student?.nameMr : undefined,
    referenceId: o.purchaseReference || String(o.id),
  };
}

const productsController = {
  async getAll(req, res) {
    const { available } = req.query;
    const filter = {};
    if (available === "true") {
      filter.availability = true;
    }
    const snacks = await snackRepository.findAllProducts(filter);
    res.json(snacks.map(s => ({ ...s, _id: s.id })));
  },

  async add(req, res) {
    const { name, nameMr, price, category, availability, quantity } = req.body;
    const nameEn = String(name || "").trim();
    const resolvedNameMr = String(nameMr || nameEn).trim();

    const product = await snackRepository.createProduct({
      name: nameEn,
      nameMr: resolvedNameMr,
      price: Number(price),
      category: category || "Other",
      availability: availability === false ? false : true,
      quantity: Number(quantity) || 0,
    });

    res.status(201).json({ ...product, _id: product.id });
  },

  async update(req, res) {
    const { id } = req.params;
    const { name, nameMr, price, category, availability, quantity } = req.body;

    const product = await snackRepository.findProductById(id);
    if (!product) return res.status(404).json({ message: "Snack product not found" });

    const updateData = {};
    if (name !== undefined) {
      updateData.name = String(name).trim() || product.name;
    }
    if (nameMr !== undefined || name !== undefined) {
      updateData.nameMr = String(nameMr || name || product.name).trim();
    }
    if (price !== undefined) updateData.price = Number(price);
    if (category !== undefined) updateData.category = category;
    if (availability !== undefined) updateData.availability = !!availability;
    if (quantity !== undefined) updateData.quantity = quantity === "" ? 0 : Number(quantity);

    const updated = await snackRepository.updateProduct(id, updateData);
    res.json({ ...updated, _id: updated.id });
  },

  async delete(req, res) {
    const success = await snackRepository.deleteProduct(req.params.id);
    if (!success) return res.status(404).json({ message: "Snack product not found" });
    res.json({ message: "Snack product deleted" });
  },
};

const ordersController = {
  async getAll(req, res) {
    const orders = await snackRepository.findAllOrders();
    res.json(orders.map(mapOrderToClient));
  },

  async getByMember(req, res) {
    const { memberId } = req.params;
    const orders = await snackRepository.findOrdersByStudent(memberId);
    const mapped = orders.map((o) => ({
      ...mapOrderToClient(o),
      commonOrderId: String(o.commonOrderId || "").trim() || (o.billSplitRequestId ? String(o.billSplitRequestId) : ""),
    }));
    res.json(mapped);
  },

  async placeOrder(req, res) {
    const memberId = req.body.memberId || req.body.studentId;
    const { snackId, quantity, date } = req.body;

    const order = await snackRepository.createOrder({
      studentId: memberId,
      snackId,
      quantity,
      chargedAmount: null,
      date: date ? new Date(date) : new Date(),
      isOutsideCustomer: false,
    });

    const populated = await snackRepository.findOrderById(order.id);
    res.status(201).json(mapOrderToClient(populated));
  },

  async placeBulkOrder(req, res) {
    const memberId = req.body.memberId || req.body.studentId;
    const { orders, date } = req.body;

    const createdOrders = await snackRepository.createBulkOrders(memberId, orders, date);
    const mapped = createdOrders.map(mapOrderToClient);
    const totalAmount = mapped.reduce((sum, o) => sum + o.totalPrice, 0);

    res.status(201).json({ orders: mapped, totalAmount });
  },

  async validateBulk(req, res) {
    const { orderIds } = req.body;
    const orders = await snackRepository.findOrdersByIds(orderIds);
    if (!orders.length) return res.status(404).json({ message: "Snack orders not found" });

    const mapped = orders.map(mapOrderToClient);
    const totalAmount = mapped.reduce((sum, o) => sum + o.totalPrice, 0);
    const totalQuantity = orders.reduce((sum, o) => sum + Number(o.quantity || 0), 0);

    const members = Array.from(
      new Map(
        orders
          .map((o) => o.student)
          .filter(Boolean)
          .map((m) => [
            String(m.id),
            {
              _id: String(m.id),
              id: String(m.id),
              name: m.name || "",
              nameMr: m.nameMr || m.name || "",
            },
          ])
      ).values()
    );
    const member = members.length === 1 ? members[0] : undefined;

    res.json({ totalAmount, totalQuantity, member, members, count: orders.length });
  },

  async validateSingle(req, res) {
    const { orderId } = req.params;
    if (orderId === "bulk") {
      return res.status(400).json({ message: "Bulk orders cannot be validated via QR scanner." });
    }

    const order = await snackRepository.findOrderById(orderId);
    if (!order) return res.status(404).json({ message: "Snack order not found" });

    const mapped = mapOrderToClient(order);
    res.json({
      ...mapped,
      snackItemMr: order.snackProduct?.nameMr || order.snackProduct?.name || "",
      memberName: order.student?.name || undefined,
      memberNameMr: order.student?.nameMr || order.student?.name || undefined,
    });
  },

  async updateOrder(req, res) {
    const { id } = req.params;
    const {
      studentId,
      memberId,
      customerName,
      customerNameMr,
      studentName,
      snackId,
      snackProductId,
      snackItem,
      quantity,
      date,
      isOutsideCustomer,
    } = req.body;

    const order = await snackRepository.findOrderById(id);
    if (!order) return res.status(404).json({ message: "Snack order not found" });

    const outside = isOutsideCustomer !== undefined ? isOutsideCustomer : order.isOutsideCustomer;
    const resolvedMemberId = memberId !== undefined ? memberId : (studentId !== undefined ? studentId : order.studentId);

    let finalSnackId = snackId || snackProductId;
    if (!finalSnackId && snackItem) {
      const product = await snackRepository.findProductByName(snackItem);
      finalSnackId = product?.id;
    }

    const updateData = {};
    if (isOutsideCustomer !== undefined) updateData.isOutsideCustomer = outside;
    if (finalSnackId !== undefined) updateData.snackId = finalSnackId;
    if (quantity !== undefined) updateData.quantity = Number(quantity);
    if (date) updateData.date = new Date(date);

    if (outside) {
      updateData.studentId = null;
      if (customerName !== undefined || studentName !== undefined) {
        updateData.customerName = String(customerName || studentName || "").trim();
      }
      if (customerNameMr !== undefined) updateData.customerNameMr = customerNameMr;
    } else {
      if (resolvedMemberId !== undefined) updateData.studentId = resolvedMemberId;
      updateData.customerName = null;
      updateData.customerNameMr = null;
    }

    if (!order.billSplitRequestId && (finalSnackId !== undefined || quantity !== undefined)) {
      const targetSnackId = finalSnackId || order.snackId;
      const targetQty = quantity !== undefined ? quantity : order.quantity;
      if (targetSnackId) {
        const pricingProduct = await snackRepository.findProductById(targetSnackId);
        if (pricingProduct) {
          updateData.chargedAmount = targetQty * pricingProduct.price;
        }
      }
    }

    await snackRepository.updateOrder(id, updateData);
    const populated = await snackRepository.findOrderById(id);
    res.json(mapOrderToClient(populated));
  },

  async deleteOrder(req, res) {
    const success = await snackRepository.deleteOrder(req.params.id);
    if (!success) return res.status(404).json({ message: "Snack order not found" });
    res.json({ message: "Snack order deleted successfully" });
  },
};

module.exports = {
  productsController,
  ordersController,
};
