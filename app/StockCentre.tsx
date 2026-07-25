"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type StockItem = {
  id: number;
  name: string;
  stock_type: "uniform" | "award";
  section: "senior" | "junior" | "shared";
  category: string;
  variant: string;
  condition: "current" | "old" | "defective";
  reorder_level: number;
  notes: string;
  quantity: number;
};
type StockTransaction = {
  id: number;
  transaction_type: string;
  quantity_delta: number;
  item_name: string;
  variant: string;
  condition: string;
  member_name: string | null;
  notes: string;
  created_by_name: string;
  created_at: string;
};
type MemberOption = { id: number; name: string; section: string; squad: string };
type StockData = {
  permissions: string[];
  items: StockItem[];
  transactions: StockTransaction[];
  members: MemberOption[];
};

export default function StockCentre({
  userName,
  onBack,
  onLogout,
}: {
  userName: string;
  onBack: () => void;
  onLogout: () => void;
}) {
  const [data, setData] = useState<StockData | null>(null);
  const [tab, setTab] = useState<"overview" | "uniform" | "award" | "history">("overview");
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("all");
  const [condition, setCondition] = useState("all");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<StockItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/stock", { cache: "no-store" });
    const result = (await response.json()) as StockData & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load stock");
    setData(result);
  }

  useEffect(() => {
    fetch("/api/stock", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as StockData & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load stock");
        setData(result);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Unable to load stock"),
      );
  }, []);

  const canViewUniform = data?.permissions.includes("stock.view_uniform");
  const canViewAwards = data?.permissions.includes("stock.view_awards");
  const canAdjust = data?.permissions.includes("stock.adjust");
  const visibleItems = useMemo(() => {
    if (!data) return [];
    const term = query.trim().toLowerCase();
    return data.items.filter((item) => {
      if (tab === "uniform" && item.stock_type !== "uniform") return false;
      if (tab === "award" && item.stock_type !== "award") return false;
      if (section !== "all" && item.section !== section) return false;
      if (condition !== "all" && item.condition !== condition) return false;
      if (category !== "all" && item.category !== category) return false;
      return !term || `${item.name} ${item.variant} ${item.category}`.toLowerCase().includes(term);
    });
  }, [category, condition, data, query, section, tab]);
  const categoryOptions = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.items
      .filter((item) => {
        if (tab === "award" && item.stock_type !== "award") return false;
        if (tab === "uniform" && item.stock_type !== "uniform") return false;
        return section === "all" || item.section === section;
      })
      .map((item) => item.category))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [data, section, tab]);
  const categorisedGroups = useMemo(() => {
    if (!["award", "uniform"].includes(tab)) return [];
    const groups = new Map<string, StockItem[]>();
    visibleItems.forEach((item) => {
      const key = `${item.section}::${item.category}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });
    const sectionOrder = { senior: 0, junior: 1, shared: 2 };
    return [...groups.entries()]
      .map(([key, items]) => {
        const [groupSection, groupCategory] = key.split("::");
        return { section: groupSection, category: groupCategory, items };
      })
      .sort((a, b) =>
        (sectionOrder[a.section as keyof typeof sectionOrder] ?? 9) -
          (sectionOrder[b.section as keyof typeof sectionOrder] ?? 9) ||
        a.category.localeCompare(b.category),
      );
  }, [tab, visibleItems]);
  const summary = useMemo(() => {
    const items = data?.items ?? [];
    return {
      units: items.reduce((sum, item) => sum + Number(item.quantity), 0),
      low: items.filter((item) => item.condition !== "defective" && Number(item.quantity) <= Number(item.reorder_level)).length,
      defective: items.filter((item) => item.condition === "defective").reduce((sum, item) => sum + Number(item.quantity), 0),
      issued: (data?.transactions ?? []).filter((row) => row.transaction_type === "issued").reduce((sum, row) => sum + Math.abs(Number(row.quantity_delta)), 0),
    };
  }, [data]);

  async function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    const transactionType = String(form.get("transactionType"));
    const response = await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "transaction",
        itemId: selected.id,
        transactionType,
        quantity: form.get("quantity"),
        quantityDelta: form.get("quantityDelta"),
        memberId: form.get("memberId"),
        notes: form.get("notes"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to save transaction");
    setSelected(null);
    await load();
    setNotice(`${selected.name} updated successfully.`);
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    const response = await fetch("/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_item",
        stockType: form.get("stockType"),
        name: form.get("name"),
        section: form.get("section"),
        category: form.get("category"),
        variant: form.get("variant"),
        condition: form.get("condition"),
        quantity: form.get("quantity"),
        reorderLevel: form.get("reorderLevel"),
        notes: form.get("notes"),
      }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to add item");
    setShowAdd(false);
    await load();
    setNotice("Stock item created successfully.");
  }

  if (!data && !error)
    return <main className="stock-loading"><div className="brand-mark app-photo" /><p>Opening Stock Centre…</p></main>;

  return (
    <main className="stock-shell">
      <header className="stock-topbar">
        <div className="resource-brand">
          <div className="brand-mark app-photo" role="img" aria-label="11th Kuching Company" />
          <div><strong>11KCHBB App</strong><span>Stock Centre</span></div>
        </div>
        <div className="stock-user">
          <span><strong>{userName}</strong><small>Authorised stock access</small></span>
          <button onClick={onBack}>Back to app</button>
          <button onClick={onLogout}>Sign out</button>
        </div>
      </header>
      <section className="stock-page">
        <div className="stock-heading">
          <div><p className="eyebrow">COMPANY INVENTORY</p><h1>Stock Centre</h1><p>Uniform and award balances, issues and returns in one auditable place.</p></div>
          {canAdjust && <button className="primary" onClick={() => setShowAdd(true)}>+ Add stock item</button>}
        </div>
        {notice && <p className="form-success" role="status">{notice}</p>}
        {error && <p className="form-error">{error}</p>}
        {data && (
          <>
            <div className="stock-summary">
              <article><span>Total on hand</span><strong>{summary.units}</strong><small>across visible stock</small></article>
              <article><span>At reorder level</span><strong>{summary.low}</strong><small>items need attention</small></article>
              <article><span>Defective</span><strong>{summary.defective}</strong><small>visible, not issuable</small></article>
              <article><span>Issued records</span><strong>{summary.issued}</strong><small>units in recent history</small></article>
            </div>
            <div className="stock-tabs" role="tablist">
              <button className={tab === "overview" ? "active" : ""} onClick={() => { setTab("overview"); setCategory("all"); }}>All stock</button>
              {canViewUniform && <button className={tab === "uniform" ? "active" : ""} onClick={() => { setTab("uniform"); setCategory("all"); }}>Uniforms</button>}
              {canViewAwards && <button className={tab === "award" ? "active" : ""} onClick={() => { setTab("award"); setCategory("all"); }}>Awards</button>}
              {data.permissions.includes("stock.view_history") && <button className={tab === "history" ? "active" : ""} onClick={() => { setTab("history"); setCategory("all"); }}>History</button>}
            </div>
            {tab === "history" ? (
              <div className="stock-history">
                {data.transactions.map((row) => (
                  <article key={row.id}>
                    <span className={`stock-delta ${row.quantity_delta < 0 ? "negative" : ""}`}>{row.quantity_delta > 0 ? "+" : ""}{row.quantity_delta}</span>
                    <div><strong>{row.item_name}{row.variant ? ` · ${row.variant}` : ""}</strong><small>{row.transaction_type.replaceAll("_", " ")}{row.member_name ? ` · ${row.member_name}` : ""}</small>{row.notes && <p>{row.notes}</p>}</div>
                    <time>{new Date(row.created_at).toLocaleString("en-MY")}<small>{row.created_by_name}</small></time>
                  </article>
                ))}
              </div>
            ) : (
              <>
                <div className="stock-filters stock-filters-categorised">
                  <label className="stock-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stock" /></label>
                  <select value={section} onChange={(event) => { setSection(event.target.value); setCategory("all"); }} aria-label="Filter by section"><option value="all">All sections</option><option value="senior">Senior Section</option><option value="junior">Junior Section</option><option value="shared">Shared</option></select>
                  <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category"><option value="all">All categories</option>{categoryOptions.map((option) => <option value={option} key={option}>{option}</option>)}</select>
                  <select value={condition} onChange={(event) => setCondition(event.target.value)} aria-label="Filter by condition"><option value="all">All conditions</option><option value="current">Current</option><option value="old">Old · usable</option><option value="defective">Defective</option></select>
                </div>
                {["award", "uniform"].includes(tab) ? (
                  <div className="award-stock-groups">
                    {categorisedGroups.map((group, index) => (
                      <section className="award-stock-group" key={`${group.section}-${group.category}`}>
                        {(index === 0 || categorisedGroups[index - 1]?.section !== group.section) && (
                          <div className="award-section-heading">
                            <p className="eyebrow">{group.section.toUpperCase()} SECTION</p>
                            <h2>
                              {group.section === "shared"
                                ? `Shared ${tab === "uniform" ? "Uniform" : "Award"} Stock`
                                : `${group.section === "junior" ? "Junior" : "Senior"} Section ${tab === "uniform" ? "Uniform" : "Awards"}`}
                            </h2>
                          </div>
                        )}
                        <div className="award-category-heading">
                          <h3>{group.category}</h3>
                          <span>{group.items.length} stock {group.items.length === 1 ? "entry" : "entries"}</span>
                        </div>
                        <div className="stock-grid">
                          {group.items.map((item) => {
                            const canManage = data.permissions.includes(tab === "award" ? "stock.manage_awards" : "stock.manage_uniform") || canAdjust;
                            const canIssue = data.permissions.includes(tab === "award" ? "stock.issue_awards" : "stock.issue_uniform");
                            return (
                              <article className={`stock-card ${item.condition}`} key={item.id}>
                                <div className="stock-card-top"><span>{item.stock_type}</span><b>{item.section}</b></div>
                                <h3>{item.name}</h3>
                                <p>{[item.variant, item.category].filter(Boolean).join(" · ")}</p>
                                <div className="stock-balance"><strong>{item.quantity}</strong><span>on hand</span></div>
                                <div className="stock-card-footer">
                                  <span className={`condition-pill ${item.condition}`}>{item.condition === "old" ? "Old · usable" : item.condition}</span>
                                  {(canManage || canIssue) && <button onClick={() => setSelected(item)}>Update</button>}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                    {!categorisedGroups.length && <p className="empty-inline">No {tab} stock matches these filters.</p>}
                  </div>
                ) : (
                  <div className="stock-grid">
                    {visibleItems.map((item) => {
                    const canManage = data.permissions.includes(item.stock_type === "award" ? "stock.manage_awards" : "stock.manage_uniform") || canAdjust;
                    const canIssue = data.permissions.includes(item.stock_type === "award" ? "stock.issue_awards" : "stock.issue_uniform");
                    return (
                      <article className={`stock-card ${item.condition}`} key={item.id}>
                        <div className="stock-card-top"><span>{item.stock_type}</span><b>{item.section}</b></div>
                        <h3>{item.name}</h3>
                        <p>{[item.variant, item.category].filter(Boolean).join(" · ")}</p>
                        <div className="stock-balance"><strong>{item.quantity}</strong><span>on hand</span></div>
                        <div className="stock-card-footer">
                          <span className={`condition-pill ${item.condition}`}>{item.condition === "old" ? "Old · usable" : item.condition}</span>
                          {(canManage || canIssue) && <button onClick={() => setSelected(item)}>Update</button>}
                        </div>
                      </article>
                    );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      {selected && data && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <section className="modal stock-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><p className="eyebrow">STOCK TRANSACTION</p><h2>{selected.name}</h2><small>{selected.quantity} currently on hand</small></div><button onClick={() => setSelected(null)} aria-label="Close">×</button></div>
            <form onSubmit={submitTransaction}>
              <label>Action<select name="transactionType" required defaultValue={selected.condition === "defective" ? "repaired" : "issued"}>
                {selected.condition !== "defective" && <option value="issued">Issue stock</option>}
                <option value="received">Receive stock</option><option value="returned">Return stock</option>
                {selected.condition !== "defective" && <option value="damaged">Move to defective stock</option>}
                {selected.condition === "defective" && <option value="repaired">Return repaired stock to usable</option>}
                <option value="written_off">Write off stock</option>
              </select></label>
              <label>Quantity<input name="quantity" type="number" min="1" step="1" defaultValue="1" required /></label>
              <label>Link to member (optional)<select name="memberId" defaultValue=""><option value="">No member selected</option>{data.members.map((member) => <option value={member.id} key={member.id}>{member.name} · {member.section} · {member.squad}</option>)}</select></label>
              <label>Notes<textarea name="notes" rows={3} placeholder="Reason, condition or other reference" /></label>
              <button className="primary" disabled={busy}>{busy ? "Saving…" : "Save transaction"}</button>
            </form>
          </section>
        </div>
      )}

      {showAdd && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowAdd(false)}>
          <section className="modal stock-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><p className="eyebrow">CATALOGUE</p><h2>Add stock item</h2></div><button onClick={() => setShowAdd(false)} aria-label="Close">×</button></div>
            <form onSubmit={createItem}>
              <div className="form-row"><label>Stock type<select name="stockType"><option value="uniform">Uniform</option><option value="award">Award</option></select></label><label>Section<select name="section"><option value="shared">Shared</option><option value="senior">Senior</option><option value="junior">Junior</option></select></label></div>
              <label>Item name<input name="name" required /></label>
              <div className="form-row"><label>Category<input name="category" /></label><label>Size or variant<input name="variant" /></label></div>
              <div className="form-row"><label>Condition<select name="condition"><option value="current">Current</option><option value="old">Old · usable</option><option value="defective">Defective</option></select></label><label>Opening quantity<input name="quantity" type="number" min="0" defaultValue="0" /></label></div>
              <label>Reorder level<input name="reorderLevel" type="number" min="0" defaultValue="0" /></label>
              <label>Notes<textarea name="notes" rows={2} /></label>
              <button className="primary" disabled={busy}>{busy ? "Creating…" : "Create item"}</button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
