import Link from 'next/link';
import { PageTitle } from '@local/components/game';
import { PlayerAvatar } from '@local/components/game/PlayerAvatar';
import { requireGameSession } from '@local/lib/game-context';
import { resolvePlayerIdentity } from '@core/lib/game-engine/player-identity';
import { auth } from '@local/lib/auth/config';
import { LogoutLink } from '@local/components/oldskool/LogoutLink';
import { WireToggleForm } from '@local/features/settings/WireToggleForm';
import { FeedbackNote } from '@local/components/game/FeedbackNote';

export default async function SettingsPage() {
  const { ctx } = await requireGameSession();
  const session = await auth();
  const identity = resolvePlayerIdentity(ctx);
  const identityLabel =
    identity.avatarSource === 'UPLOAD'
      ? 'Uploaded PFP'
      : identity.avatarId
        ? identity.avatarId.charAt(0).toUpperCase() + identity.avatarId.slice(1)
        : 'Not set';

  return (
    <>
      <PageTitle icon="player">Settings</PageTitle>

      <div className="g-gameplay-controls g-settings-chrome">
      <section className="g-settings-section" aria-labelledby="settings-identity">
        <h2 id="settings-identity" className="g-settings-heading">
          Identity
        </h2>
        <div className="g-settings-identity-card">
          <PlayerAvatar
            identity={ctx}
            alt={ctx.alias}
            size="lg"
            shape="square"
            priority
          />
          <div className="g-settings-identity-meta">
            <p className="g-settings-label">Alias</p>
            <p className="g-settings-value">{ctx.alias}</p>
            <p className="g-settings-label">Portrait</p>
            <p className="g-settings-value">{identityLabel}</p>
            <p className="g-settings-label">Accent theme</p>
            <p className="g-settings-accent-swatch">
              <span style={{ background: identity.theme.primary }} aria-hidden />
              <span style={{ background: identity.theme.secondary }} aria-hidden />
            </p>
            <Link href="/identity/select?from=settings" className="g-btn">
              Change your identity
            </Link>
          </div>
        </div>
        <FeedbackNote tone="info">
          Your PFP and accent colours are visible to other Operators in Rankings, Intel, Factions, and Reports.
        </FeedbackNote>
      </section>

      <section className="g-settings-section" aria-labelledby="settings-profile">
        <h2 id="settings-profile" className="g-settings-heading">
          Profile
        </h2>
        <p className="g-note">
          Alias: <strong>{ctx.alias}</strong>
        </p>
        <p className="g-note g-settings-muted">
          Alias changes are not available in this release.
        </p>
      </section>

      <section className="g-settings-section" aria-labelledby="settings-display">
        <h2 id="settings-display" className="g-settings-heading">
          THE WIRE
        </h2>
        <p className="g-note g-settings-label">Voice Commands</p>
        <WireToggleForm initialEnabled={ctx.wireEnabled} />
      </section>

      <section className="g-settings-section" aria-labelledby="settings-account">
        <h2 id="settings-account" className="g-settings-heading">
          Account
        </h2>
        {session?.user?.email && (
          <p className="g-note">
            Email: <span className="g-settings-value">{session.user.email}</span>
          </p>
        )}
        <p className="g-note">
          <LogoutLink />
        </p>
      </section>
      </div>
    </>
  );
}
