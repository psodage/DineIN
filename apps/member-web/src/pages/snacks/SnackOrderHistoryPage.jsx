import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import { useAuth } from "../../lib/AuthContext";
import { formatCurrencyINR } from "../../lib/dateUtils";
import PageHeader from "../../components/layout/PageHeader";
import LoadingOverlay from "../../components/ui/LoadingOverlay";

export default function SnackOrderHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const memberId = user?.id || user?._id;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) {
      setLoading(false);
      return;
    }
    api
      .get(`/api/snack-orders/orders/${memberId}`)
      .then((res) => setOrders(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [memberId]);

  const openOrder = (order) => {
    const params = new URLSearchParams({
      snackName: order.snackName || order.name || "Snack",
      quantity: String(order.quantity || 1),
      totalPrice: String(order.totalPrice || order.price || 0),
      orderId: String(order.referenceId || order._id || ""),
      orderDate: order.date || order.createdAt || "",
      memberName: user?.name || "",
      fromHistory: "1",
    });
    navigate(`/snacks/success?${params.toString()}`);
  };

  return (
    <div className="min-h-dvh bg-surface">
      <PageHeader title="Snack orders" backTo="/dashboard?tab=snacks" />
      {loading ? <LoadingOverlay visible /> : null}
      <div className="space-y-3 px-4 py-4">
        {orders.length === 0 ? (
          <p className="py-8 text-center text-muted">No snack orders yet.</p>
        ) : (
          orders.map((o) => (
            <button
              key={o._id}
              type="button"
              onClick={() => openOrder(o)}
              className="glass-card w-full p-4 text-left transition hover:shadow-md"
            >
              <div className="flex justify-between">
                <p className="font-extrabold text-ink">{o.snackName || o.name || "Snack order"}</p>
                <p className="font-bold text-brand">{formatCurrencyINR(o.totalPrice || o.price)}</p>
              </div>
              <p className="mt-1 text-xs text-muted">
                Qty {o.quantity || 1} · {new Date(o.date || o.createdAt).toLocaleString()}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
