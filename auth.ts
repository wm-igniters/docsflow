import NextAuth from "next-auth"
import connectDB from "@/lib/db"
import { UserSchema, IUser } from "@/models/User"
import { authConfig } from "./auth.config"
import { DB_CONFIG } from "@/lib/config.mjs"

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) return false;

      try {
        console.log("SignIn Triggered for email:", user.email);
        const conn = await connectDB(DB_CONFIG.USER_DB);
        
        // Bind model to this specific connection
        const UserModel = conn.models.User || conn.model<IUser>('User', UserSchema, DB_CONFIG.USER_COLLECTION);
        
        const existingUser = await UserModel.findById(user.email);

        if (!existingUser) {
          console.log("No existing user found. Creating new user in user_data database...");
          await UserModel.create({
            _id: user.email,
            name: user.name,
            email: user.email,
            image: user.image,
            role: "member",
          });
          console.log("User successfully created.");
        } else {
          console.log("User already exists in user_data.");
        }
        return true;
      } catch (error) {
        console.error("CRITICAL: Error saving user to DB:", error);
        return true; // Still allow sign in to avoid blocking user, even if DB fails
      }
    },
  },
})
