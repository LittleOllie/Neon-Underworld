'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { markAllReportsReadAction } from '@local/server/actions/report.actions';
import { PrimaryButton } from '@local/components/game/PrimaryButton';

export function MarkAllReadButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError('');
    const result = await markAllReportsReadAction();
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <PrimaryButton
        variant="secondary"
        icon="reports"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? 'Marking…' : 'Mark all read'}
      </PrimaryButton>
      {error && <p className="g-error">{error}</p>}
    </div>
  );
}
