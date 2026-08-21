import { requireGameSession } from '@local/lib/game-context';
import { IdentitySetupClient } from '@local/features/identity/IdentitySetupClient';
import type { PlayerIdentityRecord } from '@core/lib/game-engine/player-identity';

interface Props {
  searchParams: Promise<{ from?: string }>;
}

export default async function IdentitySelectPage({ searchParams }: Props) {
  const params = await searchParams;
  const { ctx } = await requireGameSession();
  const fromSettings = params.from === 'settings';

  const initial: PlayerIdentityRecord = {
    avatar: ctx.avatar,
    avatarSource: ctx.avatarSource,
    pfpUrl: ctx.pfpUrl,
    themePrimary: ctx.themePrimary,
    themeSecondary: ctx.themeSecondary,
  };

  return (
    <IdentitySetupClient
      alias={ctx.alias}
      initial={initial}
      flow={fromSettings ? 'settings' : 'onboarding'}
      returnTo={fromSettings ? '/settings' : '/command'}
    />
  );
}
