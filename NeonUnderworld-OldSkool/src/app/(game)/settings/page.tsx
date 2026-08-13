import Link from 'next/link';
import { PageTitle } from '@local/components/game';
import { PlayerAvatar } from '@local/components/game/PlayerAvatar';
import { requireGameSession } from '@local/lib/game-context';
import { resolvePlayerAvatarConfig } from '@core/lib/game-engine/resolve-player-avatar';
import { auth } from '@local/lib/auth/config';
import { LogoutLink } from '@local/components/oldskool/LogoutLink';

export default async function SettingsPage() {
  const { ctx } = await requireGameSession();
  const session = await auth();
  const avatarConfig = resolvePlayerAvatarConfig(ctx.avatar);

  return (
    <>
      <PageTitle icon="player">Settings</PageTitle>

      <section className="g-settings-section" aria-labelledby="settings-identity">
        <h2 id="settings-identity" className="g-settings-heading">
          Identity
        </h2>
        <div className="g-settings-identity-card">
          <PlayerAvatar avatarId={ctx.avatar} alt={ctx.alias} size="lg" priority />
          <div className="g-settings-identity-meta">
            <p className="g-settings-label">Alias</p>
            <p className="g-settings-value">{ctx.alias}</p>
            <p className="g-settings-label">Accent preview</p>
            <p className="g-settings-accent-swatch">
              <span style={{ background: avatarConfig.primary }} aria-hidden />
              <span style={{ background: avatarConfig.secondary }} aria-hidden />
            </p>
            <Link href="/identity/select?from=settings" className="g-btn">
              Change avatar
            </Link>
          </div>
        </div>
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
          Gameplay / Display
        </h2>
        <p className="g-note">
          Avatar accent colours apply across the interface. Semantic colours for danger, success, and
          critical states are unchanged.
        </p>
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
    </>
  );
}
