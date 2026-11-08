import { Navigate, Route, Routes } from 'react-router-dom';
import { BarChart3, Boxes, CreditCard, FolderTree, LayoutDashboard, Package, ReceiptText, Settings, ShoppingCart, TicketPercent, UserCog, Users } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import OrdersView from '../../components/OrdersView';
import Dashboard from './Dashboard';
import { Categories, Products } from './Catalog';
import { Customers, StaffMgmt } from './People';
import { Coupons, Inventory, Payments } from './Ops';
import Reports from './Reports';
import SettingsPage from './Settings';
const nav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }, { to: '/admin/products', label: 'Products', icon: Package }, { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart }, { to: '/admin/customers', label: 'Customers', icon: Users }, { to: '/admin/staff', label: 'Staff Management', icon: UserCog },
  { to: '/admin/inventory', label: 'Inventory / Stock', icon: Boxes }, { to: '/admin/payments', label: 'Payments', icon: CreditCard }, { to: '/admin/coupons', label: 'Coupons', icon: TicketPercent },
  { to: '/admin/reports', label: 'Sales Reports', icon: BarChart3 }, { to: '/admin/settings', label: 'Website Settings', icon: Settings },
];
export default function Admin() {
  return <Routes><Route element={<DashboardLayout panel="admin" items={nav} title="Admin panel" />}>
    <Route index element={<Dashboard />} /><Route path="products" element={<Products />} /><Route path="categories" element={<Categories />} />
    <Route path="orders" element={<OrdersView panel="admin" title="Orders" />} /><Route path="customers" element={<Customers />} /><Route path="staff" element={<StaffMgmt />} />
    <Route path="inventory" element={<Inventory />} /><Route path="payments" element={<Payments />} /><Route path="coupons" element={<Coupons />} /><Route path="reports" element={<Reports />} />
    <Route path="settings" element={<SettingsPage />} /><Route path="*" element={<Navigate to="/admin" replace />} /></Route></Routes>;
}
