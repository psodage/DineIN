import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2 } from "lucide-react";
import { fetchActivePoll, voteForPoll } from "../../lib/poll";
import Button from "../ui/Button";
import { toLocalYMD } from "../../lib/dateUtils";

export default function MemberPollCard({ date = new Date() }) {
  const dateKey = useMemo(() => {
    if (date instanceof Date) return toLocalYMD(date);
    return String(date ?? "");
  }, [date]);

  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [poll, setPoll] = useState(null);
  const [errorText, setErrorText] = useState("");
  const [selectedOptionKey, setSelectedOptionKey] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successText, setSuccessText] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setErrorText("");
      setSuccessText("");
      try {
        const active = await fetchActivePoll({ date: dateKey || undefined });
        if (!mounted) return;
        setPoll(active);
        setSelectedOptionKey(active?.myVote ?? null);
      } catch (err) {
        if (!mounted) return;
        setPoll(null);
        setErrorText(err?.message || "Failed to load poll.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [dateKey]);

  const hasVoted = !!poll?.myVote;
  const canVote = !!poll && !hasVoted && !!selectedOptionKey && !submitting;

  const onPressVote = async () => {
    if (!poll?.id || !selectedOptionKey) return;
    setSubmitting(true);
    setErrorText("");
    try {
      const updated = await voteForPoll(poll.id, selectedOptionKey);
      setPoll(updated);
      setSelectedOptionKey(updated?.myVote ?? selectedOptionKey);
      setSuccessText("Thanks for voting!");
    } catch (err) {
      setErrorText(err?.response?.data?.message || err?.message || "Failed to submit vote.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-5 text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
          <BarChart3 className="h-5 w-5" />
        </div>
        <p className="text-sm font-bold text-ink">No active poll</p>
        <p className="mt-0.5 text-xs text-muted">Check back later for meal preference polls.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="text-sm font-bold text-ink">{poll.question}</p>
      <div className="space-y-1.5">
        {poll.options.map((opt) => {
          const selected = selectedOptionKey === opt.key || poll.myVote === opt.key;
          const count = poll.counts?.[opt.key];
          return (
            <button
              key={opt.key}
              type="button"
              disabled={hasVoted}
              onClick={() => {
                if (hasVoted) return;
                setSelectedOptionKey(opt.key);
                setErrorText("");
              }}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                selected
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-slate-200 bg-white hover:border-brand/40"
              }`}
            >
              <span className="text-xs font-semibold">{opt.label}</span>
              {typeof count === "number" ? (
                <span className="text-[10px] font-bold text-muted">{count} votes</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {errorText ? <p className="text-xs font-semibold text-red-600">{errorText}</p> : null}
      {successText ? (
        <p className="flex items-center gap-2 text-xs font-semibold text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {successText}
        </p>
      ) : null}

      {!hasVoted ? (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={!canVote} loading={submitting} onClick={onPressVote}>
            Vote
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedOptionKey(null)}>
            Clear
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="w-full" onClick={() => setVisible(false)}>
          Dismiss
        </Button>
      )}
    </div>
  );
}
