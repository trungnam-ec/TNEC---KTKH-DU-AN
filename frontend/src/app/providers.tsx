'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

/* ═══════════════════════════════════════════
   ROLE TYPES
   ═══════════════════════════════════════════ */

export type UserRole = 'Manager' | 'Staff';

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
  isManager: boolean;
}

/* ═══════════════════════════════════════════
   RBAC RULES (Mirror backend logic)
   ═══════════════════════════════════════════ */

const STAFF_ALLOWED_STATUSES = new Set(['backlog', 'in-progress', 'internal-review']);
const STAFF_FORBIDDEN_STATUSES = new Set(['external-review', 'blocked', 'done']);

/* ═══════════════════════════════════════════
   CONTEXT
   ═══════════════════════════════════════════ */

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
  const [user, setUser] = useState<CurrentUser>(defaultManager);

  const setRole = useCallback((role: UserRole) => {
    setUser(role === 'Manager' ? defaultManager : defaultStaff);
  }, []);

  const canTransitionTo = useCallback((targetStatus: string): boolean => {
    if (user.role === 'Manager') return true;
    return STAFF_ALLOWED_STATUSES.has(targetStatus);
  }, [user.role]);

  const canEditValue = useCallback((assignee: string): boolean => {
    if (user.role === 'Manager') return true;
    return user.initials === assignee;
  }, [user.role, user.initials]);

  return (
    <RoleContext.Provider value={{
      user,
      setRole,
      canTransitionTo,
      canEditValue,
      isManager: user.role === 'Manager',
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
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-md ${user.role === 'Manager' ? 'bg-primary-500' : 'bg-amber-500'}`}>
          {user.initials.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
          <p className="text-xs text-slate-500 truncate">{user.email}</p>
        </div>
      </div>
      {/* Role Toggle */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-slate-100/60">
        <button
          onClick={() => setRole('Manager')}
          className={`flex-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${user.role === 'Manager' ? 'bg-primary-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          👑 Manager
        </button>
        <button
          onClick={() => setRole('Staff')}
          className={`flex-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${user.role === 'Staff' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          👤 Staff
        </button>
      </div>
    </div>
  );
}
