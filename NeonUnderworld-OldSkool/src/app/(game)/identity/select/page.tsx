import { requireGameSession } from '@local/lib/game-context';
import { AvatarSelectionClient } from '@local/features/identity/AvatarSelectionClient';
import { resolvePlayerAvatarId } from '@core/lib/game-engine/resolve-player-avatar';

interface Props {
  searchParams: Promise<{ from?: string }>;
}

export default async function IdentitySelectPage({ searchParams }: Props) {
  const params = await searchParams;
  const { ctx } = await requireGameSession();
  const fromSettings = params.from === 'settings';

  return (
    <AvatarSelectionClient
      alias={ctx.alias}
      initialAvatarId={ctx.avatar ? resolvePlayerAvatarId(ctx.avatar) : null}
      mode={fromSettings ? 'settings' : 'onboarding'}
      returnTo={fromSettings ? '/settings' : '/command'}
    />
  );
}
