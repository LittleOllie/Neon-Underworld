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
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { StatRow } from '@local/components/game/StatRow';
import { SectionLabel } from '@local/components/game/SectionLabel';
import { Divider } from '@local/components/game/Divider';

type Props = CartelPageData;

export function CartelPanel(initial: Props) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [inviteAlias, setInviteAlias] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  async function handleCreate() {
    setLoading(true);
    setError('');
    const response = await createCartelAction(name, tag);
    setLoading(false);
    if (!response.success) {
      setError(response.error);
      return;
    }
    router.refresh();
  }

  async function handleAccept(inviteId: string) {
    setLoading(true);
    const response = await acceptCartelInviteAction(inviteId);
    setLoading(false);
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
    setLoading(true);
    setError('');
    const response = await inviteToCartelAction(inviteAlias);
    setLoading(false);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setInviteAlias('');
  }

  async function handleLeave() {
    setLoading(true);
    const response = await leaveCartelAction();
    setLoading(false);
    if (!response.success) {
      setError(response.error);
      return;
    }
    router.refresh();
  }

  async function handleRemove(memberId: string) {
    setLoading(true);
    const response = await removeCartelMemberAction(memberId);
    setLoading(false);
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
            <PrimaryButton icon="cartel" disabled={loading} onClick={() => handleAccept(inv.id)}>
              Accept
            </PrimaryButton>
            <PrimaryButton disabled={loading} onClick={() => handleDecline(inv.id)}>
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
              disabled={loading || !inviteAlias.trim()}
              onClick={handleInvite}
            >
              Send Invite
            </PrimaryButton>
            {c.members
              .filter((m) => !m.isLeader)
              .map((m) => (
                <PrimaryButton key={m.id} disabled={loading} onClick={() => handleRemove(m.id)}>
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
        <PrimaryButton disabled={loading} onClick={handleLeave}>
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
          <PrimaryButton icon="cartel" disabled={loading} onClick={() => setShowCreate(true)}>
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
            disabled={loading || name.length < 3 || tag.length < 2}
            onClick={handleCreate}
          >
            {loading ? 'Creating…' : 'Create'}
          </PrimaryButton>
          <PrimaryButton disabled={loading} onClick={() => setShowCreate(false)}>
            Cancel
          </PrimaryButton>
        </>
      )}
    </>
  );
}
