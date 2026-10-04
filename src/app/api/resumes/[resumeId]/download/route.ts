import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { decodeFileEncryptionKey, decryptResumeBytes } from "@/lib/files/encryption";
import { getPrivateObject } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ resumeId: string }> }) {
  const user = await requireUser();
  const { resumeId } = await params;
  const resume = await db.resume.findFirst({
    where: { id: resumeId, userId: user.id },
    select: { objectKey: true, mimeType: true, originalName: true },
  });
  if (!resume) return NextResponse.json({ error: "Resume not found." }, { status: 404 });

  const encrypted = await getPrivateObject(resume.objectKey);
  const bytes = decryptResumeBytes(
    encrypted,
    decodeFileEncryptionKey(process.env.FILE_ENCRYPTION_KEY ?? ""),
  );
  const fallbackName = resume.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": resume.mimeType,
      "Content-Disposition": `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(resume.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
