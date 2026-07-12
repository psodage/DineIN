import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2 } from "lucide-react";
import Button from "../../components/ui/Button";
import { formatCurrencyINR } from "../../lib/dateUtils";

function parseOrderIds(raw) {
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map(String).filter(Boolean);
    } catch {
      /* fall through */
    }
  }
  return raw.split(",").map((x) => x.trim()).filter(Boolean);
}

export default function SnackPurchaseSuccessPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const snackName = params.get("snackName") || "Snack";
  const quantity = params.get("quantity") || "0";
  const totalPrice = params.get("totalPrice") || "0";
  const orderIds = parseOrderIds(params.get("orderIds") || "");
  const orderId = params.get("orderId") || "";
  const fromHistory = params.get("fromHistory") === "1";

  const referenceIds = useMemo(() => {
    if (orderIds.length) return orderIds;
    if (orderId && orderId !== "bulk") return [orderId];
    return [];
  }, [orderIds, orderId]);

  const qrPayload = JSON.stringify({
    type: "snack-order",
    orderIds: referenceIds,
    totalPrice: Number(totalPrice),
    quantity: Number(quantity),
  });

  return (
    <div className="min-h-dvh bg-surface px-5 py-8 safe-top safe-bottom">
      <div className="mx-auto max-w-sm text-center animate-slide-up">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" />
        <h1 className="mt-4 text-2xl font-extrabold text-ink">Order confirmed</h1>
        <p className="mt-2 text-muted">Show this QR at pickup</p>

        <div className="mt-6 rounded-3xl bg-white p-6 shadow-xl">
          <div className="mx-auto flex justify-center rounded-2xl bg-white p-3">
            <QRCodeSVG value={qrPayload} size={200} level="M" includeMargin />
          </div>
          <dl className="mt-6 space-y-2 text-left text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Item</dt>
              <dd className="font-bold text-ink">{snackName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Quantity</dt>
              <dd className="font-bold">{quantity}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Total</dt>
              <dd className="font-bold text-brand">{formatCurrencyINR(totalPrice)}</dd>
            </div>
            {referenceIds.length ? (
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Reference</dt>
                <dd className="truncate font-mono text-xs font-bold">{referenceIds.join(", ")}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="mt-6 space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => (fromHistory ? navigate(-1) : navigate("/dashboard?tab=snacks"))}
          >
            {fromHistory ? "Back" : "Order more snacks"}
          </Button>
          <Button className="w-full" onClick={() => navigate("/dashboard")}>
            Go to home
          </Button>
        </div>
      </div>
    </div>
  );
}
