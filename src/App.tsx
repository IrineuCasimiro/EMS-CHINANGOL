import { useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { AppShell } from '@/components/layout/AppShell';
import { Dashboard } from '@/pages/Dashboard';
import { EquipmentPage } from '@/pages/EquipmentPage';
import { InspectionsPage } from '@/pages/InspectionsPage';
import { WorkOrdersPage } from '@/pages/WorkOrdersPage';
import { TravelLogsPage } from '@/pages/TravelLogsPage';
import { RequisitionsPage } from '@/pages/RequisitionsPage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { AdminPage } from '@/pages/AdminPage';
import { Toaster } from '@/components/ui/sonner';

function AppContent() {
  const { profile, loading } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-teal-600 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading EMS...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <AuthScreen />;
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard onNavigate={setActiveView} />;
      case 'equipment': return <EquipmentPage />;
      case 'inspections': return <InspectionsPage />;
      case 'work-orders': return <WorkOrdersPage />;
      case 'travel-logs': return <TravelLogsPage />;
      case 'requisitions': return <RequisitionsPage />;
      case 'documents': return <DocumentsPage />;
      case 'admin': return <AdminPage />;
      default: return <Dashboard onNavigate={setActiveView} />;
    }
  };

  return (
    <DataProvider>
      <AppShell activeView={activeView} onNavigate={setActiveView}>
        {renderView()}
      </AppShell>
    </DataProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
