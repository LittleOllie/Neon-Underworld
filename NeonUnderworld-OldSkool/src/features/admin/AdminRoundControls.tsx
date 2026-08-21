'use client';

import { useState } from 'react';
import {
  endRoundAction,
  getEndRoundPreviewAction,
  getStartRoundPreviewAction,
  startNextRoundAction,
} from '@core/server/actions/admin-operations.actions';

type SeasonInfo = {
  id: string;
  number: number;
  name: string;
  status: string;
} | null;

export function AdminRoundControls({ season }: { season: SeasonInfo }) {
  const [endPreview, setEndPreview] = useState<Awaited<ReturnType<typeof getEndRoundPreviewAction>> | null>(null);
  const [startPreview, setStartPreview] = useState<Awaited<ReturnType<typeof getStartRoundPreviewAction>> | null>(
    null,
  );
  const [endConfirm, setEndConfirm] = useState('');
  const [startConfirm, setStartConfirm] = useState('');
  const [durationDays, setDurationDays] = useState(7);
  const [message, setMessage] = useState('');

  async function previewEnd() {
    if (!season) return;
    setEndPreview(await getEndRoundPreviewAction(season.id));
  }

  async function previewStart() {
    setStartPreview(await getStartRoundPreviewAction(durationDays));
  }

  async function submitEnd() {
    if (!season) return;
    const result = await endRoundAction(season.id, endConfirm);
    setMessage(result.success ? 'Round ended and archived.' : result.error);
  }

  async function submitStart() {
    const result = await startNextRoundAction(startConfirm, durationDays);
    setMessage(result.success ? `Started round ${result.data.seasonNumber}.` : result.error);
  }

  return (
    <section className="g-admin-panel g-admin-panel--danger">
      <h2>Round management</h2>
      {season ? (
        <>
          <button type="button" className="g-btn g-btn-secondary" onClick={previewEnd}>
            Preview end round
          </button>
          {endPreview ? (
            <div className="g-admin-preview">
              <p>Round {endPreview.seasonNumber}: {endPreview.activatedHumans} activated humans</p>
              <p>NPCs: {endPreview.npcCount}</p>
              <p>Leader: {endPreview.leaderAlias ?? '—'} ({endPreview.leaderNetWorth?.toLocaleString() ?? '—'} Influence)</p>
              <label className="g-field-label">
                Type END ROUND {endPreview.seasonNumber}
                <input className="g-input" value={endConfirm} onChange={(e) => setEndConfirm(e.target.value)} />
              </label>
              <button type="button" className="g-btn g-btn-danger" onClick={submitEnd}>
                End current round
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <button type="button" className="g-btn g-btn-secondary" onClick={previewStart}>
        Preview start next round
      </button>
      {startPreview ? (
        <div className="g-admin-preview">
          <p>Next round #{startPreview.nextNumber} · {startPreview.durationDays} days</p>
          <p>Will reset {startPreview.willResetHumans} human accounts (not activated until login)</p>
          <label className="g-field-label">
            Duration (days)
            <div className="g-admin-duration-row">
              <button
                type="button"
                className={`g-btn g-btn-secondary${durationDays === 7 ? ' g-btn--active' : ''}`}
                onClick={() => setDurationDays(7)}
              >
                7 days (test)
              </button>
              <button
                type="button"
                className={`g-btn g-btn-secondary${durationDays === 30 ? ' g-btn--active' : ''}`}
                onClick={() => setDurationDays(30)}
              >
                30 days
              </button>
            </div>
            <input
              className="g-input"
              type="number"
              min={1}
              max={60}
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
            />
          </label>
          <label className="g-field-label">
            Type START ROUND {startPreview.nextNumber}
            <input className="g-input" value={startConfirm} onChange={(e) => setStartConfirm(e.target.value)} />
          </label>
          <button type="button" className="g-btn" onClick={submitStart}>
            Start next round
          </button>
        </div>
      ) : null}
      {message ? <p className="g-note">{message}</p> : null}
    </section>
  );
}
