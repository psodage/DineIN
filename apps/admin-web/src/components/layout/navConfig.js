import {
  LayoutDashboard,
  Users,
  Wallet,
  CreditCard,
  FileText,
  Cloud,
  UtensilsCrossed,
  Tag,
  Calendar,
  Cookie,
  QrCode,
} from "lucide-react";

export const DASHBOARD_CARDS = [
  { id: "students", titleKey: "card_students", icon: Users, path: "/members" },
  { id: "snacks", titleKey: "card_snacks", icon: Cookie, path: "/extra-snacks" },
  { id: "expenses", titleKey: "card_expenses", icon: Wallet, path: "/mess-expenses" },
  { id: "payments", titleKey: "card_payments", icon: CreditCard, path: "/payments" },
  { id: "reports", titleKey: "card_reports", icon: FileText, path: "/reports" },
  { id: "backups", title: "Backups", icon: Cloud, path: "/backups" },
  { id: "menu", titleKey: "card_menu", icon: UtensilsCrossed, path: "/manage-menu", disabled: true },
  { id: "snackProducts", titleKey: "card_snack_products", icon: Tag, path: "/manage-extra-snacks", disabled: true },
  { id: "leave", titleKey: "card_leave", icon: Calendar, path: "/leave-approval", disabled: true },
  { id: "qr", titleKey: "QR Scanner", icon: QrCode, path: "/qr-scanner", disabled: true },
];

export const SIDEBAR_NAV = [
  { to: "/dashboard", labelKey: "dashboard_title", icon: LayoutDashboard, end: true },
  { to: "/members", labelKey: "card_students", icon: Users },
  { to: "/extra-snacks", labelKey: "card_snacks", icon: Cookie },
  { to: "/mess-expenses", labelKey: "card_expenses", icon: Wallet },
  { to: "/payments", labelKey: "card_payments", icon: CreditCard },
  { to: "/reports", labelKey: "card_reports", icon: FileText },
  { to: "/backups", title: "Backups", icon: Cloud },
];
