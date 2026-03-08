import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth, ROLE_LABELS } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, GitBranch, CalendarDays, FolderKanban,
  Wallet, FileText, Users2, BarChart3, ClipboardList, UserCog,
  LogOut, Menu, X, ChevronRight, Bell, Settings, Box
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', module: null },
  { to: '/members', icon: Users, label: 'Members', module: 'members' },
  { to: '/branches', icon: GitBranch, label: 'Branches', module: 'branches' },
  { to: '/events', icon: CalendarDays, label: 'Events', module: 'events' },
  { to: '/projects', icon: FolderKanban, label: 'Projects', module: 'projects' },
  { to: '/finance', icon: Wallet, label: 'Finance', module: 'finance' },
  { to: '/documents', icon: FileText, label: 'Documents', module: 'documents' },
  { to: '/sponsors', icon: Users2, label: 'Sponsors', module: 'sponsors' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics', module: 'analytics' },
  { to: '/audit', icon: ClipboardList, label: 'Audit Logs', module: 'audit' },
  { to: '/users', icon: UserCog, label: 'User Mgmt', module: 'users' },
];

export default function Layout() {
  const { user, logout, can } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const visibleItems = NAV_ITEMS.filter(item =>
    !item.module || can(item.module, 'read')
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950 bg-gradient-radial">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full z-40 w-64
        bg-surface-900/80 backdrop-blur-xl border-r border-white/5
        flex flex-col transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex
      `}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-white/5">
          <img
            src="/logo.png"
            alt="Uddami Youth Network Bangladesh"
            className="h-9 w-auto object-contain flex-shrink-0"
            style={{ filter: 'brightness(1)' }}
          />
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto text-slate-500 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {visibleItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={17} className="flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Info */}
        <div className="px-3 pb-4 border-t border-white/5 pt-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/3">
            {user?.photo_url ? (
              <img src={user.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-brand-600/30 border border-brand-500/30 flex items-center justify-center">
                <span className="text-brand-400 text-xs font-bold">
                  {(user?.member_name || user?.email || '?')[0].toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {user?.member_name || user?.email?.split('@')[0]}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {ROLE_LABELS[user?.role] || user?.role}
              </div>
            </div>
            <button
              onClick={logout}
              className="text-slate-500 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center gap-4 px-4 lg:px-6 py-3.5 border-b border-white/5 bg-surface-900/40 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-white lg:hidden"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1" />

          {/* Notifications bell placeholder */}
          <button className="relative p-2 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-white/5">
            <Bell size={18} />
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-screen-2xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
