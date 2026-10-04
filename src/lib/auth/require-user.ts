import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { id: true, name: true, email: true },
  });

  if (!user) redirect("/login?error=account");
  return user;
}
