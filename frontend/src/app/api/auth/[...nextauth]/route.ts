import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (dùng service_role hoặc anon để check email)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      // Rule 1: Chỉ chấp nhận domain được phép
      const allowedDomains = ["@gmail.com", "@trungnamec.com.vn", "@trungnamgroup.com.vn"];
      const isAllowedDomain = allowedDomains.some((d) => user.email?.endsWith(d));
      if (!isAllowedDomain) return false;

      // Rule 2: Kiểm tra email có trong bảng users của Supabase không
      const { data: dbUser, error } = await supabase
        .from("users")
        .select("id, role, full_name, is_active")
        .eq("email", user.email)
        .eq("is_active", true)
        .single();

      if (error || !dbUser) {
        console.error("User not authorized:", user.email, error?.message);
        return false;
      }

      // Lưu thông tin vào user object để dùng ở jwt callback
      (user as any).id = dbUser.id;
      (user as any).role = dbUser.role;
      (user as any).full_name = dbUser.full_name;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role || "Staff";
        token.full_name = (user as any).full_name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).full_name = token.full_name;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
