"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type UniformItem = {
  id: number;
  name: string;
  variant: string;
  section: string;
  category: string;
  condition: string;
  quantity: number;
};
type UniformRequest = {
  id: number;
  member_id: number;
  member_name?: string;
  member_section?: string;
  squad?: string;
  item_id: number;
  item_name: string;
  variant: string;
  item_section: string;
  category: string;
  quantity: number;
  stock_quantity?: number;
  reason: string;
  notes: string;
  status: "pending" | "approved" | "ready" | "issued" | "rejected" | "cancelled";
  review_notes: string;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  issued_at: string | null;
  issued_by: string | null;
};
type RequestData = {
  member: { id: number; name: string; section: string; squad: string } | null;
  canManage: boolean;
  canViewAll: boolean;
  canRequest: boolean;
  items: UniformItem[];
  ownRequests: UniformRequest[];
  reviewRequests: UniformRequest[];
};

const statusLabels = {
  pending: "Pending review",
  approved: "Approved",
  ready: "Ready for collection",
  issued: "Issued",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export default function UniformRequests({
  userName,
  onBack,
  onLogout,
}: {
  userName: string;
  onBack: () => void;
  onLogout: () => void;
}) {
  const [data, setData] = useState<RequestData | null>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [reviewFilter, setReviewFilter] = useState("active");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/uniform-requests/", { cache: "no-store" });
    const result = (await response.json()) as RequestData & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load uniform requests");
    setData(result);
  }
  useEffect(() => {
    fetch("/api/uniform-requests/", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as RequestData & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load uniform requests");
        setData(result);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load uniform requests"));
  }, []);

  const itemGroups = useMemo(() => {
    const groups = new Map<string, UniformItem[]>();
    (data?.items ?? []).forEach((item) => {
      const label = `${item.section === "shared" ? "Shared" : item.section === "junior" ? "Junior" : "Senior"} · ${item.category}`;
      groups.set(label, [...(groups.get(label) ?? []), item]);
    });
    return [...groups.entries()];
  }, [data?.items]);
  const selectedItem = data?.items.find((item) => String(item.id) === selectedItemId);
  const reviewRequests = useMemo(() => {
    const requests = data?.reviewRequests ?? [];
    if (reviewFilter === "all") return requests;
    if (reviewFilter === "closed") return requests.filter((request) => ["issued", "rejected", "cancelled"].includes(request.status));
    return requests.filter((request) => ["pending", "approved", "ready"].includes(request.status));
  }, [data?.reviewRequests, reviewFilter]);

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/uniform-requests/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_request",
        itemId: form.get("itemId"),
        quantity: form.get("quantity"),
        reason: form.get("reason"),
        notes: form.get("notes"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to submit request");
    event.currentTarget.reset();
    setSelectedItemId("");
    await load();
    setNotice("Uniform request submitted successfully.");
  }

  async function cancelRequest(request: UniformRequest) {
    if (!window.confirm(`Cancel your request for ${request.item_name}?`)) return;
    const response = await fetch("/api/uniform-requests/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel_request", requestId: request.id }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setError(result.error ?? "Unable to cancel request");
    await load();
    setNotice("Uniform request cancelled.");
  }

  async function reviewRequest(request: UniformRequest, status: string, formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/uniform-requests/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "review_request",
        requestId: request.id,
        status,
        reviewNotes: form.get("reviewNotes"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to update request");
    await load();
    setNotice(
      status === "issued"
        ? "Uniform issued and stock balance updated."
        : `Request marked ${statusLabels[status as keyof typeof statusLabels].toLowerCase()}.`,
    );
  }

  return (
    <main className="uniform-request-shell">
      <header className="stock-topbar">
        <div className="resource-brand">
          <div className="brand-mark app-photo" role="img" aria-label="11th Kuching Company" />
          <div><strong>11KCHBB App</strong><span>Uniform Requests</span></div>
        </div>
        <div className="stock-user">
          <span><strong>{userName}</strong><small>Uniform request portal</small></span>
          <button onClick={onBack}>Back to app</button>
          <button onClick={onLogout}>Sign out</button>
        </div>
      </header>
      <section className="uniform-request-page">
        <div className="uniform-request-hero">
          <div><p className="eyebrow">UNIFORM STORE</p><h1>Uniform requests</h1><p>Request available uniform parts and follow every request through collection.</p></div>
          {data?.member && <div className="request-member-chip"><strong>{data.member.name}</strong><span>{data.member.section} · {data.member.squad}</span></div>}
        </div>
        {notice && <p className="form-success" role="status">{notice}</p>}
        {error && <p className="form-error">{error}</p>}
        {!data && !error && <p className="request-loading">Loading uniform requests…</p>}
        {data && (
          <>
            {data.member && data.canRequest ? (
              <section className="request-create-card">
                <div><p className="eyebrow">NEW REQUEST</p><h2>Request a uniform part</h2><p>Only currently available items for your section are shown.</p></div>
                <form onSubmit={createRequest}>
                  <label>Uniform part
                    <select name="itemId" required value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)}>
                      <option value="" disabled>Select an item</option>
                      {itemGroups.map(([label, items]) => <optgroup label={label} key={label}>{items.map((item) => <option value={item.id} key={item.id}>{item.name}{item.variant ? ` · ${item.variant}` : ""} · {item.quantity} available</option>)}</optgroup>)}
                    </select>
                  </label>
                  <div className="form-row">
                    <label>Quantity<input name="quantity" type="number" min="1" max={Math.min(10, Number(selectedItem?.quantity ?? 10))} defaultValue="1" required /></label>
                    <label>Reason<select name="reason" required defaultValue=""><option value="" disabled>Select a reason</option><option>First issue</option><option>Replacement due to size</option><option>Damaged or worn</option><option>Lost item</option><option>Additional set</option><option>Other</option></select></label>
                  </div>
                  <label>Additional notes (optional)<textarea name="notes" rows={3} placeholder="Explain the size, condition or any other detail" /></label>
                  <button className="primary" disabled={busy || !selectedItemId}>{busy ? "Submitting…" : "Submit request"}</button>
                </form>
              </section>
            ) : !data.canViewAll ? (
              <p className="form-error">Your account is not linked to a member profile, so you cannot submit a personal request.</p>
            ) : null}

            {data.member && data.canRequest && (
              <section className="my-uniform-requests">
                <div className="request-section-heading"><div><p className="eyebrow">MY REQUESTS</p><h2>Request history</h2></div><span>{data.ownRequests.length}</span></div>
                <div className="request-card-grid">
                  {data.ownRequests.map((request) => (
                    <article className="uniform-request-card" key={request.id}>
                      <div className="request-card-top"><span className={`request-status ${request.status}`}>{statusLabels[request.status]}</span><time>{new Date(request.submitted_at).toLocaleDateString("en-MY")}</time></div>
                      <h3>{request.item_name}{request.variant ? ` · ${request.variant}` : ""}</h3>
                      <p>{request.quantity} requested · {request.reason}</p>
                      {request.notes && <small>Your note: {request.notes}</small>}
                      {request.review_notes && <div className="request-review-note"><strong>Review note</strong><p>{request.review_notes}</p></div>}
                      {request.status === "pending" && <button className="danger-link" onClick={() => cancelRequest(request)}>Cancel request</button>}
                    </article>
                  ))}
                  {!data.ownRequests.length && <p className="empty-inline">You have not submitted any uniform requests.</p>}
                </div>
              </section>
            )}

            {data.canViewAll && (
              <section className="uniform-review-section">
                <div className="request-section-heading">
                  <div><p className="eyebrow">STOREKEEPER</p><h2>Review requests</h2></div>
                  <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)} aria-label="Filter uniform requests"><option value="active">Active requests</option><option value="closed">Closed requests</option><option value="all">All requests</option></select>
                </div>
                <div className="uniform-review-list">
                  {reviewRequests.map((request) => (
                    <article key={request.id}>
                      <div className="uniform-review-summary">
                        <span className={`request-status ${request.status}`}>{statusLabels[request.status]}</span>
                        <h3>{request.member_name}</h3>
                        <p>{request.member_section} · {request.squad}</p>
                        <strong>{request.item_name}{request.variant ? ` · ${request.variant}` : ""}</strong>
                        <small>{request.quantity} requested · {request.reason} · {request.stock_quantity ?? 0} currently available</small>
                        {request.notes && <blockquote>{request.notes}</blockquote>}
                      </div>
                      {data.canManage ? (
                      <form onSubmit={(event) => event.preventDefault()}>
                        <label>Review note (optional)<textarea name="reviewNotes" rows={2} defaultValue={request.review_notes} placeholder="Message shown to the member" /></label>
                        {request.status === "pending" && <div className="uniform-review-actions"><button className="approve" type="button" disabled={busy} onClick={(event) => reviewRequest(request, "approved", event.currentTarget.form!)}>Approve</button><button className="reject" type="button" disabled={busy} onClick={(event) => reviewRequest(request, "rejected", event.currentTarget.form!)}>Reject</button></div>}
                        {request.status === "approved" && <div className="uniform-review-actions"><button className="ready" type="button" disabled={busy} onClick={(event) => reviewRequest(request, "ready", event.currentTarget.form!)}>Ready for collection</button><button className="issue" type="button" disabled={busy} onClick={(event) => reviewRequest(request, "issued", event.currentTarget.form!)}>Mark issued</button></div>}
                        {request.status === "ready" && <div className="uniform-review-actions"><button className="issue" type="button" disabled={busy} onClick={(event) => reviewRequest(request, "issued", event.currentTarget.form!)}>Mark issued</button><button className="reject" type="button" disabled={busy} onClick={(event) => reviewRequest(request, "rejected", event.currentTarget.form!)}>Reject</button></div>}
                        {["issued", "rejected", "cancelled"].includes(request.status) && request.review_notes && <div className="request-review-note"><strong>Review note</strong><p>{request.review_notes}</p></div>}
                      </form>
                      ) : (
                        <div className="request-review-note">
                          <strong>Review details</strong>
                          <p>{request.review_notes || "No review note was added."}</p>
                        </div>
                      )}
                    </article>
                  ))}
                  {!reviewRequests.length && <p className="empty-inline">No requests in this view.</p>}
                </div>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}
