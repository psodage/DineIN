import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PageHeader({ title, subtitle, backTo }) {
  return (
    <div className="mb-2">
      {backTo ? (
        <Link
          to={backTo}
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      ) : null}
      <h1 className="page-title">{title}</h1>
      {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
    </div>
  );
}
