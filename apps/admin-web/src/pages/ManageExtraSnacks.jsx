import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, UtensilsCrossed } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Alert } from "@/utils/dialog";
import PageHeader from "@/components/ui/PageHeader";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";

const CATEGORIES = ["Beverage", "Food", "Other"];

const CATEGORY_LABELS_MR = {
  Beverage: "पेय",
  Food: "खाद्य",
  Other: "इतर",
};

export default function ManageExtraSnacks() {
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();

  const [snacks, setSnacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSnack, setEditingSnack] = useState(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState("Other");
  const [availability, setAvailability] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSnacks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/snack-products");
      setSnacks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to load extra snacks"
      );
      setSnacks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSnacks();
    }
  }, [isAuthenticated, fetchSnacks]);

  const openAddModal = () => {
    setEditingSnack(null);
    setName("");
    setPrice("");
    setQuantity("0");
    setCategory("Other");
    setAvailability(false);
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setEditingSnack(item);
    setName(item.name || item.nameMr || "");
    setPrice(String(item.price ?? ""));
    const q = Number(item.quantity ?? 0);
    setQuantity(String(q));
    setCategory(item.category || "Other");
    setAvailability(q > 0);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingSnack(null);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const numPrice = Number(price);
    const numQuantity = Number(quantity);
    if (!trimmedName) {
      Alert.alert("Validation", "Snack name is required.");
      return;
    }
    if (isNaN(numPrice) || numPrice < 0) {
      Alert.alert("Validation", "Price must be a valid non-negative number.");
      return;
    }
    if (isNaN(numQuantity) || numQuantity < 0) {
      Alert.alert(
        "Validation",
        "Quantity must be a valid non-negative number."
      );
      return;
    }

    const enforcedAvailability = numQuantity > 0;
    const payload = {
      name: trimmedName,
      nameMr: trimmedName,
      price: numPrice,
      quantity: numQuantity,
      category,
      availability: enforcedAvailability,
    };

    try {
      setSaving(true);
      if (editingSnack) {
        await api.put(
          `/api/snack-products/update/${editingSnack._id}`,
          payload
        );
      } else {
        await api.post("/api/snack-products/add", payload);
      }
      closeModal();
      fetchSnacks();
    } catch (err) {
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to save snack product"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    const displayName =
      language === "mr" ? item.nameMr || item.name : item.name;
    Alert.alert(
      "Delete Snack",
      `Are you sure you want to delete ${displayName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/api/snack-products/delete/${item._id}`);
              fetchSnacks();
            } catch (err) {
              Alert.alert(
                "Error",
                err?.response?.data?.message || "Failed to delete snack product"
              );
            }
          },
        },
      ]
    );
  };

  const title =
    language === "en"
      ? "Manage Extra Snacks"
      : "अतिरिक्त स्नॅक्स व्यवस्थापन";

  return (
    <div className="animate-fade-in">
      <PageHeader title={title} backTo="/dashboard" />

      <button
        type="button"
        className="btn-primary mb-6 w-full sm:w-auto"
        onClick={openAddModal}
      >
        <Plus className="h-5 w-5" />
        {language === "en" ? "Add Snack" : "स्नॅक जोडा"}
      </button>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : snacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <UtensilsCrossed className="h-16 w-16 text-slate-300" />
          <p className="mt-4 max-w-sm text-center text-base">
            {language === "en"
              ? "No snack products yet. Add one!"
              : "अजून कोणतेही स्नॅक्स नाहीत. नवीन स्नॅक जोडा!"}
          </p>
        </div>
      ) : (
        <ul className="space-y-3 pb-8">
          {snacks.map((item) => {
            const qty = Number(item.quantity ?? 0);
            const isAvailable = qty > 0 && item.availability !== false;
            return (
              <li key={item._id} className="card-panel">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-slate-900">
                      {language === "mr"
                        ? item.nameMr || item.name
                        : item.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      ₹{Number(item.price || 0).toLocaleString("en-IN")} · Qty:{" "}
                      {qty} ·{" "}
                      {language === "mr"
                        ? CATEGORY_LABELS_MR[item.category] ||
                          item.category ||
                          "इतर"
                        : item.category || "Other"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isAvailable
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {isAvailable ? "Available" : "Not Available"}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    onClick={() => openEditModal(item)}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-danger flex-1"
                    onClick={() => handleDelete(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={modalVisible}
        onClose={closeModal}
        title={
          editingSnack
            ? language === "en"
              ? "Edit Snack"
              : "स्नॅक संपादित करा"
            : language === "en"
              ? "Add Snack"
              : "स्नॅक जोडा"
        }
        size="md"
      >
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            {language === "en" ? "Snack Name *" : "स्नॅकचे नाव *"}
            <input
              className="input-field mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={language === "en" ? "e.g. Samosa" : "उदा. समोसा"}
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            {language === "en" ? "Price (₹) *" : "किंमत (₹) *"}
            <input
              className="input-field mt-1"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            {language === "en" ? "Quantity (units) *" : "प्रमाण (युनिट) *"}
            <input
              className="input-field mt-1"
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => {
                const v = e.target.value;
                setQuantity(v);
                const q = Number(v);
                if (Number.isNaN(q)) return;
                if (q <= 0) setAvailability(false);
                else setAvailability(true);
              }}
              placeholder="0"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            {language === "en" ? "Category" : "वर्ग"}
            <select
              className="input-field mt-1"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {language === "mr"
                    ? CATEGORY_LABELS_MR[cat] || cat
                    : cat}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="text-sm font-semibold text-slate-700">
              {language === "en" ? "Availability" : "उपलब्धता"}
            </span>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  availability
                    ? "bg-green-600 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
                onClick={() => setAvailability(true)}
              >
                {language === "en" ? "Available" : "उपलब्ध"}
              </button>
              <button
                type="button"
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  !availability
                    ? "bg-red-600 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
                onClick={() => setAvailability(false)}
              >
                {language === "en" ? "Not Available" : "उपलब्ध नाही"}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary mt-2 w-full"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Spinner className="h-4 w-4 border-white/30 border-t-white" label="" />
            ) : null}
            {language === "en" ? "Save" : "जतन करा"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
