import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Leaf, LogOut, Menu } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

// Fixed left sidebar on desktop; drawer on mobile (hamburger, tap-outside closes, closes on navigate)
export default function DashboardLayout({ panel, items, title }) {
  const { user, logout } = useAuth(panel); const [open, setOpen] = useState(false);
  const loc = useLocation(); const nav = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname, loc.search]);
  const loginPath = panel === 'customer' ? '/login' : `/${panel}/login`;
  if (!user) return <Navigate to={loginPath} state={{ from: loc.pathname }} replace />;
  const side = (
    <div className="flex h-full flex-col bg-earth-dark text-beige-light">
      <div className="flex items-center gap-2 px-5 py-5"><Leaf className="h-6 w-6 text-sage-light" /><div><p className="font-display text-2xl leading-none text-white">Radha Veda</p><p className="text-xs text-beige-dark">{title}</p></div></div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map(({ to, label, icon: I, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors', isActive ? 'bg-sage text-white' : 'hover:bg-white/10')}>
            <I className="h-[18px] w-[18px]" />{label}</NavLink>))}
      </nav>
      <button onClick={() => { logout(); nav(panel === 'customer' ? '/' : loginPath); }} className="m-3 flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-white/10"><LogOut className="h-[18px] w-[18px]" />Logout</button>
    </div>
  );
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{side}</aside>
      {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-earth-dark/50" onClick={() => setOpen(false)} /><aside className="drawer-in absolute inset-y-0 left-0 w-72 max-w-[85vw]">{side}</aside></div>}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-beige-dark/60 bg-cream/95 px-4 backdrop-blur sm:px-6">
          <button aria-label="Open menu" className="rounded-full p-2 hover:bg-beige lg:hidden" onClick={() => setOpen(true)}><Menu className="h-6 w-6" /></button>
          <p className="hidden font-display text-xl lg:block">{title}</p>
          <div className="text-right text-sm"><p className="font-semibold">{user.name}</p><p className="text-xs text-earth-light capitalize">{user.role}</p></div>
        </header>
        <main className="p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
