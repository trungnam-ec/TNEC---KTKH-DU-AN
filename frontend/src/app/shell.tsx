'use client';

import { usePathname } from 'next/navigation';
import { SidebarNav, RoleSwitcher } from './providers';
import React from 'react';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  if (pathname === '/login') {
    return <main className="w-full h-screen overflow-hidden m-0 p-0 font-sans">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 glass-panel border-r-0 rounded-r-3xl my-4 ml-4 flex flex-col z-20">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary-600 text-heading tracking-tight">TNEC-<span className="text-slate-800">KTKH</span></h1>
        </div>
        
        <SidebarNav />

        {/* Role Switcher */}
        <RoleSwitcher />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Navbar */}
        <header className="h-20 flex-shrink-0 flex items-center justify-between px-8 z-10">
          <h2 className="text-2xl font-bold text-heading text-slate-800">TNEC-KTKH Project Management</h2>
          <div className="flex items-center gap-6">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search projects, tasks..." 
                className="pl-10 pr-4 py-2 glass-panel rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500/50 w-64 text-sm"
              />
              <svg className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <button className="relative p-2 glass-panel rounded-full hover:bg-white/40 transition-colors">
              <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8 pt-4">
          {children}
        </div>
      </main>
    </div>
  );
}
