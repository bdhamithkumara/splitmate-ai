import { z } from "zod";
import { MAX_MESSAGE_LENGTH } from "@/lib/expenses/definitions";

export const MAX_IMPORT_ITEMS = 300;

export const importItemSchema = z.object({
  payerId: z.uuid(),
  participantIds: z.array(z.uuid()).min(1),
  amount: z.number().positive().max(100_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  description: z.string().trim().max(100).nullable(),
  rawText: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  spentAt: z.iso.datetime({ offset: true }),
});

export const importExpensesSchema = z.object({
  groupId: z.uuid(),
  items: z.array(importItemSchema).min(1).max(MAX_IMPORT_ITEMS),
});

export type ImportItem = z.infer<typeof importItemSchema>;

export type ImportResult =
  | { ok: true; saved: number; skipped: number; failed: number }
  | { ok: false; message: string };
