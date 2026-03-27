import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Bỏ qua các file static, _next, api, và các file có extension (.png, .css, .js...)
  if (path.startsWith('/_next') || path.startsWith('/api') || path.includes('.')) {
    return NextResponse.next();
  }

  // Biến tạm để simualte auth, khi tích hợp thật sẽ check token ở đây.
  const isAuthenticated = true; // TEMP: bypass auth to test Dashboard UI

  if (!isAuthenticated && !path.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthenticated && path.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}


