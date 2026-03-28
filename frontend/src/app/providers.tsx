'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { SessionProvider, useSession } from "next-auth/react";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <RoleProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </RoleProvider>
    </SessionProvider>
  );
}

/* ═══════════════════════════════════════════
   ROLE TYPES
   ═══════════════════════════════════════════ */

export type UserRole = 'Admin' | 'Manager' | 'Staff';

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
}

interface RoleContextType {
  user: CurrentUser;
  setRole: (role: UserRole) => void;
  canTransitionTo: (targetStatus: string) => boolean;
  canEditValue: (assignee: string) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
}

/* ═══════════════════════════════════════════
   RBAC RULES (Mirror backend logic)
   ═══════════════════════════════════════════ */

const STAFF_ALLOWED_STATUSES = new Set(['backlog', 'in-progress', 'internal-review']);
const STAFF_FORBIDDEN_STATUSES = new Set(['external-review', 'blocked', 'done']);

/* ═══════════════════════════════════════════
   CONTEXT
   ═══════════════════════════════════════════ */

const defaultAdmin: CurrentUser = {
  id: 0,
  name: 'Administrator',
  email: 'admin@trungnamgroup.com.vn',
  role: 'Admin',
  initials: 'A',
};

const defaultManager: CurrentUser = {
  id: 1,
  name: 'Manager',
  email: 'manager@trungnamgroup.com.vn',
  role: 'Manager',
  initials: 'M',
};

const defaultStaff: CurrentUser = {
  id: 2,
  name: 'Nguyễn Văn An',
  email: 'nva@trungnamgroup.com.vn',
  role: 'Staff',
  initials: 'NVA',
};

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser>(defaultAdmin);

  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      setUser({
        id: (session.user as any).id || 0,
        name: session.user.name || 'Unknown',
        email: session.user.email || '',
        role: (session.user as any).role || 'Staff',
        initials: session.user.name ? session.user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() : 'U',
      });
    }
  }, [session, status]);

  const setRole = useCallback((role: UserRole) => {
    // Optionally keep ability to override role locally for testing
    if (role === 'Admin') setUser(prev => ({ ...prev, role: 'Admin' }));
    else if (role === 'Manager') setUser(prev => ({ ...prev, role: 'Manager' }));
    else setUser(prev => ({ ...prev, role: 'Staff' }));
  }, []);

  const canTransitionTo = useCallback((targetStatus: string): boolean => {
    if (user.role === 'Admin' || user.role === 'Manager') return true;
    return STAFF_ALLOWED_STATUSES.has(targetStatus);
  }, [user.role]);

  const canEditValue = useCallback((assignee: string): boolean => {
    if (user.role === 'Admin' || user.role === 'Manager') return true;
    return user.initials === assignee;
  }, [user.role, user.initials]);

  return (
    <RoleContext.Provider value={{
      user,
      setRole,
      canTransitionTo,
      canEditValue,
      isAdmin: user.role === 'Admin',
      isManager: user.role === 'Manager' || user.role === 'Admin',
      isStaff: user.role === 'Staff',
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
}

/* ═══════════════════════════════════════════
   TOAST NOTIFICATION SYSTEM
   ═══════════════════════════════════════════ */

export interface ToastMessage {
  id: string;
  type: 'error' | 'success' | 'info';
  message: string;
}

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (type: ToastMessage['type'], message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 max-w-sm">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-5 py-3 rounded-xl shadow-2xl border flex items-start gap-3 animate-slide-in
              ${toast.type === 'error' ? 'bg-red-50/90 border-red-200/60 text-red-700' : ''}
              ${toast.type === 'success' ? 'bg-emerald-50/90 border-emerald-200/60 text-emerald-700' : ''}
              ${toast.type === 'info' ? 'bg-blue-50/90 border-blue-200/60 text-blue-700' : ''}
            `}
            style={{ backdropFilter: 'blur(12px)' }}
          >
            <span className="text-lg flex-shrink-0 mt-0.5">
              {toast.type === 'error' ? '🚫' : toast.type === 'success' ? '✅' : 'ℹ️'}
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-snug">{toast.message}</p>
            </div>
            <button onClick={() => removeToast(toast.id)} className="text-current opacity-40 hover:opacity-70 flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

/* ═══════════════════════════════════════════
   ROLE SWITCHER WIDGET (for sidebar)
   ═══════════════════════════════════════════ */

export function RoleSwitcher() {
  const { user, setRole } = useRole();

  return (
    <div className="glass-card rounded-2xl p-3 m-4 space-y-2">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-md ${user.role === 'Admin' ? 'bg-rose-500' : user.role === 'Manager' ? 'bg-primary-500' : 'bg-amber-500'}`}>
          {user.initials.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
          <p className="text-xs text-slate-500 truncate">{user.email}</p>
        </div>
      </div>
      {/* Role Toggle */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-slate-100/60 flex-wrap">
        <button
          onClick={() => setRole('Admin')}
          className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-bold transition-all ${user.role === 'Admin' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          🛡️ Admin
        </button>
        <button
          onClick={() => setRole('Manager')}
          className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-bold transition-all ${user.role === 'Manager' ? 'bg-primary-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          👑 Manager
        </button>
        <button
          onClick={() => setRole('Staff')}
          className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-bold transition-all ${user.role === 'Staff' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          👤 Staff
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SIDEBAR NAV (Dynamic by Role)
   ═══════════════════════════════════════════ */

export function SidebarNav() {
  const { isStaff } = useRole();
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-4 mt-6 space-y-2">
      {!isStaff && (
        <Link href="/" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/' ? 'bg-white/40 text-primary-600 font-medium' : 'hover:bg-white/20 text-slate-600'}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          Dashboard
        </Link>
      )}
      <Link href="/my-tasks" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/my-tasks' ? 'bg-white/40 text-primary-600 font-medium' : 'hover:bg-white/20 text-slate-600'}`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
        My Tasks
      </Link>
      <Link href="/projects" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname?.startsWith('/projects') ? 'bg-white/40 text-primary-600 font-medium' : 'hover:bg-white/20 text-slate-600'}`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
        Projects
      </Link>
      {!isStaff && (
        <Link href="/settings" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/settings' ? 'bg-white/40 text-primary-600 font-medium' : 'hover:bg-white/20 text-slate-600'}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Settings
        </Link>
      )}
    </nav>
  );
}
