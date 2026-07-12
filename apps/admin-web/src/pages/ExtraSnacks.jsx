import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  List,
  Pencil,
  Plus,
  Trash2,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import api from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { getMonthLabel } from "@/lib/monthLabels";
import { fetchMemberDirectory } from "@/lib/memberDirectory";
import {
  clampYearMonthToSelectableWindow,
  combineMinYearMonth,
  getCurrentYearMonth,
  getMaxSelectableYearMonth,
  stepNextYearMonth,
  stepPrevYearMonth,
} from "@/lib/monthNavigation";
import { Alert } from "@/utils/dialog";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import MonthNavigator from "@/components/ui/MonthNavigator";
import Spinner from "@/components/ui/Spinner";

const formatDisplayDate = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatCardDate = (d, lang) => {
  const date = d instanceof Date ? d : new Date(d);
  if (lang === "mr") {
    return date.toLocaleDateString("mr-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return formatDisplayDate(d);
};

const formatCurrency = (amount) => `₹${Number(amount).toLocaleString("en-IN")}`;

const resolveDisplayTotal = (order) => {
  const charged = Number(order?.chargedAmount);
  if (Number.isFinite(charged) && charged >= 0) return charged;
  const qty = Number(order?.quantity || 0);
  const price = Number(order?.pricePerItem || 0);
  return qty * price;
};

const INITIAL_FORM = {
  customerName: "",
  customerType: "outside",
  studentId: "",
  snackItem: "",
  quantity: "",
  pricePerItem: "",
};

const INITIAL_CART_ITEM = {
  snackItem: "",
  quantity: "",
  pricePerItem: "",
};

function SnackCard({ item, language, t, onEdit, onDelete }) {
  const isSplitGroup = !!item?.isSplitGroup;

  if (isSplitGroup) {
    const title =
      language === "mr"
        ? `विभाजित स्नॅक्स (${item.memberNames?.length || 0} सदस्य)`
        : `Split Snacks (${item.memberNames?.length || 0} members)`;
    const snackLine =
      item.snackOverflow > 0 || item.snackNames?.length > 1
        ? language === "mr"
          ? `एकाधिक स्नॅक्स (${item.snackNames?.length || 0})`
          : `Multiple snacks (${item.snackNames?.length || 0})`
        : language === "mr"
          ? item.snackNames?.[0] || "Snack"
          : item.snackNames?.[0] || "Snack";

    return (
      <li className="card-panel">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <span className="font-bold text-slate-900">{formatCurrency(item.totalPrice || 0)}</span>
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <Users className="h-4 w-4" />
          {language === "mr" ? "सदस्य:" : "Members:"}{" "}
          {item.memberPreview}
          {item.memberOverflow > 0
            ? language === "mr"
              ? ` +${item.memberOverflow} अधिक`
              : ` +${item.memberOverflow} more`
            : ""}
        </p>
        <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
          <UtensilsCrossed className="h-4 w-4" />
          {t("qr_scanner_label_snack")}: {snackLine}
        </p>
        <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
          <List className="h-4 w-4" />
          {t("qr_scanner_label_quantity")}: {item.quantityTotal}
          {language === "mr" ? " (विभाजित)" : " (split)"}
        </p>
        <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
          <Calendar className="h-4 w-4" />
          {formatCardDate(item.date, language)}
        </p>
        <button type="button" className="btn-danger mt-4 w-full text-sm" onClick={() => onDelete(item)}>
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </li>
    );
  }

  return (
    <li className="card-panel">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900">
          {language === "mr" ? item.studentNameMr || item.studentName : item.studentName}
        </h3>
        <span className="font-bold text-slate-900">{formatCurrency(resolveDisplayTotal(item))}</span>
      </div>
      <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
        <UtensilsCrossed className="h-4 w-4" />
        {t("qr_scanner_label_snack")}:{" "}
        {language === "mr" ? item.snackItemMr || item.snackItem : item.snackItem}
      </p>
      <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
        <List className="h-4 w-4" />
        {t("qr_scanner_label_quantity")}: {item.quantity} × ₹{item.pricePerItem}
        {item?.billSplitRequestId
          ? language === "mr"
            ? " (विभाजित रक्कम लागू)"
            : " (split charged)"
          : ""}
      </p>
      <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
        <Calendar className="h-4 w-4" />
        {formatCardDate(item.date, language)}
      </p>
      <div className="mt-4 flex gap-2">
        <button type="button" className="btn-primary flex-1 text-sm" onClick={() => onEdit(item)}>
          <Pencil className="h-4 w-4" />
          Edit
        </button>
        <button type="button" className="btn-danger flex-1 text-sm" onClick={() => onDelete(item)}>
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>
    </li>
  );
}

export default function ExtraSnacks() {
  const { language, t } = useLanguage();
  const [snacks, setSnacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() =>
    clampYearMonthToSelectableWindow(getCurrentYearMonth())
  );
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [cartItems, setCartItems] = useState([]);

  const fetchSnacks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/snacks");
      const raw = Array.isArray(res.data) ? res.data : [];
      const normalized = raw.map((s) => ({
        ...s,
        studentName:
          s?.studentName || s?.memberName || s?.customerName || s?.studentId?.name || "",
        studentNameMr:
          s?.studentNameMr ||
          s?.memberNameMr ||
          s?.customerNameMr ||
          s?.studentId?.nameMr ||
          "",
      }));
      setSnacks(normalized);
    } catch (err) {
      Alert.alert(
        t("alert_error"),
        err.response?.data?.message || t("extra_snacks_alert_fetch_orders_failed")
      );
      setSnacks([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchMembers = useCallback(async () => {
    try {
      const rows = await fetchMemberDirectory(api);
      setMembers(Array.isArray(rows) ? rows : []);
    } catch (err) {
      Alert.alert(
        t("alert_error"),
        err?.response?.data?.message || t("extra_snacks_alert_fetch_members_failed")
      );
      setMembers([]);
    }
  }, [t]);

  useEffect(() => {
    fetchSnacks();
    fetchMembers();
  }, [fetchSnacks, fetchMembers]);

  const filteredMembers = members.filter((m) => {
    if (!memberSearch.trim()) return true;
    const search = memberSearch.trim().toLowerCase();
    const name = (language === "mr" ? m.nameMr || m.name : m.name) || "";
    const nameLower = String(name).toLowerCase();
    const roll = (m.rollNumber || "").toLowerCase();
    const room = (m.roomNumber || m.roomOwnerName || "").toLowerCase();
    const owner =
      (language === "mr" ? m.roomOwnerNameMr || m.roomOwnerName : m.roomOwnerName) || "";
    const ownerLower = String(owner).toLowerCase();
    return (
      nameLower.includes(search) ||
      roll.includes(search) ||
      room.includes(search) ||
      ownerLower.includes(search)
    );
  });

  const snackMonths = snacks
    .map((s) => {
      const d = new Date(s.date);
      return d.getFullYear() * 12 + d.getMonth();
    })
    .filter((ym) => !Number.isNaN(ym));
  const minSnackMonth = combineMinYearMonth(
    snackMonths.length > 0 ? Math.min(...snackMonths) : getCurrentYearMonth(0)
  );

  useEffect(() => {
    setSelectedMonth((m) =>
      clampYearMonthToSelectableWindow(m, minSnackMonth, getMaxSelectableYearMonth())
    );
  }, [minSnackMonth, snacks.length]);

  const monthSnacks = snacks.filter((s) => {
    const d = new Date(s.date);
    const ym = d.getFullYear() * 12 + d.getMonth();
    return ym === selectedMonth;
  });

  const displaySnacks = useMemo(() => {
    const memberDisplay = (o) =>
      language === "mr" ? o?.studentNameMr || o?.studentName : o?.studentName;
    const snackDisplay = (o) =>
      language === "mr" ? o?.snackItemMr || o?.snackItem : o?.snackItem;

    const normal = [];
    const splitGroupsById = new Map();

    for (const o of monthSnacks || []) {
      const billSplitRequestId = o?.billSplitRequestId;
      const isSplit = !!billSplitRequestId;
      if (!isSplit) {
        normal.push(o);
        continue;
      }
      const splitId = String(billSplitRequestId);
      const existing = splitGroupsById.get(splitId);
      const displayMemberName = memberDisplay(o) || "Member";
      const displaySnackName = snackDisplay(o) || "Snack";
      const orderId = String(o?._id || "");

      if (!existing) {
        splitGroupsById.set(splitId, {
          _id: `split-${splitId}`,
          isSplitGroup: true,
          billSplitRequestId: splitId,
          orderIds: orderId ? [orderId] : [],
          items: [o],
          memberNames: [displayMemberName],
          snackNames: [displaySnackName],
          quantityTotal: Number(o?.quantity || 0),
          totalPrice: resolveDisplayTotal(o),
          date: o?.date ? new Date(o.date) : null,
        });
      } else {
        existing.items.push(o);
        if (orderId) existing.orderIds.push(orderId);
        existing.quantityTotal += Number(o?.quantity || 0);
        existing.totalPrice += resolveDisplayTotal(o);
        existing.memberNames.push(displayMemberName);
        existing.snackNames.push(displaySnackName);
        if (o?.date) {
          const d = new Date(o.date);
          if (!Number.isNaN(d.getTime()) && (!existing.date || d > existing.date)) {
            existing.date = d;
          }
        }
      }
    }

    const splitGroups = Array.from(splitGroupsById.values()).map((g) => {
      const uniqMembers = Array.from(new Set(g.memberNames.filter(Boolean)));
      const uniqSnackNames = Array.from(new Set(g.snackNames.filter(Boolean)));
      return {
        ...g,
        memberNames: uniqMembers,
        snackNames: uniqSnackNames,
        memberPreview: uniqMembers.slice(0, 3).join(", "),
        memberOverflow: Math.max(0, uniqMembers.length - 3),
        snackPreview: uniqSnackNames.slice(0, 2).join(" + "),
        snackOverflow: Math.max(0, uniqSnackNames.length - 2),
        date: g.date || new Date(),
      };
    });

    const normalizedNormal = (normal || []).map((o) => ({
      ...o,
      _sortDate: o?.date ? new Date(o.date) : new Date(0),
    }));
    const normalizedSplit = splitGroups.map((g) => ({
      ...g,
      _sortDate: g.date ? new Date(g.date) : new Date(0),
    }));

    return [...normalizedNormal, ...normalizedSplit]
      .sort((a, b) => (b?._sortDate?.getTime?.() || 0) - (a?._sortDate?.getTime?.() || 0))
      .map(({ _sortDate, ...rest }) => rest);
  }, [monthSnacks, language]);

  const totalMonthRevenue = monthSnacks.reduce(
    (sum, s) => sum + resolveDisplayTotal(s),
    0
  );

  const totalPrice = (() => {
    const q = Number(form.quantity);
    const p = Number(form.pricePerItem);
    if (!Number.isFinite(q) || !Number.isFinite(p) || q < 0 || p < 0) return 0;
    return q * p;
  })();

  const cartTotal = cartItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);

  const openAddForm = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setCartItems([]);
    setErrors({});
    setShowMemberPicker(false);
    setMemberSearch("");
    setFormVisible(true);
  };

  const openEditForm = (snack) => {
    setEditingId(snack._id);
    setForm({
      customerName: snack.isOutsideCustomer
        ? language === "mr"
          ? (snack.studentNameMr || snack.studentName || "").trim()
          : (snack.studentName || snack.studentNameMr || "").trim()
        : snack.studentName || snack.studentNameMr || "",
      customerType: snack.isOutsideCustomer ? "outside" : "member",
      studentId: snack.studentId || "",
      snackItem: snack.snackItem || "",
      quantity: String(snack.quantity || ""),
      pricePerItem: String(snack.pricePerItem ?? ""),
    });
    setErrors({});
    setShowMemberPicker(false);
    setMemberSearch("");
    setFormVisible(true);
  };

  const closeForm = () => {
    setFormVisible(false);
    setEditingId(null);
    setCartItems([]);
    setShowMemberPicker(false);
  };

  const validate = (mode = "save") => {
    const e = {};
    if (form.customerType === "outside") {
      if (!form.customerName?.trim()) {
        e.customerName =
          language === "en"
            ? "Customer name is required"
            : "ग्राहकाचे नाव आवश्यक आहे";
      }
    } else if (!form.studentId) {
      e.studentId = "Member is required";
    }
    const shouldValidateCurrentSnackFields =
      mode !== "finalize" || editingId || cartItems.length === 0;
    if (shouldValidateCurrentSnackFields) {
      if (!form.snackItem?.trim()) e.snackItem = "Snack item is required";
      if (!form.quantity?.trim()) e.quantity = "Quantity is required";
      else {
        const q = Number(form.quantity);
        if (!Number.isFinite(q) || !Number.isInteger(q) || q < 1) {
          e.quantity = "Enter a valid quantity (integer min 1)";
        }
      }
      if (!form.pricePerItem?.trim()) e.pricePerItem = "Price is required";
      else {
        const p = Number(form.pricePerItem);
        if (!Number.isFinite(p) || p < 0) {
          e.pricePerItem = "Enter a valid price (0 or more)";
        }
      }
    }
    if (mode === "finalize" && !editingId && cartItems.length === 0) {
      e.cart =
        language === "en"
          ? "Add at least one snack item to cart"
          : "कार्टमध्ये किमान एक स्नॅक आयटम जोडा";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const resetCartItemFields = () => {
    setForm((f) => ({ ...f, ...INITIAL_CART_ITEM }));
  };

  const handleAddToCart = () => {
    if (!validate("cart")) return;
    const quantity = Number(form.quantity);
    const pricePerItem = Number(form.pricePerItem);
    setCartItems((items) => [
      ...items,
      {
        id: `${form.snackItem}-${Date.now()}-${items.length}`,
        snackItem: form.snackItem.trim(),
        snackItemMr: form.snackItem.trim(),
        quantity,
        pricePerItem,
        totalPrice: quantity * pricePerItem,
      },
    ]);
    setErrors((e) => ({
      ...e,
      snackItem: null,
      quantity: null,
      pricePerItem: null,
      cart: null,
    }));
    resetCartItemFields();
  };

  const handleRemoveCartItem = (id) => {
    setCartItems((items) => items.filter((item) => item.id !== id));
  };

  const handleSave = async () => {
    if (editingId) {
      if (!validate("save")) return;
    } else if (!validate("finalize")) {
      return;
    }
    try {
      setSaving(true);
      const isOutsideCustomer = form.customerType !== "member";
      if (editingId) {
        await api.put(`/api/snacks/${editingId}`, {
          isOutsideCustomer,
          studentId: isOutsideCustomer ? undefined : form.studentId,
          customerName: isOutsideCustomer ? form.customerName.trim() : undefined,
          snackItem: form.snackItem.trim(),
          quantity: Number(form.quantity),
          pricePerItem: Number(form.pricePerItem),
          totalPrice: totalPrice,
          date: new Date().toISOString(),
        });
        Alert.alert(t("alert_success"), t("extra_snacks_alert_order_updated"));
      } else {
        await api.post("/api/snacks/bulk", {
          isOutsideCustomer,
          studentId: isOutsideCustomer ? undefined : form.studentId,
          customerName: isOutsideCustomer ? form.customerName.trim() : undefined,
          date: new Date().toISOString(),
          orders: cartItems.map((item) => ({
            snackItem: item.snackItem,
            quantity: Number(item.quantity),
            pricePerItem: Number(item.pricePerItem),
            totalPrice: Number(item.totalPrice),
          })),
        });
        Alert.alert(t("alert_success"), t("extra_snacks_alert_order_added"));
      }
      closeForm();
      fetchSnacks();
    } catch (err) {
      Alert.alert(
        t("alert_error"),
        err.response?.data?.message || t("extra_snacks_alert_save_failed")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (snack) => {
    const isSplitGroup = !!snack?.isSplitGroup;
    const displayName = isSplitGroup
      ? snack?.memberPreview || "Split"
      : language === "mr"
        ? snack.studentNameMr || snack.studentName
        : snack.studentName;

    Alert.alert(
      t("extra_snacks_alert_delete_title"),
      isSplitGroup
        ? language === "mr"
          ? `विभाजित ऑर्डर हटवायचा आहे का? यामुळे त्या split request मधील सर्व रेकॉर्ड हटतील. (${displayName})`
          : `Delete this split snack order? This will remove all member rows for the split request. (${displayName})`
        : t("extra_snacks_alert_delete_body").replace("{{name}}", displayName),
      [
        { text: t("button_cancel"), style: "cancel" },
        {
          text: t("manage_members_delete"),
          style: "destructive",
          onPress: async () => {
            try {
              if (isSplitGroup) {
                for (const id of snack?.orderIds || []) {
                  await api.delete(`/api/snacks/${id}`);
                }
              } else {
                await api.delete(`/api/snacks/${snack._id}`);
              }
              Alert.alert(t("alert_success"), t("extra_snacks_alert_order_deleted"));
              fetchSnacks();
            } catch (err) {
              Alert.alert(
                t("alert_error"),
                err.response?.data?.message || t("extra_snacks_alert_delete_failed")
              );
            }
          },
        },
      ]
    );
  };

  const formTitle = editingId
    ? language === "en"
      ? "Edit Snack Order"
      : "स्नॅक्स ऑर्डर संपादित करा"
    : language === "en"
      ? "Add Snack Order"
      : "स्नॅक्स ऑर्डर जोडा";

  return (
    <div>
      <PageHeader title={language === "en" ? "Extra Snacks" : "अतिरिक्त स्नॅक्स"} />

      <div className="card-panel mb-4">
        <p className="text-sm font-medium text-slate-500">
          {language === "en" ? "Total Snacks Revenue" : "एकूण स्नॅक्स उत्पन्न"} (
          {getMonthLabel(selectedMonth, language)})
        </p>
        <p className="mt-1 text-3xl font-bold text-slate-900">{formatCurrency(totalMonthRevenue)}</p>
      </div>

      <MonthNavigator
        yearMonth={selectedMonth}
        language={language}
        canPrev={selectedMonth > minSnackMonth}
        canNext
        onPrev={() => setSelectedMonth((m) => stepPrevYearMonth(m, minSnackMonth))}
        onNext={() => setSelectedMonth((m) => stepNextYearMonth(m))}
      />

      <button type="button" className="btn-primary mt-4 w-full sm:w-auto" onClick={openAddForm}>
        <Plus className="h-4 w-4" />
        {language === "en" ? "Add Snack Order" : "स्नॅक्स ऑर्डर जोडा"}
      </button>

      {loading ? (
        <div className="mt-12 flex justify-center">
          <Spinner />
        </div>
      ) : displaySnacks.length === 0 ? (
        <div className="mt-12 flex flex-col items-center text-slate-400">
          <UtensilsCrossed className="h-16 w-16" />
          <p className="mt-4 text-center text-slate-500">
            {language === "en"
              ? `No snack orders for ${getMonthLabel(selectedMonth, language)}. Add one!`
              : `${getMonthLabel(selectedMonth, language)} साठी कोणत्याही स्नॅक्स ऑर्डर नाहीत. नवीन ऑर्डर जोडा!`}
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {displaySnacks.map((item) => (
            <SnackCard
              key={item._id}
              item={item}
              language={language}
              t={t}
              onEdit={openEditForm}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}

      <Modal open={formVisible} onClose={closeForm} title={formTitle} size="lg">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                checked={form.customerType === "outside"}
                onChange={() => {
                  setForm((f) => ({
                    ...f,
                    customerType: "outside",
                    studentId: "",
                    customerName: "",
                  }));
                  setShowMemberPicker(false);
                }}
              />
              <span className="text-sm font-medium">
                {language === "en" ? "Outside customer" : "बाहेरील ग्राहक"}
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                checked={form.customerType === "member"}
                onChange={() => setForm((f) => ({ ...f, customerType: "member" }))}
              />
              <span className="text-sm font-medium">
                {language === "en" ? "Existing member" : "विद्यमान सदस्य"}
              </span>
            </label>
          </div>

          {form.customerType === "outside" ? (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                {language === "en"
                  ? "Customer name (English or Marathi) *"
                  : "ग्राहकाचे नाव (मराठी किंवा इंग्रजी) *"}
              </label>
              <input
                className={`input-field ${errors.customerName ? "border-red-500" : ""}`}
                value={form.customerName}
                onChange={(e) => {
                  setForm((f) => ({ ...f, customerName: e.target.value }));
                  setErrors((er) => ({ ...er, customerName: null }));
                }}
              />
              {errors.customerName ? (
                <p className="mt-1 text-xs text-red-600">{errors.customerName}</p>
              ) : null}
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                {language === "en" ? "Member *" : "सदस्य *"}
              </label>
              <button
                type="button"
                className={`input-field flex w-full justify-between text-left ${errors.studentId ? "border-red-500" : ""}`}
                onClick={() => setShowMemberPicker((v) => !v)}
              >
                <span className={form.studentId ? "text-slate-900" : "text-slate-400"}>
                  {form.studentId
                    ? form.customerName
                    : language === "en"
                      ? "Select member"
                      : "सदस्य निवडा"}
                </span>
              </button>
              {showMemberPicker ? (
                <div className="mt-2 max-h-52 overflow-hidden rounded-xl border border-slate-200">
                  <input
                    className="w-full border-b border-slate-200 px-3 py-2 text-sm"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder={
                      language === "en"
                        ? "Search by name, roll or room"
                        : "नाव, रोल किंवा रूमने शोधा"
                    }
                  />
                  <ul className="max-h-40 overflow-y-auto">
                    {filteredMembers.map((m) => (
                      <li key={m._id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          onClick={() => {
                            setForm((f) => ({
                              ...f,
                              studentId: m._id,
                              customerName: m.name || "",
                            }));
                            setErrors((er) => ({ ...er, studentId: null }));
                            setShowMemberPicker(false);
                          }}
                        >
                          {language === "mr" ? m.nameMr || m.name : m.name}{" "}
                          {(m.rollNumber ||
                            m.roomNumber ||
                            (language === "mr"
                              ? m.roomOwnerNameMr || m.roomOwnerName
                              : m.roomOwnerName)) &&
                            `(${m.rollNumber || m.roomNumber || (language === "mr" ? m.roomOwnerNameMr || m.roomOwnerName : m.roomOwnerName)})`}
                        </button>
                      </li>
                    ))}
                    {filteredMembers.length === 0 ? (
                      <li className="px-3 py-4 text-center text-sm text-slate-500">
                        {language === "en"
                          ? "No members match your search"
                          : "तुमच्या शोधाशी जुळणारा सदस्य नाही"}
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
              {errors.studentId ? (
                <p className="mt-1 text-xs text-red-600">{errors.studentId}</p>
              ) : null}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {language === "en" ? "Snack Item *" : "स्नॅक आयटम *"}
            </label>
            <input
              className={`input-field ${errors.snackItem ? "border-red-500" : ""}`}
              value={form.snackItem}
              onChange={(e) => {
                setForm((f) => ({ ...f, snackItem: e.target.value }));
                setErrors((er) => ({ ...er, snackItem: null }));
              }}
            />
            {errors.snackItem ? <p className="mt-1 text-xs text-red-600">{errors.snackItem}</p> : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {language === "en" ? "Price Per Item (₹) *" : "प्रति आयटम किंमत (₹) *"}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={`input-field ${errors.pricePerItem ? "border-red-500" : ""}`}
              value={form.pricePerItem}
              onChange={(e) => {
                setForm((f) => ({ ...f, pricePerItem: e.target.value }));
                setErrors((er) => ({ ...er, pricePerItem: null }));
              }}
            />
            {errors.pricePerItem ? (
              <p className="mt-1 text-xs text-red-600">{errors.pricePerItem}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {language === "en" ? "Quantity *" : "प्रमाण *"}
            </label>
            <input
              type="number"
              min="1"
              step="1"
              className={`input-field ${errors.quantity ? "border-red-500" : ""}`}
              value={form.quantity}
              onChange={(e) => {
                setForm((f) => ({ ...f, quantity: e.target.value }));
                setErrors((er) => ({ ...er, quantity: null }));
              }}
            />
            {errors.quantity ? <p className="mt-1 text-xs text-red-600">{errors.quantity}</p> : null}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-600">
              {language === "en" ? "Total Price" : "एकूण रक्कम"}
            </span>
            <span className="text-lg font-bold text-slate-900">{formatCurrency(totalPrice)}</span>
          </div>

          {!editingId ? (
            <>
              <button type="button" className="btn-secondary w-full" disabled={saving} onClick={handleAddToCart}>
                {language === "en" ? "Add To Cart" : "कार्टमध्ये जोडा"}
              </button>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex justify-between text-sm font-bold">
                  <span>{language === "en" ? "Cart Items" : "कार्ट आयटम्स"}</span>
                  <span>
                    {cartItems.length} {language === "en" ? "items" : "आयटम्स"}
                  </span>
                </div>
                {cartItems.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    {language === "en"
                      ? "Select snacks and add them to cart before finalizing."
                      : "ऑर्डर अंतिम करण्यापूर्वी स्नॅक्स निवडा आणि कार्टमध्ये जोडा."}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {cartItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between rounded-lg bg-white p-3"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {language === "mr"
                              ? item.snackItemMr || item.snackItem
                              : item.snackItem}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.quantity} × {formatCurrency(item.pricePerItem)} ={" "}
                            {formatCurrency(item.totalPrice)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-red-600"
                          onClick={() => handleRemoveCartItem(item.id)}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 font-bold">
                  <span>{language === "en" ? "Order Total" : "ऑर्डर एकूण"}</span>
                  <span>{formatCurrency(cartTotal)}</span>
                </div>
                {errors.cart ? <p className="mt-1 text-xs text-red-600">{errors.cart}</p> : null}
              </div>
            </>
          ) : null}

          <button type="button" className="btn-primary w-full" disabled={saving} onClick={handleSave}>
            {saving ? (
              <Spinner className="h-4 w-4 border-white/30 border-t-white" label="" />
            ) : editingId ? (
              language === "en" ? "Update Order" : "ऑर्डर अपडेट करा"
            ) : (
              language === "en" ? "Finalize Order" : "ऑर्डर अंतिम करा"
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
}
