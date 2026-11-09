// PATH: src/components/admin/AdminSidebar.tsx
/**
 * AdminSidebar é um alias/re-export para DiamanteSidebar
 * Mantém todos os paths alinhados com App.tsx
 */
export {
  DiamanteSidebar,
  DiamanteSidebar as AdminSidebar,
  menuItems,
  navItems,
  default,
} from './DiamanteSidebar';
export type { MenuItem, DiamanteSidebarProps, DiamanteSidebarProps as AdminSidebarProps } from './DiamanteSidebar';
