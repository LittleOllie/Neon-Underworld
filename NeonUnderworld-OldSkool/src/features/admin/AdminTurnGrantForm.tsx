'use client';

import { useState } from 'react';
import { grantTurnsToPlayerAction } from '@core/server/actions/admin-operations.actions';

const PRESETS = [50, 100, 250, 500] as const;

export function AdminTurnGrantForm({ playerId, alias }: { playerId: string; alias: string }) {
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    const result = await grantTurnsToPlayerAction(playerId, amount, reason);
    setPending(false);
    setMessage(result.success ? `Granted. ${alias} now has ${result.data.newTurns} turns.` : result.error);
  }

  return (
    <section className="g-admin-panel">
      <h3>Grant turns to {alias}</h3>
      <div className="g-admin-form">
        <div className="g-admin-presets">
          {PRESETS.map((p) => (
            <button key={p} type="button" className="g-btn g-btn-secondary" onClick={() => setAmount(p)}>
              +{p}
            </button>
          ))}
        </div>
        <label className="g-field-label">
          Custom amount
          <input className="g-input" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </label>
        <label className="g-field-label">
          Reason
          <input className="g-input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <button type="button" className="g-btn" disabled={pending} onClick={submit}>
          Grant turns
        </button>
        {message ? <p className="g-note">{message}</p> : null}
      </div>
    </section>
  );
}
