'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  updatePayoutAction,
  previewPayoutAction,
} from '@local/server/actions/empire.actions';
import { EMPIRE_PAYOUT_RULES } from '@local/config/empire-rules';
import { payoutTradeOffDescription } from '@core/lib/game-engine/supply-status';
import { PrimaryButton } from '@local/components/game/PrimaryButton';

interface PayoutFormProps {
  initialPayout: number;
}

export function PayoutForm({ initialPayout }: PayoutFormProps) {
  const router = useRouter();
  const [payout, setPayout] = useState(initialPayout);
  const [preview, setPreview] = useState<{ effects: string[] } | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const proposedTrade = payout !== initialPayout ? payoutTradeOffDescription(payout) : null;

  useEffect(() => {
    if (payout === initialPayout) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    previewPayoutAction(payout).then((result) => {
      if (cancelled || !result.success) return;
      setPreview({ effects: result.data.effects });
    });
    return () => {
      cancelled = true;
    };
  }, [payout, initialPayout]);

  async function handleUpdate() {
    setLoading(true);
    setMessage('');
    const result = await updatePayoutAction(payout);
    setLoading(false);
    if (!result.success) {
      setMessage(result.error);
      return;
    }
    setMessage(`Payout updated to ${result.data.payoutPercent}%.`);
    router.refresh();
  }

  return (
    <div>
      <div className="g-stepper">
        <button
          type="button"
          className="g-stepper-btn"
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
          {proposedTrade.playerRetention} · {proposedTrade.workerStability}
        </p>
      )}

      {preview && payout !== initialPayout && (
        <ul className="g-note">
          {preview.effects.map((effect) => (
            <li key={effect}>{effect}</li>
          ))}
        </ul>
      )}

      <PrimaryButton
        className="g-btn-save"
        icon="payout"
        onClick={handleUpdate}
        disabled={loading || payout === initialPayout}
      >
        {loading ? 'Saving…' : 'Save Payout'}
      </PrimaryButton>

      {message && (
        <p className={message.includes('updated') ? 'g-success' : 'g-error'}>{message}</p>
      )}
    </div>
  );
}
