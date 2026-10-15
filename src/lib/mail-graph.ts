// Microsoft Graph, read-only, signed in as an Azure app with the client credentials flow and the
// Mail.Read application permission. Used to find proposals reps have emailed, in their Sent Items.
// Nothing in anyone's mailbox is changed.

const GRAPH = "https://graph.microsoft.com/v1.0";

export class MailError extends Error {}

export type MailCreds = { tenantId: string; clientId: string; secret: string };

export type SentMessage = { id: string; internetMessageId: string; subject: string; sentDateTime: string; to: string[] };
export type AttachmentInfo = { id: string; name: string; contentType: string; size: number };

// Files that can be a proposal, and words that mark one in the file name or the email subject.
const PROPOSAL_FILE = /\.(pdf|docx?|xlsx?)$/i;
const PROPOSAL_WORDS = /proposal|quote|quotation|estimate|recommendation plan|bid|pricing|scope of work|\bsow\b/i;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function looksLikeProposal(subject: string, a: AttachmentInfo) {
  return PROPOSAL_FILE.test(a.name) && a.size <= MAX_ATTACHMENT_BYTES && (PROPOSAL_WORDS.test(a.name) || PROPOSAL_WORDS.test(subject));
}

function signInError(code: string, fallback: string) {
  if (code.includes("AADSTS90002") || code.includes("AADSTS900023")) return "That Directory (tenant) ID wasn't found. Copy it from the app's Overview page in Azure.";
  if (code.includes("AADSTS700016")) return "No app with that Application (client) ID exists in this directory.";
  if (code.includes("AADSTS7000215") || code.includes("AADSTS7000222")) return "The client secret is wrong or expired. Copy the secret's Value (not its ID), or make a new one.";
  return fallback;
}

export async function getMailToken(c: MailCreds): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.tenantId.trim())}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: c.clientId.trim(),
        client_secret: c.secret,
        scope: "https://graph.microsoft.com/.default",
      }),
      cache: "no-store",
    });
  } catch {
    throw new MailError("Couldn't reach Microsoft. Try again.");
  }
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new MailError(signInError(body.error_description ?? "", "Microsoft wouldn't sign the app in. Check the three values."));
  return body.access_token;
}

async function call(token: string, path: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${GRAPH}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    throw new MailError("Couldn't reach Microsoft 365. Try again.");
  }
  if (res.ok) return res;
  const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  const code = body.error?.code ?? "";
  if (res.status === 401 || res.status === 403 || code === "ErrorAccessDenied" || code === "Authorization_RequestDenied") {
    throw new MailError("The app isn't allowed to read mail. Give it the Mail.Read application permission and grant admin consent (steps below).");
  }
  if (res.status === 404 || code === "MailboxNotEnabledForRESTAPI" || code === "ResourceNotFound" || code === "ErrorInvalidUser") {
    throw new MailError("No Microsoft 365 mailbox was found for this email address.");
  }
  throw new MailError(body.error?.message ? `Microsoft 365 said: ${body.error.message}` : `Microsoft 365 returned an error (${res.status}).`);
}

const user = (email: string) => `/users/${encodeURIComponent(email)}`;

// Sent emails with attachments, oldest first, sent after `after`.
export async function sentWithAttachments(token: string, email: string, after: Date, top = 25): Promise<SentMessage[]> {
  const q = new URLSearchParams({
    $filter: `sentDateTime gt ${after.toISOString()} and hasAttachments eq true`,
    $orderby: "sentDateTime asc",
    $top: String(top),
    $select: "id,internetMessageId,subject,sentDateTime,toRecipients",
  });
  const res = await call(token, `${user(email)}/mailFolders/sentitems/messages?${q}`);
  const body = (await res.json()) as {
    value: { id: string; internetMessageId?: string; subject?: string; sentDateTime: string; toRecipients?: { emailAddress?: { name?: string; address?: string } }[] }[];
  };
  return body.value.map((m) => ({
    id: m.id,
    internetMessageId: m.internetMessageId ?? m.id,
    subject: m.subject ?? "",
    sentDateTime: m.sentDateTime,
    to: (m.toRecipients ?? []).map((r) => r.emailAddress?.name || r.emailAddress?.address || "").filter(Boolean),
  }));
}

export async function listAttachments(token: string, email: string, messageId: string): Promise<AttachmentInfo[]> {
  const res = await call(token, `${user(email)}/messages/${encodeURIComponent(messageId)}/attachments?$select=id,name,contentType,size,isInline`);
  const body = (await res.json()) as { value: { "@odata.type"?: string; id: string; name?: string; contentType?: string; size?: number; isInline?: boolean }[] };
  return body.value
    .filter((a) => a["@odata.type"] === "#microsoft.graph.fileAttachment" && !a.isInline && a.name)
    .map((a) => ({ id: a.id, name: a.name!, contentType: a.contentType ?? "application/octet-stream", size: a.size ?? 0 }));
}

export async function attachmentBytes(token: string, email: string, messageId: string, attachmentId: string): Promise<Uint8Array<ArrayBuffer>> {
  const res = await call(token, `${user(email)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}/$value`);
  return new Uint8Array(await res.arrayBuffer());
}
