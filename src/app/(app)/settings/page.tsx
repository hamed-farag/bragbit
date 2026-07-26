import { Download } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { ChangeEmailForm } from "@/features/account/components/change-email-form";
import { ChangePasswordForm } from "@/features/account/components/change-password-form";
import { DeleteAccountForm } from "@/features/account/components/delete-account-form";
import { listDocuments } from "@/features/document/queries";
import {
  IntegrationCards,
  type ProviderCardData,
} from "@/features/integrations/components/integration-cards";
import { IntegrationFlash } from "@/features/integrations/components/integration-flash";
import {
  ReviewQueue,
  type CandidateView,
  type DocumentOption,
} from "@/features/integrations/components/review-queue";
import { availableProviderDescriptors } from "@/features/integrations/providers";
import { listCandidates, listConnections } from "@/features/integrations/queries";
import { ConnectedApps } from "@/features/oauth-clients/components/connected-apps";
import { RefreshOnReturn } from "@/features/oauth-clients/components/refresh-on-return";
import { listConnectedApps } from "@/features/oauth-clients/queries";
import { getProfile } from "@/features/profile/queries";
import { env } from "@/lib/env";
import { ReminderSettingsForm } from "@/features/reminder/components/reminder-settings-form";
import { getActiveWorkspace } from "@/features/workspace/queries";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ integration?: string }>;
}) {
  const { integration } = await searchParams;
  const { user, workspace } = await getActiveWorkspace();
  const profile = await getProfile(user.id);
  const connectedApps = await listConnectedApps(user.id);
  // The MCP server endpoint a client connects to (NOT the bare origin — that
  // serves the app's HTML). It returns the 401 challenge from which the client
  // discovers the OAuth flow; that's the only URL a client needs.
  const mcpServerUrl = `${env.BETTER_AUTH_URL ?? env.APP_URL}/api/mcp`;

  // Integrations (docs/specs/integrations.md): the available providers plus the
  // caller's connections and pending imports, shaped into plain props for the cards.
  const providers = availableProviderDescriptors();
  const [connections, candidates, documents] = await Promise.all([
    listConnections(user.id, workspace.id),
    listCandidates(user.id, workspace.id),
    listDocuments(),
  ]);
  const integrationCards: ProviderCardData[] = providers.map((p) => {
    const conn = connections.find((c) => c.provider === p.id) ?? null;
    return {
      id: p.id,
      label: p.label,
      supportsPat: p.supportsPat,
      oauthConfigured: p.oauthConfigured,
      connection: conn
        ? {
            authType: conn.authType,
            externalAccountLabel: conn.externalAccountLabel,
            lastSyncedAt: conn.lastSyncedAt ? conn.lastSyncedAt.toISOString() : null,
          }
        : null,
    };
  });
  const candidateViews: CandidateView[] = candidates.map((c) => ({
    id: c.id,
    provider: c.provider,
    title: c.title,
    externalUrl: c.externalUrl,
    occurredAt: c.occurredAt ? c.occurredAt.toISOString() : null,
  }));
  const documentOptions: DocumentOption[] = documents.map((d) => ({ id: d.id, title: d.title }));

  return (
    <div className="content-wide flex flex-col gap-8">
      <header>
        <h1 className="font-serif text-[28px] leading-tight font-semibold tracking-[-0.01em]">
          Account settings
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          Manage how you sign in. These control your account, not your workspace.
        </p>
      </header>

      <section className="rounded-xl border border-line bg-card p-6 shadow-card">
        <h2 className="mb-1 font-serif text-lg font-semibold">Email address</h2>
        <p className="mb-5 text-[13px] text-ink-soft">
          Changing your email sends a confirmation link to your current inbox; the change applies
          only after you click it.
        </p>
        <ChangeEmailForm currentEmail={user.email} />
      </section>

      <section className="rounded-xl border border-line bg-card p-6 shadow-card">
        <h2 className="mb-1 font-serif text-lg font-semibold">Password</h2>
        <p className="mb-5 text-[13px] text-ink-soft">
          Choose a strong password. Changing it signs out your other sessions.
        </p>
        <ChangePasswordForm />
      </section>

      <section className="rounded-xl border border-line bg-card p-6 shadow-card">
        <h2 className="mb-1 font-serif text-lg font-semibold">Weekly reminders</h2>
        <p className="mb-5 text-[13px] text-ink-soft">
          A gentle nudge to log what you shipped — capture wins while they&apos;re fresh, not at
          review time.
        </p>
        <ReminderSettingsForm
          initial={{
            enabled: profile?.reminderEnabled ?? false,
            day: profile?.reminderDay ?? null,
            timezone: profile?.timezone ?? null,
          }}
        />
      </section>

      <section className="rounded-xl border border-line bg-card p-6 shadow-card">
        <h2 className="mb-1 font-serif text-lg font-semibold">Export your data</h2>
        <p className="mb-5 text-[13px] text-ink-soft">
          Download everything you&apos;ve logged — every document and brag, including private and
          archived ones — as a single JSON file. Your data is always yours to take.
        </p>
        <a
          href="/api/export/data"
          className={buttonVariants({ variant: "outline", size: "sm" })}
          download
        >
          <Download className="size-3.5" aria-hidden />
          Download JSON
        </a>
      </section>

      <section
        id="integrations"
        className="rounded-xl border border-line bg-card p-6 shadow-card"
        style={{ scrollMarginTop: "80px" }}
      >
        <h2 className="mb-1 font-serif text-lg font-semibold">Integrations</h2>
        <p className="mb-5 text-[13px] text-ink-soft">
          Connect your tools and let BragBit pull in your shipped work. Imports land in a review
          queue — nothing is logged until you approve it.
        </p>
        <IntegrationFlash status={integration} />
        <IntegrationCards cards={integrationCards} />
        {candidateViews.length > 0 && (
          <div className="mt-6 border-t border-line pt-6">
            <h3 className="mb-4 font-serif text-base font-semibold">Review imported items</h3>
            <ReviewQueue candidates={candidateViews} documents={documentOptions} />
          </div>
        )}
      </section>

      {/* id: the dashboard's connector hint links straight here. */}
      <section
        id="connected-apps"
        className="rounded-xl border border-line bg-card p-6 shadow-card"
        style={{ scrollMarginTop: "80px" }}
      >
        <h2 className="mb-1 font-serif text-lg font-semibold">Connected apps</h2>
        <p className="mb-5 text-[13px] text-ink-soft">
          AI assistants you&apos;ve authorized to log brags on your behalf through the MCP
          connector. Revoking an app invalidates its access immediately.
        </p>
        <RefreshOnReturn />
        <ConnectedApps apps={connectedApps} mcpServerUrl={mcpServerUrl} />
      </section>

      <section className="rounded-xl border border-dashed border-destructive/40 bg-card p-6 shadow-card">
        <h2 className="mb-1 font-serif text-lg font-semibold text-destructive">Danger zone</h2>
        <p className="mb-5 text-[13px] text-ink-soft">
          Delete your account and your data. This can&apos;t be undone.
        </p>
        <DeleteAccountForm isSoloOwner={workspace.type === "personal"} />
      </section>
    </div>
  );
}
