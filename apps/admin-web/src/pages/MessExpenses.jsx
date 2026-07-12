import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import {
  clampYearMonthToSelectableWindow,
  combineMinYearMonth,
  getCurrentYearMonth,
  getMaxSelectableYearMonth,
  stepNextYearMonth,
  stepPrevYearMonth,
} from "@/lib/monthNavigation";
import { getMonthLabel } from "@/lib/monthLabels";
import { Alert } from "@/utils/dialog";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import MonthNavigator from "@/components/ui/MonthNavigator";
import Spinner from "@/components/ui/Spinner";

const CATEGORIES = ["Vegetables", "Milk", "Grocery", "Gas", "Maintenance", "Other"];

const CATEGORY_LABELS_MR = {
  Vegetables: "भाज्या",
  Milk: "दुग्ध",
  Grocery: "किराणा",
  Gas: "गॅस",
  Maintenance: "देखभाल",
  Other: "इतर",
};

const formatDisplayDate = (d, lang = "en") => {
  const date = d instanceof Date ? d : new Date(d);
  const locale = lang === "mr" ? "mr-IN" : "en-IN";
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatCurrency = (amount) => `₹${Number(amount).toLocaleString("en-IN")}`;

const toInputDate = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const todayInputMax = toInputDate(new Date());

export default function MessExpenses() {
  const { language } = useLanguage();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() =>
    clampYearMonthToSelectableWindow(getCurrentYearMonth())
  );
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "",
    amount: "",
    date: new Date(),
    description: "",
  });
  const [errors, setErrors] = useState({});

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/expenses");
      setExpenses(res.data);
    } catch (err) {
      const title = language === "en" ? "Error" : "त्रुटी";
      const msg =
        err.response?.data?.message ||
        (language === "en" ? "Failed to fetch expenses" : "खर्च मिळवण्यात अयशस्वी");
      Alert.alert(title, msg);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const allExpenseMonths = expenses
    .map((e) => {
      const d = new Date(e.date);
      return d.getFullYear() * 12 + d.getMonth();
    })
    .filter((ym) => !Number.isNaN(ym));
  const minExpenseMonth = combineMinYearMonth(
    allExpenseMonths.length > 0 ? Math.min(...allExpenseMonths) : getCurrentYearMonth(0)
  );

  useEffect(() => {
    setSelectedMonth((m) =>
      clampYearMonthToSelectableWindow(m, minExpenseMonth, getMaxSelectableYearMonth())
    );
  }, [minExpenseMonth, expenses.length]);

  const monthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    const ym = d.getFullYear() * 12 + d.getMonth();
    return ym === selectedMonth;
  });

  const totalAmount = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const canPrevMonth = selectedMonth > minExpenseMonth;

  const openAddForm = () => {
    setEditingId(null);
    setForm({
      title: "",
      category: "",
      amount: "",
      date: new Date(),
      description: "",
    });
    setErrors({});
    setShowCategoryPicker(false);
    setFormVisible(true);
  };

  const openEditForm = (exp) => {
    setEditingId(exp._id);
    setForm({
      title: exp.title || exp.titleMr || "",
      category: exp.category,
      amount: String(exp.amount),
      date: new Date(exp.date),
      description: exp.description || exp.descriptionMr || "",
    });
    setErrors({});
    setShowCategoryPicker(false);
    setFormVisible(true);
  };

  const closeForm = () => {
    setFormVisible(false);
    setEditingId(null);
    setShowCategoryPicker(false);
  };

  const validate = () => {
    const e = {};
    const en = language === "en";
    if (!form.title.trim()) e.title = en ? "Title is required" : "शीर्षक आवश्यक आहे";
    if (!form.category) e.category = en ? "Category is required" : "विभाग आवश्यक आहे";
    if (!form.amount.trim()) e.amount = en ? "Amount is required" : "रक्कम आवश्यक आहे";
    else if (isNaN(Number(form.amount)) || Number(form.amount) < 0)
      e.amount = en ? "Enter a valid amount" : "वैध रक्कम प्रविष्ट करा";
    if (!form.date) e.date = en ? "Date is required" : "तारीख आवश्यक आहे";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      const payload = {
        title: form.title.trim(),
        titleMr: form.title.trim(),
        category: form.category,
        amount: Number(form.amount),
        date: form.date.toISOString(),
        description: form.description.trim(),
        descriptionMr: form.description.trim(),
      };
      if (editingId) {
        await api.put(`/api/expenses/${editingId}`, payload);
        Alert.alert(
          language === "en" ? "Success" : "यशस्वी",
          language === "en"
            ? "Expense updated successfully"
            : "खर्च यशस्वीरित्या अपडेट झाला"
        );
      } else {
        await api.post("/api/expenses", payload);
        Alert.alert(
          language === "en" ? "Success" : "यशस्वी",
          language === "en"
            ? "Expense added successfully"
            : "खर्च यशस्वीरित्या जोडला गेला"
        );
      }
      closeForm();
      fetchExpenses();
    } catch (err) {
      Alert.alert(
        language === "en" ? "Error" : "त्रुटी",
        err.response?.data?.message ||
          (language === "en" ? "Failed to save expense" : "खर्च जतन करण्यात अयशस्वी")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (exp) => {
    const displayTitle = language === "mr" ? exp.titleMr || exp.title : exp.title;
    Alert.alert(
      language === "en" ? "Delete expense" : "खर्च हटवा",
      language === "en"
        ? `Are you sure you want to delete "${displayTitle}"?`
        : `तुम्हाला खात्री आहे की "${displayTitle}" हटवायचे आहे?`,
      [
        { text: language === "en" ? "Cancel" : "रद्द करा", style: "cancel" },
        {
          text: language === "en" ? "Delete" : "हटवा",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/api/expenses/${exp._id}`);
              fetchExpenses();
            } catch (err) {
              Alert.alert(
                language === "en" ? "Error" : "त्रुटी",
                err.response?.data?.message ||
                  (language === "en" ? "Failed to delete expense" : "खर्च हटवण्यात अयशस्वी")
              );
            }
          },
        },
      ]
    );
  };

  const formTitle = editingId
    ? language === "en"
      ? "Edit Expense"
      : "खर्च संपादित करा"
    : language === "en"
      ? "Add Expense"
      : "खर्च जोडा";

  return (
    <div>
      <PageHeader title={language === "en" ? "Mess Expenses" : "मेस खर्च"} />

      <div className="card-panel mb-4">
        <p className="text-sm font-medium text-slate-500">
          {language === "en" ? "Total Expenses" : "एकूण खर्च"} (
          {getMonthLabel(selectedMonth, language)})
        </p>
        <p className="mt-1 text-3xl font-bold text-slate-900">{formatCurrency(totalAmount)}</p>
      </div>

      <MonthNavigator
        yearMonth={selectedMonth}
        language={language}
        canPrev={canPrevMonth}
        canNext
        onPrev={() => setSelectedMonth((m) => stepPrevYearMonth(m, minExpenseMonth))}
        onNext={() => setSelectedMonth((m) => stepNextYearMonth(m))}
      />

      <button type="button" className="btn-primary mt-4 w-full sm:w-auto" onClick={openAddForm}>
        <Plus className="h-4 w-4" />
        {language === "en" ? "Add Expense" : "खर्च जोडा"}
      </button>

      {loading ? (
        <div className="mt-12 flex justify-center">
          <Spinner />
        </div>
      ) : monthExpenses.length === 0 ? (
        <p className="mt-10 text-center text-slate-500">
          {language === "en"
            ? "No expenses for this month"
            : "या महिन्यासाठी कोणताही खर्च नोंदलेला नाही"}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {monthExpenses.map((item) => (
            <li key={item._id} className="card-panel">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-slate-900">
                  {language === "mr" ? item.titleMr || item.title : item.title}
                </h3>
                <span className="font-bold text-slate-900">{formatCurrency(item.amount)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {language === "mr"
                    ? CATEGORY_LABELS_MR[item.category] || item.category
                    : item.category}
                </span>
                <span>{formatDisplayDate(item.date, language)}</span>
              </div>
              {(language === "mr" ? item.descriptionMr || item.description : item.description) ? (
                <p className="mt-2 text-sm text-slate-600">
                  {language === "mr"
                    ? item.descriptionMr || item.description
                    : item.description}
                </p>
              ) : null}
              <div className="mt-4 flex gap-2">
                <button type="button" className="btn-primary flex-1 text-sm" onClick={() => openEditForm(item)}>
                  <Pencil className="h-4 w-4" />
                  {language === "en" ? "Edit" : "संपादन"}
                </button>
                <button type="button" className="btn-danger flex-1 text-sm" onClick={() => handleDelete(item)}>
                  <Trash2 className="h-4 w-4" />
                  {language === "en" ? "Delete" : "हटवा"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={formVisible} onClose={closeForm} title={formTitle} size="lg">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {language === "en"
                ? "Expense title (English or Marathi) *"
                : "खर्चाचे शीर्षक (इंग्रजी किंवा मराठी) *"}
            </label>
            <input
              className={`input-field ${errors.title ? "border-red-500" : ""}`}
              value={form.title}
              onChange={(e) => {
                setForm((f) => ({ ...f, title: e.target.value }));
                setErrors((er) => ({ ...er, title: null }));
              }}
              placeholder={
                language === "en"
                  ? "e.g. Monthly vegetables or मासिक भाज्या"
                  : "उदा. Monthly vegetables किंवा मासिक भाज्या"
              }
            />
            {errors.title ? <p className="mt-1 text-xs text-red-600">{errors.title}</p> : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {language === "en" ? "Category *" : "विभाग *"}
            </label>
            <button
              type="button"
              className={`input-field flex w-full items-center justify-between text-left ${errors.category ? "border-red-500" : ""}`}
              onClick={() => setShowCategoryPicker((v) => !v)}
            >
              <span className={form.category ? "text-slate-900" : "text-slate-400"}>
                {form.category || (language === "en" ? "Select category" : "विभाग निवडा")}
              </span>
            </button>
            {showCategoryPicker ? (
              <ul className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                {CATEGORIES.map((cat) => (
                  <li key={cat}>
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        setForm((f) => ({ ...f, category: cat }));
                        setShowCategoryPicker(false);
                        setErrors((er) => ({ ...er, category: null }));
                      }}
                    >
                      {language === "mr" ? CATEGORY_LABELS_MR[cat] || cat : cat}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {errors.category ? <p className="mt-1 text-xs text-red-600">{errors.category}</p> : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {language === "en" ? "Amount *" : "रक्कम *"}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={`input-field ${errors.amount ? "border-red-500" : ""}`}
              value={form.amount}
              onChange={(e) => {
                setForm((f) => ({ ...f, amount: e.target.value }));
                setErrors((er) => ({ ...er, amount: null }));
              }}
              placeholder="0"
            />
            {errors.amount ? <p className="mt-1 text-xs text-red-600">{errors.amount}</p> : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {language === "en" ? "Date *" : "तारीख *"}
            </label>
            <input
              type="date"
              max={todayInputMax}
              className={`input-field ${errors.date ? "border-red-500" : ""}`}
              value={toInputDate(form.date)}
              onChange={(e) => {
                const v = e.target.value;
                if (v) setForm((f) => ({ ...f, date: new Date(v) }));
                setErrors((er) => ({ ...er, date: null }));
              }}
            />
            {errors.date ? <p className="mt-1 text-xs text-red-600">{errors.date}</p> : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              {language === "en"
                ? "Description (English or Marathi, optional)"
                : "वर्णन (इंग्रजी किंवा मराठी, पर्यायी)"}
            </label>
            <textarea
              className="input-field min-h-[80px] resize-y"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={language === "en" ? "Add notes…" : "टीपा जोडा…"}
            />
          </div>

          <button type="button" className="btn-primary w-full" disabled={saving} onClick={handleSave}>
            {saving ? (
              <Spinner className="h-4 w-4 border-white/30 border-t-white" label="" />
            ) : editingId ? (
              language === "en" ? "Update" : "अपडेट करा"
            ) : (
              language === "en" ? "Save" : "जतन करा"
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
}
