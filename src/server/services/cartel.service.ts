import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { REDLITE_CARTEL } from '@/config/game/redlite-rules';
import {
  CARTEL_ARMOURY_ITEMS,
  cartelArmouryPurchaseTotal,
  getCartelArmouryItem,
  isCartelArmouryItem,
  type CartelArmouryItemKey,
} from '@/config/game/cartel-armoury-rules';
import {
  applyCartelContribution,
  cartelAssetsFromRecord,
  cartelDefenceThugBonus,
  calculateCartelNetWorth,
  normalizeDonationPercent,
} from '@/lib/game-engine/cartel-economics';
import {
  computeCartelResponseForce,
  CARTEL_THUGS_PER_RIDE,
} from '@/lib/game-engine/cartel-response-force';
import { GameplayError } from '@/lib/game-engine/gameplay-errors';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';
import { calculateCanonicalNetWorthFromPlayer } from '@/lib/game-engine/canonical-net-worth';
import { formatMemberPresence } from '@/lib/game-engine/cartel-presence';
import { resolvePlayerAvatarId } from '@/lib/game-engine/resolve-player-avatar';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Per Redlite guide §6 — cartel armoury uses Uzi/Glock only; AK-47 is player-only. */
export const CARTEL_ARMOURY_WEAPON_TYPES = ['glock', 'uzi'] as const;
export const CARTEL_AK_SUPPORTED = false;

export interface CartelDefenceContext {
  virtualSupportThugs: number;
  /** Organised cartel Response Force thugs deployed for this defence. */
  responseForceThugs: number;
  /** Deployed thugs passed to combat (alias of responseForceThugs). */
  ownedThugs: number;
  ownedGlocks: number;
  ownedUzis: number;
}

async function lockCartelForDefence(
  tx: CartelTx,
  cartelId: string,
): Promise<{ thugs: number; glocks: number; uzis: number; rides: number }> {
  await tx.$queryRaw`SELECT id FROM "Cartel" WHERE id = ${cartelId} FOR UPDATE`;
  return tx.cartel.findUniqueOrThrow({
    where: { id: cartelId },
    select: { thugs: true, glocks: true, uzis: true, rides: true },
  });
}

function normalizeTag(tag: string): string {
  return tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

type CartelTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function clearPendingMembershipActions(
  tx: CartelTx,
  playerId: string,
  except?: { inviteId?: string; requestId?: string },
): Promise<void> {
  await tx.cartelInvite.updateMany({
    where: {
      inviteeId: playerId,
      status: 'PENDING',
      ...(except?.inviteId ? { id: { not: except.inviteId } } : {}),
    },
    data: { status: 'DECLINED' },
  });
  await tx.cartelJoinRequest.updateMany({
    where: {
      applicantId: playerId,
      status: 'PENDING',
      ...(except?.requestId ? { id: { not: except.requestId } } : {}),
    },
    data: { status: 'CANCELLED' },
  });
}

async function assertCartelNameAndTagAvailable(
  tx: CartelTx,
  cleanName: string,
  cleanTag: string,
): Promise<void> {
  const [nameTaken, tagTaken] = await Promise.all([
    tx.cartel.findUnique({ where: { name: cleanName }, select: { id: true } }),
    tx.cartel.findUnique({ where: { tag: cleanTag }, select: { id: true } }),
  ]);
  if (nameTaken) throw new GameplayError('CARTEL_NAME_TAKEN');
  if (tagTaken) throw new GameplayError('CARTEL_TAG_TAKEN');
}

export const CartelService = {
  async getCartelPageForPlayer(playerId: string) {
    const player = await prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      include: {
        district: { select: { id: true, name: true, slug: true } },
        cartel: {
          include: {
            members: {
              select: {
                id: true,
                alias: true,
                avatar: true,
                cash: true,
                bankCash: true,
                prostitutes: true,
                thugs: true,
                rides: true,
                glocks: true,
                uzis: true,
                aks: true,
                hash: true,
                shrooms: true,
                coke: true,
                heroin: true,
                businesses: true,
                cartelDonationPercent: true,
                travelling: true,
                lifeStatus: true,
                districtId: true,
                district: { select: { name: true, slug: true } },
                user: { select: { lastLoginAt: true } },
                updatedAt: true,
              },
            },
          },
        },
        cartelInvitesRecv: {
          where: { status: 'PENDING', expiresAt: { gt: new Date() } },
          include: { cartel: true, inviter: { select: { alias: true } } },
        },
      },
    });

    const browse = player.cartelId
      ? []
      : await prisma.cartel.findMany({
          include: {
            _count: { select: { members: true } },
            members: { select: { id: true, alias: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });

    const applicantPendingRequests = player.cartelId
      ? []
      : await prisma.cartelJoinRequest.findMany({
          where: { applicantId: playerId, status: 'PENDING' },
          include: { cartel: { select: { id: true, name: true, tag: true } } },
        });

    const pendingRequestCartelIds = new Set(applicantPendingRequests.map((r) => r.cartelId));

    let cartelView = null;
    let pendingJoinRequestsForLeader: Array<{ id: string; alias: string; avatarId: string }> = [];
    if (player.cartel) {
      const leaderId = player.cartel.leaderId;
      const members = player.cartel.members.map((m) => {
        const isLeader = m.id === leaderId;
        return {
          id: m.id,
          alias: m.alias,
          avatarId: resolvePlayerAvatarId(m.avatar),
          netWorth: calculateCanonicalNetWorthFromPlayer(m),
          donationPercent: m.cartelDonationPercent,
          city: m.district.name,
          role: isLeader ? ('Leader' as const) : ('Member' as const),
          isLeader,
          presence: formatMemberPresence(m.user.lastLoginAt),
          travelling: m.travelling,
        };
      });

      const eligibleSupporters = player.cartel.members.filter(
        (m) =>
          m.id !== playerId &&
          m.districtId === player.district.id &&
          !m.travelling &&
          m.lifeStatus === 'ACTIVE',
      );

      const leaderMember = members.find((m) => m.isLeader);
      const assets = cartelAssetsFromRecord(player.cartel);
      const cartelRides = assets.rides ?? 0;
      const transportCapacity = cartelRides * CARTEL_THUGS_PER_RIDE;
      const myMaxResponseForce = computeCartelResponseForce(
        player.thugs,
        assets.thugs ?? 0,
        cartelRides,
      );

      cartelView = {
        id: player.cartel.id,
        name: player.cartel.name,
        tag: player.cartel.tag,
        leaderId,
        leaderAlias: leaderMember?.alias ?? 'Unknown',
        foundedAt: player.cartel.createdAt.toISOString(),
        treasuryCash: player.cartel.treasuryCash,
        memberCount: members.length,
        maxMembers: REDLITE_CARTEL.maxMembers,
        maxDonationPercent: REDLITE_CARTEL.maxDonationPercent,
        cartelNetWorth: calculateCartelNetWorth(assets),
        members,
        isLeader: leaderId === playerId,
        myRole: leaderId === playerId ? ('Leader' as const) : ('Member' as const),
        myDonationPercent: player.cartelDonationPercent,
        myCity: player.district.name,
        status: 'Active' as const,
        protection: {
          sameCitySupporters: eligibleSupporters.length,
          virtualDefenceThugs: cartelDefenceThugBonus(
            eligibleSupporters.map((m) => ({ thugs: m.thugs })),
          ),
          responseForce: {
            maxForYou: myMaxResponseForce,
            cartelRides,
            transportCapacity,
            poolThugs: assets.thugs ?? 0,
          },
        },
        armoury: {
          treasuryCash: assets.treasuryCash,
          thugs: assets.thugs ?? 0,
          glocks: assets.glocks ?? 0,
          uzis: assets.uzis ?? 0,
          rides: cartelRides,
          transportCapacity,
          hasSharedStock: true,
          supportedWeaponTypes: [...CARTEL_ARMOURY_WEAPON_TYPES],
          akSupported: CARTEL_AK_SUPPORTED,
          catalog: CARTEL_ARMOURY_ITEMS.map((item) => ({
            key: item.key,
            displayName: item.displayName,
            unitPrice: item.unitPrice,
            purpose: item.purpose,
            ownedQuantity: assets[item.field] ?? 0,
          })),
        },
      };

      if (leaderId === playerId) {
        const pendingRequests = await prisma.cartelJoinRequest.findMany({
          where: { cartelId: player.cartel.id, status: 'PENDING' },
          include: {
            applicant: { select: { id: true, alias: true, avatar: true } },
          },
          orderBy: { createdAt: 'asc' },
        });
        pendingJoinRequestsForLeader = pendingRequests.map((r) => ({
          id: r.id,
          alias: r.applicant.alias,
          avatarId: resolvePlayerAvatarId(r.applicant.avatar),
        }));
      }
    }

    return {
      inCartel: Boolean(player.cartelId),
      cartel: cartelView,
      pendingInvites: player.cartelInvitesRecv.map((i) => ({
        id: i.id,
        cartelName: i.cartel.name,
        cartelTag: i.cartel.tag,
        inviterAlias: i.inviter.alias,
        expiresAt: i.expiresAt.toISOString(),
      })),
      browse: browse.map((c) => {
        const leaderMember = c.members.find((m) => m.id === c.leaderId);
        return {
          id: c.id,
          name: c.name,
          tag: c.tag,
          memberCount: c._count.members,
          maxMembers: REDLITE_CARTEL.maxMembers,
          leaderAlias: leaderMember?.alias ?? 'Unknown',
          hasPendingRequest: pendingRequestCartelIds.has(c.id),
        };
      }),
      pendingJoinRequests: applicantPendingRequests.map((r) => ({
        cartelId: r.cartelId,
        cartelName: r.cartel.name,
        cartelTag: r.cartel.tag,
      })),
      pendingJoinRequestsForLeader,
    };
  },

  async createCartel(playerId: string, name: string, tag: string) {
    const cleanName = name.trim();
    const cleanTag = normalizeTag(tag);
    if (cleanName.length < 3 || cleanName.length > 32) {
      throw new GameplayError('INVALID_QUANTITY', 'Cartel name must be 3–32 characters.');
    }
    if (cleanTag.length < 2 || cleanTag.length > 6) {
      throw new GameplayError('INVALID_QUANTITY', 'Cartel tag must be 2–6 letters or numbers.');
    }

    return prisma.$transaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
      assertPlayerCanPerformAction(player);
      if (player.cartelId) throw new GameplayError('CARTEL_ALREADY_MEMBER');

      await assertCartelNameAndTagAvailable(tx, cleanName, cleanTag);

      const cartel = await tx.cartel.create({
        data: { name: cleanName, tag: cleanTag, leaderId: playerId },
      });
      await tx.player.update({
        where: { id: playerId },
        data: { cartelId: cartel.id, cartelDonationPercent: 0 },
      });
      return cartel;
    });
  },

  async invitePlayer(leaderId: string, inviteeAlias: string) {
    const invitee = await prisma.player.findFirst({
      where: { aliasNormalized: inviteeAlias.trim().toLowerCase(), isSystemPlayer: false },
    });
    if (!invitee) throw new GameplayError('INVALID_TARGET');

    return prisma.$transaction(async (tx) => {
      const leader = await tx.player.findUniqueOrThrow({
        where: { id: leaderId },
        include: { cartel: { include: { _count: { select: { members: true } } } } },
      });
      if (!leader.cartelId || !leader.cartel) throw new GameplayError('CARTEL_ALREADY_MEMBER');
      if (leader.cartel.leaderId !== leaderId) throw new GameplayError('CARTEL_NOT_LEADER');
      if (leader.cartel._count.members >= REDLITE_CARTEL.maxMembers) {
        throw new GameplayError('CARTEL_FULL');
      }
      if (invitee.cartelId) throw new GameplayError('CARTEL_ALREADY_MEMBER');

      await tx.cartelInvite.updateMany({
        where: { cartelId: leader.cartelId, inviteeId: invitee.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });

      return tx.cartelInvite.create({
        data: {
          cartelId: leader.cartelId,
          inviterId: leaderId,
          inviteeId: invitee.id,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
      });
    });
  },

  async acceptInvite(playerId: string, inviteId: string) {
    return prisma.$transaction(async (tx) => {
      const invite = await tx.cartelInvite.findUnique({
        where: { id: inviteId },
        include: { cartel: { include: { _count: { select: { members: true } } } } },
      });
      if (!invite || invite.inviteeId !== playerId || invite.status !== 'PENDING') {
        throw new GameplayError('CARTEL_INVITE_INVALID');
      }
      if (invite.expiresAt <= new Date()) {
        await tx.cartelInvite.update({ where: { id: inviteId }, data: { status: 'EXPIRED' } });
        throw new GameplayError('CARTEL_INVITE_INVALID');
      }

      const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
      if (player.cartelId) throw new GameplayError('CARTEL_ALREADY_MEMBER');
      if (invite.cartel._count.members >= REDLITE_CARTEL.maxMembers) {
        throw new GameplayError('CARTEL_FULL');
      }

      await tx.player.update({
        where: { id: playerId },
        data: { cartelId: invite.cartelId, cartelDonationPercent: 0 },
      });
      await tx.cartelInvite.update({ where: { id: inviteId }, data: { status: 'ACCEPTED' } });
      await clearPendingMembershipActions(tx, playerId, { inviteId });
      return invite.cartelId;
    });
  },

  async declineInvite(playerId: string, inviteId: string) {
    const invite = await prisma.cartelInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.inviteeId !== playerId || invite.status !== 'PENDING') {
      throw new GameplayError('CARTEL_INVITE_INVALID');
    }
    await prisma.cartelInvite.update({ where: { id: inviteId }, data: { status: 'DECLINED' } });
  },

  async leaveCartel(playerId: string) {
    return prisma.$transaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({
        where: { id: playerId },
        include: { cartel: { include: { members: true } } },
      });
      if (!player.cartelId || !player.cartel) return;

      if (player.cartel.leaderId === playerId) {
        const others = player.cartel.members.filter((m) => m.id !== playerId);
        if (others.length === 0) {
          await tx.player.update({
            where: { id: playerId },
            data: { cartelId: null, cartelDonationPercent: 0 },
          });
          await tx.cartel.delete({ where: { id: player.cartelId } });
          return;
        }
        throw new GameplayError(
          'CARTEL_NOT_LEADER',
          'Transfer leadership or disband before leaving as leader.',
        );
      }

      await tx.player.update({
        where: { id: playerId },
        data: { cartelId: null, cartelDonationPercent: 0 },
      });
    });
  },

  async removeMember(leaderId: string, memberId: string) {
    return prisma.$transaction(async (tx) => {
      const leader = await tx.player.findUniqueOrThrow({
        where: { id: leaderId },
        include: { cartel: true },
      });
      if (!leader.cartel || leader.cartel.leaderId !== leaderId) {
        throw new GameplayError('CARTEL_NOT_LEADER');
      }
      if (memberId === leaderId) throw new GameplayError('INVALID_TARGET');
      const member = await tx.player.findUnique({ where: { id: memberId } });
      if (!member || member.cartelId !== leader.cartelId) throw new GameplayError('INVALID_TARGET');

      await tx.player.update({
        where: { id: memberId },
        data: { cartelId: null, cartelDonationPercent: 0 },
      });
    });
  },

  async setDonationPercent(playerId: string, percent: number) {
    const normalized = normalizeDonationPercent(percent);
    await prisma.player.update({
      where: { id: playerId },
      data: { cartelDonationPercent: normalized },
    });
    return normalized;
  },

  async requestToJoin(playerId: string, cartelId: string) {
    return prisma.$transaction(async (tx) => {
      const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
      assertPlayerCanPerformAction(player);
      if (player.cartelId) throw new GameplayError('CARTEL_ALREADY_MEMBER');

      const cartel = await tx.cartel.findUnique({
        where: { id: cartelId },
        include: { _count: { select: { members: true } } },
      });
      if (!cartel) throw new GameplayError('INVALID_TARGET');
      if (cartel._count.members >= REDLITE_CARTEL.maxMembers) {
        throw new GameplayError('CARTEL_FULL');
      }

      const existing = await tx.cartelJoinRequest.findFirst({
        where: { cartelId, applicantId: playerId, status: 'PENDING' },
      });
      if (existing) throw new GameplayError('CARTEL_JOIN_REQUEST_EXISTS');

      try {
        return await tx.cartelJoinRequest.create({
          data: { cartelId, applicantId: playerId },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new GameplayError('CARTEL_JOIN_REQUEST_EXISTS');
        }
        throw error;
      }
    });
  },

  async acceptJoinRequest(leaderId: string, requestId: string) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.cartelJoinRequest.findUnique({
        where: { id: requestId },
        include: {
          cartel: { include: { _count: { select: { members: true } } } },
          applicant: true,
        },
      });
      if (!request || request.status !== 'PENDING') {
        throw new GameplayError('CARTEL_JOIN_REQUEST_INVALID');
      }

      const leader = await tx.player.findUniqueOrThrow({
        where: { id: leaderId },
        include: { cartel: true },
      });
      if (!leader.cartel || leader.cartel.leaderId !== leaderId) {
        throw new GameplayError('CARTEL_NOT_LEADER');
      }
      if (leader.cartelId !== request.cartelId) {
        throw new GameplayError('CARTEL_JOIN_REQUEST_INVALID');
      }
      if (request.cartel._count.members >= REDLITE_CARTEL.maxMembers) {
        throw new GameplayError('CARTEL_FULL');
      }
      if (request.applicant.cartelId) {
        throw new GameplayError('CARTEL_JOIN_REQUEST_INVALID');
      }
      assertPlayerCanPerformAction(request.applicant);

      await tx.player.update({
        where: { id: request.applicantId },
        data: { cartelId: request.cartelId, cartelDonationPercent: 0 },
      });
      await tx.cartelJoinRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      });
      await clearPendingMembershipActions(tx, request.applicantId, { requestId });
      return request.cartelId;
    });
  },

  async declineJoinRequest(leaderId: string, requestId: string) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.cartelJoinRequest.findUnique({
        where: { id: requestId },
        include: { cartel: true },
      });
      if (!request || request.status !== 'PENDING') {
        throw new GameplayError('CARTEL_JOIN_REQUEST_INVALID');
      }

      const leader = await tx.player.findUniqueOrThrow({
        where: { id: leaderId },
        include: { cartel: true },
      });
      if (!leader.cartel || leader.cartel.leaderId !== leaderId) {
        throw new GameplayError('CARTEL_NOT_LEADER');
      }
      if (leader.cartelId !== request.cartelId) {
        throw new GameplayError('CARTEL_JOIN_REQUEST_INVALID');
      }

      await tx.cartelJoinRequest.update({
        where: { id: requestId },
        data: { status: 'DECLINED' },
      });
    });
  },

  async transferLeadership(leaderId: string, newLeaderId: string) {
    return prisma.$transaction(async (tx) => {
      const leader = await tx.player.findUniqueOrThrow({
        where: { id: leaderId },
        include: { cartel: true },
      });
      if (!leader.cartel || leader.cartel.leaderId !== leaderId) {
        throw new GameplayError('CARTEL_NOT_LEADER');
      }
      if (newLeaderId === leaderId) {
        throw new GameplayError('INVALID_TARGET');
      }

      const target = await tx.player.findUnique({ where: { id: newLeaderId } });
      if (!target || target.cartelId !== leader.cartelId) {
        throw new GameplayError('CARTEL_NOT_MEMBER');
      }
      assertPlayerCanPerformAction(target);

      const cartelId = leader.cartelId;
      if (!cartelId) throw new GameplayError('CARTEL_ALREADY_MEMBER');

      await tx.cartel.update({
        where: { id: cartelId },
        data: { leaderId: newLeaderId },
      });
      return cartelId;
    });
  },

  async applyIncomeContribution(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    playerId: string,
    grossCash: number,
  ): Promise<{ playerCash: number; cartelCash: number }> {
    const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
    if (!player.cartelId || grossCash <= 0) {
      return { playerCash: grossCash, cartelCash: 0 };
    }
    const split = applyCartelContribution(grossCash, player.cartelDonationPercent);
    if (split.cartelCash > 0) {
      await tx.cartel.update({
        where: { id: player.cartelId },
        data: { treasuryCash: { increment: split.cartelCash } },
      });
    }
    return split;
  },

  async getCartelDefenceContextInTx(
    tx: CartelTx,
    defenderId: string,
  ): Promise<CartelDefenceContext> {
    const empty: CartelDefenceContext = {
      virtualSupportThugs: 0,
      responseForceThugs: 0,
      ownedThugs: 0,
      ownedGlocks: 0,
      ownedUzis: 0,
    };

    const defender = await tx.player.findUnique({
      where: { id: defenderId },
      select: { cartelId: true, districtId: true, travelling: true, thugs: true },
    });
    if (!defender?.cartelId || defender.travelling) {
      return empty;
    }

    const cartel = await lockCartelForDefence(tx, defender.cartelId);

    const supporters = await tx.player.findMany({
      where: {
        cartelId: defender.cartelId,
        id: { not: defenderId },
        districtId: defender.districtId,
        travelling: false,
        lifeStatus: 'ACTIVE',
      },
      select: { thugs: true },
    });

    const responseForceThugs = computeCartelResponseForce(
      defender.thugs,
      cartel.thugs,
      cartel.rides,
    );

    return {
      virtualSupportThugs: cartelDefenceThugBonus(supporters),
      responseForceThugs,
      ownedThugs: responseForceThugs,
      ownedGlocks: cartel.glocks,
      ownedUzis: cartel.uzis,
    };
  },

  async getDefenceSupportInTx(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    defenderId: string,
  ): Promise<number> {
    const context = await this.getCartelDefenceContextInTx(tx, defenderId);
    return context.virtualSupportThugs;
  },

  async getDefenceSupport(defenderId: string): Promise<number> {
    return prisma.$transaction(async (tx) => this.getDefenceSupportInTx(tx, defenderId));
  },

  async purchaseArmouryItem(
    leaderId: string,
    item: string,
    quantity: number,
    idempotencyKey: string,
  ) {
    if (!isCartelArmouryItem(item)) {
      throw new GameplayError('INVALID_QUANTITY', 'This item cannot be purchased for the cartel.');
    }

    const existing = await prisma.gameAction.findFirst({
      where: { playerId: leaderId, idempotencyKey },
    });
    if (existing?.resultPayload) {
      return existing.resultPayload as {
        item: CartelArmouryItemKey;
        quantity: number;
        unitPrice: number;
        totalCost: number;
        newTreasuryCash: number;
        newOwnedQuantity: number;
        cartelNetWorth: number;
      };
    }

    return prisma.$transaction(async (tx) => {
      const leader = await tx.player.findUniqueOrThrow({
        where: { id: leaderId },
        include: { cartel: true, season: true },
      });
      assertPlayerCanPerformAction(leader);
      if (!leader.cartelId || !leader.cartel) throw new GameplayError('CARTEL_ALREADY_MEMBER');
      if (leader.cartel.leaderId !== leaderId) throw new GameplayError('CARTEL_NOT_LEADER');
      if (leader.season.status !== 'ACTIVE') throw new GameplayError('SEASON_INACTIVE');

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
        throw new GameplayError('INVALID_QUANTITY');
      }

      const rule = getCartelArmouryItem(item)!;
      const totalCost = cartelArmouryPurchaseTotal(item, quantity);
      if (leader.cartel.treasuryCash < totalCost) {
        throw new GameplayError('INSUFFICIENT_CASH', 'Insufficient treasury funds.');
      }

      const currentQty = leader.cartel[rule.field];
      const newQty = currentQty + quantity;
      const newTreasury = leader.cartel.treasuryCash - totalCost;

      const updatedCartel = await tx.cartel.update({
        where: { id: leader.cartelId },
        data: {
          treasuryCash: newTreasury,
          [rule.field]: newQty,
        },
      });

      const assets = cartelAssetsFromRecord(updatedCartel);
      const resultData = {
        item,
        quantity,
        unitPrice: rule.unitPrice,
        totalCost,
        newTreasuryCash: newTreasury,
        newOwnedQuantity: newQty,
        cartelNetWorth: calculateCartelNetWorth(assets),
      };

      await tx.gameAction.create({
        data: {
          playerId: leaderId,
          seasonId: leader.seasonId,
          actionType: 'CARTEL_ARMOURY_PURCHASE',
          idempotencyKey,
          requestPayload: { item, quantity } as object,
          resultPayload: resultData as object,
          turnsSpent: 0,
        },
      });

      return resultData;
    }, { isolationLevel: 'Serializable' });
  },

  async getCartelRankings() {
    const cartels = await prisma.cartel.findMany({
      include: { _count: { select: { members: true } } },
    });

    const ranked = cartels
      .map((c) => {
        const assets = cartelAssetsFromRecord(c);
        return {
          id: c.id,
          name: c.name,
          tag: c.tag,
          memberCount: c._count.members,
          cartelNetWorth: calculateCartelNetWorth(assets),
          treasuryCash: c.treasuryCash,
          createdAt: c.createdAt,
        };
      })
      .sort((a, b) => {
        if (b.cartelNetWorth !== a.cartelNetWorth) return b.cartelNetWorth - a.cartelNetWorth;
        return a.createdAt.getTime() - b.createdAt.getTime();
      })
      .map((row, i) => ({ ...row, rank: i + 1 }));

    return ranked;
  },
};

// Re-export for tests
export {
  applyCartelContribution,
  cartelDefenceThugBonus,
  calculateCartelNetWorth,
  computeCartelResponseForce,
  lockCartelForDefence,
};
