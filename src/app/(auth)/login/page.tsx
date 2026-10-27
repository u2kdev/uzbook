import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage() {
  // getCurrentUser verifies the user still exists, so a stale cookie can't trap us in onboarding.
  const user = await getCurrentUser();
  if (user) redirect(user.role === "OWNER" ? "/dashboard" : "/admin");

  return <AuthForm mode="login" />;
}
