'use client';

import { useEffect, useRef } from 'react';
import { GameIcon } from '@local/components/game/GameIcon';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { WIRE_EXAMPLE_COMMANDS } from '@local/lib/wire/stat-display';
import type { WirePanelController } from './useWirePanel';
import { useWireSpeech } from './useWireSpeech';

export function WirePanel({ wire }: { wire: WirePanelController }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    open,
    input,
    setInput,
    panelPhase,
    close,
    submitCommand,
    confirmPurchase,
    cancelConfirm,
    helpExamples,
    hireSoonMessage,
  } = wire;

  const speech = useWireSpeech({
    panelOpen: open,
    onFinalTranscript: submitCommand,
  });

  useEffect(() => {
    if (open && inputRef.current && panelPhase.phase !== 'pending' && !speech.listening) {
      const id = window.requestAnimationFrame(() => inputRef.current?.focus());
      return () => window.cancelAnimationFrame(id);
    }
  }, [open, panelPhase.phase, speech.listening]);

  if (!open) return null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    submitCommand(input);
  }

  function handleClose() {
    speech.abort();
    close();
  }

  const headerStatus = speech.listening
    ? 'NETWORK LISTENING…'
    : panelPhase.phase === 'pending'
      ? 'PROCESSING COMMAND…'
      : 'NETWORK ONLINE';

  return (
    <>
      <button type="button" className="g-wire-overlay" aria-label="Close THE WIRE" onClick={handleClose} />
      <div
        className={`g-wire-panel${speech.listening ? ' g-wire-panel--listening' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="THE WIRE"
        data-testid="wire-panel"
      >
        <header className="g-wire-header">
          <div>
            <p className="g-wire-eyebrow">THE WIRE</p>
            <p className="g-wire-status" data-testid="wire-status">
              {headerStatus}
            </p>
          </div>
          <button type="button" className="g-wire-close" onClick={handleClose} aria-label="Close">
            ×
          </button>
        </header>

        {(speech.lastHeard || speech.interimTranscript) && (
          <div className="g-wire-heard" data-testid="wire-you-said">
            <p className="g-wire-hint">{speech.listening && speech.interimTranscript ? 'HEARING…' : 'YOU SAID'}</p>
            <code>{speech.lastHeard ?? speech.interimTranscript}</code>
          </div>
        )}

        {speech.voiceError && (
          <p className="g-wire-voice-error" data-testid="wire-voice-error">
            {speech.voiceError}
            {speech.voiceError === 'MICROPHONE ACCESS DENIED' && (
              <span className="g-wire-voice-error-note"> Typed commands still work. </span>
            )}
          </p>
        )}

        {speech.support === 'unsupported' && (
          <p className="g-wire-voice-unavailable" data-testid="wire-voice-unavailable">
            VOICE UNAVAILABLE ON THIS DEVICE
          </p>
        )}

        <WirePanelBody
          phase={panelPhase}
          helpExamples={helpExamples}
          hireSoonMessage={hireSoonMessage}
          onConfirm={confirmPurchase}
          onCancel={cancelConfirm}
        />

        <form className="g-wire-form" onSubmit={handleSubmit}>
          <button
            type="button"
            className={`g-wire-mic${speech.listening ? ' g-wire-mic--active' : ''}`}
            aria-label={speech.listening ? 'Stop listening' : 'Start voice command'}
            aria-pressed={speech.listening}
            disabled={speech.support === 'unsupported' || panelPhase.phase === 'pending'}
            onClick={speech.toggleListening}
            data-testid="wire-mic"
          >
            <GameIcon name="mic" size={20} />
          </button>
          <label className="g-wire-input-wrap">
            <span className="g-wire-prompt">&gt;</span>
            <input
              ref={inputRef}
              type="text"
              className="g-wire-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="buy max aks"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              disabled={panelPhase.phase === 'pending' || speech.listening}
              data-testid="wire-input"
            />
          </label>
          <PrimaryButton
            type="submit"
            className="g-wire-send"
            icon="wire"
            disabled={panelPhase.phase === 'pending' || speech.listening || !input.trim()}
            pending={panelPhase.phase === 'pending'}
          >
            Send
          </PrimaryButton>
        </form>
      </div>
    </>
  );
}

function WirePanelBody({
  phase,
  helpExamples,
  hireSoonMessage,
  onConfirm,
  onCancel,
}: {
  phase: WirePanelController['panelPhase'];
  helpExamples: readonly string[];
  hireSoonMessage: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (phase.phase === 'idle') {
    return (
      <div className="g-wire-body g-wire-body--idle">
        <p className="g-wire-hint">TRY:</p>
        <ul className="g-wire-examples">
          {WIRE_EXAMPLE_COMMANDS.map((example) => (
            <li key={example}>
              <code>{example}</code>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (phase.phase === 'stat') {
    return (
      <div className="g-wire-body" data-testid="wire-result">
        <p className="g-wire-result-label">{phase.label}</p>
        <p className="g-wire-result-value">{phase.value}</p>
        <p className="g-wire-command-echo">&gt; {phase.command}</p>
      </div>
    );
  }

  if (phase.phase === 'confirm') {
    const { preview } = phase;
    return (
      <div className="g-wire-body" data-testid="wire-confirm">
        <p className="g-wire-result-label">ORDER READY</p>
        <p className="g-wire-order-line">
          {preview.displayName} × {preview.quantity.toLocaleString()}
        </p>
        <dl className="g-wire-order-details">
          <div>
            <dt>Unit price</dt>
            <dd>${preview.unitPrice.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>${preview.totalCost.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Cash after</dt>
            <dd>${preview.remainingCash.toLocaleString()}</dd>
          </div>
        </dl>
        <div className="g-wire-actions">
          <PrimaryButton type="button" icon="shop" onClick={onConfirm} data-testid="wire-confirm-purchase">
            Confirm Purchase
          </PrimaryButton>
          <PrimaryButton type="button" variant="secondary" onClick={onCancel} data-testid="wire-cancel-purchase">
            Cancel
          </PrimaryButton>
        </div>
      </div>
    );
  }

  if (phase.phase === 'insufficient') {
    return (
      <div className="g-wire-body g-wire-body--error" data-testid="wire-result">
        <p className="g-wire-result-label">{phase.title}</p>
        <p className="g-wire-result-message">{phase.message}</p>
        <p className="g-wire-command-echo">&gt; {phase.command}</p>
      </div>
    );
  }

  if (phase.phase === 'hire_soon') {
    return (
      <div className="g-wire-body" data-testid="wire-result">
        <p className="g-wire-result-label">{hireSoonMessage}</p>
        <p className="g-wire-command-echo">&gt; {phase.command}</p>
      </div>
    );
  }

  if (phase.phase === 'unknown') {
    return (
      <div className="g-wire-body g-wire-body--error" data-testid="wire-result">
        <p className="g-wire-result-label">COMMAND NOT RECOGNISED</p>
        {phase.reason && <p className="g-wire-result-message">{phase.reason}</p>}
        <p className="g-wire-hint">Try:</p>
        <ul className="g-wire-examples">
          {helpExamples.map((example) => (
            <li key={example}>
              <code>{example}</code>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (phase.phase === 'success') {
    return (
      <div className="g-wire-body g-wire-body--success" data-testid="wire-result">
        <p className="g-wire-result-label">ORDER COMPLETE</p>
        <p className="g-wire-order-line">
          {phase.quantity.toLocaleString()} × {phase.displayName} purchased
        </p>
        <p className="g-wire-result-message">
          Spent: ${phase.totalCost.toLocaleString()}
          <br />
          Cash remaining: ${phase.remainingCash.toLocaleString()}
        </p>
      </div>
    );
  }

  if (phase.phase === 'error') {
    return (
      <div className="g-wire-body g-wire-body--error" data-testid="wire-result">
        <p className="g-wire-result-label">ORDER FAILED</p>
        <p className="g-wire-result-message">{phase.message}</p>
        <p className="g-wire-command-echo">&gt; {phase.command}</p>
      </div>
    );
  }

  if (phase.phase === 'pending') {
    return (
      <div className="g-wire-body" data-testid="wire-pending">
        <p className="g-wire-result-label">TRANSMITTING ORDER…</p>
        <p className="g-wire-command-echo">&gt; {phase.command}</p>
      </div>
    );
  }

  return null;
}

export function WireFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="g-wire-fab"
      onClick={onClick}
      aria-label="Open THE WIRE"
      data-testid="wire-fab"
    >
      <GameIcon name="wire" size={20} />
      <span className="g-wire-fab-label">WIRE</span>
    </button>
  );
}
