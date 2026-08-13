'use client';

import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import {
  createMarketListingAction,
  placeMarketBidAction,
  type MarketFilter,
  type MarketPageData,
} from '@local/server/actions/market.actions';
import type { MarketDurationMinutes } from '@core/config/game/market-rules';
import {
  marketFilterCategory,
  marketReferenceUnitPrice,
  suggestedMarketOpeningBid,
} from '@core/config/game/market-rules';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { NumericInput } from '@local/components/game/NumericInput';
import { StatRow } from '@local/components/game/StatRow';
import { SectionLabel } from '@local/components/game/SectionLabel';
import { Divider } from '@local/components/game/Divider';
import { SimpleTabs } from '@local/components/game/SimpleTabs';
import { FilterPills } from '@local/components/game/FilterPills';
import { SelectableCard } from '@local/components/game/SelectableCard';
import { FeedbackNote } from '@local/components/game/FeedbackNote';
import { EmptyState } from '@local/components/game/EmptyState';

const FILTERS: { key: MarketFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'weapons', label: 'Weapons' },
  { key: 'rides', label: 'Rides' },
  { key: 'drugs', label: 'Drugs' },
  { key: 'supplies', label: 'Supplies' },
  { key: 'personnel', label: 'Crew' },
];

const TABS = [
  { id: 'browse' as const, label: 'Browse' },
  { id: 'sell' as const, label: 'Sell Item' },
  { id: 'mine' as const, label: 'My Auctions' },
];
type Tab = (typeof TABS)[number]['id'];

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
  const reconcile = useGameplayReconcile();
  const [tab, setTab] = useState<Tab>('browse');
  const [filter, setFilter] = useState<MarketFilter>(initialFilter);
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const [sellItem, setSellItem] = useState<string>(initial.tradableInventory[0]?.key ?? '');
  const [sellQty, setSellQty] = useState('1');
  const [startPrice, setStartPrice] = useState(String(initial.minStartingPrice));
  const [priceTouched, setPriceTouched] = useState(false);
  const [duration, setDuration] = useState<MarketDurationMinutes>(60);

  useEffect(() => {
    setData(initial);
    if (initial.tradableInventory.length > 0) {
      setSellItem((current) =>
        initial.tradableInventory.some((item) => item.key === current)
          ? current
          : initial.tradableInventory[0]!.key,
      );
    }
  }, [initial]);

  const selectedInventory = data.tradableInventory.find((item) => item.key === sellItem);
  const sellQtyNum = parseInt(sellQty, 10) || 0;
  const unitReference = sellItem ? marketReferenceUnitPrice(sellItem) : 0;
  const suggestedBid =
    sellItem && sellQtyNum > 0 ? suggestedMarketOpeningBid(sellItem, sellQtyNum) : 0;
  const startPriceNum = parseInt(startPrice, 10);
  const priceWellBelowGuide =
    suggestedBid > 0 && startPriceNum > 0 && startPriceNum < suggestedBid * 0.5;

  useEffect(() => {
    setPriceTouched(false);
  }, [sellItem]);

  useEffect(() => {
    if (priceTouched || !sellItem) return;
    const qty = parseInt(sellQty, 10) || 1;
    setStartPrice(String(suggestedMarketOpeningBid(sellItem, qty)));
  }, [sellItem, sellQty, priceTouched]);

  const filteredListings = useMemo(() => {
    if (filter === 'all') return data.listings;
    return data.listings.filter((l) => marketFilterCategory(l.itemKey) === filter);
  }, [data.listings, filter]);

  async function handleBid(listingId: string, minNextBid: number) {
    setLoading(listingId);
    setError('');
    setSuccess('');
    const response = await placeMarketBidAction(listingId, minNextBid, uuidv4());
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setData((prev) => ({ ...prev, cash: response.data.shell.cash }));
    reconcile(response.data.shell);
  }

  async function handleCreateListing() {
    const qty = parseInt(sellQty, 10);
    const price = parseInt(startPrice, 10);
    if (!sellItem || !qty || qty <= 0) {
      setError('Enter a valid quantity.');
      return;
    }
    const owned = selectedInventory?.quantity ?? 0;
    if (qty > owned) {
      setError(`You only have ${owned.toLocaleString()} ${selectedInventory?.name ?? 'items'} available.`);
      return;
    }
    if (!price || price < data.minStartingPrice) {
      setError(`Minimum starting price is $${data.minStartingPrice}.`);
      return;
    }
    setLoading('sell');
    setError('');
    setSuccess('');
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
    setSuccess(`Listed ${qty}× ${selectedInventory?.name ?? sellItem} on the Market.`);
    setSellQty('1');
    setTab('mine');
    setData((prev) => ({
      ...prev,
      cash: response.data.shell.cash,
      tradableInventory: prev.tradableInventory
        .map((item) =>
          item.key === sellItem ? { ...item, quantity: Math.max(0, item.quantity - qty) } : item,
        )
        .filter((item) => item.quantity > 0),
    }));
    reconcile(response.data.shell);
  }

  return (
    <>
      <p className="g-note">
        Player auctions only — list items for a set time; other players bid and the highest bid when
        the clock runs out wins. There are no instant-buy listings.
      </p>
      <StatRow label="Cash on hand" value={`$${data.cash.toLocaleString()}`} />

      <SimpleTabs tabs={TABS} active={tab} onChange={setTab} />

      {error && <FeedbackNote tone="error">{error}</FeedbackNote>}
      {success && <FeedbackNote tone="success">{success}</FeedbackNote>}

      {tab === 'browse' && (
        <>
          <FilterPills
            ariaLabel="Market category"
            options={FILTERS.map((f) => ({ id: f.key, label: f.label }))}
            value={filter}
            onChange={setFilter}
          />
          {filteredListings.length === 0 ? (
            <EmptyState
              title="No active listings"
              body="Check back later or list something from your inventory."
            />
          ) : null}
          {filteredListings.map((l) => (
            <SelectableCard
              key={l.id}
              as="div"
              title={`${l.itemName} × ${l.quantity.toLocaleString()}`}
              meta={
                <>
                  {l.currentBid != null ? (
                    <>Current bid: ${l.currentBid.toLocaleString()}</>
                  ) : (
                    <>Starting: ${l.startingPrice.toLocaleString()}</>
                  )}
                  {' · '}
                  Ends in {formatTimeLeft(l.endsAt)}
                  {' · '}
                  Seller: {l.sellerAlias}
                  {' · '}
                  Min bid: ${l.minNextBid.toLocaleString()}
                </>
              }
            >
              <PrimaryButton
                icon="market"
                disabled={loading !== null || data.cash < l.minNextBid}
                pending={loading === l.id}
                onClick={() => handleBid(l.id, l.minNextBid)}
              >
                {loading === l.id ? ACTION_PENDING.marketBid : 'Place bid'}
              </PrimaryButton>
            </SelectableCard>
          ))}
        </>
      )}

      {tab === 'sell' && (
        <>
          {data.tradableInventory.length === 0 ? (
            <EmptyState
              title="Nothing to sell"
              body="Tradable items from your inventory can be listed here."
              actionHref="/shop"
              actionLabel="Visit shop"
            />
          ) : (
            <>
              <p className="g-note">
                Create a timed auction. Set an opening bid — buyers must bid at least that amount to
                start, then each new bid must beat the last by 20%.
              </p>
              <SectionLabel>ITEM</SectionLabel>
              <p className="g-note">What you are putting up for auction from your inventory.</p>
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
              {selectedInventory && (
                <StatRow label="Owned" value={String(selectedInventory.quantity)} />
              )}
              <NumericInput
                id="market-qty"
                label="Quantity"
                value={sellQty}
                onChange={(raw) => setSellQty(raw)}
              />
              <p className="g-note">
                How many units of this item to include in the lot. You must own at least this many.
              </p>
              <NumericInput
                id="market-price"
                label="Opening bid (total for lot)"
                value={startPrice}
                onChange={(raw) => {
                  setPriceTouched(true);
                  setStartPrice(raw);
                }}
              />
              {sellItem && sellQtyNum > 0 && (
                <p className="g-note">
                  Suggested opening bid: ${suggestedBid.toLocaleString()} (${unitReference.toLocaleString()}{' '}
                  reference × {sellQtyNum.toLocaleString()}). Low opening bids invite snipes — only
                  the opening bid is locked in; undervalued lots can sell far below market.
                </p>
              )}
              {priceWellBelowGuide && (
                <FeedbackNote tone="warn">
                  This opening bid is well below the reference value. You may lose significant value
                  if nobody bids higher.
                </FeedbackNote>
              )}
              <SectionLabel>DURATION</SectionLabel>
              <p className="g-note">
                How long the auction stays open. When time expires, the highest bidder wins (or you
                keep the items if there were no bids).
              </p>
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
                {loading === 'sell' ? ACTION_PENDING.marketList : 'List Item'}
              </PrimaryButton>
            </>
          )}
        </>
      )}

      {tab === 'mine' && (
        <>
          <SectionLabel>SELLING</SectionLabel>
          {data.myAuctions.selling.length === 0 ? (
            <EmptyState title="No listings" body="Items you list for auction appear here." />
          ) : null}
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
