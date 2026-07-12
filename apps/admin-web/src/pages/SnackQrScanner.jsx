import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Scan,
  XCircle,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import api from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { Alert } from "@/utils/dialog";
import PageHeader from "@/components/ui/PageHeader";
import Spinner from "@/components/ui/Spinner";

const SCANNER_ID = "snack-qr-scanner-region";

export default function SnackQrScanner() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const scannerRef = useRef(null);
  const html5Ref = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanned, setScanned] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const stopScanner = useCallback(async () => {
    if (html5Ref.current) {
      try {
        await html5Ref.current.stop();
        html5Ref.current.clear();
      } catch {
        // ignore stop errors
      }
      html5Ref.current = null;
    }
  }, []);

  const handleBarCodeScanned = useCallback(
    async (data) => {
      if (scanned || validating) return;
      setScanned(true);
      setErrorMessage("");
      setValidationResult(null);

      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        setErrorMessage(t("qr_scanner_err_invalid_json"));
        setScanned(false);
        return;
      }

      if (!parsed?.orderId) {
        setErrorMessage(t("qr_scanner_err_missing_order"));
        setScanned(false);
        return;
      }

      try {
        setValidating(true);
        let order;

        if (parsed.orderId === "bulk") {
          const orderIds = Array.isArray(parsed?.orderIds) ? parsed.orderIds : [];
          if (!orderIds.length) {
            setErrorMessage(t("qr_scanner_err_bulk_ids"));
            setScanned(false);
            return;
          }

          const res = await api.post("/api/snack-orders/validate/bulk", { orderIds });
          const payload = res?.data || {};
          const splitMembers = Array.isArray(payload?.members)
            ? payload.members
                .map((m) => ({
                  _id: String(m?._id || "").trim(),
                  name: String(m?.name || "").trim(),
                  nameMr: String(m?.nameMr || m?.name || "").trim(),
                }))
                .filter((m) => m._id && (m.name || m.nameMr))
            : [];
          order = {
            _id: "BULK",
            quantity: Number(payload?.totalQuantity || parsed?.quantity || 0),
            totalPrice: Number(payload?.totalAmount || parsed?.totalPrice || 0),
            date: parsed?.orderDate || new Date().toISOString(),
            studentId: payload?.member || undefined,
            splitMembers,
            snackId: { name: "Multiple Snacks", nameMr: "अनेक स्नॅक्स" },
          };
        } else {
          const res = await api.get(`/api/snack-orders/validate/${parsed.orderId}`);
          order = res.data;
        }

        setValidationResult({ qr: parsed, order });
      } catch (err) {
        const message =
          err?.response?.data?.message || t("qr_scanner_err_validate_failed");
        setErrorMessage(message);
        Alert.alert(t("qr_scanner_alert_validation_failed"), message);
      } finally {
        setValidating(false);
      }
    },
    [scanned, validating, t]
  );

  const scannedRef = useRef(false);
  const validatingRef = useRef(false);
  scannedRef.current = scanned;
  validatingRef.current = validating;

  const startScanner = useCallback(async () => {
    await stopScanner();
    setCameraError("");
    setCameraReady(false);

    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras?.length) {
        setCameraError(t("qr_scanner_err_permission"));
        return;
      }
      const backCam =
        cameras.find((c) => /back|rear|environment/i.test(c.label || "")) || cameras[0];
      const instance = new Html5Qrcode(SCANNER_ID);
      html5Ref.current = instance;
      await instance.start(
        backCam.id,
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          if (!scannedRef.current && !validatingRef.current) handleBarCodeScanned(decoded);
        },
        () => {}
      );
      setCameraReady(true);
    } catch (err) {
      setCameraError(
        err?.message ||
          "Camera is currently unavailable. Please enable camera access and try again."
      );
    }
  }, [handleBarCodeScanned, stopScanner, t]);

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetScanner = async () => {
    setScanned(false);
    setValidationResult(null);
    setErrorMessage("");
    setCameraError("");
    await startScanner();
  };

  const order = validationResult?.order;
  const qr = validationResult?.qr;

  const isMatch =
    order &&
    qr &&
    (qr.totalPrice == null || Number(order.totalPrice || 0) === Number(qr.totalPrice || 0));

  const formatOrderDateTime = (d) => {
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return t("qr_scanner_na");
    return date.toLocaleString(language === "mr" ? "mr-IN" : "en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const na = t("qr_scanner_na");
  const qrTag = t("qr_scanner_from_qr");
  const splitMemberNamesFromQr = Array.isArray(qr?.splitMemberNames)
    ? qr.splitMemberNames.map((name) => String(name || "").trim()).filter(Boolean)
    : [];
  const splitMemberNamesFromOrder = Array.isArray(order?.splitMembers)
    ? order.splitMembers
        .map((m) =>
          language === "mr"
            ? String(m?.nameMr || m?.name || "").trim()
            : String(m?.name || m?.nameMr || "").trim()
        )
        .filter(Boolean)
    : [];
  const splitMemberNames =
    splitMemberNamesFromOrder.length > 0 ? splitMemberNamesFromOrder : splitMemberNamesFromQr;
  const memberDisplay =
    splitMemberNames.length > 0
      ? splitMemberNames.join(", ")
      : language === "mr"
        ? order?.studentId?.nameMr || order?.studentId?.name || qr?.memberName || na
        : order?.studentId?.name || qr?.memberName || na;

  if (cameraError && !cameraReady) {
    return (
      <div>
        <PageHeader title={t("qr_scanner_title")} backTo="/dashboard" />
        <div className="card-panel mt-8 text-center">
          <p className="font-bold text-slate-900">{t("qr_scanner_camera_denied_title")}</p>
          <p className="mt-2 text-sm text-slate-600">{t("qr_scanner_camera_denied_body")}</p>
          <button type="button" className="btn-secondary mt-4" onClick={() => navigate(-1)}>
            {t("qr_scanner_go_back")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t("qr_scanner_title")} backTo="/dashboard" />

      <div className="relative mx-auto mt-4 max-w-lg overflow-hidden rounded-2xl bg-black">
        <div id={SCANNER_ID} ref={scannerRef} className="min-h-[260px] w-full" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-52 w-52 rounded-2xl border-2 border-yellow-400" />
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-slate-600">{t("qr_scanner_helper")}</p>

      {validating ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Spinner className="h-5 w-5" />
          <span className="text-sm text-slate-700">{t("qr_scanner_validating")}</span>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
          <XCircle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="text-sm text-red-800">{errorMessage}</p>
        </div>
      ) : null}

      {order ? (
        <div
          className={`card-panel mt-4 ${isMatch ? "border-green-300" : "border-amber-300"}`}
        >
          <div className="mb-3 flex items-center gap-2">
            {isMatch ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <AlertCircle className="h-6 w-6 text-amber-600" />
            )}
            <h3
              className={`font-bold ${isMatch ? "text-green-800" : "text-amber-900"}`}
            >
              {isMatch ? t("qr_scanner_valid_title") : t("qr_scanner_mismatch_title")}
            </h3>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t("qr_scanner_label_member")}</dt>
              <dd className="max-w-[60%] text-right font-semibold text-slate-900">
                {memberDisplay}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t("qr_scanner_label_snack")}</dt>
              <dd className="max-w-[60%] text-right font-semibold text-slate-900">
                {language === "mr"
                  ? order.snackId?.nameMr || order.snackId?.name || qr?.snackName || na
                  : order.snackId?.name || qr?.snackName || na}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t("qr_scanner_label_quantity")}</dt>
              <dd className="font-semibold text-slate-900">
                {order.quantity}
                {qr?.quantity ? ` (${qrTag}: ${Number(qr.quantity) || qr.quantity})` : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t("qr_scanner_label_total")}</dt>
              <dd className="font-semibold text-slate-900">
                ₹{Number(order.totalPrice || 0).toLocaleString("en-IN")}
                {qr?.totalPrice
                  ? ` (${qrTag}: ₹${Number(qr.totalPrice || 0).toLocaleString("en-IN")})`
                  : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t("qr_scanner_label_order_date")}</dt>
              <dd className="font-semibold text-slate-900">
                {order.date
                  ? formatOrderDateTime(order.date)
                  : qr?.orderDate
                    ? formatOrderDateTime(qr.orderDate)
                    : na}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{t("qr_scanner_label_reference")}</dt>
              <dd className="max-w-[65%] break-all text-right font-mono text-xs text-slate-900">
                {order._id}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="mt-6 flex justify-center">
        <button type="button" className="btn-secondary" onClick={resetScanner}>
          <Scan className="h-4 w-4" />
          {scanned ? t("qr_scanner_scan_again") : t("qr_scanner_ready")}
        </button>
      </div>
    </div>
  );
}
