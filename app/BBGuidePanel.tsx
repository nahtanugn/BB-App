"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppRoute } from "./AppShell";

type GuideData = {
  language: "en" | "zh" | "ms";
  guide: {
    key: string;
    title: string;
    purpose: string;
    recommendation: string;
    steps: string[];
    targetRoute: AppRoute;
  };
  ui: Record<string, string>;
  accessSummary: string;
  completedStep: number;
  completedAt: string | null;
};

function recoveryMessage(message: string, language: "en" | "zh" | "ms") {
  const lower = message.toLowerCase();
  const key = lower.includes("sign in") || lower.includes("401")
    ? "auth"
    : lower.includes("permission") || lower.includes("forbidden") || lower.includes("403")
      ? "permission"
      : lower.includes("database") || lower.includes("d1") || lower.includes("sqlite")
        ? "database"
        : "retry";
  const messages = {
    en: {
      auth: "Your session has ended. Sign in again, then reopen Help me.",
      permission: "Your role does not permit this action. Ask an Officer or Administrator if your access should change.",
      database: "The company database is temporarily unavailable. Try again; an Administrator should check the D1 binding if it continues.",
      retry: "The guide could not complete that request. Check your connection and try again.",
    },
    zh: {
      auth: "您的登录已结束。请重新登录，再打开“帮助我”。",
      permission: "您的角色不允许此操作。如需更改权限，请联系军官或管理员。",
      database: "连队数据库暂时无法使用。请重试；若问题持续，管理员应检查 D1 绑定。",
      retry: "指南无法完成此请求。请检查网络后重试。",
    },
    ms: {
      auth: "Sesi anda telah tamat. Daftar masuk semula, kemudian buka Bantu saya.",
      permission: "Peranan anda tidak membenarkan tindakan ini. Hubungi Pegawai atau Pentadbir jika akses perlu diubah.",
      database: "Pangkalan data kompeni tidak tersedia buat sementara. Cuba lagi; Pentadbir perlu menyemak ikatan D1 jika masalah berterusan.",
      retry: "Panduan tidak dapat melengkapkan permintaan itu. Semak sambungan anda dan cuba lagi.",
    },
  } as const;
  return messages[language][key];
}

export default function BBGuidePanel({
  open,
  route,
  onClose,
  onNavigate,
  onTutorials,
}: {
  open: boolean;
  route: AppRoute;
  onClose: () => void;
  onNavigate: (route: AppRoute) => void;
  onTutorials: () => void;
}) {
  const [data, setData] = useState<GuideData | null>(null);
  const [language, setLanguage] = useState<"en" | "zh" | "ms">("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async (preferred?: "en" | "zh" | "ms") => {
    const params = new URLSearchParams({ route });
    if (preferred) params.set("language", preferred);
    const response = await fetch(`/api/help?${params}`, { cache: "no-store" });
    const result = await response.json() as GuideData & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to load BB Guide");
    setData(result);
    setLanguage(result.language);
  }, [route]);

  const post = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/help", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Unable to update BB Guide");
  }, []);

  const updateProgress = useCallback(async (step: number, automatic = false) => {
    if (!data || busy) return;
    setBusy(true); setError("");
    try {
      await post({ action: "complete_step", route, language, step });
      setNotice(automatic ? data.ui.success : "");
      await load(language);
    } catch (cause) {
      setError(recoveryMessage(cause instanceof Error ? cause.message : "retry", language));
    } finally { setBusy(false); }
  }, [busy, data, language, load, post, route]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setError("");
      setNotice("");
      void load().catch((cause) => setError(recoveryMessage(cause instanceof Error ? cause.message : "retry", language)));
      closeRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [language, load, open]);

  useEffect(() => {
    if (!open || !data || data.completedStep >= data.guide.steps.length) return;
    const observer = new MutationObserver((mutations) => {
      const confirmed = mutations.some((mutation) => [...mutation.addedNodes].some((node) => {
        if (!(node instanceof HTMLElement)) return false;
        if (node.closest(".bb-guide-panel")) return false;
        const success = node.matches(".form-success, .action-toast[role='status']")
          ? node
          : node.querySelector<HTMLElement>(".form-success, .action-toast[role='status']");
        return Boolean(success && !success.closest(".bb-guide-panel"));
      }));
      if (!confirmed) return;
      void updateProgress(Math.min(data.guide.steps.length, data.completedStep + 1), true);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [data, open, updateProgress]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onClose(); return; }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); previousFocusRef.current?.focus(); };
  }, [onClose, open]);

  async function chooseLanguage(next: "en" | "zh" | "ms") {
    setBusy(true); setError(""); setNotice("");
    try {
      await post({ action: "set_language", language: next });
      setLanguage(next);
      await load(next);
    } catch (cause) {
      setError(recoveryMessage(cause instanceof Error ? cause.message : "retry", next));
    } finally { setBusy(false); }
  }

  if (!open) return null;
  const ui = data?.ui ?? { label: "BB GUIDE", heading: "Help me", close: "Close BB Guide", language: "Guide language" };
  return (
    <div className="bb-guide-backdrop" role="presentation" onMouseDown={onClose}>
      <aside ref={panelRef} className="bb-guide-panel" role="dialog" aria-modal="true" aria-labelledby="bb-guide-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><p className="eyebrow">{ui.label}</p><h2 id="bb-guide-title">{ui.heading}</h2></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={ui.close}>×</button>
        </header>
        <div className="bb-guide-scroll">
          <label className="bb-guide-language"><span>{ui.language}</span><select value={language} disabled={busy} onChange={(event) => void chooseLanguage(event.target.value as "en" | "zh" | "ms")}><option value="en">English</option><option value="zh">中文</option><option value="ms">Bahasa Malaysia</option></select></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="form-success" role="status">{notice}</p>}
          {!data ? <div className="bb-guide-loading"><span /><p>Preparing your guide…</p></div> : <>
            <section className="bb-guide-intro"><p className="eyebrow">{ui.page}</p><h3>{data.guide.title}</h3><p>{data.guide.purpose}</p></section>
            <section className="bb-guide-access"><strong>{ui.access}</strong><p>{data.accessSummary}</p></section>
            <section className="bb-guide-recommendation"><strong>{ui.next}</strong><p>{data.guide.recommendation}</p>{data.guide.targetRoute !== route && <button type="button" className="secondary-button" onClick={() => { onNavigate(data.guide.targetRoute); }}>{ui.open}</button>}</section>
            <section className="bb-guide-steps">
              <div className="bb-guide-progress"><div><strong>{ui.steps}</strong><span>{data.completedStep}/{data.guide.steps.length}</span></div><progress max={data.guide.steps.length} value={data.completedStep} aria-label={ui.progress} /></div>
              <ol>{data.guide.steps.map((step, index) => { const done = index < data.completedStep; const current = index === data.completedStep; return <li className={done ? "done" : current ? "current" : ""} key={step}><span>{done ? "✓" : index + 1}</span><div><p>{step}</p>{current && <button type="button" disabled={busy} onClick={() => void updateProgress(index + 1)}>{ui.complete}</button>}{done && <small>{ui.done}</small>}</div></li>; })}</ol>
            </section>
            <button type="button" className="bb-guide-tutorials" onClick={onTutorials}>{ui.tutorials}<span>›</span></button>
          </>}
        </div>
      </aside>
    </div>
  );
}
