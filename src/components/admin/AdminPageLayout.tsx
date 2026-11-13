import React from 'react';
import { AdminSidebar } from './AdminSidebar';

interface AdminPageLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

/** Estrutura comum das páginas administrativas que não possuem sidebar própria. */
export const AdminPageLayout: React.FC<AdminPageLayoutProps> = ({
  currentPath,
  onNavigate,
  children,
}) => (
  <div className="min-h-screen min-w-0 overflow-x-hidden bg-[#080d17]">
    <AdminSidebar currentPath={currentPath} onNavigate={onNavigate} />
    <main className="min-h-screen min-w-0 overflow-x-hidden pt-16 lg:ml-[280px] lg:pt-0">
      {children}
    </main>
  </div>
);
