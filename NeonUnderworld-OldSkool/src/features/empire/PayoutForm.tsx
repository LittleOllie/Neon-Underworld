'use client';

import { useEffect, useState } from 'react';
import {
  updatePayoutAction,
  previewPayoutAction,
} from '@local/server/actions/empire.actions';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import { EMPIRE_PAYOUT_RULES } from '@local/config/empire-rules';
import { payoutTradeOffDescription } from '@core/lib/game-engine/supply-status';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { ACTION_PENDING } from '@local/lib/loading-copy';

interface PayoutFormProps {
  initialPayout: number;
}

export function PayoutForm({ initialPayout }: PayoutFormProps) {
  const reconcile = useGameplayReconcile();
  const [payout, setPayout] = useState(initialPayout);
  const [preview, setPreview] = useState<{ effects: string[] } | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  const proposedTrade = payout !== initialPayout ? payoutTradeOffDescription(payout) : null;

  useEffect(() => {
    if (payout === initialPayout) {
      setPreview(null);
      setPreviewError('');
      return;
    }
    let cancelled = false;
    setPreviewError('');
    previewPayoutAction(payout).then((result) => {
      if (cancelled) return;
      if (!result.success) {
        setPreview(null);
        setPreviewError(result.error);
        return;
      }
      setPreview({ effects: result.data.effects });
    });
    return () => {
      cancelled = true;
    };
  }, [payout, initialPayout]);

  async function handleUpdate() {
    if (pending) return;
    setPending(true);
    setMessage('');
    try {
      const result = await updatePayoutAction(payout);
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      setMessage(`Payout updated to ${result.data.payoutPercent}%.`);
      setPayout(result.data.payoutPercent);
      if (result.data.shell) reconcile(result.data.shell);
    } finally {
      setPending(false);
    }
  }

  return (
    <div aria-busy={pending || undefined}>
      <div className="g-stepper">
        <button
          type="button"
          className="g-stepper-btn"
          disabled={pending}
          onClick={() =>
            setPayout((p) => Math.max(EMPIRE_PAYOUT_RULES.minPercent, p - EMPIRE_PAYOUT_RULES.increment))
          }
          aria-label="Decrease payout"
        >
          −
        </button>
        <span className="g-stepper-value">{payout}%</span>
        <button
          type="button"
          className="g-stepper-btn"
          disabled={pending}
          onClick={() =>
            setPayout((p) => Math.min(EMPIRE_PAYOUT_RULES.maxPercent, p + EMPIRE_PAYOUT_RULES.increment))
          }
          aria-label="Increase payout"
        >
          +
        </button>
      </div>

      {proposedTrade && (
        <p className="g-note">
          {proposedTrade.playerRetention} · Morale: {proposedTrade.moraleEffect}
        </p>
      )}

      {preview && payout !== initialPayout && (
        <ul className="g-note">
          {preview.effects.map((effect) => (
            <li key={effect}>{effect}</li>
          ))}
        </ul>
      )}

      {previewError && <p className="g-error">{previewError}</p>}

      <PrimaryButton
        className="g-btn-save"
        icon="payout"
        onClick={handleUpdate}
        disabled={pending || payout === initialPayout}
        pending={pending}
      >
        {pending ? ACTION_PENDING.payout : 'Save Payout'}
      </PrimaryButton>

      {message && (
        <p className={message.includes('updated') ? 'g-success' : 'g-error'}>{message}</p>
      )}
    </div>
  );
}
