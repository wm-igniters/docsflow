import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

export const authConfig = {
  providers: [
    Google({
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isAppPage = nextUrl.pathname.startsWith('/app')
      const isManagePage = nextUrl.pathname.startsWith('/manage-tech-stack')
      
      if (isAppPage || isManagePage) {
        if (isLoggedIn) return true
        return false // Redirect to login
      }
      return true
    },
  },
} satisfies NextAuthConfig
