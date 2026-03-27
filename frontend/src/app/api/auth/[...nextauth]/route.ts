import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (user.email) {
        // Rule 1: Chỉ chấp nhận @gmail.com hoặc domain công ty
        const allowedDomains = ["@gmail.com", "@trungnamec.com.vn", "@trungnamgroup.com.vn"];
        const isAllowedDomain = allowedDomains.some((domain) => user.email?.endsWith(domain));
        
        if (!isAllowedDomain) return false;

        // Rule 2: Check backend xem email đã được phân quyền chưa
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'}/api/users/check-email/${user.email}`);
          if (!res.ok) {
            // Error 404 từ backend mang message "Tài khoản chưa được phân quyền..."
            return false; 
          }
          const dbUser = await res.json();
          // Lưu thông tin vào user object của NextAuth để dùng ở callback jwt
          (user as any).id = dbUser.id;
          (user as any).role = dbUser.role;
          return true;
        } catch (error) {
          console.error("SSO check failed:", error);
          return false;
        }
      }
      return false;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role || "Staff";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login', // Trang login custom bằng Glassmorphism
    error: '/login', // Lỗi cũng đẩy về login
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
