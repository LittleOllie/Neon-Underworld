import { prisma } from '@/lib/db/prisma';
import { REDLITE_CARTEL } from '@/config/game/redlite-rules';
import {
  applyCartelContribution,
  cartelDefenceThugBonus,
  normalizeDonationPercent,
} from '@/lib/game-engine/cartel-economics';
import { GameplayError } from '@/lib/game-engine/gameplay-errors';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';
import { calculateCanonicalNetWorthFromPlayer } from '@/lib/game-engine/canonical-net-worth';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeTag(tag: string): string {
  return tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export const CartelService = {
  async getCartelPageForPlayer(playerId: string) {
    const player = await prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      include: {
        cartel: {
          include: {
            members: {
              select: {
                id: true,
                alias: true,
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
                district: { select: { name: true, slug: true } },
                user: { select: { lastLoginAt: true } },
                statusExt: true,
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
          include: { _count: { select: { members: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });

    let cartelView = null;
    if (player.cartel) {
      const members = player.cartel.members.map((m) => ({
        id: m.id,
        alias: m.alias,
        netWorth: calculateCanonicalNetWorthFromPlayer(m),
        donationPercent: m.cartelDonationPercent,
        city: m.district.name,
        isLeader: m.id === player.cartel!.leaderId,
      }));
      cartelView = {
        id: player.cartel.id,
        name: player.cartel.name,
        tag: player.cartel.tag,
        leaderId: player.cartel.leaderId,
        treasuryCash: player.cartel.treasuryCash,
        memberCount: members.length,
        maxMembers: REDLITE_CARTEL.maxMembers,
        combinedNetWorth: members.reduce((s, m) => s + m.netWorth, 0),
        members,
        isLeader: player.cartel.leaderId === playerId,
        myDonationPercent: player.cartelDonationPercent,
      };
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
      browse: browse.map((c) => ({
        id: c.id,
        name: c.name,
        tag: c.tag,
        memberCount: c._count.members,
        maxMembers: REDLITE_CARTEL.maxMembers,
      })),
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

  async getDefenceSupportInTx(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    defenderId: string,
  ): Promise<number> {
    const defender = await tx.player.findUnique({
      where: { id: defenderId },
      select: { cartelId: true, districtId: true, travelling: true },
    });
    if (!defender?.cartelId || defender.travelling) return 0;

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

    return cartelDefenceThugBonus(supporters);
  },

  async getDefenceSupport(defenderId: string): Promise<number> {
    return prisma.$transaction(async (tx) => this.getDefenceSupportInTx(tx, defenderId));
  },

  async getCartelRankings() {
    const cartels = await prisma.cartel.findMany({
      include: {
        members: {
          select: {
            id: true,
            createdAt: true,
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
          },
        },
      },
    });

    const ranked = cartels
      .map((c) => {
        const combinedNetWorth = c.members.reduce(
          (sum, m) => sum + calculateCanonicalNetWorthFromPlayer(m),
          0,
        );
        return {
          id: c.id,
          name: c.name,
          tag: c.tag,
          memberCount: c.members.length,
          combinedNetWorth,
          createdAt: c.createdAt,
        };
      })
      .sort((a, b) => {
        if (b.combinedNetWorth !== a.combinedNetWorth) return b.combinedNetWorth - a.combinedNetWorth;
        return a.createdAt.getTime() - b.createdAt.getTime();
      })
      .map((row, i) => ({ ...row, rank: i + 1 }));

    return ranked;
  },
};

// Re-export for tests
export { applyCartelContribution, cartelDefenceThugBonus };
