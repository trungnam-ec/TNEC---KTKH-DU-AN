'use client';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <div className="min-h-screen w-[100vw] bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden" style={{ margin: 0, padding: 0 }}>
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/20 rounded-full blur-[120px] -translate-x-1/2 translate-y-1/2" />

      {/* Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-lg p-12 bg-slate-900/60 backdrop-blur-2xl border border-slate-800 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] flex flex-col items-center text-center mx-4">
        
        {/* Logo/Icon */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-8 border border-blue-400/20">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.95 11.95 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>

        <h1 className="text-3xl font-extrabold text-white mb-3 tracking-tight">TNEC-PHÒNG KẾ HOẠCH</h1>
        <p className="text-slate-400 font-medium mb-10 text-[15px]">Đăng nhập Hệ thống Quản trị Nội bộ</p>

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="flex items-center gap-3 px-5 py-3 bg-white hover:bg-gray-50 border border-gray-300 rounded-md font-sans font-medium text-[14px] text-[#3c4043] transition-all duration-150 shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span>Sign in with Google</span>
        </button>

        <div className="mt-8 text-xs text-slate-500 font-medium px-4">
          Hệ thống chỉ ủy quyền truy cập cho địa chỉ <span className="text-slate-300">@gmail.com</span> hoặc domain công ty đã đăng ký duyệt.
        </div>
      </div>
    </div>
  );
}
