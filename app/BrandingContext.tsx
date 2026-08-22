"use client";

import { createContext, type CSSProperties, type ReactNode, useContext, useEffect, useState } from "react";

export type Branding = { appName: string; shortName: string; companyName: string; subtitle: string; logoUrl: string; updatedAt: string };
export const defaultBranding: Branding = { appName: "BB Company App", shortName: "BB App", companyName: "Your BB Company", subtitle: "BB Section Tracker", logoUrl: "/default-app-logo.svg", updatedAt: "" };
const BrandingContext = createContext(defaultBranding);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState(defaultBranding);
  useEffect(() => {
    const load = () => void fetch("/api/branding", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<Branding> : Promise.reject())
      .then((value) => { setBranding(value); document.title = `${value.appName} · ${value.subtitle}`; })
      .catch(() => undefined);
    load(); window.addEventListener("app-branding-updated", load);
    return () => window.removeEventListener("app-branding-updated", load);
  }, []);
  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useBranding() { return useContext(BrandingContext); }
export function brandingLogoStyle(branding: Branding): CSSProperties { return { backgroundImage: `url("${branding.logoUrl.replaceAll('"', '%22')}")` }; }
