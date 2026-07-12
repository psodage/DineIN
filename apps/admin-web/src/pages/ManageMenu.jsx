import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Calendar, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import api from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { getDefaultMessMenuForDate } from "@/lib/defaultMessMenu";
import { formatPollOptionLabel, formatPollQuestion } from "@/lib/memberLabelsMr";
import { Alert } from "@/utils/dialog";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Spinner from "@/components/ui/Spinner";

const DEFAULT_POLL_OPTIONS = [
  { key: "option1", label: "", labelMr: "" },
  { key: "option2", label: "", labelMr: "" },
];

const getDefaultPollTemplate = (language) =>
  language === "mr"
    ? { question: "जेवणाची पसंती", options: DEFAULT_POLL_OPTIONS.map((o) => ({ ...o })) }
    : { question: "Meal Preference", options: DEFAULT_POLL_OPTIONS.map((o) => ({ ...o })) };

const formatDisplayDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const localDateKey = (dateLike) => {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const pollDateKeyFromPollDoc = (p) => localDateKey(p?.date);

const toInputDate = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  return localDateKey(date);
};

const fromInputDate = (value) => {
  if (!value) return new Date();
  const [y, m, day] = value.split("-").map(Number);
  return new Date(y, m - 1, day);
};

const menuLine = (item, language, field) => {
  const en = item?.[field];
  const mr = item?.[`${field}Mr`];
  return language === "mr" ? String(mr || en || "").trim() : String(en || mr || "").trim();
};

const newPollOptionKey = () =>
  `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const menuCategoryLabel = (item, language) => {
  const en = String(item?.pollOptionLabel || "").trim();
  const mr = String(item?.pollOptionLabelMr || "").trim();
  const fallback = String(item?.pollOptionKey || "").trim();
  if (language === "mr") return mr || en || fallback || "";
  return en || mr || fallback || "";
};

function PollResultsBlock({ poll, language, t }) {
  return (
    <div className="mt-3">
      <p className="font-bold text-slate-900">
        {formatPollQuestion(poll, language) || getDefaultPollTemplate(language).question}
      </p>
      <ul className="mt-3 space-y-2">
        {(poll.options || []).map((o) => (
          <li key={o.key} className="flex flex-wrap gap-1 text-sm">
            <span className="font-bold text-slate-900">{formatPollOptionLabel(o, language)}:</span>
            <span>{Number(poll.counts?.[o.key] || 0)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs font-medium text-slate-500">
        {t("manage_menu_poll_total_votes")} {Number(poll.totalVotes || 0)}
      </p>
    </div>
  );
}

function MenuCard({ item, onEdit, onDelete, language, t, readOnly }) {
  return (
    <li className={readOnly ? "rounded-lg border border-slate-200 bg-slate-100 p-3" : "card-panel"}>
      <p className={`font-bold ${readOnly ? "text-xs text-slate-500" : "text-slate-900"}`}>
        {formatDisplayDate(item.date)}
      </p>
      {menuCategoryLabel(item, language) ? (
        <span className="mt-2 inline-block rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-800">
          {menuCategoryLabel(item, language)}
        </span>
      ) : null}
      <div className="mt-3">
        <p className="text-xs font-semibold uppercase text-slate-500">{t("manage_menu_lunch")}</p>
        <p className="text-sm text-slate-900">{menuLine(item, language, "lunch") || "-"}</p>
      </div>
      <div className="mt-2">
        <p className="text-xs font-semibold uppercase text-slate-500">{t("manage_menu_dinner")}</p>
        <p className="text-sm text-slate-900">{menuLine(item, language, "dinner") || "-"}</p>
      </div>
      {!readOnly ? (
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn-primary flex-1 text-sm" onClick={() => onEdit(item)}>
            <Pencil className="h-4 w-4" />
            {t("manage_members_edit")}
          </button>
          <button type="button" className="btn-danger flex-1 text-sm" onClick={() => onDelete(item)}>
            <Trash2 className="h-4 w-4" />
            {t("manage_members_delete")}
          </button>
        </div>
      ) : null}
    </li>
  );
}

function MenuFormModal({
  open,
  onClose,
  onSave,
  initialData,
  isEditing,
  pollOptions,
  language,
  t,
}) {
  const [date, setDate] = useState(new Date());
  const [lunch, setLunch] = useState("");
  const [dinner, setDinner] = useState("");
  const [selectedOptionKey, setSelectedOptionKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setDate(initialData.date ? new Date(initialData.date) : new Date());
      setLunch(menuLine(initialData, language, "lunch") || "");
      setDinner(menuLine(initialData, language, "dinner") || "");
      setSelectedOptionKey(initialData.pollOptionKey || "");
    } else {
      setDate(new Date());
      setLunch("");
      setDinner("");
      setSelectedOptionKey(
        Array.isArray(pollOptions) && pollOptions.length > 0 ? pollOptions[0]?.key || "" : ""
      );
    }
  }, [open, initialData, language, pollOptions]);

  const handleSave = async () => {
    const l = lunch.trim();
    const d = dinner.trim();
    if (!l && !d) {
      Alert.alert(t("alert_validation_title"), t("manage_menu_validation_lunch_dinner"));
      return;
    }
    const selectedOption = (Array.isArray(pollOptions) ? pollOptions : []).find(
      (o) => o.key === selectedOptionKey
    );
    if ((Array.isArray(pollOptions) ? pollOptions : []).length > 0 && !selectedOption) {
      Alert.alert(
        t("alert_validation_title"),
        language === "en" ? "Please select a menu category" : "कृपया मेनू श्रेणी निवडा"
      );
      return;
    }
    const fallbackOptionPayload = selectedOptionKey
      ? {
          pollOptionKey: selectedOptionKey,
          pollOptionLabel: String(initialData?.pollOptionLabel || "").trim(),
          pollOptionLabelMr: String(
            initialData?.pollOptionLabelMr || initialData?.pollOptionLabel || ""
          ).trim(),
        }
      : { pollOptionKey: "", pollOptionLabel: "", pollOptionLabelMr: "" };

    setSaving(true);
    try {
      await onSave({
        date: date.toISOString(),
        lunch: l,
        dinner: d,
        ...(selectedOption
          ? {
              pollOptionKey: selectedOption.key,
              pollOptionLabel: selectedOption.label || "",
              pollOptionLabelMr: selectedOption.labelMr || selectedOption.label || "",
            }
          : fallbackOptionPayload),
      });
      onClose();
    } catch (err) {
      Alert.alert(t("alert_error"), err.response?.data?.message || t("manage_menu_menu_save_failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? t("manage_menu_edit_menu") : t("manage_menu_add_menu")}
      size="lg"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t("manage_menu_date")}</label>
          <input
            type="date"
            className="input-field"
            value={toInputDate(date)}
            onChange={(e) => setDate(fromInputDate(e.target.value))}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t("manage_menu_lunch")}</label>
          <textarea className="input-field min-h-[60px]" value={lunch} onChange={(e) => setLunch(e.target.value)} placeholder={t("manage_menu_lunch_ph")} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t("manage_menu_dinner")}</label>
          <textarea className="input-field min-h-[60px]" value={dinner} onChange={(e) => setDinner(e.target.value)} placeholder={t("manage_menu_dinner_ph")} />
        </div>
        {(Array.isArray(pollOptions) ? pollOptions : []).length > 0 ? (
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              {language === "en" ? "Menu Category" : "मेनू श्रेणी"}
            </label>
            <div className="flex flex-wrap gap-2">
              {pollOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                    selectedOptionKey === opt.key
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                  onClick={() => setSelectedOptionKey(opt.key)}
                >
                  {formatPollOptionLabel(opt, language)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <button type="button" className="btn-primary w-full" disabled={saving} onClick={handleSave}>
          {saving ? <Spinner className="h-4 w-4 border-white/30 border-t-white" label="" /> : t("manage_menu_save")}
        </button>
      </div>
    </Modal>
  );
}

function CreateMenuFlowModal({ open, onClose, onSave, date, language, t }) {
  const [optionCount, setOptionCount] = useState(1);
  const [step, setStep] = useState(1);
  const [menuDate, setMenuDate] = useState(new Date());
  const [singleLunch, setSingleLunch] = useState("");
  const [singleDinner, setSingleDinner] = useState("");
  const [optionOneLabel, setOptionOneLabel] = useState(language === "mr" ? "व्हेज" : "Veg");
  const [optionTwoLabel, setOptionTwoLabel] = useState(language === "mr" ? "नॉन व्हेज" : "Non Veg");
  const [optionOneLunch, setOptionOneLunch] = useState("");
  const [optionOneDinner, setOptionOneDinner] = useState("");
  const [optionTwoLunch, setOptionTwoLunch] = useState("");
  const [optionTwoDinner, setOptionTwoDinner] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setOptionCount(1);
    setMenuDate(date ? new Date(date) : new Date());
    setSingleLunch("");
    setSingleDinner("");
    setOptionOneLunch("");
    setOptionOneDinner("");
    setOptionTwoLunch("");
    setOptionTwoDinner("");
  }, [open, date]);

  useEffect(() => {
    if (!open) return;
    setOptionOneLabel(language === "mr" ? "व्हेज" : "Veg");
    setOptionTwoLabel(language === "mr" ? "नॉन व्हेज" : "Non Veg");
  }, [open, language]);

  const maxStep = optionCount === 1 ? 2 : 3;

  const validateCurrentStep = () => {
    if (step === 1) return true;
    if (optionCount === 1) {
      if (!singleLunch.trim() && !singleDinner.trim()) {
        Alert.alert(t("alert_validation_title"), t("manage_menu_validation_lunch_dinner"));
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (!optionOneLabel.trim() || !optionTwoLabel.trim()) {
        Alert.alert(
          t("alert_validation_title"),
          language === "en" ? "Please enter both option names" : "कृपया दोन्ही पर्यायांची नावे भरा"
        );
        return false;
      }
      return true;
    }
    const menuOne = { lunch: optionOneLunch.trim(), dinner: optionOneDinner.trim() };
    const menuTwo = { lunch: optionTwoLunch.trim(), dinner: optionTwoDinner.trim() };
    if ((!menuOne.lunch && !menuOne.dinner) || (!menuTwo.lunch && !menuTwo.dinner)) {
      Alert.alert(
        t("alert_validation_title"),
        language === "en"
          ? "Each option needs at least lunch or dinner"
          : "प्रत्येक पर्यायासाठी किमान लंच किंवा डिनर भरा"
      );
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (optionCount === 1) {
      const lunch = singleLunch.trim();
      const dinner = singleDinner.trim();
      if (!lunch && !dinner) {
        Alert.alert(t("alert_validation_title"), t("manage_menu_validation_lunch_dinner"));
        return;
      }
      setSaving(true);
      try {
        await onSave({ date: menuDate.toISOString(), mode: "single", menu: { lunch, dinner } });
        onClose();
      } catch (err) {
        Alert.alert(t("alert_error"), err?.response?.data?.message || t("manage_menu_menu_save_failed"));
      } finally {
        setSaving(false);
      }
      return;
    }
    const labelOne = optionOneLabel.trim();
    const labelTwo = optionTwoLabel.trim();
    const menuOne = { lunch: optionOneLunch.trim(), dinner: optionOneDinner.trim() };
    const menuTwo = { lunch: optionTwoLunch.trim(), dinner: optionTwoDinner.trim() };
    if (!labelOne || !labelTwo) {
      Alert.alert(
        t("alert_validation_title"),
        language === "en" ? "Please enter both option names" : "कृपया दोन्ही पर्यायांची नावे भरा"
      );
      return;
    }
    if ((!menuOne.lunch && !menuOne.dinner) || (!menuTwo.lunch && !menuTwo.dinner)) {
      Alert.alert(
        t("alert_validation_title"),
        language === "en"
          ? "Each option needs at least lunch or dinner"
          : "प्रत्येक पर्यायासाठी किमान लंच किंवा डिनर भरा"
      );
      return;
    }
    setSaving(true);
    try {
      await onSave({
        date: menuDate.toISOString(),
        mode: "double",
        poll: {
          question: language === "mr" ? "जेवणाची पसंती" : "Meal Preference",
          options: [
            { label: labelOne, labelMr: labelOne },
            { label: labelTwo, labelMr: labelTwo },
          ],
        },
        menus: [
          { optionLabel: labelOne, lunch: menuOne.lunch, dinner: menuOne.dinner },
          { optionLabel: labelTwo, lunch: menuTwo.lunch, dinner: menuTwo.dinner },
        ],
      });
      onClose();
    } catch (err) {
      Alert.alert(t("alert_error"), err?.response?.data?.message || t("manage_menu_menu_save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setStep((prev) => Math.min(prev + 1, maxStep));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={language === "en" ? "Create Menu" : "मेनू तयार करा"}
      size="lg"
    >
      <div className="max-h-[70vh] space-y-4 overflow-y-auto">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">{t("manage_menu_date")}</label>
          <input
            type="date"
            className="input-field"
            value={toInputDate(menuDate)}
            onChange={(e) => setMenuDate(fromInputDate(e.target.value))}
          />
        </div>
        <p className="text-sm font-semibold text-slate-500">
          {language === "en" ? `Step ${step} of ${maxStep}` : `स्टेप ${step} / ${maxStep}`}
        </p>
        {step === 1 ? (
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              {language === "en" ? "Number of Options" : "पर्यायांची संख्या"}
            </label>
            <div className="flex gap-2">
              {[1, 2].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={`flex-1 rounded-xl py-2 text-sm font-bold ${
                    optionCount === count ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"
                  }`}
                  onClick={() => setOptionCount(count)}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {optionCount === 1 && step === 2 ? (
          <>
            <textarea className="input-field min-h-[60px]" value={singleLunch} onChange={(e) => setSingleLunch(e.target.value)} placeholder={t("manage_menu_lunch_ph")} />
            <textarea className="input-field min-h-[60px]" value={singleDinner} onChange={(e) => setSingleDinner(e.target.value)} placeholder={t("manage_menu_dinner_ph")} />
          </>
        ) : null}
        {optionCount === 2 && step === 2 ? (
          <>
            <input className="input-field" value={optionOneLabel} onChange={(e) => setOptionOneLabel(e.target.value)} />
            <input className="input-field" value={optionTwoLabel} onChange={(e) => setOptionTwoLabel(e.target.value)} />
          </>
        ) : null}
        {optionCount === 2 && step === 3 ? (
          <>
            <p className="font-bold text-slate-900">{optionOneLabel}</p>
            <textarea className="input-field min-h-[50px]" value={optionOneLunch} onChange={(e) => setOptionOneLunch(e.target.value)} placeholder={t("manage_menu_lunch_ph")} />
            <textarea className="input-field min-h-[50px]" value={optionOneDinner} onChange={(e) => setOptionOneDinner(e.target.value)} placeholder={t("manage_menu_dinner_ph")} />
            <p className="font-bold text-slate-900">{optionTwoLabel}</p>
            <textarea className="input-field min-h-[50px]" value={optionTwoLunch} onChange={(e) => setOptionTwoLunch(e.target.value)} placeholder={t("manage_menu_lunch_ph")} />
            <textarea className="input-field min-h-[50px]" value={optionTwoDinner} onChange={(e) => setOptionTwoDinner(e.target.value)} placeholder={t("manage_menu_dinner_ph")} />
          </>
        ) : null}
        <div className="flex gap-2">
          {step > 1 ? (
            <button type="button" className="btn-secondary flex-1" onClick={() => setStep((s) => s - 1)}>
              {language === "en" ? "Back" : "मागे"}
            </button>
          ) : null}
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={saving}
            onClick={step === maxStep ? handleSave : handleNext}
          >
            {saving ? (
              <Spinner className="h-4 w-4 border-white/30 border-t-white" label="" />
            ) : step === maxStep ? (
              t("manage_menu_save")
            ) : language === "en" ? (
              "Next"
            ) : (
              "पुढे"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PollFormModal({ open, onClose, onSave, initialData, pollDate, language, t }) {
  const defaults = getDefaultPollTemplate(language);
  const [question, setQuestion] = useState(defaults.question);
  const [options, setOptions] = useState(defaults.options);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = getDefaultPollTemplate(language);
    const q =
      language === "mr"
        ? initialData?.questionMr || initialData?.question || d.question
        : initialData?.question || initialData?.questionMr || d.question;
    setQuestion(q);
    const src =
      Array.isArray(initialData?.options) && initialData.options.length >= 2
        ? initialData.options
        : d.options;
    setOptions(
      src.map((o) => ({
        key: String(o?.key || "").trim() || newPollOptionKey(),
        label: String(o?.label || "").trim(),
        labelMr: String(o?.labelMr || "").trim() || String(o?.label || "").trim(),
      }))
    );
  }, [language, initialData, open]);

  const updateOption = (idx, patch) => {
    setOptions((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, ...patch } : o))
    );
  };

  const removeOption = (idx) => {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const addOption = () => {
    setOptions((prev) => [...prev, { key: newPollOptionKey(), label: "", labelMr: "" }]);
  };

  const handleSave = async () => {
    const d = getDefaultPollTemplate(language);
    const q = String(question || "").trim() || d.question;
    const normalized = (Array.isArray(options) ? options : [])
      .map((o) => {
        const label = String(o?.label || "").trim();
        const labelMr = String(o?.labelMr || "").trim();
        let key = String(o?.key || "").trim().toLowerCase();
        key = key.replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "");
        if (!key) key = newPollOptionKey();
        return { key, label, labelMr };
      })
      .filter((o) => o.label || o.labelMr);

    const unique = [];
    const used = new Set();
    for (const o of normalized) {
      let k = o.key;
      let n = 0;
      while (used.has(k)) {
        n += 1;
        k = `${o.key}_${n}`;
      }
      used.add(k);
      unique.push({ key: k, label: o.label, labelMr: o.labelMr });
    }

    if (unique.length < 2) {
      Alert.alert(t("alert_validation_title"), t("manage_menu_poll_validation_options"));
      return;
    }

    setSaving(true);
    try {
      await onSave({ date: localDateKey(pollDate || new Date()), question: q, options: unique });
      onClose();
    } catch (err) {
      Alert.alert(t("alert_error"), err.response?.data?.message || t("manage_menu_poll_save_failed"));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        initialData?._id ? t("manage_menu_poll_modal_edit") : t("manage_menu_poll_modal_create")
      }
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{formatDisplayDate(pollDate || new Date())}</p>
        <input
          className="input-field"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("manage_menu_poll_question_ph")}
        />
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">{t("manage_menu_poll_options")}</span>
          <button type="button" className="text-sm font-bold text-slate-900" onClick={addOption}>
            {t("manage_menu_poll_add_option")}
          </button>
        </div>
        {options.map((opt, idx) => (
          <div key={opt.key || idx} className="flex gap-2">
            <input
              className="input-field flex-1"
              value={language === "mr" ? opt.labelMr || opt.label : opt.label || opt.labelMr}
              onChange={(e) =>
                updateOption(idx, language === "mr" ? { labelMr: e.target.value } : { label: e.target.value })
              }
              placeholder={t("manage_menu_poll_option_text_ph")}
            />
            <button
              type="button"
              className="text-red-600 disabled:opacity-40"
              disabled={options.length <= 2}
              onClick={() => removeOption(idx)}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        ))}
        <button type="button" className="btn-primary w-full" disabled={saving} onClick={handleSave}>
          {saving ? <Spinner className="h-4 w-4 border-white/30 border-t-white" label="" /> : t("manage_menu_save")}
        </button>
      </div>
    </Modal>
  );
}

export default function ManageMenu() {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [createFlowVisible, setCreateFlowVisible] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const [pollsList, setPollsList] = useState([]);
  const [pollLoading, setPollLoading] = useState(false);
  const [pollError, setPollError] = useState("");
  const [pollFormVisible, setPollFormVisible] = useState(false);
  const [pollFormInstanceKey, setPollFormInstanceKey] = useState(0);
  const [editingPoll, setEditingPoll] = useState(null);
  const [menuFormPollOptions, setMenuFormPollOptions] = useState([]);
  const [accountCreatedDay, setAccountCreatedDay] = useState(null);

  const fetchMenus = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_BASE_URL}/api/menu`);
      setMenus(data);
    } catch (err) {
      Alert.alert(t("alert_error"), err.response?.data?.message || t("manage_menu_load_failed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/api/auth/admin-account-bounds");
        const raw = data?.createdAt;
        if (cancelled || !raw) return;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return;
        setAccountCreatedDay(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
      } catch {
        // fallback to user.createdAt
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filterDateMinFromStoredUser = useMemo(() => {
    const raw = user?.createdAt;
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, [user?.createdAt]);

  const filterDateMin = useMemo(
    () => accountCreatedDay ?? filterDateMinFromStoredUser,
    [accountCreatedDay, filterDateMinFromStoredUser]
  );

  const filterDateMax = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const filterMaxTs = filterDateMax.getTime();
  const filterMinTs = filterDateMin?.getTime() ?? null;
  const filterPickerMin = filterMinTs != null ? toInputDate(new Date(Math.min(filterMinTs, filterMaxTs))) : undefined;
  const filterPickerMax = toInputDate(filterDateMax);

  const pollDate = useMemo(() => {
    if (filterDate) {
      const d = new Date(filterDate);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, [filterDate]);

  const pollDateKey = useMemo(() => localDateKey(pollDate), [pollDate]);

  const fetchPollsList = useCallback(async () => {
    try {
      setPollLoading(true);
      setPollError("");
      const res = await api.get("/api/polls/list");
      setPollsList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setPollError(err.response?.data?.message || t("manage_menu_poll_load_failed"));
      setPollsList([]);
    } finally {
      setPollLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPollsList();
  }, [fetchPollsList]);

  const poll = useMemo(
    () => pollsList.find((p) => pollDateKeyFromPollDoc(p) === pollDateKey) || null,
    [pollsList, pollDateKey]
  );

  const pollHistory = useMemo(() => {
    const now = Date.now();
    return pollsList
      .filter((p) => p.expiresAt && new Date(p.expiresAt).getTime() <= now)
      .filter((p) => pollDateKeyFromPollDoc(p) !== pollDateKey)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [pollsList, pollDateKey]);

  const todayLocalKey = localDateKey(new Date());
  const isSelectedPollDayPast = localDateKey(pollDate) < todayLocalKey;
  const isCurrentPollExpired =
    !!(poll?.expiresAt && new Date(poll.expiresAt).getTime() <= Date.now());
  const pollActionsLocked = isSelectedPollDayPast || isCurrentPollExpired;

  const getPollOptionsForDate = useCallback(
    (dateLike) => {
      const key = localDateKey(dateLike || new Date());
      const dayPoll = pollsList.find((p) => pollDateKeyFromPollDoc(p) === key);
      return Array.isArray(dayPoll?.options) ? dayPoll.options : [];
    },
    [pollsList]
  );

  const sortedMenus = useMemo(
    () => [...menus].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [menus]
  );

  const filteredMenus = useMemo(() => {
    if (filterDate) {
      const fk = localDateKey(filterDate);
      return sortedMenus.filter((m) => localDateKey(m.date) === fk);
    }
    return sortedMenus;
  }, [sortedMenus, filterDate]);

  const activeMenus = useMemo(() => {
    if (filterDate) return filteredMenus;
    const tl = localDateKey(new Date());
    return sortedMenus.filter((m) => localDateKey(m.date) >= tl);
  }, [filterDate, filteredMenus, sortedMenus]);

  const isMenuReadOnly = useCallback(
    (item) => {
      const tl = localDateKey(new Date());
      if (filterDate) return localDateKey(filterDate) < tl;
      return localDateKey(item.date) < tl;
    },
    [filterDate]
  );

  const targetMenuDate = useMemo(() => filterDate || new Date(), [filterDate]);

  const handleFilterDateChange = (value) => {
    if (!value) {
      setFilterDate(null);
      return;
    }
    let ts = fromInputDate(value).getTime();
    if (filterMinTs != null && ts < filterMinTs) ts = filterMinTs > filterMaxTs ? filterMaxTs : filterMinTs;
    if (ts > filterMaxTs) ts = filterMaxTs;
    setFilterDate(new Date(ts));
  };

  useEffect(() => {
    if (!filterDate) return;
    const ts = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate()).getTime();
    if (filterMinTs != null && ts < filterMinTs) setFilterDate(null);
    else if (ts > filterMaxTs) setFilterDate(null);
  }, [filterDate, filterMinTs, filterMaxTs]);

  const handleEditMenu = (item) => {
    setEditingMenu(item);
    setMenuFormPollOptions(getPollOptionsForDate(item?.date || new Date()));
    setFormVisible(true);
  };

  const handleDeleteMenu = (item) => {
    Alert.alert(
      t("manage_menu_delete_menu_title"),
      t("manage_menu_delete_menu_body").replace(/\{\{date\}\}/g, formatDisplayDate(item.date)),
      [
        { text: t("button_cancel"), style: "cancel" },
        {
          text: t("manage_members_delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await axios.delete(`${API_BASE_URL}/api/menu/${item._id}`);
              fetchMenus();
            } catch (err) {
              Alert.alert(t("alert_error"), err.response?.data?.message || t("manage_menu_menu_delete_failed"));
            }
          },
        },
      ]
    );
  };

  const handleSaveMenu = async (payload) => {
    if (editingMenu) {
      await axios.put(`${API_BASE_URL}/api/menu/${editingMenu._id}`, payload);
    } else {
      await axios.post(`${API_BASE_URL}/api/menu`, payload);
    }
    fetchMenus();
  };

  const handleCreateMenuFlow = async (payload) => {
    const selectedDateKey = localDateKey(payload?.date || targetMenuDate);
    const existingMenusForDay = menus.filter((m) => localDateKey(m.date) === selectedDateKey);
    const existingPollForDay = pollsList.find((p) => pollDateKeyFromPollDoc(p) === selectedDateKey);

    if (payload?.mode === "single") {
      if (existingMenusForDay.length > 0 || existingPollForDay) {
        throw new Error(
          language === "en"
            ? "Poll or menu already exists for this date"
            : "या तारखेसाठी पोल किंवा मेनू आधीच उपलब्ध आहे"
        );
      }
      await axios.post(`${API_BASE_URL}/api/menu`, {
        date: payload.date,
        lunch: payload?.menu?.lunch || "",
        dinner: payload?.menu?.dinner || "",
      });
      await fetchMenus();
      return;
    }

    if (existingPollForDay || existingMenusForDay.length > 0) {
      throw new Error(
        language === "en"
          ? "Poll or menus already exist for this date"
          : "या तारखेसाठी पोल किंवा मेनू आधीच उपलब्ध आहेत"
      );
    }

    const options = (payload?.poll?.options || []).map((option, index) => ({
      key: `option${index + 1}`,
      label: option.label,
      labelMr: option.labelMr,
    }));

    await api.post("/api/polls", {
      date: payload.date,
      question: payload?.poll?.question,
      options,
    });

    await Promise.all(
      (payload?.menus || []).map((menu, index) =>
        axios.post(`${API_BASE_URL}/api/menu`, {
          date: payload.date,
          lunch: menu.lunch,
          dinner: menu.dinner,
          pollOptionKey: options[index]?.key || "",
          pollOptionLabel: options[index]?.label || "",
          pollOptionLabelMr: options[index]?.labelMr || options[index]?.label || "",
        })
      )
    );

    await Promise.all([fetchMenus(), fetchPollsList()]);
  };

  const openEditPoll = () => {
    setEditingPoll(poll);
    setPollFormInstanceKey((k) => k + 1);
    setPollFormVisible(true);
  };

  const handleSavePoll = async (payload) => {
    if (editingPoll?._id) {
      await api.put(`/api/polls/${editingPoll._id}`, payload);
    } else {
      await api.post("/api/polls", payload);
    }
    await fetchPollsList();
  };

  const handleDeletePoll = () => {
    if (!poll?._id) return;
    Alert.alert(t("manage_menu_poll_delete_title"), t("manage_menu_poll_delete_body"), [
      { text: t("button_cancel"), style: "cancel" },
      {
        text: t("manage_members_delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/polls/${poll._id}`);
            await fetchPollsList();
          } catch (err) {
            Alert.alert(t("alert_error"), err.response?.data?.message || t("manage_menu_poll_delete_failed"));
          }
        },
      },
    ]);
  };

  return (
    <div>
      <PageHeader title={t("card_menu")} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <Calendar className="h-4 w-4 text-slate-700" />
          <input
            type="date"
            className="border-0 bg-transparent text-sm font-medium text-slate-900 focus:outline-none focus:ring-0"
            value={filterDate ? toInputDate(filterDate) : ""}
            min={filterPickerMin}
            max={filterPickerMax}
            onChange={(e) => handleFilterDateChange(e.target.value)}
          />
        </div>
        {filterDate ? (
          <button type="button" className="text-sm font-semibold text-red-600" onClick={() => setFilterDate(null)}>
            {language === "en" ? "Clear" : "रीसेट"}
          </button>
        ) : (
          <span className="text-sm text-slate-500">
            {language === "en" ? "Filter by date" : "तारखेनुसार फिल्टर"}
          </span>
        )}
      </div>

      <div className="card-panel mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-slate-900">{t("manage_menu_poll_section")}</h2>
          {poll?._id ? (
            pollActionsLocked ? (
              <span className="text-sm font-semibold text-slate-500">
                {language === "en" ? "View only" : "फक्त वाचन"}
              </span>
            ) : (
              <div className="flex gap-3">
                <button type="button" className="text-sm font-bold text-slate-900" onClick={openEditPoll}>
                  {t("manage_members_edit")}
                </button>
                <button type="button" className="text-sm font-bold text-red-600" onClick={handleDeletePoll}>
                  {t("manage_members_delete")}
                </button>
              </div>
            )
          ) : null}
        </div>
        <p className="mt-2 text-sm text-slate-500">{formatDisplayDate(pollDate)}</p>
        {pollLoading ? (
          <div className="mt-3 flex items-center gap-2">
            <Spinner className="h-5 w-5" />
            <span className="text-sm">{t("manage_menu_poll_loading")}</span>
          </div>
        ) : pollError ? (
          <p className="mt-3 text-sm font-semibold text-red-600">{pollError}</p>
        ) : !poll ? (
          <p className="mt-3 text-sm text-slate-700">{t("manage_menu_poll_none")}</p>
        ) : (
          <PollResultsBlock poll={poll} language={language} t={t} />
        )}
      </div>

      {pollHistory.length > 0 ? (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-bold text-slate-500">{t("manage_menu_poll_history")}</h3>
          <ul className="space-y-3">
            {pollHistory.map((hp) => (
              <li key={hp._id} className="card-panel bg-slate-50">
                <p className="font-bold text-slate-900">{formatDisplayDate(hp.date)}</p>
                <PollResultsBlock poll={hp} language={language} t={t} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button type="button" className="btn-primary mb-6 w-full sm:w-auto" onClick={() => setCreateFlowVisible(true)}>
        <Plus className="h-4 w-4" />
        {t("manage_menu_add_menu")}
      </button>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : filterDate && filteredMenus.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-slate-400">
          <UtensilsCrossed className="h-12 w-12" />
          <p className="mt-4 text-center text-slate-600">
            {language === "en"
              ? "No menu added for this date. Default menu:"
              : "या तारखेसाठी मेनू उपलब्ध नाही. डीफॉल्ट मेनू:"}
          </p>
          <div className="card-panel mt-4 w-full max-w-md">
            <p className="font-bold">{formatDisplayDate(filterDate)}</p>
            <p className="mt-2 text-sm">
              {t("manage_menu_lunch")}: {menuLine(getDefaultMessMenuForDate(filterDate), language, "lunch")}
            </p>
            <p className="text-sm">
              {t("manage_menu_dinner")}: {menuLine(getDefaultMessMenuForDate(filterDate), language, "dinner")}
            </p>
          </div>
        </div>
      ) : !filterDate && activeMenus.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-slate-400">
          <UtensilsCrossed className="h-12 w-12" />
          <p className="mt-4 text-center text-slate-600">
            {sortedMenus.length > 0
              ? language === "en"
                ? "No menu for today or upcoming dates. Use filter to view past menus."
                : "आज किंवा पुढील तारखांसाठी मेनू नाही. मागील मेनू पाहण्यासाठी फिल्टर वापरा."
              : language === "en"
                ? "No menus yet. Add one!"
                : "अजून कोणताही मेनू नाही. नवीन मेनू जोडा!"}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {activeMenus.map((item) => (
            <MenuCard
              key={item._id}
              item={item}
              language={language}
              t={t}
              readOnly={isMenuReadOnly(item)}
              onEdit={handleEditMenu}
              onDelete={handleDeleteMenu}
            />
          ))}
        </ul>
      )}

      <MenuFormModal
        open={formVisible}
        language={language}
        t={t}
        pollOptions={menuFormPollOptions}
        onClose={() => {
          setFormVisible(false);
          setEditingMenu(null);
          setMenuFormPollOptions([]);
        }}
        onSave={handleSaveMenu}
        initialData={editingMenu}
        isEditing={!!editingMenu}
      />

      <CreateMenuFlowModal
        open={createFlowVisible}
        date={targetMenuDate}
        language={language}
        t={t}
        onClose={() => setCreateFlowVisible(false)}
        onSave={async (flowPayload) => {
          try {
            await handleCreateMenuFlow(flowPayload);
            setCreateFlowVisible(false);
          } catch (err) {
            const msg =
              err?.response?.data?.message || err?.message || t("manage_menu_menu_save_failed");
            throw { response: { data: { message: msg } } };
          }
        }}
      />

      <PollFormModal
        key={pollFormInstanceKey}
        open={pollFormVisible}
        pollDate={pollDate}
        language={language}
        t={t}
        onClose={() => {
          setPollFormVisible(false);
          setEditingPoll(null);
        }}
        onSave={handleSavePoll}
        initialData={editingPoll}
      />
    </div>
  );
}
