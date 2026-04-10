import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
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
import { CustomerPortal } from './pages/billing/CustomerPortal';
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
import SetupWizard from './pages/SetupWizard';
import { UserManagement } from './pages/UserManagement';

function App() {
  return (
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
              <Sidebar />
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
                  <Route path="/radius" element={<RadiusManagement />} />
                  <Route path="/tickets" element={<TicketSystem />} />
                  <Route path="/captive-portal" element={<CaptivePortalBuilder />} />
                  <Route path="/bandwidth" element={<BandwidthGraphs />} />
                  <Route path="/resellers" element={<ResellerPortal />} />
                  <Route path="/users" element={<UserManagement />} />
                  
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
  );
}

export default App;
