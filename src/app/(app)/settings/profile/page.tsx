import { requireUser } from "@/lib/auth";
import { roleLabel } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { saveProfile } from "../actions";
import { ImageInput, SettingsForm } from "../forms";
import { PhotoUpload } from "@/components/photo-upload";
import { ThemePicker } from "@/components/theme-picker";
import { BackgroundUpload } from "@/components/background-upload";
import { backgroundUrl, photoUrl } from "@/lib/photos";
import { PasswordForm } from "./password-form";
import { endRepPreview, startRepPreview } from "../../preview-actions";

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="My profile" subtitle={`${user.email} · ${roleLabel(user.role)}`} />
      <div className="card p-5">
        <label className="label">Appearance</label>
        <ThemePicker current={user.theme} />
        <label className="label mt-5">Background picture</label>
        <BackgroundUpload current={backgroundUrl(user)} />
      </div>
      <div className="card p-5">
        <label className="label">Photo</label>
        <PhotoUpload userId={user.id} name={user.name} photoUrl={photoUrl(user)} size="lg" />
      </div>
      <div className="card p-5">
        <SettingsForm action={saveProfile}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input className="input" id="name" name="name" defaultValue={user.name} required />
            </div>
            <div>
              <label className="label" htmlFor="title">Title on quotes</label>
              <input className="input" id="title" name="title" defaultValue={user.title ?? ""} placeholder="Commercial Sales Manager" />
            </div>
          </div>
          <ImageInput
            name="signature"
            label="Signature"
            defaultValue={user.signature}
            hint="Printed on the cover and sign-off of quotes you prepare. Sign on white paper, photograph it, and crop it tight."
          />
        </SettingsForm>
      </div>
      {(user.role === "ADMIN" || user.previewing) && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="font-semibold">Preview as a sales rep</h2>
            <p className="text-sm text-slate-500">See Mothership the way a sales rep does: only your own accounts, contacts and quotes, and no admin tabs or settings. Turn it off from the banner at the top of any page.</p>
          </div>
          <form action={user.previewing ? endRepPreview : startRepPreview}>
            <button className={user.previewing ? "btn" : "btn btn-primary"}>{user.previewing ? "Exit preview" : "Start preview"}</button>
          </form>
        </div>
      )}
      <div className="card p-5">
        <h2 className="mb-3 font-semibold">Password</h2>
        <PasswordForm />
      </div>
    </div>
  );
}
