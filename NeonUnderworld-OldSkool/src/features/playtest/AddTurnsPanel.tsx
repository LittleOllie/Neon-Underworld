'use client';

import { useState } from 'react';
import {
  grantPlaytestTurnsAction,
  type PlaytestTurnGrant,
} from '@local/server/actions/playtest.actions';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { ActionResult } from '@local/components/game/ActionResult';

interface AddTurnsPanelProps {
  currentTurns: number;
  turnCap: number;
}

const GRANTS: Array<{ grant: PlaytestTurnGrant; label: string }> = [
  { grant: '500', label: '+500 turns' },
  { grant: '1000', label: '+1,000 turns' },
  { grant: 'fill', label: 'Fill to cap' },
];

export function AddTurnsPanel({ currentTurns, turnCap }: AddTurnsPanelProps) {
  const reconcile = useGameplayReconcile();
  const [loading, setLoading] = useState<PlaytestTurnGrant | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<number | null>(null);

  async function handleGrant(grant: PlaytestTurnGrant) {
    setLoading(grant);
    setError('');
    setResult(null);
    const response = await grantPlaytestTurnsAction(grant);
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setResult(response.data.newTurns);
    reconcile(response.data.shell);
  }

  return (
    <div className="g-section">
      <p className="g-result-lines" style={{ marginTop: 0 }}>
        You have <strong>{currentTurns.toLocaleString()}</strong> of{' '}
        <strong>{turnCap.toLocaleString()}</strong> turns.
      </p>
      <p className="g-result-lines">
        Alpha playtest — add turns anytime to scout, produce, and attack without waiting on
        regeneration.
      </p>

      <div className="g-actions" style={{ marginTop: 12 }}>
        {GRANTS.map(({ grant, label }) => (
          <PrimaryButton
            key={grant}
            type="button"
            disabled={loading !== null || (grant !== 'fill' && currentTurns >= turnCap)}
            onClick={() => handleGrant(grant)}
          >
            {loading === grant ? 'Adding…' : label}
          </PrimaryButton>
        ))}
      </div>

      {error && (
        <p className="g-auth-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      {result !== null && (
        <ActionResult
          title="Turns updated"
          lines={[{ text: `You now have ${result.toLocaleString()} turns.` }]}
        />
      )}
    </div>
  );
}
