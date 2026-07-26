import { BrandingForm } from "@/features/workspace/components/branding-form";
import { LogoUploader } from "@/features/workspace/components/logo-uploader";
import { getActiveWorkspace } from "@/features/workspace/queries";

export default async function AdminPage() {
  const { workspace } = await getActiveWorkspace();
  const logoUrl = workspace.logoKey ? `/api/files/${workspace.logoKey}` : null;
  const isOrg = workspace.type === "organization";

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-serif text-[28px] leading-tight font-semibold tracking-[-0.01em]">
          Workspace
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          Your workspace&apos;s name, accent, and logo — shown across the app
          {isOrg ? ", in invitations," : ""} and on documents you share.
        </p>
      </header>

      <section className="rounded-xl border border-line bg-card p-6 shadow-card">
        <h2 className="mb-1 font-serif text-lg font-semibold">Logo</h2>
        <p className="mb-5 text-[13px] text-ink-soft">
          Shown in the app header and on your sign-in and share pages.
        </p>
        <LogoUploader logoUrl={logoUrl} workspaceName={workspace.name} />
      </section>

      <section className="rounded-xl border border-line bg-card p-6 shadow-card">
        <h2 className="mb-1 font-serif text-lg font-semibold">Name &amp; accent</h2>
        <p className="mb-5 text-[13px] text-ink-soft">
          The accent tints buttons, highlights, and links throughout BragBit.
        </p>
        <BrandingForm
          initial={{ name: workspace.name, accentColor: workspace.accentColor ?? "#e8590c" }}
        />
      </section>
    </div>
  );
}
