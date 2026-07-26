"use client";

import type { ReactNode } from "react";

type NavigationAction = {
  label: string;
  onClick: () => void;
  badge?: number;
};

export default function AppNavigation({
  section,
  userName,
  userDescription,
  onBack,
  onLogout,
  backLabel = "Back to app",
  actions = [],
  children,
}: {
  section: string;
  userName: string;
  userDescription: string;
  onBack?: () => void;
  onLogout: () => void;
  backLabel?: string;
  actions?: NavigationAction[];
  children?: ReactNode;
}) {
  const controls = (
    <>
      {actions.map((action) => (
        <button type="button" onClick={action.onClick} key={action.label}>
          {action.label}
          {Boolean(action.badge) && (
            <span className="app-navigation-badge">{action.badge}</span>
          )}
        </button>
      ))}
      {children}
      {onBack && (
        <button type="button" onClick={onBack}>
          {backLabel}
        </button>
      )}
      <button type="button" className="sign-out" onClick={onLogout}>
        Sign out
      </button>
    </>
  );

  return (
    <header className="app-navigation">
      <div className="app-navigation-brand">
        <div
          className="brand-mark app-photo"
          role="img"
          aria-label="11th Kuching Company"
        />
        <div>
          <strong>11KCHBB App</strong>
          <span>{section}</span>
        </div>
      </div>

      <div className="app-navigation-desktop">
        <div className="app-navigation-user">
          <strong>{userName}</strong>
          <small>{userDescription}</small>
        </div>
        <nav aria-label={`${section} navigation`}>{controls}</nav>
      </div>

      <details className="app-navigation-mobile">
        <summary aria-label={`Open ${section} navigation`}>Menu</summary>
        <div>
          <p>
            <strong>{userName}</strong>
            <small>{userDescription}</small>
          </p>
          <nav aria-label={`${section} mobile navigation`}>{controls}</nav>
        </div>
      </details>
    </header>
  );
}
