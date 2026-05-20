import { z } from 'zod';

export const AdminChangePasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export type AdminChangePasswordDto = z.infer<typeof AdminChangePasswordSchema>;

export const AdminSetActiveSchema = z.object({
  isActive: z.boolean(),
});

export type AdminSetActiveDto = z.infer<typeof AdminSetActiveSchema>;
