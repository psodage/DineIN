import api from "./api";

function normalizeOption(option) {
  const key = String(option?.key ?? "").trim().toLowerCase();
  if (!key) return null;
  const label = String(option?.label ?? option?.labelMr ?? "").trim();
  return { key, label: label || key };
}

function normalizePoll(pollSummary) {
  if (!pollSummary) return null;

  const options = Array.isArray(pollSummary?.options)
    ? pollSummary.options.map(normalizeOption).filter(Boolean)
    : [];

  const rawCounts = pollSummary?.counts;
  const counts =
    rawCounts && typeof rawCounts === "object" && !Array.isArray(rawCounts)
      ? Object.fromEntries(
          Object.entries(rawCounts)
            .map(([k, v]) => {
              const n = typeof v === "number" ? v : Number(v);
              if (!Number.isFinite(n)) return null;
              const key = String(k ?? "").trim().toLowerCase();
              if (!key) return null;
              return [key, n];
            })
            .filter(Boolean)
        )
      : null;

  const expiresAt = pollSummary?.expiresAt ? new Date(pollSummary.expiresAt) : null;
  const isActive = expiresAt ? expiresAt.getTime() > Date.now() : true;

  return {
    id: pollSummary?._id ? String(pollSummary._id) : null,
    title: "Poll",
    question: String(pollSummary?.question ?? "").trim() || "Meal Preference",
    options,
    myVote: pollSummary?.myVote ? String(pollSummary.myVote) : null,
    counts,
    isActive,
    createdAt: pollSummary?.createdAt ?? null,
    expiresAt: pollSummary?.expiresAt ?? null,
    totalVotes: typeof pollSummary?.totalVotes === "number" ? pollSummary.totalVotes : null,
  };
}

function toDateQueryValue(dateLike) {
  if (!dateLike) return new Date().toISOString();
  if (typeof dateLike === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) {
    return new Date(`${dateLike}T12:00:00`).toISOString();
  }
  if (typeof dateLike === "string") return dateLike;
  if (dateLike instanceof Date) return dateLike.toISOString();
  return new Date(dateLike).toISOString();
}

export async function fetchActivePoll({ date } = {}) {
  const dateQuery = toDateQueryValue(date ?? new Date());
  const res = await api.get("/api/polls", { params: { date: dateQuery } });
  return normalizePoll(res?.data ?? null);
}

export async function voteForPoll(pollId, optionKey) {
  const id = String(pollId ?? "").trim();
  const key = String(optionKey ?? "").trim().toLowerCase();
  if (!id) throw new Error("Poll id is required");
  if (!key) throw new Error("Option key is required");
  const res = await api.post(`/api/polls/${id}/vote`, { optionKey: key });
  return normalizePoll(res?.data ?? null);
}
