'use client';

import { useState, useTransition } from 'react';
import { setWireEnabledAction } from '@local/server/actions/player-wire.actions';

type WireToggleValue = 'off' | 'on';

export function WireToggleForm({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const value: WireToggleValue = enabled ? 'on' : 'off';

  function handleChange(next: WireToggleValue) {
    const nextEnabled = next === 'on';
    if (nextEnabled === enabled || pending) return;

    setError('');
    const previous = enabled;
    setEnabled(nextEnabled);

    startTransition(async () => {
      const result = await setWireEnabledAction(nextEnabled);
      if (!result.success) {
        setEnabled(previous);
        setError(result.error);
        return;
      }
      setEnabled(result.data.wireEnabled);
    });
  }

  return (
    <div className="g-settings-wire">
      <p className="g-note g-settings-wire-desc">
        Issue commands to your network using voice or text.
      </p>
      <div className="g-shop-mode g-settings-wire-toggle" role="group" aria-label="THE WIRE">
        <button
          type="button"
          className={`g-shop-mode-btn${value === 'off' ? ' g-shop-mode-btn--active' : ''}`}
          aria-pressed={value === 'off'}
          disabled={pending}
          onClick={() => handleChange('off')}
        >
          OFF
        </button>
        <button
          type="button"
          className={`g-shop-mode-btn${value === 'on' ? ' g-shop-mode-btn--active' : ''}`}
          aria-pressed={value === 'on'}
          disabled={pending}
          onClick={() => handleChange('on')}
        >
          {pending ? 'Saving…' : 'ON'}
        </button>
      </div>
      {error && <p className="g-error">{error}</p>}
    </div>
  );
}
