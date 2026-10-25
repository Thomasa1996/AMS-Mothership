"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { readPdf } from "@/lib/pdf-upload";
import { SignError, signPdf } from "@/lib/sign-pdf";

const MAX_IMAGE_CHARS = 700_000; // about 500 KB once base64 encoded, as in My profile

// The same signature My profile keeps for quotes, saved from here by drawing or uploading it.
export async function saveSignature(dataUrl: string): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!/^data:image\/(png|jpeg|svg\+xml);/.test(dataUrl) || dataUrl.length > MAX_IMAGE_CHARS) {
    return { error: "Signatures must be a PNG, JPG or SVG picture under 500 KB" };
  }
  await db.user.update({ where: { id: user.id }, data: { signature: dataUrl } });
  revalidatePath("/", "layout");
  return {};
}

const share = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

// The browser sends the PDF, the signature drawn as a PNG, and where the block goes on which page.
export async function signDocument(formData: FormData): Promise<{ error: string } | { id: string }> {
  const user = await requireUser();
  const pdf = await readPdf(formData.get("file"));
  if ("error" in pdf) return pdf;
  const signature = formData.get("signature");
  if (!(signature instanceof File) || signature.size === 0) return { error: "Save your signature first" };
  if (signature.size > 2 * 1024 * 1024) return { error: "That signature picture is too big" };

  const placement = {
    page: Math.round(share(formData.get("page"))),
    left: share(formData.get("left")),
    top: share(formData.get("top")),
    width: share(formData.get("width")),
  };
  if (Object.values(placement).some(Number.isNaN) || placement.page < 1) return { error: "Place your signature on the page first" };
  const text = (k: string) => String(formData.get(k) ?? "").slice(0, 200);

  let signed: Uint8Array;
  try {
    signed = await signPdf(pdf.data, new Uint8Array(await signature.arrayBuffer()), placement, {
      name: text("name"),
      title: text("title"),
      company: text("company"),
      date: text("date"),
    });
  } catch (e) {
    if (e instanceof SignError) return { error: e.message };
    console.error("Signing a PDF failed", e);
    return { error: "That PDF couldn't be signed. Try saving it again as a PDF." };
  }

  const fileName = pdf.fileName.replace(/\.pdf$/i, "") + " - signed.pdf";
  const doc = await db.signedDocument.create({
    data: {
      companyId: user.companyId,
      signedById: user.id,
      signerName: user.name,
      fileName,
      size: signed.length,
      data: new Uint8Array(signed),
    },
    select: { id: true },
  });
  revalidatePath("/sales/sign");
  return { id: doc.id };
}

export async function deleteSignedDocument(id: string) {
  const user = await requireUser();
  await db.signedDocument.deleteMany({
    where: { id, companyId: user.companyId, ...(user.role === "ADMIN" ? {} : { signedById: user.id }) },
  });
  revalidatePath("/sales/sign");
}
