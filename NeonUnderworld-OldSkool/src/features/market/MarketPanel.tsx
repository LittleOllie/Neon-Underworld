'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import {
  createMarketListingAction,
  placeMarketBidAction,
  type MarketFilter,
  type MarketPageData,
} from '@local/server/actions/market.actions';
import type { MarketDurationMinutes } from '@core/config/game/market-rules';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { NumericInput } from '@local/components/game/NumericInput';
import { StatRow } from '@local/components/game/StatRow';
import { SectionLabel } from '@local/components/game/SectionLabel';
import { Divider } from '@local/components/game/Divider';

const FILTERS: { key: MarketFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'weapons', label: 'Weapons' },
  { key: 'rides', label: 'Rides' },
  { key: 'drugs', label: 'Drugs' },
  { key: 'supplies', label: 'Supplies' },
];

const TABS = ['browse', 'sell', 'mine'] as const;
type Tab = (typeof TABS)[number];

function formatTimeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

type Props = MarketPageData & { initialFilter?: MarketFilter };

export function MarketPanel({ initialFilter = 'all', ...initial }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('browse');
  const [filter, setFilter] = useState<MarketFilter>(initialFilter);
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const [sellItem, setSellItem] = useState<string>(initial.tradableInventory[0]?.key ?? '');
  const [sellQty, setSellQty] = useState('1');
  const [startPrice, setStartPrice] = useState(String(initial.minStartingPrice));
  const [duration, setDuration] = useState<MarketDurationMinutes>(60);

  const filteredListings = useMemo(() => {
    if (filter === 'all') return data.listings;
    return data.listings.filter((l) => {
      const key = l.itemKey;
      if (filter === 'weapons') return ['glock', 'uzi', 'ak'].includes(key);
      if (filter === 'rides') return key === 'ride';
      if (filter === 'drugs') return ['shroom', 'coke', 'heroin'].includes(key);
      return ['beer', 'condom', 'hash'].includes(key);
    });
  }, [data.listings, filter]);

  async function handleBid(listingId: string, minNextBid: number) {
    setLoading(listingId);
    setError('');
    const response = await placeMarketBidAction(listingId, minNextBid, uuidv4());
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    router.refresh();
  }

  async function handleCreateListing() {
    const qty = parseInt(sellQty, 10);
    const price = parseInt(startPrice, 10);
    if (!sellItem || !qty || qty <= 0) {
      setError('Enter a valid quantity.');
      return;
    }
    if (!price || price < data.minStartingPrice) {
      setError(`Minimum starting price is $${data.minStartingPrice}.`);
      return;
    }
    setLoading('sell');
    setError('');
    const response = await createMarketListingAction(
      sellItem,
      qty,
      price,
      duration,
      uuidv4(),
    );
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setTab('mine');
    router.refresh();
  }

  return (
    <>
      <p className="g-note">Player auctions. Bid on equipment and supplies listed by other players.</p>
      <StatRow label="Cash on hand" value={`$${data.cash.toLocaleString()}`} />

      <div className="g-filter-row">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`g-filter${tab === t ? ' g-filter-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'browse' ? 'Browse' : t === 'sell' ? 'Sell Item' : 'My Auctions'}
          </button>
        ))}
      </div>

      {error && <p className="g-note g-note-error">{error}</p>}

      {tab === 'browse' && (
        <>
          <div className="g-filter-row">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`g-filter${filter === f.key ? ' g-filter-active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {filteredListings.length === 0 && <p className="g-note">No active listings.</p>}
          {filteredListings.map((l) => (
            <div key={l.id} className="g-area-row">
              <div className="g-area-name">
                {l.itemName} × {l.quantity}
              </div>
              <div className="g-area-meta">
                {l.currentBid != null ? (
                  <>Current bid: ${l.currentBid.toLocaleString()}</>
                ) : (
                  <>Starting: ${l.startingPrice.toLocaleString()}</>
                )}
                {' · '}
                Ends in {formatTimeLeft(l.endsAt)}
                {' · '}
                Seller: {l.sellerAlias}
              </div>
              <div className="g-area-meta">Min bid: ${l.minNextBid.toLocaleString()}</div>
              <PrimaryButton
                icon="market"
                disabled={loading !== null || data.cash < l.minNextBid}
                onClick={() => handleBid(l.id, l.minNextBid)}
              >
                {loading === l.id ? 'Bidding…' : 'Bid'}
              </PrimaryButton>
            </div>
          ))}
        </>
      )}

      {tab === 'sell' && (
        <>
          {data.tradableInventory.length === 0 ? (
            <p className="g-note">You have no tradable items to list.</p>
          ) : (
            <>
              <SectionLabel>ITEM</SectionLabel>
              <select
                className="g-input"
                value={sellItem}
                onChange={(e) => setSellItem(e.target.value)}
              >
                {data.tradableInventory.map((i) => (
                  <option key={i.key} value={i.key}>
                    {i.name} ({i.quantity} owned)
                  </option>
                ))}
              </select>
              <NumericInput
                id="market-qty"
                label="Quantity"
                value={sellQty}
                onChange={(raw) => setSellQty(raw)}
              />
              <NumericInput
                id="market-price"
                label="Starting price"
                value={startPrice}
                onChange={(raw) => setStartPrice(raw)}
              />
              <SectionLabel>DURATION</SectionLabel>
              <select
                className="g-input"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) as MarketDurationMinutes)}
              >
                {data.durations.map((d) => (
                  <option key={d} value={d}>
                    {d < 60 ? `${d} min` : d < 1440 ? `${d / 60} hours` : '24 hours'}
                  </option>
                ))}
              </select>
              <PrimaryButton
                icon="market"
                disabled={loading !== null}
                onClick={handleCreateListing}
              >
                {loading === 'sell' ? 'Listing…' : 'Create Auction'}
              </PrimaryButton>
            </>
          )}
        </>
      )}

      {tab === 'mine' && (
        <>
          <SectionLabel>SELLING</SectionLabel>
          {data.myAuctions.selling.length === 0 && <p className="g-note">No listings.</p>}
          {data.myAuctions.selling.map((l) => (
            <StatRow
              key={l.id}
              label={`${l.itemKey} × ${l.quantity}`}
              value={
                l.status === 'ACTIVE'
                  ? `$${(l.currentBid ?? l.startingPrice).toLocaleString()} · ${l.status}`
                  : l.status
              }
            />
          ))}
          <Divider />
          <SectionLabel>BIDDING</SectionLabel>
          {data.myAuctions.bidding.length === 0 && <p className="g-note">No active bids.</p>}
          {data.myAuctions.bidding.map((l) => (
            <StatRow
              key={l.id}
              label={`${l.itemKey} × ${l.quantity}`}
              value={`$${(l.currentBid ?? 0).toLocaleString()} · ${formatTimeLeft(l.endsAt.toISOString())}`}
            />
          ))}
          <Divider />
          <SectionLabel>WON</SectionLabel>
          {data.myAuctions.won.length === 0 && <p className="g-note">No wins yet.</p>}
          {data.myAuctions.won.map((l) => (
            <StatRow
              key={l.id}
              label={`${l.itemKey} × ${l.quantity}`}
              value={`$${(l.currentBid ?? 0).toLocaleString()}`}
            />
          ))}
        </>
      )}
    </>
  );
}
