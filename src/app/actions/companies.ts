"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { detectAts } from "@/lib/ats/detect";
import { companyFormSchema } from "@/lib/schemas/company";

export async function addCompany(formData: FormData) {
  const user = await requireUser();
  const parsed = companyFormSchema.safeParse({
    name: formData.get("name"),
    careersUrl: formData.get("careersUrl"),
    roleKeywords: formData.get("roleKeywords") ?? "",
    locations: formData.get("locations") ?? "",
  });
  if (!parsed.success) redirect("/companies?error=fields");

  let detection;
  try {
    detection = detectAts(parsed.data.careersUrl);
  } catch (error) {
    const message = error instanceof Error && error.message.includes("LinkedIn")
      ? "blocked"
      : error instanceof Error && error.message.includes("HTTPS")
        ? "https"
        : "url";
    redirect(`/companies?error=${message}`);
  }

  try {
    await db.company.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        careersUrl: detection.normalizedUrl,
        normalizedUrl: detection.normalizedUrl,
        atsPlatform: detection.platform,
        roleKeywords: parsed.data.roleKeywords,
        locations: parsed.data.locations,
        discoveryEnabled: detection.platform !== "UNSUPPORTED",
        nextScanAt: detection.platform === "UNSUPPORTED" ? null : new Date(),
        lastScanError: detection.reason,
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      redirect("/companies?error=duplicate");
    }
    throw error;
  }

  revalidatePath("/companies");
  revalidatePath("/dashboard");
  redirect("/companies?saved=1");
}

export async function requestCompanyScan(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("companyId") ?? "");
  const company = await db.company.findFirst({ where: { id, userId: user.id } });
  if (!company) redirect("/companies?error=not-found");
  if (company.atsPlatform === "UNSUPPORTED") redirect("/companies?error=unsupported");
  await db.company.updateMany({
    where: { id, userId: user.id },
    data: { discoveryEnabled: true, nextScanAt: new Date(), lastScanError: null },
  });
  revalidatePath("/companies");
  redirect("/companies?queued=1");
}

export async function pauseCompanyScan(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("companyId") ?? "");
  await db.company.updateMany({
    where: { id, userId: user.id },
    data: { discoveryEnabled: false, nextScanAt: null },
  });
  revalidatePath("/companies");
}

export async function deleteCompany(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("companyId") ?? "");
  await db.company.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/companies");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
}
