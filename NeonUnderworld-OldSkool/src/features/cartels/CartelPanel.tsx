'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import type { PlayerShellSnapshot } from '@local/domain/player-shell.model';
import {
  acceptCartelInviteAction,
  acceptCartelJoinRequestAction,
  createCartelAction,
  declineCartelInviteAction,
  declineCartelJoinRequestAction,
  inviteToCartelAction,
  leaveCartelAction,
  purchaseCartelArmouryAction,
  removeCartelMemberAction,
  requestCartelJoinAction,
  setCartelDonationAction,
  transferCartelLeadershipAction,
  type CartelArmouryPurchaseResult,
  type CartelPageData,
} from '@local/server/actions/cartel.actions';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { StatRow } from '@local/components/game/StatRow';
import { SectionLabel } from '@local/components/game/SectionLabel';
import { Divider } from '@local/components/game/Divider';
import { NumericInput } from '@local/components/game/NumericInput';
import { SelectableCard } from '@local/components/game/SelectableCard';
import { FeedbackNote } from '@local/components/game/FeedbackNote';
import { PlayerIdentity } from '@local/components/game/PlayerIdentity';
import { EmptyState } from '@local/components/game/EmptyState';
import { parsePositiveInteger } from '@local/lib/numeric-input';
import { OS_TERMS } from '@local/config/terminology';

type Props = CartelPageData;

function CartelHQView({
  cartel,
  pendingJoinRequestsForLeader,
  donationOptions,
  error,
  success,
  loading,
  inviteAlias,
  setInviteAlias,
  transferTargetId,
  setTransferTargetId,
  onInvite,
  onRemove,
  onLeave,
  onDonation,
  onArmouryPurchase,
  onAcceptRequest,
  onDeclineRequest,
  onTransferLeadership,
  armouryQuantities,
  setArmouryQuantities,
}: {
  cartel: NonNullable<CartelPageData['cartel']>;
  pendingJoinRequestsForLeader: CartelPageData['pendingJoinRequestsForLeader'];
  donationOptions: readonly number[];
  error: string;
  success: string;
  loading: string | null;
  inviteAlias: string;
  setInviteAlias: (v: string) => void;
  transferTargetId: string;
  setTransferTargetId: (v: string) => void;
  onInvite: () => void;
  onRemove: (memberId: string) => void;
  onLeave: () => void;
  onDonation: (percent: number) => void;
  onArmouryPurchase: (itemKey: string) => void;
  onAcceptRequest: (requestId: string) => void;
  onDeclineRequest: (requestId: string) => void;
  onTransferLeadership: () => void;
  armouryQuantities: Record<string, string>;
  setArmouryQuantities: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  const transferCandidates = cartel.members.filter((m) => !m.isLeader);

  return (
    <div className="g-cartel-hq">
      {error && <FeedbackNote tone="error" role="alert">{error}</FeedbackNote>}
      {success && <FeedbackNote tone="success" role="status">{success}</FeedbackNote>}

      <header className="g-cartel-hq__header">
        <h2 className="g-cartel-hq__name">
          {cartel.name.toUpperCase()}
          <span className="g-cartel-hq__tag">[{cartel.tag}]</span>
        </h2>
        <p className="g-cartel-hq__sub">
          {cartel.myRole} · {cartel.status}
        </p>
      </header>

      <section className="g-cartel-hq__section" aria-label="Faction overview">
        <SectionLabel>OVERVIEW</SectionLabel>
        <div className="g-cartel-hq__grid">
          <div className="g-cartel-hq__stat">
            <span className="g-cartel-hq__stat-label">Members</span>
            <span className="g-cartel-hq__stat-value">
              {cartel.memberCount}/{cartel.maxMembers}
            </span>
          </div>
          <div className="g-cartel-hq__stat">
            <span className="g-cartel-hq__stat-label">{OS_TERMS.faction} {OS_TERMS.influence}</span>
            <span className="g-cartel-hq__stat-value">
              ${cartel.cartelNetWorth.toLocaleString()}
            </span>
          </div>
          <div className="g-cartel-hq__stat">
            <span className="g-cartel-hq__stat-label">Donation</span>
            <span className="g-cartel-hq__stat-value">{cartel.myDonationPercent}%</span>
          </div>
          <div className="g-cartel-hq__stat">
            <span className="g-cartel-hq__stat-label">Leader</span>
            <span className="g-cartel-hq__stat-value">{cartel.leaderAlias}</span>
          </div>
        </div>
      </section>

      <section className="g-cartel-hq__section" aria-label="Faction treasury">
        <SectionLabel>FACTION TREASURY</SectionLabel>
        <StatRow label="Cash balance" value={`$${cartel.treasuryCash.toLocaleString()}`} />
        <p className="g-note">
          Shared faction cash from member Scout / Operations donations. Used for armoury purchases.
        </p>
      </section>

      <section className="g-cartel-hq__section" aria-label="Faction forces">
        <SectionLabel>FACTION FORCES</SectionLabel>
        <StatRow label={`${OS_TERMS.faction} ${OS_TERMS.enforcers}`} value={cartel.armoury.thugs.toLocaleString()} />
        <StatRow label={OS_TERMS.glocks} value={cartel.armoury.glocks.toLocaleString()} />
        <StatRow label={OS_TERMS.uzis} value={cartel.armoury.uzis.toLocaleString()} />
        <StatRow label={OS_TERMS.rides} value={cartel.armoury.rides.toLocaleString()} />
        <StatRow
          label="Transport capacity"
          value={`${cartel.armoury.rides.toLocaleString()} ${OS_TERMS.rides.toLowerCase()} · ${cartel.armoury.transportCapacity.toLocaleString()} ${OS_TERMS.enforcers.toLowerCase()}`}
        />
        <p className="g-note">
          Shared faction assets — not member personal {OS_TERMS.influence.toLowerCase()}. Faction{' '}
          {OS_TERMS.enforcers.toLowerCase()} can be lost defending members; faction weapons are never
          lost. Each faction ride carries 5 {OS_TERMS.enforcers.toLowerCase()} for response.
        </p>
      </section>

      <section className="g-cartel-hq__section" aria-label="Faction response">
        <SectionLabel>RESPONSE FORCE</SectionLabel>
        <StatRow
          label="Your max faction response"
          value={`${cartel.protection.responseForce.maxForYou.toLocaleString()} ${OS_TERMS.enforcers.toLowerCase()}`}
        />
        <StatRow
          label="Local backup (your city)"
          value={`${cartel.protection.virtualDefenceThugs.toLocaleString()} ${OS_TERMS.enforcers.toLowerCase()}`}
        />
        <StatRow
          label={`Supporters in ${cartel.myCity}`}
          value={String(cartel.protection.sameCitySupporters)}
        />
        <p className="g-note">
          Faction response is limited by twice your personal {OS_TERMS.enforcers.toLowerCase()}{' '}
          (minimum allowance 25), 25% of current faction {OS_TERMS.enforcers.toLowerCase()}, and
          faction transport capacity. Nearby faction members also provide 10% of their{' '}
          {OS_TERMS.enforcers.toLowerCase()} as unarmed local backup. No faction support while
          travelling.
        </p>
      </section>

      {cartel.isLeader && (
        <section className="g-cartel-hq__section" aria-label="Faction armoury purchases">
          <SectionLabel>ARMOURY</SectionLabel>
          <p className="g-note">
            Purchase shared assets from treasury. {OS_TERMS.uzis} and {OS_TERMS.glocks} only —{' '}
            {OS_TERMS.ak} is player-only.
          </p>
          <div className="g-cartel-armoury">
            {cartel.armoury.catalog.map((entry) => {
              const qty = parsePositiveInteger(armouryQuantities[entry.key] ?? '1');
              const total = qty ? entry.unitPrice * qty : 0;
              const canAfford = qty ? total <= cartel.armoury.treasuryCash : false;
              return (
                <div key={entry.key} className="g-cartel-armoury__row">
                  <div className="g-cartel-armoury__info">
                    <span className="g-cartel-armoury__name">{entry.displayName}</span>
                    <span className="g-cartel-armoury__meta">
                      ${entry.unitPrice.toLocaleString()} each · own {entry.ownedQuantity.toLocaleString()}
                    </span>
                  </div>
                  <NumericInput
                    id={`cartel-armoury-${entry.key}`}
                    value={armouryQuantities[entry.key] ?? '1'}
                    max={1000}
                    disabled={loading !== null}
                    onChange={(value) =>
                      setArmouryQuantities((prev) => ({ ...prev, [entry.key]: value }))
                    }
                  />
                  {qty && !canAfford && (
                    <FeedbackNote tone="warn">
                      Not enough faction treasury — need ${total.toLocaleString()}, have $
                      {cartel.armoury.treasuryCash.toLocaleString()}.
                    </FeedbackNote>
                  )}
                  <PrimaryButton
                    disabled={loading !== null || !qty || !canAfford}
                    pending={loading === `armoury-${entry.key}`}
                    onClick={() => onArmouryPurchase(entry.key)}
                  >
                    {loading === `armoury-${entry.key}`
                      ? ACTION_PENDING.cartelArmoury
                      : `Buy $${total.toLocaleString()}`}
                  </PrimaryButton>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {cartel.isLeader && pendingJoinRequestsForLeader.length > 0 && (
        <section className="g-cartel-hq__section" aria-label="Join requests">
          <SectionLabel>JOIN REQUESTS</SectionLabel>
          {pendingJoinRequestsForLeader.map((req) => (
            <SelectableCard key={req.id} as="div" title={req.alias} meta="Request to join">
              <div className="g-btn-row">
                <PrimaryButton
                  disabled={loading !== null}
                  pending={loading === `accept-req-${req.id}`}
                  onClick={() => onAcceptRequest(req.id)}
                >
                  Accept
                </PrimaryButton>
                <PrimaryButton
                  variant="secondary"
                  disabled={loading !== null}
                  onClick={() => onDeclineRequest(req.id)}
                >
                  Decline
                </PrimaryButton>
              </div>
            </SelectableCard>
          ))}
        </section>
      )}

      <section className="g-cartel-hq__section" aria-label="Faction members">
        <SectionLabel>MEMBERS</SectionLabel>
        <ul className="g-cartel-members">
          {cartel.members.map((m) => (
            <li key={m.id} className="g-cartel-member">
              <div className="g-cartel-member__top">
                <PlayerIdentity
                  player={{ alias: m.alias, ...m.identity, avatar: m.identity.avatar ?? m.avatarId }}
                  avatarSize="sm"
                  static
                />
                <span
                  className={`g-cartel-member__presence${m.presence.online ? ' g-cartel-member__presence--online' : ''}`}
                >
                  {m.travelling ? 'Travelling' : m.presence.label}
                </span>
              </div>
              <p className="g-cartel-member__meta">
                {m.role} · ${m.netWorth.toLocaleString()} · {m.city}
                {m.donationPercent > 0 ? ` · ${m.donationPercent}% donation` : ''}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <Divider />

      <SectionLabel>YOUR CONTRIBUTION</SectionLabel>
      <p className="g-note">Street income (Scout / Operations cash) — 0–{cartel.maxDonationPercent}%</p>
      <select
        className="g-input"
        value={cartel.myDonationPercent}
        disabled={loading !== null}
        aria-busy={loading === 'donation' || undefined}
        onChange={(e) => onDonation(Number(e.target.value))}
      >
        {donationOptions.map((p) => (
          <option key={p} value={p}>
            {p}%
          </option>
        ))}
      </select>

      {cartel.isLeader && (
        <>
          <Divider />
          <SectionLabel>LEADER CONTROLS</SectionLabel>
          <input
            className="g-input"
            placeholder="Player alias to invite"
            value={inviteAlias}
            disabled={loading !== null}
            onChange={(e) => setInviteAlias(e.target.value)}
          />
          <PrimaryButton
            icon="cartel"
            disabled={loading !== null || !inviteAlias.trim()}
            pending={loading === 'invite'}
            onClick={onInvite}
          >
            {loading === 'invite' ? ACTION_PENDING.cartelInvite : 'Send Invite'}
          </PrimaryButton>

          {transferCandidates.length > 0 && (
            <>
              <select
                className="g-input"
                value={transferTargetId}
                disabled={loading !== null}
                onChange={(e) => setTransferTargetId(e.target.value)}
              >
                <option value="">Transfer leadership to…</option>
                {transferCandidates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.alias}
                  </option>
                ))}
              </select>
              <PrimaryButton
                disabled={loading !== null || !transferTargetId}
                pending={loading === 'transfer'}
                onClick={onTransferLeadership}
              >
                {loading === 'transfer' ? 'Transferring…' : 'Transfer Leadership'}
              </PrimaryButton>
            </>
          )}

          {cartel.members
            .filter((m) => !m.isLeader)
            .map((m) => (
              <PrimaryButton
                key={m.id}
                disabled={loading !== null}
                onClick={() => onRemove(m.id)}
              >
                Remove {m.alias}
              </PrimaryButton>
            ))}
        </>
      )}

      <Divider />

      <PrimaryButton disabled={loading !== null} onClick={onLeave}>
        Leave {OS_TERMS.faction}
      </PrimaryButton>
    </div>
  );
}

export function CartelPanel(initial: Props) {
  const reconcile = useGameplayReconcile();
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [inviteAlias, setInviteAlias] = useState('');
  const [transferTargetId, setTransferTargetId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [armouryQuantities, setArmouryQuantities] = useState<Record<string, string>>({});

  useEffect(() => {
    setData(initial);
  }, [initial]);

  function applyMutation(page: CartelPageData, shell?: PlayerShellSnapshot) {
    setData(page);
    if (shell) reconcile(shell);
  }

  async function handleCreate() {
    setLoading('create');
    setError('');
    setSuccess('');
    const response = await createCartelAction(name, tag);
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setSuccess(`${OS_TERMS.faction} ${name} [${tag}] created.`);
    applyMutation(response.data.page, response.data.shell);
  }

  async function handleAccept(inviteId: string) {
    setLoading('accept');
    setError('');
    const response = await acceptCartelInviteAction(inviteId);
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    applyMutation(response.data.page, response.data.shell);
  }

  async function handleDecline(inviteId: string) {
    if (loading !== null) return;
    setLoading(`decline-${inviteId}`);
    setError('');
    try {
      const response = await declineCartelInviteAction(inviteId);
      if (!response.success) {
        setError(response.error);
        return;
      }
      applyMutation(response.data.page, response.data.shell);
    } finally {
      setLoading(null);
    }
  }

  async function handleRequestJoin(cartelId: string) {
    setLoading(`request-${cartelId}`);
    setError('');
    setSuccess('');
    const response = await requestCartelJoinAction(cartelId);
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setSuccess('Join request sent.');
    applyMutation(response.data.page, response.data.shell);
  }

  async function handleAcceptRequest(requestId: string) {
    setLoading(`accept-req-${requestId}`);
    setError('');
    setSuccess('');
    const response = await acceptCartelJoinRequestAction(requestId);
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setSuccess(`${response.data.memberAlias} joined your ${OS_TERMS.faction.toLowerCase()}.`);
    applyMutation(response.data.page, response.data.shell);
  }

  async function handleDeclineRequest(requestId: string) {
    setLoading(`decline-req-${requestId}`);
    const response = await declineCartelJoinRequestAction(requestId);
    setLoading(null);
    if (response.success) applyMutation(response.data.page, response.data.shell);
  }

  async function handleInvite() {
    setLoading('invite');
    setError('');
    setSuccess('');
    const response = await inviteToCartelAction(inviteAlias);
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setInviteAlias('');
    setSuccess(`Invite sent to ${inviteAlias}.`);
    applyMutation(response.data.page, response.data.shell);
  }

  async function handleLeave() {
    setLoading('leave');
    setError('');
    const response = await leaveCartelAction();
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    applyMutation(response.data.page, response.data.shell);
  }

  async function handleRemove(memberId: string) {
    setLoading('remove');
    setError('');
    const response = await removeCartelMemberAction(memberId);
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setSuccess('Member removed.');
    applyMutation(response.data.page, response.data.shell);
  }

  async function handleTransferLeadership() {
    if (!transferTargetId) return;
    setLoading('transfer');
    setError('');
    setSuccess('');
    const response = await transferCartelLeadershipAction(transferTargetId);
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setTransferTargetId('');
    setSuccess(`Leadership transferred to ${response.data.newLeaderAlias}.`);
    applyMutation(response.data.page, response.data.shell);
  }

  async function handleDonation(percent: number) {
    if (loading !== null) return;
    setLoading('donation');
    setError('');
    try {
      const response = await setCartelDonationAction(percent);
      if (!response.success) {
        setError(response.error);
        return;
      }
      applyMutation(response.data.page, response.data.shell);
    } finally {
      setLoading(null);
    }
  }

  async function handleArmouryPurchase(itemKey: string) {
    const qty = parsePositiveInteger(armouryQuantities[itemKey] ?? '1');
    if (!qty) {
      setError('Enter a valid quantity.');
      setSuccess('');
      return;
    }

    setLoading(`armoury-${itemKey}`);
    setError('');
    setSuccess('');
    const response = await purchaseCartelArmouryAction(itemKey, qty, uuidv4());
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }

    const label =
      itemKey === 'thug'
        ? `${OS_TERMS.faction} ${OS_TERMS.enforcers}`
        : itemKey === 'glock'
          ? OS_TERMS.glocks
          : itemKey === 'uzi'
            ? OS_TERMS.uzis
            : OS_TERMS.rides;
    setSuccess(
      `Purchased ${qty.toLocaleString()} ${label} for $${response.data.totalCost.toLocaleString()} from treasury.`,
    );
    applyMutation(response.data.page, response.data.shell);
  }

  if (data.pendingInvites.length > 0 && !data.inCartel) {
    return (
      <>
        <SectionLabel>FACTION INVITES</SectionLabel>
        {error && <FeedbackNote tone="error" role="alert">{error}</FeedbackNote>}
        {data.pendingInvites.map((inv) => (
          <SelectableCard
            key={inv.id}
            as="div"
            title={`${inv.cartelName} [${inv.cartelTag}]`}
            meta={`Invited by ${inv.inviterAlias}`}
          >
            <div className="g-btn-row">
              <PrimaryButton
                icon="cartel"
                disabled={loading !== null}
                pending={loading === 'accept'}
                onClick={() => handleAccept(inv.id)}
              >
                {loading === 'accept' ? ACTION_PENDING.cartelJoin : 'Accept'}
              </PrimaryButton>
              <PrimaryButton
                variant="secondary"
                disabled={loading !== null}
                pending={loading === `decline-${inv.id}`}
                onClick={() => handleDecline(inv.id)}
              >
                {loading === `decline-${inv.id}` ? ACTION_PENDING.cartelAction : 'Decline'}
              </PrimaryButton>
            </div>
          </SelectableCard>
        ))}
      </>
    );
  }

  if (data.cartel) {
    return (
      <CartelHQView
        cartel={data.cartel}
        pendingJoinRequestsForLeader={data.pendingJoinRequestsForLeader}
        donationOptions={data.donationOptions}
        error={error}
        success={success}
        loading={loading}
        inviteAlias={inviteAlias}
        setInviteAlias={setInviteAlias}
        transferTargetId={transferTargetId}
        setTransferTargetId={setTransferTargetId}
        onInvite={handleInvite}
        onRemove={handleRemove}
        onLeave={handleLeave}
        onDonation={handleDonation}
        onArmouryPurchase={handleArmouryPurchase}
        onAcceptRequest={handleAcceptRequest}
        onDeclineRequest={handleDeclineRequest}
        onTransferLeadership={handleTransferLeadership}
        armouryQuantities={armouryQuantities}
        setArmouryQuantities={setArmouryQuantities}
      />
    );
  }

  return (
    <>
      <p className="g-note">Build your crew. Share protection. Rise together.</p>

      {error && <FeedbackNote tone="error" role="alert">{error}</FeedbackNote>}
      {success && <FeedbackNote tone="success" role="status">{success}</FeedbackNote>}

      {!showCreate ? (
        <>
          <PrimaryButton icon="cartel" disabled={loading !== null} onClick={() => setShowCreate(true)}>
            Create {OS_TERMS.faction}
          </PrimaryButton>
          <Divider />
          <SectionLabel>AVAILABLE {OS_TERMS.factions.toUpperCase()}</SectionLabel>
          {data.browse.length === 0 ? (
            <EmptyState title={`No ${OS_TERMS.factions.toLowerCase()} yet`} body="Be the first to create one." />
          ) : null}
          {data.browse.map((c) => {
            const isFull = c.memberCount >= c.maxMembers;
            const pending = c.hasPendingRequest;
            return (
              <SelectableCard
                key={c.id}
                as="div"
                title={`${c.name} [${c.tag}]`}
                meta={`${c.memberCount} / ${c.maxMembers} members · Leader: ${c.leaderAlias}`}
              >
                {pending ? (
                  <FeedbackNote tone="info">Request pending</FeedbackNote>
                ) : isFull ? (
                  <FeedbackNote tone="warn">{OS_TERMS.faction} full</FeedbackNote>
                ) : (
                  <PrimaryButton
                    icon="cartel"
                    disabled={loading !== null}
                    pending={loading === `request-${c.id}`}
                    onClick={() => handleRequestJoin(c.id)}
                  >
                    {loading === `request-${c.id}` ? 'Sending…' : 'Request to Join'}
                  </PrimaryButton>
                )}
              </SelectableCard>
            );
          })}
        </>
      ) : (
        <>
          <SectionLabel>CREATE {OS_TERMS.faction.toUpperCase()}</SectionLabel>
          <input
            className="g-input"
            placeholder={`${OS_TERMS.faction} name`}
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
