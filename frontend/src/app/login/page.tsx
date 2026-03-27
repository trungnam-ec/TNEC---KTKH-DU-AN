'use client';

import { signIn } from 'next-auth/react';

export default function Login() {
  return (
    <div className="min-h-screen bg-liquid flex items-center justify-center p-4">
      <div className="max-w-md w-full glass-card p-10 rounded-3xl shadow-2xl relative overflow-hidden text-center">
        {/* Decorative ambient light */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-primary-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-primary-300/30 rounded-full blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex justify-center mb-8 bg-white/50 w-24 h-24 rounded-2xl items-center mx-auto shadow-sm border border-white/60">
             <h1 className="text-4xl font-black text-primary-600 tracking-tighter">TK</h1>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-2">TNEC-KTKH</h2>
          <p className="text-slate-500 mb-8 font-medium">Hệ thống Quản trị Dự án Nội bộ</p>
          
          <button 
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl shadow-sm border border-slate-200 transition-all hover:shadow-md"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google Workspace Login
          </button>
          
          <p className="mt-8 text-xs text-slate-400 font-medium tracking-wide">
            CHỈ HỖ TRỢ ĐỊA CHỈ EMAIL<br/>@TRUNGNAMEC.COM.VN | @TRUNGNAMGROUP.COM.VN
          </p>
        </div>
      </div>
    </div>
  );
}
