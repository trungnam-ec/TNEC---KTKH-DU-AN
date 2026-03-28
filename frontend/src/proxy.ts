import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Bỏ qua các file static, _next, api/auth (để NextAuth tự handle), và tài nguyên tĩnh
  if (
    path.startsWith('/_next') || 
    path.startsWith('/api/auth') || 
    path.includes('.')
  ) {
    return NextResponse.next();
  }

  // Xác thực token từ cookie NextAuth
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const isAuthenticated = !!token;

  // Chưa đăng nhập mà vào URL bên trong -> Đẩy về login
  if (!isAuthenticated && !path.startsWith('/login')) {
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', encodeURI(request.url));
    return NextResponse.redirect(url);
  }

  // Đã đăng nhập mà cố vào lại login -> Đẩy về home (hoặc callbackUrl)
  if (isAuthenticated && path.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}
