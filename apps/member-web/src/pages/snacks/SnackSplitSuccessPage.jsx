import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../lib/api";
import Button from "../../components/ui/Button";
import LoadingOverlay from "../../components/ui/LoadingOverlay";

export default function SnackSplitSuccessPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestId = params.get("requestId");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!requestId);

  useEffect(() => {
    if (!requestId) return;
    let mounted = true;
    const poll = async () => {
      try {
        const res = await api.get(`/api/bill-splits/${requestId}`);
        if (mounted) setData(res?.data);
      } catch {
        /* ignore */
      } finally {
        if (mounted) setLoading(false);
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [requestId]);

  return (
    <div className="min-h-dvh bg-surface px-5 py-10 text-center">
      {loading ? <LoadingOverlay visible /> : null}
      <h1 className="text-2xl font-extrabold text-ink">Bill split request</h1>
      <p className="mt-2 text-muted">
        {data?.status ? `Status: ${data.status}` : "Waiting for approval from split members…"}
      </p>
      <div className="mt-8 space-y-2">
        <Button className="w-full" onClick={() => navigate("/dashboard?tab=snacks")}>
          Back to snacks
        </Button>
        <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard")}>
          Home
        </Button>
      </div>
    </div>
  );
}
