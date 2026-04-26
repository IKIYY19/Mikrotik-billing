import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { GlobalSearch } from './components/GlobalSearch';
import { getToken } from './lib/auth';
import LoginPage from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { ProjectDetail } from './pages/ProjectDetail';
import { Templates } from './pages/Templates';
import { MikroTikAPI } from './pages/MikroTikAPI';
import { ScriptOutput } from './pages/ScriptOutput';
import { TopologyBuilder } from './pages/TopologyBuilder';
import { RouterLinking } from './pages/RouterLinking';
import { Devices } from './pages/Devices';
import { BillingDashboard } from './pages/billing/BillingDashboard';
import { BillingCustomers } from './pages/billing/BillingCustomers';
import { BillingPlans } from './pages/billing/BillingPlans';
import { BillingSubscriptions } from './pages/billing/BillingSubscriptions';
import { BillingInvoices } from './pages/billing/BillingInvoices';
import { BillingPayments } from './pages/billing/BillingPayments';
import { BillingCustomerDetail } from './pages/billing/BillingCustomerDetail';
import { PaymentPage } from './pages/billing/PaymentPage';
import { SMSPage } from './pages/billing/SMSPage';
import { MonitoringDashboard } from './pages/billing/MonitoringDashboard';
import { AgentResellerPage } from './pages/billing/AgentResellerPage';
import { AutoSuspendPage } from './pages/billing/AutoSuspendPage';
import { CustomerPortal } from './pages/billing/EnhancedCustomerPortal';
import { FinancialReports } from './pages/billing/FinancialReports';
import { WhatsAppPage } from './pages/billing/WhatsAppPage';
import { MapView } from './pages/billing/MapView';
import { WalletPage } from './pages/billing/WalletPage';
import { BackupPage } from './pages/billing/BackupPage';
import { InventoryPage } from './pages/billing/InventoryPage';
import { AnalyticsReports } from './pages/billing/AnalyticsReports';
import { PPPoEManagement } from './pages/billing/PPPoEManagement';
import { HotspotManagement } from './pages/billing/HotspotManagement';
import { HotspotVouchers } from './pages/billing/HotspotVouchers';
import { NetworkServices } from './pages/billing/NetworkServices';
import { RadiusManagement } from './pages/billing/RadiusManagement';
import { TicketSystem } from './pages/billing/TicketSystem';
import { CaptivePortalBuilder } from './pages/billing/CaptivePortalBuilder';
import { BandwidthGraphs } from './pages/billing/BandwidthGraphs';
import { ResellerPortal } from './pages/billing/ResellerPortal';
import { OLTManagement } from './pages/billing/OLTManagement';
import SetupWizard from './pages/SetupWizard';
import { UserManagement } from './pages/UserManagement';
import IntegrationsSettings from './pages/IntegrationsSettings';
import { SettingsPage } from './pages/SettingsPage';
import { FUPProfiles } from './pages/network/FUPProfiles';
import { TR069Devices } from './pages/network/TR069Devices';
import { SpeedTest } from './pages/network/SpeedTest';
import { Alerts } from './pages/network/Alerts';
// import { Monitoring } from './pages/network/Monitoring';

function App() {
  const [searchOpen, setSearchOpen] = useState(false);

  // Heartbeat to keep user online status updated
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const sendHeartbeat = async () => {
      try {
        const API = import.meta.env.VITE_API_URL || '/api';
        await axios.post(`${API}/users/heartbeat`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupWizard />} />

        {/* Customer portal - public (different UI) */}
        <Route path="/portal/:customerId" element={<CustomerPortal />} />
        <Route path="/pay/:invoiceId" element={<PaymentPage />} />

        {/* Protected routes - require authentication */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="flex h-screen bg-[#0f1117]">
                <Sidebar onSearchOpen={() => setSearchOpen(true)} />
                <main className="flex-1 overflow-auto">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/project/:id" element={<ProjectDetail />} />
                    <Route path="/topology" element={<TopologyBuilder />} />
                    <Route path="/router-linking" element={<RouterLinking />} />
                    <Route path="/devices" element={<Devices />} />
                    <Route path="/templates" element={<Templates />} />
                    <Route path="/mikrotik-api" element={<MikroTikAPI />} />
                    <Route path="/output" element={<ScriptOutput />} />

                    {/* Billing */}
                    <Route path="/billing" element={<BillingDashboard />} />
                    <Route path="/billing-customers" element={<BillingCustomers />} />
                    <Route path="/billing-customers/:id" element={<BillingCustomerDetail />} />
                    <Route path="/billing-plans" element={<BillingPlans />} />
                    <Route path="/billing-subscriptions" element={<BillingSubscriptions />} />
                    <Route path="/billing-invoices" element={<BillingInvoices />} />
                    <Route path="/billing-payments" element={<BillingPayments />} />
                    <Route path="/billing-sms" element={<SMSPage />} />
                    <Route path="/billing-whatsapp" element={<WhatsAppPage />} />
                    <Route path="/billing-map" element={<MapView />} />
                    <Route path="/billing-wallet" element={<WalletPage />} />
                    <Route path="/billing-monitoring" element={<MonitoringDashboard />} />
                    <Route path="/billing-agents" element={<AgentResellerPage />} />
                    <Route path="/billing-auto-suspend" element={<AutoSuspendPage />} />
                    <Route path="/billing-reports" element={<FinancialReports />} />
                    <Route path="/billing-backup" element={<BackupPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/analytics" element={<AnalyticsReports />} />
                    <Route path="/pppoe" element={<PPPoEManagement />} />
                    <Route path="/hotspot" element={<HotspotManagement />} />
                    <Route path="/hotspot-vouchers" element={<HotspotVouchers />} />
                    <Route path="/network-services" element={<NetworkServices />} />
                    <Route path="/olt" element={<OLTManagement />} />
                    <Route path="/fup" element={<FUPProfiles />} />
                    <Route path="/tr069" element={<TR069Devices />} />
                    <Route path="/speedtest" element={<SpeedTest />} />
                    <Route path="/alerts" element={<Alerts />} />
                    {/* <Route path="/monitoring" element={<Monitoring />} /> */}
                    <Route path="/radius" element={<RadiusManagement />} />
                    <Route path="/tickets" element={<TicketSystem />} />
                    <Route path="/captive-portal" element={<CaptivePortalBuilder />} />
                    <Route path="/bandwidth" element={<BandwidthGraphs />} />
                    <Route path="/resellers" element={<ResellerPortal />} />
                    <Route path="/users" element={<ProtectedRoute feature="users"><UserManagement /></ProtectedRoute>} />
                    <Route path="/integrations" element={<IntegrationsSettings />} />
                    <Route path="/settings" element={<SettingsPage />} />

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
    </>
  );
}

export default App;
