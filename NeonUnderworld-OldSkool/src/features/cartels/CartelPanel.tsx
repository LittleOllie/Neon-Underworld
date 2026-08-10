'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import {
  acceptCartelInviteAction,
  createCartelAction,
  declineCartelInviteAction,
  inviteToCartelAction,
  leaveCartelAction,
  purchaseCartelArmouryAction,
  removeCartelMemberAction,
  setCartelDonationAction,
  type CartelPageData,
} from '@local/server/actions/cartel.actions';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { StatRow } from '@local/components/game/StatRow';
import { SectionLabel } from '@local/components/game/SectionLabel';
import { Divider } from '@local/components/game/Divider';
import { NumericInput } from '@local/components/game/NumericInput';
import { parsePositiveInteger } from '@local/lib/numeric-input';

type Props = CartelPageData;

function CartelHQView({
  cartel,
  donationOptions,
  error,
  loading,
  inviteAlias,
  setInviteAlias,
  onInvite,
  onRemove,
  onLeave,
  onDonation,
  onArmouryPurchase,
  armouryQuantities,
  setArmouryQuantities,
}: {
  cartel: NonNullable<CartelPageData['cartel']>;
  donationOptions: readonly number[];
  error: string;
  loading: string | null;
  inviteAlias: string;
  setInviteAlias: (v: string) => void;
  onInvite: () => void;
  onRemove: (memberId: string) => void;
  onLeave: () => void;
  onDonation: (percent: number) => void;
  onArmouryPurchase: (itemKey: string) => void;
  armouryQuantities: Record<string, string>;
  setArmouryQuantities: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  return (
    <div className="g-cartel-hq">
      <header className="g-cartel-hq__header">
        <h2 className="g-cartel-hq__name">
          {cartel.name.toUpperCase()}
          <span className="g-cartel-hq__tag">[{cartel.tag}]</span>
        </h2>
        <p className="g-cartel-hq__sub">
          {cartel.myRole} · {cartel.status}
        </p>
      </header>

      <section className="g-cartel-hq__section" aria-label="Cartel overview">
        <SectionLabel>OVERVIEW</SectionLabel>
        <div className="g-cartel-hq__grid">
          <div className="g-cartel-hq__stat">
            <span className="g-cartel-hq__stat-label">Members</span>
            <span className="g-cartel-hq__stat-value">
              {cartel.memberCount}/{cartel.maxMembers}
            </span>
          </div>
          <div className="g-cartel-hq__stat">
            <span className="g-cartel-hq__stat-label">Cartel Net Worth</span>
            <span className="g-cartel-hq__stat-value">
              ${cartel.cartelNetWorth.toLocaleString()}
            </span>
          </div>
          <div className="g-cartel-hq__stat">
            <span className="g-cartel-hq__stat-label">Donation</span>
            <span className="g-cartel-hq__stat-value">{cartel.myDonationPercent}%</span>
          </div>
          <div className="g-cartel-hq__stat">
            <span className="g-cartel-hq__stat-label">Treasury</span>
            <span className="g-cartel-hq__stat-value">
              ${cartel.treasuryCash.toLocaleString()}
            </span>
          </div>
        </div>
      </section>

      <section className="g-cartel-hq__section" aria-label="Cartel protection">
        <SectionLabel>PROTECTION</SectionLabel>
        <StatRow
          label="Virtual defence (your city)"
          value={`${cartel.protection.virtualDefenceThugs.toLocaleString()} thugs`}
        />
        <StatRow
          label={`Supporters in ${cartel.myCity}`}
          value={String(cartel.protection.sameCitySupporters)}
        />
        <StatRow
          label="Cartel thugs (armoury)"
          value={`${cartel.protection.ownedDefenceThugs.toLocaleString()} thugs`}
        />
        <p className="g-note">
          Same-city cartel mates contribute 25% of their thugs as unarmed defence support.
          Cartel-owned thugs from the armoury fight in all attacks and can be killed.
        </p>
      </section>

      <section className="g-cartel-hq__section" aria-label="Cartel armoury">
        <SectionLabel>ARMOURY</SectionLabel>
        <p className="g-note">Shared cartel assets — not member personal net worth.</p>
        <StatRow label="Treasury" value={`$${cartel.armoury.treasuryCash.toLocaleString()}`} />
        <StatRow label="Thugs" value={cartel.armoury.thugs.toLocaleString()} />
        <StatRow label="Glocks" value={cartel.armoury.glocks.toLocaleString()} />
        <StatRow label="Uzis" value={cartel.armoury.uzis.toLocaleString()} />
        <p className="g-note">
          Purchases come from treasury. Uzi and Glock only — AK-47 is player-only. Cartel
          weapons are never lost in attacks.
        </p>
        {cartel.isLeader && (
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
                    onChange={(value) =>
                      setArmouryQuantities((prev) => ({ ...prev, [entry.key]: value }))
                    }
                  />
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
        )}
      </section>

      <section className="g-cartel-hq__section" aria-label="Cartel members">
        <SectionLabel>MEMBERS</SectionLabel>
        <ul className="g-cartel-members">
          {cartel.members.map((m) => (
            <li key={m.id} className="g-cartel-member">
              <div className="g-cartel-member__top">
                <span className="g-cartel-member__name">{m.alias}</span>
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

      <section className="g-cartel-hq__section" aria-label="Cartel information">
        <SectionLabel>INFO</SectionLabel>
        <StatRow label="Leader" value={cartel.leaderAlias} />
        <StatRow label="Founded" value={new Date(cartel.foundedAt).toLocaleDateString()} />
        <StatRow label="Member limit" value={String(cartel.maxMembers)} />
        <StatRow label="Max donation" value={`${cartel.maxDonationPercent}%`} />
        <StatRow label="Treasury" value={`$${cartel.treasuryCash.toLocaleString()}`} />
        <StatRow
          label="Cartel net worth"
          value={`$${cartel.cartelNetWorth.toLocaleString()}`}
        />
      </section>

      <Divider />

      <SectionLabel>YOUR CONTRIBUTION</SectionLabel>
      <p className="g-note">Street income (Scout / Produce cash) — 0–{cartel.maxDonationPercent}%</p>
      <select
        className="g-input"
        value={cartel.myDonationPercent}
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
            placeholder="Player alias"
            value={inviteAlias}
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

      {error && <p className="g-note g-note-error">{error}</p>}
      <PrimaryButton disabled={loading !== null} onClick={onLeave}>
        Leave Cartel
      </PrimaryButton>
    </div>
  );
}

export function CartelPanel(initial: Props) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [inviteAlias, setInviteAlias] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [armouryQuantities, setArmouryQuantities] = useState<Record<string, string>>({});

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

  async function handleArmouryPurchase(itemKey: string) {
    const qty = parsePositiveInteger(armouryQuantities[itemKey] ?? '1');
    if (!qty) return;

    setLoading(`armoury-${itemKey}`);
    setError('');
    const response = await purchaseCartelArmouryAction(itemKey, qty, uuidv4());
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    router.refresh();
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
    return (
      <CartelHQView
        cartel={data.cartel}
        donationOptions={data.donationOptions}
        error={error}
        loading={loading}
        inviteAlias={inviteAlias}
        setInviteAlias={setInviteAlias}
        onInvite={handleInvite}
        onRemove={handleRemove}
        onLeave={handleLeave}
        onDonation={handleDonation}
        onArmouryPurchase={handleArmouryPurchase}
        armouryQuantities={armouryQuantities}
        setArmouryQuantities={setArmouryQuantities}
      />
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
