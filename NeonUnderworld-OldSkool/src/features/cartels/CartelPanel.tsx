'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  acceptCartelInviteAction,
  createCartelAction,
  declineCartelInviteAction,
  inviteToCartelAction,
  leaveCartelAction,
  removeCartelMemberAction,
  setCartelDonationAction,
  type CartelPageData,
} from '@local/server/actions/cartel.actions';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { StatRow } from '@local/components/game/StatRow';
import { SectionLabel } from '@local/components/game/SectionLabel';
import { Divider } from '@local/components/game/Divider';

type Props = CartelPageData;

export function CartelPanel(initial: Props) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [inviteAlias, setInviteAlias] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  async function handleCreate() {
    setLoading('create');
    setError('');
    const response = await createCartelAction(name, tag);
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    router.refresh();
  }

  async function handleAccept(inviteId: string) {
    setLoading('accept');
    const response = await acceptCartelInviteAction(inviteId);
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    router.refresh();
  }

  async function handleDecline(inviteId: string) {
    await declineCartelInviteAction(inviteId);
    setData((prev) => ({
      ...prev,
      pendingInvites: prev.pendingInvites.filter((i) => i.id !== inviteId),
    }));
  }

  async function handleInvite() {
    setLoading('invite');
    setError('');
    const response = await inviteToCartelAction(inviteAlias);
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setInviteAlias('');
  }

  async function handleLeave() {
    setLoading('leave');
    const response = await leaveCartelAction();
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    router.refresh();
  }

  async function handleRemove(memberId: string) {
    setLoading('remove');
    const response = await removeCartelMemberAction(memberId);
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    router.refresh();
  }

  async function handleDonation(percent: number) {
    const response = await setCartelDonationAction(percent);
    if (response.success && data.cartel) {
      setData((prev) => ({
        ...prev,
        cartel: prev.cartel
          ? { ...prev.cartel, myDonationPercent: response.data.percent }
          : null,
      }));
    }
  }

  if (data.pendingInvites.length > 0 && !data.inCartel) {
    return (
      <>
        <SectionLabel>CARTEL INVITES</SectionLabel>
        {error && <p className="g-note g-note-error">{error}</p>}
        {data.pendingInvites.map((inv) => (
          <div key={inv.id} className="g-area-row">
            <div className="g-area-name">
              {inv.cartelName} [{inv.cartelTag}]
            </div>
            <div className="g-area-meta">Invited by {inv.inviterAlias}</div>
            <PrimaryButton
              icon="cartel"
              disabled={loading !== null}
              pending={loading === 'accept'}
              onClick={() => handleAccept(inv.id)}
            >
              {loading === 'accept' ? ACTION_PENDING.cartelJoin : 'Accept'}
            </PrimaryButton>
            <PrimaryButton disabled={loading !== null} onClick={() => handleDecline(inv.id)}>
              Decline
            </PrimaryButton>
          </div>
        ))}
      </>
    );
  }

  if (data.cartel) {
    const c = data.cartel;
    return (
      <>
        <div className="g-area-row g-area-row-selected">
          <div className="g-area-name">
            {c.name.toUpperCase()} [{c.tag}]
          </div>
          <div className="g-area-meta">
            {c.memberCount} / {c.maxMembers} members
          </div>
        </div>

        <StatRow label="Combined Net Worth" value={`$${c.combinedNetWorth.toLocaleString()}`} />
        <StatRow label="Treasury" value={`$${c.treasuryCash.toLocaleString()}`} />

        <Divider />

        <SectionLabel>MEMBERS</SectionLabel>
        {c.members.map((m) => (
          <StatRow
            key={m.id}
            label={`${m.alias}${m.isLeader ? ' (Leader)' : ''}`}
            value={`$${m.netWorth.toLocaleString()}`}
          />
        ))}

        {c.isLeader && (
          <>
            <Divider />
            <SectionLabel>INVITE PLAYER</SectionLabel>
            <input
              className="g-input"
              placeholder="Player alias"
              value={inviteAlias}
              onChange={(e) => setInviteAlias(e.target.value)}
            />
            <PrimaryButton
              icon="cartel"
              disabled={loading !== null || !inviteAlias.trim()}
              pending={loading === 'invite'}
              onClick={handleInvite}
            >
              {loading === 'invite' ? ACTION_PENDING.cartelInvite : 'Send Invite'}
            </PrimaryButton>
            {c.members
              .filter((m) => !m.isLeader)
              .map((m) => (
                <PrimaryButton key={m.id} disabled={loading !== null} onClick={() => handleRemove(m.id)}>
                  Remove {m.alias}
                </PrimaryButton>
              ))}
          </>
        )}

        <Divider />

        <SectionLabel>YOUR CONTRIBUTION</SectionLabel>
        <p className="g-note">Street income (Scout / Produce cash) — 0–60%</p>
        <select
          className="g-input"
          value={c.myDonationPercent}
          onChange={(e) => handleDonation(Number(e.target.value))}
        >
          {data.donationOptions.map((p) => (
            <option key={p} value={p}>
              {p}%
            </option>
          ))}
        </select>

        <Divider />

        {error && <p className="g-note g-note-error">{error}</p>}
        <PrimaryButton disabled={loading !== null} onClick={handleLeave}>
          Leave Cartel
        </PrimaryButton>
      </>
    );
  }

  return (
    <>
      <p className="g-note">Build your crew. Share protection. Rise together.</p>

      {error && <p className="g-note g-note-error">{error}</p>}

      {!showCreate ? (
        <>
          <PrimaryButton icon="cartel" disabled={loading !== null} onClick={() => setShowCreate(true)}>
            Create Cartel
          </PrimaryButton>
          <Divider />
          <SectionLabel>AVAILABLE CARTELS</SectionLabel>
          {data.browse.length === 0 && <p className="g-note">No cartels yet. Be the first.</p>}
          {data.browse.map((c) => (
            <div key={c.id} className="g-area-row">
              <div className="g-area-name">
                {c.name} [{c.tag}]
              </div>
              <div className="g-area-meta">
                {c.memberCount} / {c.maxMembers} members · Invite only
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          <SectionLabel>CREATE CARTEL</SectionLabel>
          <input
            className="g-input"
            placeholder="Cartel name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="g-input"
            placeholder="Tag (e.g. NS)"
            value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase())}
          />
          <PrimaryButton
            icon="cartel"
            disabled={loading !== null || name.length < 3 || tag.length < 2}
            pending={loading === 'create'}
            onClick={handleCreate}
          >
            {loading === 'create' ? ACTION_PENDING.cartelCreate : 'Create'}
          </PrimaryButton>
          <PrimaryButton disabled={loading !== null} onClick={() => setShowCreate(false)}>
            Cancel
          </PrimaryButton>
        </>
      )}
    </>
  );
}
