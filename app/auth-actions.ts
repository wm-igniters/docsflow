"use server";

import { signOut, signIn } from "@/auth";

export async function handleSignOut() {
  await signOut({ redirectTo: "/" });
}

export async function handleSignIn() {
  await signIn("google", { redirectTo: "/app" });
}
