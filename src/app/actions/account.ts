"use server";

import { signOut } from "@/auth";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { deletePrivateObject } from "@/lib/storage";

export async function deleteAccount(formData: FormData) {
  const user = await requireUser();
  if (formData.get("confirmation") !== "DELETE") {
    throw new Error("Type DELETE to confirm account removal.");
  }

  const resumes = await db.resume.findMany({ where: { userId: user.id }, select: { objectKey: true } });
  const approvals = await db.application.findMany({
    where: { userId: user.id, approval: { is: { screenshotKey: { not: null } } } },
    select: { approval: { select: { screenshotKey: true } } },
  });
  const objectKeys = [
    ...resumes.map((resume) => resume.objectKey),
    ...approvals.flatMap(({ approval }) => approval?.screenshotKey ? [approval.screenshotKey] : []),
  ];
  const results = await Promise.allSettled(objectKeys.map((objectKey) => deletePrivateObject(objectKey)));
  if (results.some((result) => result.status === "rejected")) {
    throw new Error("We couldn’t remove every private file. Your account is still active; try again later.");
  }

  await db.user.delete({ where: { id: user.id } });
  await signOut({ redirectTo: "/" });
}
