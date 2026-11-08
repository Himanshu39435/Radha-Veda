import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { Spinner } from './components/ui';
import ShopLayout from './components/ShopLayout';
import PanelLogin from './pages/PanelLogin';
import Home from './pages/customer/Home';
import Shop from './pages/customer/Shop';
import ProductDetail from './pages/customer/ProductDetail';
import Cart from './pages/customer/Cart';
import Checkout from './pages/customer/Checkout';
import Policy from './pages/customer/Policy';
import { Forgot, Login, Register, Reset } from './pages/customer/AuthPages';
// Admin and staff panels (and the charting library) are only downloaded by people who open them
const Admin = lazy(() => import('./pages/admin/Admin'));
const Staff = lazy(() => import('./pages/staff/Staff'));
const CustomerPanel = lazy(() => import('./pages/customer/CustomerPanel'));

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
export default function App() {
  return (<><ScrollTop /><Suspense fallback={<Spinner />}><Routes>
    <Route path="/admin/login" element={<PanelLogin panel="admin" />} /><Route path="/admin/*" element={<Admin />} />
    <Route path="/account/*" element={<CustomerPanel />} />
    <Route path="/staff/login" element={<PanelLogin panel="staff" />} /><Route path="/staff/*" element={<Staff />} />
    <Route element={<ShopLayout />}>
      <Route index element={<Home />} /><Route path="shop" element={<Shop />} /><Route path="product/:slug" element={<ProductDetail />} />
      <Route path="cart" element={<Cart />} /><Route path="checkout" element={<Checkout />} /><Route path="login" element={<Login />} /><Route path="register" element={<Register />} />
      <Route path="forgot-password" element={<Forgot />} /><Route path="reset-password/:token" element={<Reset />} /><Route path="policy/:key" element={<Policy />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route></Routes></Suspense></>);
}
