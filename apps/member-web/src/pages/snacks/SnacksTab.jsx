import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { History, Minus, Plus, ShoppingCart, UtensilsCrossed } from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { formatCurrencyINR } from "../../lib/dateUtils";
import Button from "../../components/ui/Button";
import LoadingOverlay from "../../components/ui/LoadingOverlay";
import Modal from "../../components/ui/Modal";

function getSnackKey(snack) {
  return String(snack?._id || snack?.id || "");
}

function getSnackStock(snack) {
  const raw = snack?.quantity ?? snack?.availableQuantity ?? snack?.stock ?? snack?.inStock;
  const stock = Number(raw);
  if (!Number.isFinite(stock)) return Number.POSITIVE_INFINITY;
  if (snack?.availability === false) return 0;
  return Math.max(0, Math.floor(stock));
}

export default function SnacksTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const memberId = user?.id || user?._id;
  const memberName = user?.name || "";

  const [snacks, setSnacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [placing, setPlacing] = useState(false);
  const [modal, setModal] = useState(null);
  const placingRef = useRef(false);

  const fetchSnacks = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await api.get("/api/snack-products", { params: { available: "true" } });
      let items = Array.isArray(res.data) ? res.data : [];
      items = items.filter((s) => s.availability !== false && getSnackStock(s) >= 1);
      setSnacks(items);
    } catch (err) {
      setModal({ title: "Error", body: err?.response?.data?.message || "Failed to load snacks." });
      setSnacks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSnacks();
  }, [fetchSnacks]);

  const getQty = (id) => Math.max(0, Math.floor(Number(quantities[String(id)] || 0)));

  const updateQty = (id, delta) => {
    const key = String(id);
    setQuantities((prev) => {
      const next = Math.max(0, (prev[key] || 0) + delta);
      return { ...prev, [key]: next };
    });
  };

  const cartItems = snacks.filter((s) => getQty(getSnackKey(s)) > 0);
  const totalItems = cartItems.reduce((sum, s) => sum + getQty(getSnackKey(s)), 0);
  const cartTotal = cartItems.reduce(
    (sum, s) => sum + Number(s.price || 0) * getQty(getSnackKey(s)),
    0
  );

  const placeOrder = async () => {
    if (placingRef.current) return;
    if (!memberId) {
      setModal({ title: "Missing Member", body: "Please log in again." });
      return;
    }

    const orderPayload = snacks
      .map((s) => ({
        snackId: getSnackKey(s),
        quantity: getQty(getSnackKey(s)),
        _stock: getSnackStock(s),
      }))
      .filter((x) => x.quantity >= 1);

    if (!orderPayload.length) {
      setModal({ title: "Validation", body: "Please select at least one snack." });
      return;
    }

    const invalid = orderPayload.find((x) => x.quantity > x._stock);
    if (invalid) {
      const snack = snacks.find((s) => getSnackKey(s) === invalid.snackId);
      setModal({
        title: "Stock Limit",
        body: `${snack?.name || "Snack"} only has ${invalid._stock} available.`,
      });
      return;
    }

    try {
      placingRef.current = true;
      setPlacing(true);
      const orderDate = new Date().toISOString();
      const res = await api.post("/api/snack-orders/bulk-order", {
        studentId: memberId,
        orders: orderPayload.map((x) => ({ snackId: x.snackId, quantity: x.quantity })),
        date: orderDate,
      });

      const { orders, totalAmount } = res?.data || {};
      const rawOrders = Array.isArray(orders) ? orders : [];
      const orderIds = rawOrders
        .map((o) => String(o?.referenceId || o?._id || "").trim())
        .filter(Boolean);

      const params = new URLSearchParams({
        snackName: orderPayload.length === 1 ? snacks.find((s) => getSnackKey(s) === orderPayload[0].snackId)?.name || "Snack" : "Multiple Snacks",
        quantity: String(totalItems),
        totalPrice: String(totalAmount || cartTotal),
        orderId: orderIds.length !== 1 ? "bulk" : orderIds[0],
        orderIds: orderIds.join(","),
        orderDate,
        memberName,
      });
      setQuantities({});
      navigate(`/snacks/success?${params.toString()}`);
    } catch (err) {
      setModal({ title: "Error", body: err?.response?.data?.message || "Failed to place order." });
    } finally {
      placingRef.current = false;
      setPlacing(false);
    }
  };

  if (loading) return <LoadingOverlay visible />;

  return (
    <div className="min-h-dvh bg-white pb-20">
      {/* ── Accent curved header — matches LeaveTab / BillTab / ProfileTab ── */}
      <header className="safe-top rounded-b-[26px] bg-accent px-5 pb-8 pt-4 text-white">
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={() => navigate("/snacks/history")}
            className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold"
          >
            <History className="h-3.5 w-3.5" />
            History
          </button>
        </div>
        <h1 className="mt-2 text-2xl font-extrabold">Extra Snacks</h1>
        <p className="text-sm text-white/85">Order add-ons for your mess account</p>
      </header>

      {/* ── Content overlapping header ────────────────────────────────────── */}
      <div className="space-y-4 px-4 -mt-4">
        {/* Stats row */}
        <div className="rounded-2xl border border-slate-100 bg-surface grid grid-cols-3 gap-2 p-4 text-center text-sm">
          <div>
            <p className="text-muted">Available</p>
            <p className="font-extrabold text-ink">{snacks.length}</p>
          </div>
          <div>
            <p className="text-muted">In Cart</p>
            <p className="font-extrabold text-accent">{totalItems}</p>
          </div>
          <div>
            <p className="text-muted">Total</p>
            <p className="font-extrabold text-ink">{formatCurrencyINR(cartTotal)}</p>
          </div>
        </div>

        {/* Snack items list */}
        <div className="rounded-2xl border border-slate-100 bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-extrabold text-ink">Menu Items</p>
            <button
              type="button"
              onClick={() => fetchSnacks(true)}
              className="text-xs font-bold text-accent transition active:scale-95"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {snacks.length === 0 ? (
            <p className="py-12 text-center text-muted">No snacks available right now.</p>
          ) : (
            <div className="space-y-2">
              {snacks.map((item) => {
                const key = getSnackKey(item);
                const qty = getQty(key);
                const stock = getSnackStock(item);
                const canInc = qty < stock;
                return (
                  <article
                    key={key}
                    className="rounded-xl bg-white p-3 animate-fade-in transition-all"
                  >
                    <div className="flex gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-accent">
                        <UtensilsCrossed className="h-7 w-7" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-extrabold text-ink">{item.name}</h3>
                        <p className="text-xs text-muted">Category: {item.category || "Food"}</p>
                        <p className="mt-1 font-bold text-accent">{formatCurrencyINR(item.price)}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="inline-flex items-center rounded-full bg-slate-100 p-0.5">
                            <button
                              type="button"
                              onClick={() => updateQty(key, -1)}
                              className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white active:scale-90"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-[2rem] text-center text-sm font-bold">{qty}</span>
                            <button
                              type="button"
                              disabled={!canInc}
                              onClick={() => canInc && updateQty(key, 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white active:scale-90 disabled:opacity-40"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="text-xs font-semibold text-muted">
                            Left: {Number.isFinite(stock) ? Math.max(0, stock - qty) : "∞"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Floating cart bar ──────────────────────────────────────────────── */}
      {totalItems > 0 ? (
        <div className="safe-bottom fixed inset-x-0 bottom-16 z-20 px-4">
          <div className="mx-auto max-w-lg rounded-2xl bg-ink p-4 text-white shadow-2xl">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                <ShoppingCart className="h-4 w-4" />
                {totalItems} item(s)
              </span>
              <span className="font-extrabold">{formatCurrencyINR(cartTotal)}</span>
            </div>
            <Button className="mt-3 w-full bg-accent" loading={placing} onClick={placeOrder}>
              Place order
            </Button>
          </div>
        </div>
      ) : null}

      <Modal open={!!modal} title={modal?.title} onClose={() => setModal(null)}>
        {modal?.body}
      </Modal>
    </div>
  );
}
