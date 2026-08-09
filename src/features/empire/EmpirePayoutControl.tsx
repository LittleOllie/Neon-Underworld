'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updatePayoutAction } from '@/server/actions/empire.actions';
import { Check } from 'lucide-react';

interface EmpirePayoutControlProps {
  initialPayout: number;
}

export function EmpirePayoutControl({ initialPayout }: EmpirePayoutControlProps) {
  const router = useRouter();
  const [payout, setPayout] = useState(initialPayout);
  const [savedPayout, setSavedPayout] = useState(initialPayout);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const hasChanges = payout !== savedPayout;

  async function handleUpdate() {
    if (!hasChanges) return;
    setLoading(true);
    setMessage('');
    setSuccess(false);
    const result = await updatePayoutAction(payout);
    setLoading(false);
    if (result.success) {
      setSavedPayout(payout);
      setSuccess(true);
      setMessage(`Saved. Happiness now ${result.data.prostituteHappiness}%.`);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setMessage(result.error);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-label">Payout percentage</p>
          <p className="font-mono-figures text-2xl font-medium text-gold">{payout}%</p>
        </div>
        <p className="text-xs text-muted">Higher payout reduces happiness</p>
      </div>
      <input
        id="payout"
        type="range"
        min={10}
        max={90}
        value={payout}
        onChange={(e) => {
          setPayout(parseInt(e.target.value));
          setSuccess(false);
        }}
        aria-valuemin={10}
        aria-valuemax={90}
        aria-valuenow={payout}
        aria-label="Prostitute payout percentage"
        className="mt-3 w-full accent-[var(--gold)]"
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>10%</span>
        <span>50%</span>
        <span>90%</span>
      </div>
      <button
        type="button"
        onClick={handleUpdate}
        disabled={loading || !hasChanges}
        className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-2.5 text-sm font-medium transition-all duration-200 hover:border-gold/30 disabled:opacity-40 active:scale-[0.98]"
      >
        {success ? (
          <>
            <Check className="h-4 w-4 text-green" aria-hidden />
            Saved
          </>
        ) : loading ? (
          'Saving…'
        ) : (
          'Update payout'
        )}
      </button>
      {message && !success && (
        <p className="mt-2 text-xs text-muted" role="status">{message}</p>
      )}
    </div>
  );
}
