import React, { useState, useEffect } from "react";
import { BrandingProvider } from "./contexts/BrandingContext";
import { Routes, Route, Navigate } from "react-router-dom";
import { Menu } from "lucide-react";
import axios from "axios";
import { Sidebar } from "./components/Sidebar";
import { Toast } from "./components/Toast";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { GlobalSearch } from "./components/GlobalSearch";
import { getToken } from "./lib/auth";
import LoginPage from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { ProjectDetail } from "./pages/ProjectDetail";
import { ScriptOutput } from "./pages/ScriptOutput";
import { BillingDashboard } from "./pages/billing/BillingDashboard";
import { BillingCustomers } from "./pages/billing/BillingCustomers";
import { BillingPlans } from "./pages/billing/BillingPlans";
import { BillingSubscriptions } from "./pages/billing/BillingSubscriptions";
import { BillingReconcile } from "./pages/billing/BillingReconcile";
import { BillingInvoices } from "./pages/billing/BillingInvoices";
import { BillingPayments } from "./pages/billing/BillingPayments";
import { BillingCustomerDetail } from "./pages/billing/BillingCustomerDetail";
import { PaymentPage } from "./pages/billing/PaymentPage";
import { SMSPage } from "./pages/billing/SMSPage";
import { MonitoringDashboard } from "./pages/billing/MonitoringDashboard";
import { AgentResellerPage } from "./pages/billing/AgentResellerPage";
import { AutoSuspendPage } from "./pages/billing/AutoSuspendPage";
import { CustomerPortal } from "./pages/billing/EnhancedCustomerPortal";
import { ReviewsManagement } from "./pages/billing/ReviewsManagement";
import { FinancialReports } from "./pages/billing/FinancialReports";
import { WhatsAppPage } from "./pages/billing/WhatsAppPage";
import MessagingPage from "./pages/billing/MessagingPage";
import { MapView } from "./pages/billing/MapView";
import { WalletPage } from "./pages/billing/WalletPage";
import MergeCustomers from "./pages/MergeCustomers";
import { MpesaReconcile } from "./pages/MpesaReconcile";
import { BackupPage } from "./pages/billing/BackupPage";
import CreditNotes from "./pages/billing/CreditNotes";
import { InventoryPage } from "./pages/billing/InventoryPage";
import { AnalyticsReports } from "./pages/billing/AnalyticsReports";
import { PPPoEManagement } from "./pages/billing/PPPoEManagement";
import { HotspotManagement } from "./pages/billing/HotspotManagement";
import { HotspotVouchers } from "./pages/billing/HotspotVouchers";
import { NetworkServices } from "./pages/billing/NetworkServices";
import { RadiusManagement } from "./pages/billing/RadiusManagement";
import { RadiusImport } from "./pages/RadiusImport";
import { TicketSystem } from "./pages/billing/TicketSystem";
import { CaptivePortalBuilder } from "./pages/billing/CaptivePortalBuilder";
import { BandwidthGraphs } from "./pages/billing/BandwidthGraphs";
import { ResellerPortal } from "./pages/billing/ResellerPortal";
import { OLTManagement } from "./pages/billing/OLTManagement";
import SetupWizard from "./pages/SetupWizard";
import { UserManagement } from "./pages/UserManagement";
import IntegrationsSettings from "./pages/IntegrationsSettings";
import { SettingsPage } from "./pages/SettingsPage";
import RouterLink from "./pages/RouterLink";
import RoutersPage from "./pages/RoutersPage";
import TenantSettingsPage from "./pages/TenantSettingsPage";
import { AuditLogs } from "./pages/AuditLogs";
import WebhooksPage from "./pages/WebhooksPage";
import { FUPProfiles } from "./pages/network/FUPProfiles";
import { TR069Devices } from "./pages/network/TR069Devices";
import { SpeedTest } from "./pages/network/SpeedTest";
import IPAMPage from "./pages/IPAMPage";
// import { Alerts } from './pages/network/Alerts';
// import { Monitoring } from './pages/network/Monitoring';
import { SignupPage } from "./pages/public/SignupPage";
import { PlansPage } from "./pages/public/PlansPage";
import { CheckoutPage } from "./pages/public/CheckoutPage";
import { WelcomePage } from "./pages/public/WelcomePage";
import CustomerPortalLogin from "./pages/CustomerPortalLogin";

function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Heartbeat to keep user online status updated
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const sendHeartbeat = async () => {
      try {
        const API = import.meta.env.VITE_API_URL || "/api";
        await axios.post(
          `${API}/auth/heartbeat`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } catch (e) {
        // Silently fail - don't spam errors
      }
    };

    // Send heartbeat every 30 seconds
    const interval = setInterval(sendHeartbeat, 30000);

    // Send initial heartbeat
    sendHeartbeat();

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <BrandingProvider>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupWizard />} />

        {/* Customer portal - public (different UI) */}
        <Route path="/portal/login" element={<CustomerPortalLogin />} />
        <Route path="/portal/:customerId" element={<CustomerPortal />} />
        <Route path="/pay/:invoiceId" element={<PaymentPage />} />

        {/* Self-provisioning portal */}
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/checkout/:invoiceId" element={<CheckoutPage />} />
        <Route path="/welcome" element={<WelcomePage />} />

        {/* Protected routes - require authentication */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="flex h-screen bg-background">
                {/* Mobile overlay */}
                {mobileMenuOpen && (
                  <div
                    className="fixed inset-0 bg-black/60 z-20 lg:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                  />
                )}

                {/* Sidebar - hidden on mobile by default, shown when toggled */}
                <div
                  className={`
                    fixed lg:static inset-y-0 left-0 z-30
                    transform transition-transform duration-300
                    ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
                    lg:translate-x-0
                  `}
                >
                  <Sidebar
                    onSearchOpen={() => setSearchOpen(true)}
                    onCloseMobile={() => setMobileMenuOpen(false)}
                  />
                </div>

                {/* Main content */}
                <main className="flex-1 overflow-auto">
                  {/* Mobile header bar */}
                  <div className="lg:hidden flex items-center justify-between p-4 border-b border-zinc-800/50">
                    <button
                      onClick={() => setMobileMenuOpen(true)}
                      className="text-zinc-400 p-3 -m-1"
                    >
                      <Menu className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-semibold text-white">
                      MTK Billing
                    </span>
                    <div className="w-5" /> {/* spacer */}
                  </div>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/project/:id" element={<ProjectDetail />} />
                    <Route path="/output" element={<ScriptOutput />} />

                    {/* Billing */}
                    <Route path="/billing" element={<BillingDashboard />} />
                    <Route
                      path="/billing-customers"
                      element={<BillingCustomers />}
                    />
                    <Route
                      path="/billing-customers/:id"
                      element={<BillingCustomerDetail />}
                    />
                    <Route path="/billing-plans" element={<BillingPlans />} />
                    <Route
                      path="/billing-subscriptions"
                      element={<BillingSubscriptions />}
                    />
                    <Route
                      path="/billing-reconcile"
                      element={<BillingReconcile />}
                    />
                    <Route
                      path="/billing-invoices"
                      element={<BillingInvoices />}
                    />
                    <Route
                      path="/billing-payments"
                      element={<BillingPayments />}
                    />
                    <Route path="/billing-sms" element={<SMSPage />} />
                    <Route path="/billing-whatsapp" element={<WhatsAppPage />} />
                    <Route path="/billing-messaging" element={<MessagingPage />} />
                    <Route path="/billing-map" element={<MapView />} />
                    <Route path="/billing-wallet" element={<WalletPage />} />
                    <Route
                      path="/merge-customers"
                      element={<MergeCustomers />}
                    />
                    <Route
                      path="/mpesa-reconcile"
                      element={
                        <ProtectedRoute feature="mpesa-reconcile">
                          <MpesaReconcile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/billing-monitoring"
                      element={<MonitoringDashboard />}
                    />
                    <Route
                      path="/billing-agents"
                      element={<AgentResellerPage />}
                    />
                    <Route
                      path="/billing-auto-suspend"
                      element={<AutoSuspendPage />}
                    />
                    <Route
                      path="/billing-reviews"
                      element={<ReviewsManagement />}
                    />
                    <Route
                      path="/billing-reports"
                      element={<FinancialReports />}
                    />
                    <Route path="/billing-backup" element={<BackupPage />} />
                    <Route path="/credit-notes" element={<CreditNotes />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/analytics" element={<AnalyticsReports />} />
                    <Route path="/pppoe" element={<PPPoEManagement />} />
                    <Route path="/hotspot" element={<HotspotManagement />} />
                    <Route
                      path="/hotspot-vouchers"
                      element={<HotspotVouchers />}
                    />
                    <Route
                      path="/network-services"
                      element={<NetworkServices />}
                    />
                    <Route path="/olt" element={<OLTManagement />} />
                    <Route path="/fup" element={<FUPProfiles />} />
                    <Route path="/tr069" element={<TR069Devices />} />
                    <Route path="/speedtest" element={<SpeedTest />} />
                    <Route path="/ipam" element={<IPAMPage />} />
                    {/* <Route path="/alerts" element={<Alerts />} /> */}
                    {/* <Route path="/monitoring" element={<Monitoring />} /> */}
                    <Route path="/radius" element={<RadiusManagement />} />
                    <Route path="/radius-import" element={<RadiusImport />} />
                    <Route path="/tickets" element={<TicketSystem />} />
                    <Route
                      path="/captive-portal"
                      element={<CaptivePortalBuilder />}
                    />
                    <Route path="/bandwidth" element={<BandwidthGraphs />} />
                    <Route path="/resellers" element={<ResellerPortal />} />
                    <Route
                      path="/users"
                      element={
                        <ProtectedRoute feature="users">
                          <UserManagement />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/integrations"
                      element={<IntegrationsSettings />}
                    />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/routers" element={<RoutersPage />} />
                    <Route path="/router-link" element={<RoutersPage />} />
                    <Route path="/tenant-branding" element={<TenantSettingsPage />} />
                    <Route path="/audit-logs" element={<AuditLogs />} />
                    <Route path="/webhooks" element={<WebhooksPage />} />

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
                <Toast />
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </BrandingProvider>
  );
}

export default App;
