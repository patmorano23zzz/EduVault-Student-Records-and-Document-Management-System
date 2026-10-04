import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/api'
import {
  LayoutDashboard, Users, FileText,
  ClipboardList, ScrollText, LogOut, Menu, X, GraduationCap, Settings
} from 'lucide-react'
import { useState } from 'react'
import { usePendingCount } from '../hooks/useRequests'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import BrandMark from '../components/BrandMark'
import ThemeToggle from '../components/ThemeToggle'

export default function AdminLayout() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const { data: pendingCount = 0 } = usePendingCount()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navItems = [
    { to: '/admin',            label: 'Dashboard',  icon: LayoutDashboard, end: true },
    { to: '/admin/students',   label: 'Students',   icon: Users },
    { to: '/admin/documents',  label: 'Documents',  icon: FileText },
    { to: '/admin/requests',   label: 'Requests',   icon: ClipboardList, badge: pendingCount },
    { to: '/admin/teachers',   label: 'Teachers',   icon: GraduationCap },
    { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
    { to: '/admin/settings',   label: 'Settings',   icon: Settings },
  ]

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-60 bg-gray-900 text-white flex flex-col
        transform transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-700">
          <div>
            <BrandMark compact />
          </div>
          <p className="text-xs text-gray-400">Admin Portal</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`
              }
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 truncate">{profile?.full_name}</p>
          <p className="text-xs text-blue-400 capitalize mb-3">{profile?.role}</p>
          <button
            onClick={() => setConfirmLogout(true)}
            className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center gap-3 lg:px-6 shadow-sm">
          <button className="lg:hidden text-gray-500 hover:text-gray-700" onClick={() => setOpen(o => !o)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
          <h2 className="text-sm font-semibold text-gray-700">Registrar / Admin</h2>
          <div className="ml-auto"><ThemeToggle /></div>
        </header>
        <main className="page-enter flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
      {confirmLogout && (
        <ConfirmDialog
          title="Sign out?"
          message="You will need to sign in again to access the registrar portal."
          confirmLabel="Sign out"
          onClose={() => setConfirmLogout(false)}
          onConfirm={signOut}
          danger
        />
      )}
    </div>
  )
}
