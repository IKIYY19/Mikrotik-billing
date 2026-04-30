import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "/api";

const defaults = {
  company_name: "",
  company_logo: "",
  primary_color: "#3b82f6",
  secondary_color: "#1e293b",
  branding_title: "",
};

const BrandingContext = createContext(defaults);

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(defaults);

  useEffect(() => {
    axios
      .get(`${API}/settings`)
      .then(({ data }) => {
        setBranding({
          company_name: data.company_name || "",
          company_logo: data.company_logo || "",
          primary_color: data.primary_color || "#3b82f6",
          secondary_color: data.secondary_color || "#1e293b",
          branding_title: data.branding_title || "",
        });
      })
      .catch(() => {});
  }, []);

  const appName = branding.branding_title || branding.company_name || "MikroTik Billing";

  // Apply primary color as CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty("--brand-primary", branding.primary_color);
    document.documentElement.style.setProperty("--brand-secondary", branding.secondary_color);
  }, [branding.primary_color, branding.secondary_color]);

  return (
    <BrandingContext.Provider value={{ ...branding, appName }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
