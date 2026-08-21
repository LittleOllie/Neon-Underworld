'use client';

import { useState } from 'react';
import {
  grantBulkTurnsAction,
  previewBulkTurnGrantAction,
} from '@core/server/actions/admin-operations.actions';

const PRESETS = [50, 100, 250, 500] as const;

export function AdminBulkTurnGrant({ seasonId }: { seasonId: string }) {
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function loadPreview() {
    const result = await previewBulkTurnGrantAction();
    if (result.success) setPreviewCount(result.data.affectedCount);
  }

  async function submit() {
    setPending(true);
    setMessage('');
    const result = await grantBulkTurnsAction(amount, reason, confirmation);
    setPending(false);
    if (result.success) {
      setMessage(`Granted to ${result.data.affectedCount} activated human players.`);
      setConfirmation('');
    } else {
      setMessage(result.error);
    }
  }

  return (
    <section className="g-admin-panel">
      <h2>Bulk turn grant</h2>
      <p className="g-note">Activated human players only — excludes NPCs and inactive accounts.</p>
      <div className="g-admin-form">
        <div className="g-admin-presets">
          {PRESETS.map((p) => (
            <button key={p} type="button" className="g-btn g-btn-secondary" onClick={() => setAmount(p)}>
              +{p}
            </button>
          ))}
        </div>
        <label className="g-field-label">
          Amount
          <input
            className="g-input"
            type="number"
            min={1}
            max={10000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>
        <label className="g-field-label">
          Reason
          <input className="g-input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <button type="button" className="g-btn g-btn-secondary" onClick={loadPreview}>
          Preview affected count
        </button>
        {previewCount != null ? (
          <p className="g-note">Will affect {previewCount} activated human players.</p>
        ) : null}
        <label className="g-field-label">
          Confirmation (type GRANT {amount} TO {previewCount ?? '?'})
          <input className="g-input" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        </label>
        <button type="button" className="g-btn" disabled={pending} onClick={submit}>
          Grant bulk turns
        </button>
        {message ? <p className="g-note">{message}</p> : null}
      </div>
    </section>
  );
}
