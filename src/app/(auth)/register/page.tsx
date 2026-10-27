import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Регистрация" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "OWNER" ? "/dashboard" : "/admin");
  return <AuthForm mode="register" />;
}
