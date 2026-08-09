'use client';

import { useRouter } from 'next/navigation';
import { markAllReportsReadAction } from '@local/server/actions/report.actions';
import { PrimaryButton } from '@local/components/game/PrimaryButton';

export function MarkAllReadButton() {
  const router = useRouter();

  async function handleClick() {
    await markAllReportsReadAction();
    router.refresh();
  }

  return (
    <PrimaryButton variant="secondary" icon="reports" onClick={handleClick}>
      Mark all read
    </PrimaryButton>
  );
}
