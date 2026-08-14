import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameplayError } from '@/lib/game-engine/gameplay-errors';

const mockTransaction = vi.fn();
const mockPlayerFindUniqueOrThrow = vi.fn();
const mockCartelFindMany = vi.fn();
const mockCartelJoinRequestFindMany = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    gameAction: { findFirst: vi.fn(), findUnique: vi.fn() },
    player: { findUniqueOrThrow: (...args: unknown[]) => mockPlayerFindUniqueOrThrow(...args) },
    cartel: { findMany: (...args: unknown[]) => mockCartelFindMany(...args) },
    cartelJoinRequest: { findMany: (...args: unknown[]) => mockCartelJoinRequestFindMany(...args) },
  },
}));

function activePlayer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'player-1',
    cartelId: null,
    lifeStatus: 'ACTIVE',
    travelling: false,
    ...overrides,
  };
}

function txMock(overrides: Record<string, unknown> = {}) {
  return {
    player: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(activePlayer()),
      findUnique: vi.fn().mockResolvedValue(activePlayer()),
      update: vi.fn().mockResolvedValue({}),
    },
    cartel: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'cartel-1',
        leaderId: 'leader-1',
        _count: { members: 2 },
      }),
      update: vi.fn().mockResolvedValue({ id: 'cartel-1' }),
    },
    cartelJoinRequest: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'req-1', cartelId: 'cartel-1' }),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    cartelInvite: {
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    ...overrides,
  };
}

describe('CartelService membership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(txMock()));
    mockCartelFindMany.mockResolvedValue([]);
    mockCartelJoinRequestFindMany.mockResolvedValue([]);
    mockPlayerFindUniqueOrThrow.mockReset();
  });

  it('submits join request when eligible', async () => {
    const { CartelService } = await import('@/server/services/cartel.service');
    const result = await CartelService.requestToJoin('player-1', 'cartel-1');
    expect(result.id).toBe('req-1');
  });

  it('rejects duplicate pending join request', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(
        txMock({
          cartelJoinRequest: {
            findFirst: vi.fn().mockResolvedValue({ id: 'existing' }),
            create: vi.fn(),
          },
        }),
      ),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    await expect(CartelService.requestToJoin('player-1', 'cartel-1')).rejects.toMatchObject({
      gameplayCode: 'CARTEL_JOIN_REQUEST_EXISTS',
    });
  });

  it('rejects join request when already in cartel', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(
        txMock({
          player: {
            findUniqueOrThrow: vi.fn().mockResolvedValue(activePlayer({ cartelId: 'cartel-x' })),
          },
        }),
      ),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    await expect(CartelService.requestToJoin('player-1', 'cartel-1')).rejects.toMatchObject({
      gameplayCode: 'CARTEL_ALREADY_MEMBER',
    });
  });

  it('rejects join request when cartel full', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(
        txMock({
          cartel: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'cartel-1',
              _count: { members: 5 },
            }),
          },
        }),
      ),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    await expect(CartelService.requestToJoin('player-1', 'cartel-1')).rejects.toMatchObject({
      gameplayCode: 'CARTEL_FULL',
    });
  });

  it('leader accepts pending join request', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(
        txMock({
          cartelJoinRequest: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'req-1',
              status: 'PENDING',
              cartelId: 'cartel-1',
              applicantId: 'player-2',
              cartel: { _count: { members: 3 } },
              applicant: activePlayer({ id: 'player-2', cartelId: null }),
            }),
            update: vi.fn(),
            updateMany: vi.fn(),
          },
          player: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              ...activePlayer({ id: 'leader-1', cartelId: 'cartel-1' }),
              cartel: { id: 'cartel-1', leaderId: 'leader-1' },
            }),
            findUnique: vi.fn(),
            update: vi.fn(),
          },
          cartel: {
            findUnique: vi.fn(),
          },
        }),
      ),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    const cartelId = await CartelService.acceptJoinRequest('leader-1', 'req-1');
    expect(cartelId).toBe('cartel-1');
  });

  it('non-leader cannot accept join request', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(
        txMock({
          cartelJoinRequest: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'req-1',
              status: 'PENDING',
              cartelId: 'cartel-1',
              cartel: { _count: { members: 3 } },
              applicant: activePlayer({ id: 'player-2' }),
            }),
          },
          player: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              ...activePlayer({ id: 'member-1', cartelId: 'cartel-1' }),
              cartel: { id: 'cartel-1', leaderId: 'leader-1' },
            }),
          },
        }),
      ),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    await expect(CartelService.acceptJoinRequest('member-1', 'req-1')).rejects.toMatchObject({
      gameplayCode: 'CARTEL_NOT_LEADER',
    });
  });

  it('leader declines pending join request', async () => {
    const joinUpdate = vi.fn();
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(
        txMock({
          cartelJoinRequest: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'req-1',
              status: 'PENDING',
              cartelId: 'cartel-1',
              cartel: { leaderId: 'leader-1' },
            }),
            update: joinUpdate,
          },
          player: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              ...activePlayer({ id: 'leader-1', cartelId: 'cartel-1' }),
              cartel: { id: 'cartel-1', leaderId: 'leader-1' },
            }),
          },
        }),
      ),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    await CartelService.declineJoinRequest('leader-1', 'req-1');
    expect(joinUpdate).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: { status: 'DECLINED' },
    });
  });

  it('rejects accept when applicant already joined another cartel', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(
        txMock({
          cartelJoinRequest: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'req-1',
              status: 'PENDING',
              cartelId: 'cartel-1',
              applicantId: 'player-2',
              cartel: { _count: { members: 2 } },
              applicant: activePlayer({ id: 'player-2', cartelId: 'cartel-other' }),
            }),
          },
          player: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              ...activePlayer({ id: 'leader-1', cartelId: 'cartel-1' }),
              cartel: { id: 'cartel-1', leaderId: 'leader-1' },
            }),
          },
        }),
      ),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    await expect(CartelService.acceptJoinRequest('leader-1', 'req-1')).rejects.toMatchObject({
      gameplayCode: 'CARTEL_JOIN_REQUEST_INVALID',
    });
  });

  it('rejects accept when cartel filled before approval', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(
        txMock({
          cartelJoinRequest: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'req-1',
              status: 'PENDING',
              cartelId: 'cartel-1',
              applicantId: 'player-2',
              cartel: { _count: { members: 5 } },
              applicant: activePlayer({ id: 'player-2', cartelId: null }),
            }),
          },
          player: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              ...activePlayer({ id: 'leader-1', cartelId: 'cartel-1' }),
              cartel: { id: 'cartel-1', leaderId: 'leader-1' },
            }),
          },
        }),
      ),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    await expect(CartelService.acceptJoinRequest('leader-1', 'req-1')).rejects.toMatchObject({
      gameplayCode: 'CARTEL_FULL',
    });
  });

  it('rejects stale join request acceptance', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(
        txMock({
          cartelJoinRequest: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'req-1',
              status: 'DECLINED',
              cartelId: 'cartel-1',
              cartel: { _count: { members: 2 } },
              applicant: activePlayer({ id: 'player-2' }),
            }),
          },
        }),
      ),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    await expect(CartelService.acceptJoinRequest('leader-1', 'req-1')).rejects.toMatchObject({
      gameplayCode: 'CARTEL_JOIN_REQUEST_INVALID',
    });
  });

  it('maps concurrent duplicate create to join request exists', async () => {
    const { Prisma } = await import('@prisma/client');
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(
        txMock({
          cartelJoinRequest: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockRejectedValue(
              new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
                code: 'P2002',
                clientVersion: 'test',
              }),
            ),
          },
        }),
      ),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    await expect(CartelService.requestToJoin('player-1', 'cartel-1')).rejects.toMatchObject({
      gameplayCode: 'CARTEL_JOIN_REQUEST_EXISTS',
    });
  });

  it('accepting invite clears pending join requests', async () => {
    const inviteUpdateMany = vi.fn();
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(
        txMock({
          cartelInvite: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'invite-1',
              inviteeId: 'player-1',
              status: 'PENDING',
              expiresAt: new Date(Date.now() + 60_000),
              cartelId: 'cartel-1',
              cartel: { _count: { members: 2 } },
            }),
            update: vi.fn(),
            updateMany: inviteUpdateMany,
          },
          cartelJoinRequest: {
            updateMany: vi.fn(),
          },
          player: {
            findUniqueOrThrow: vi.fn().mockResolvedValue(activePlayer({ id: 'player-1' })),
            update: vi.fn(),
          },
        }),
      ),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    await CartelService.acceptInvite('player-1', 'invite-1');
    expect(inviteUpdateMany).toHaveBeenCalled();
  });

  it('accepting join request clears incompatible pending invites', async () => {
    const inviteUpdateMany = vi.fn();
    const joinUpdateMany = vi.fn();
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(
        txMock({
          cartelJoinRequest: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'req-1',
              status: 'PENDING',
              cartelId: 'cartel-1',
              applicantId: 'player-2',
              cartel: { _count: { members: 2 } },
              applicant: activePlayer({ id: 'player-2', cartelId: null }),
            }),
            update: vi.fn(),
            updateMany: joinUpdateMany,
          },
          cartelInvite: {
            updateMany: inviteUpdateMany,
          },
          player: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              ...activePlayer({ id: 'leader-1', cartelId: 'cartel-1' }),
              cartel: { id: 'cartel-1', leaderId: 'leader-1' },
            }),
            findUnique: vi.fn(),
            update: vi.fn(),
          },
          cartel: {
            findUnique: vi.fn(),
          },
        }),
      ),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    await CartelService.acceptJoinRequest('leader-1', 'req-1');
    expect(inviteUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ inviteeId: 'player-2', status: 'PENDING' }),
        data: { status: 'DECLINED' },
      }),
    );
    expect(joinUpdateMany).toHaveBeenCalled();
  });

  function cartelPagePlayer(
    playerId: string,
    leaderId: string,
    members: Array<{ id: string; alias: string }>,
  ) {
    return {
      id: playerId,
      cartelId: 'cartel-1',
      cartelDonationPercent: 0,
      district: { id: 'd1', name: 'Neon Strip', slug: 'neon-strip' },
      cartel: {
        id: 'cartel-1',
        name: 'Test Cartel',
        tag: 'TC',
        leaderId,
        treasuryCash: 1000,
        thugs: 0,
        glocks: 0,
        uzis: 0,
        createdAt: new Date(),
        members: members.map((m) => ({
          ...m,
          avatar: null,
          cash: 0,
          bankCash: 0,
          prostitutes: 0,
          thugs: 0,
          rides: 0,
          glocks: 0,
          uzis: 0,
          aks: 0,
          hash: 0,
          shrooms: 0,
          coke: 0,
          heroin: 0,
          businesses: [],
          cartelDonationPercent: 0,
          travelling: false,
          lifeStatus: 'ACTIVE',
          districtId: 'd1',
          district: { name: 'Neon Strip', slug: 'neon-strip' },
          user: { lastLoginAt: new Date() },
          updatedAt: new Date(),
        })),
      },
      cartelInvitesRecv: [],
    };
  }

  it('new leader gains leader permissions in page data', async () => {
    mockPlayerFindUniqueOrThrow.mockResolvedValue(
      cartelPagePlayer('member-2', 'member-2', [
        { id: 'member-2', alias: 'NewLeader' },
        { id: 'leader-1', alias: 'OldLeader' },
      ]),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    const page = await CartelService.getCartelPageForPlayer('member-2');
    expect(page.cartel?.isLeader).toBe(true);
    expect(page.cartel?.myRole).toBe('Leader');
    expect(page.cartel?.armoury.catalog.length).toBeGreaterThan(0);
  });

  it('previous leader loses leader permissions in page data', async () => {
    mockPlayerFindUniqueOrThrow.mockResolvedValue(
      cartelPagePlayer('leader-1', 'member-2', [
        { id: 'member-2', alias: 'NewLeader' },
        { id: 'leader-1', alias: 'OldLeader' },
      ]),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    const page = await CartelService.getCartelPageForPlayer('leader-1');
    expect(page.cartel?.isLeader).toBe(false);
    expect(page.cartel?.myRole).toBe('Member');
  });

  it('transfers leadership to another member', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(
        txMock({
          player: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              ...activePlayer({ id: 'leader-1', cartelId: 'cartel-1' }),
              cartel: { id: 'cartel-1', leaderId: 'leader-1' },
            }),
            findUnique: vi.fn().mockResolvedValue(
              activePlayer({ id: 'member-2', cartelId: 'cartel-1' }),
            ),
          },
          cartel: {
            findUnique: vi.fn(),
            update: vi.fn().mockResolvedValue({ id: 'cartel-1', leaderId: 'member-2' }),
          },
        }),
      ),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    const cartelId = await CartelService.transferLeadership('leader-1', 'member-2');
    expect(cartelId).toBe('cartel-1');
  });

  it('blocks leadership transfer to non-member', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(
        txMock({
          player: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({
              ...activePlayer({ id: 'leader-1', cartelId: 'cartel-1' }),
              cartel: { id: 'cartel-1', leaderId: 'leader-1' },
            }),
            findUnique: vi.fn().mockResolvedValue(null),
          },
          cartel: {
            findUnique: vi.fn().mockResolvedValue({ id: 'cartel-1', leaderId: 'leader-1' }),
          },
        }),
      ),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    await expect(
      CartelService.transferLeadership('leader-1', 'outsider'),
    ).rejects.toMatchObject({ gameplayCode: 'CARTEL_NOT_MEMBER' });
  });

  it('rejects duplicate cartel name on create', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(
        txMock({
          cartel: {
            findUnique: vi
              .fn()
              .mockResolvedValueOnce({ id: 'existing' })
              .mockResolvedValueOnce(null),
          },
        }),
      ),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    await expect(CartelService.createCartel('player-1', 'Taken Name', 'TAG')).rejects.toMatchObject({
      gameplayCode: 'CARTEL_NAME_TAKEN',
    });
  });

  it('rejects duplicate cartel tag on create', async () => {
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(
        txMock({
          cartel: {
            findUnique: vi
              .fn()
              .mockResolvedValueOnce(null)
              .mockResolvedValueOnce({ id: 'existing' }),
          },
        }),
      ),
    );
    const { CartelService } = await import('@/server/services/cartel.service');
    await expect(CartelService.createCartel('player-1', 'New Name', 'TAKEN')).rejects.toMatchObject({
      gameplayCode: 'CARTEL_TAG_TAKEN',
    });
  });
});

describe('Market listing quantity cap', () => {
  it('rejects quantity above 1000 with specific message', async () => {
    const { MarketService } = await import('@/server/services/market.service');
    await expect(
      MarketService.createListing('seller', 'glock', 1001, 100, 60, 'key-1'),
    ).rejects.toMatchObject({ gameplayCode: 'MARKET_LISTING_QUANTITY_CAP' });
  });
});

describe('GameplayError messages', () => {
  it('maps cartel duplicate and market cap errors', () => {
    expect(new GameplayError('CARTEL_NAME_TAKEN').message).toBe(
      'That cartel name is already taken.',
    );
    expect(new GameplayError('CARTEL_TAG_TAKEN').message).toBe(
      'That cartel tag is already taken.',
    );
    expect(new GameplayError('MARKET_LISTING_QUANTITY_CAP').message).toBe(
      'Maximum quantity per listing is 1,000.',
    );
  });
});
