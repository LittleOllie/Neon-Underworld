import { z } from 'zod';
import { AUTH_CONFIG } from '@/config/game/balance';

export const registerSchema = z
  .object({
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(AUTH_CONFIG.passwordMinLength, `Password must be at least ${AUTH_CONFIG.passwordMinLength} characters`),
    confirmPassword: z.string(),
    inviteCode: z.string().min(4, 'Invite code is required'),
    alias: z
      .string()
      .min(AUTH_CONFIG.aliasMinLength, `Alias must be at least ${AUTH_CONFIG.aliasMinLength} characters`)
      .max(AUTH_CONFIG.aliasMaxLength, `Alias must be at most ${AUTH_CONFIG.aliasMaxLength} characters`)
      .regex(AUTH_CONFIG.aliasPattern, 'Alias may only contain letters, numbers, and underscores'),
    districtSlug: z.string().min(1, 'Select a district'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const scoutSchema = z.object({
  turns: z.number().int().positive(),
  areaSlug: z.string().min(1).optional(),
  idempotencyKey: z.string().uuid(),
});

export const produceSchema = z.object({
  turns: z.number().int().positive(),
  drugType: z.enum(['hash', 'shrooms', 'coke', 'heroin']),
  idempotencyKey: z.string().uuid(),
});

export const shopPurchaseSchema = z.object({
  item: z.enum([
    'glock', 'uzi', 'ak', 'ride',
    'hash', 'shroom', 'coke', 'heroin', 'beer', 'condom',
  ]),
  quantity: z.number().int().min(1).max(1000),
  idempotencyKey: z.string().uuid(),
});

export const payoutSchema = z.object({
  payoutPercent: z.number().int().min(1).max(100),
});

export const inviteCodeSchema = z.object({
  code: z.string().min(4).max(32),
  label: z.string().max(100).optional(),
  maximumUses: z.number().int().positive().default(1),
  expiresAt: z.string().datetime().optional(),
});

export const scoutTargetSchema = z.object({
  targetAlias: z.string().min(2).max(32),
  idempotencyKey: z.string().uuid(),
});

export const attackLaunchSchema = z.object({
  scoutReportId: z.string().min(1),
  attackType: z.enum(['DRIVE_BY', 'HOME_INVASION', 'RAID_DRUG_LABS']),
  attackingThugs: z.number().int().min(1).max(5000),
  idempotencyKey: z.string().uuid(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ScoutInput = z.infer<typeof scoutSchema>;
export type PayoutInput = z.infer<typeof payoutSchema>;
