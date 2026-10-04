"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { parseAnswerForm, parseProfileForm } from "@/lib/schemas/profile";

export async function saveProfile(formData: FormData) {
  const user = await requireUser();
  const parsed = parseProfileForm(formData);
  if (!parsed.success) throw new Error("Check the profile fields and try again.");

  const values = parsed.data;
  const data = {
    fullName: values.fullName,
    email: values.email.toLowerCase(),
    phone: values.phone || null,
    city: values.city || null,
    links: values.links,
    noticePeriod: values.noticePeriod || null,
    expectedSalary: values.expectedSalary || null,
    workAuthorization: values.workAuthorization || null,
    needsVisaSponsorship:
      values.needsVisaSponsorship === "unknown"
        ? null
        : values.needsVisaSponsorship === "yes",
  };

  await db.$transaction([
    db.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    }),
    db.user.update({ where: { id: user.id }, data: { name: values.fullName } }),
  ]);
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  redirect("/profile?saved=1");
}

export async function saveAnswer(formData: FormData) {
  const user = await requireUser();
  const parsed = parseAnswerForm(formData);
  if (!parsed.success) throw new Error("Check the answer fields and try again.");

  const { id, question, answer, tags } = parsed.data;
  if (id) {
    const result = await db.answer.updateMany({
      where: { id, userId: user.id },
      data: { question, answer, tags },
    });
    if (!result.count) throw new Error("That saved answer could not be found.");
  } else {
    await db.answer.create({ data: { userId: user.id, question, answer, tags } });
  }

  revalidatePath("/profile");
}

export async function deleteAnswer(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("A saved answer ID is required.");
  await db.answer.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/profile");
}
