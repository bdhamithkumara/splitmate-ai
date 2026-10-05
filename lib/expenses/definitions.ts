import { z } from "zod";

export const MAX_MESSAGE_LENGTH = 300;

export const previewExpenseSchema = z.object({
  groupId: z.uuid(),
  text: z
    .string()
    .trim()
    .min(1, { error: "Type an expense message." })
    .max(MAX_MESSAGE_LENGTH, {
      error: `Keep it under ${MAX_MESSAGE_LENGTH} characters.`,
    }),
});

export const saveExpenseSchema = z.object({
  groupId: z.uuid(),
  payerId: z.uuid({ error: "Pick who paid." }),
  amount: z.coerce
    .number({ error: "Enter an amount." })
    .positive({ error: "Amount must be more than 0." })
    .max(100_000_000, { error: "That amount is too large." }),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, { error: "Currency must be a 3-letter code." }),
  description: z.string().trim().max(100).optional(),
  rawText: z.string().trim().max(MAX_MESSAGE_LENGTH).optional(),
  participantIds: z
    .array(z.uuid())
    .min(1, { error: "Pick at least one person to split with." }),
});

export const updateExpenseSchema = saveExpenseSchema
  .pick({
    groupId: true,
    payerId: true,
    amount: true,
    description: true,
    participantIds: true,
  })
  .extend({ expenseId: z.uuid() });

export const deleteExpenseSchema = z.object({
  groupId: z.uuid(),
  expenseId: z.uuid(),
});

export type SaveExpenseState =
  | {
      errors?: Partial<
        Record<"amount" | "currency" | "payerId" | "participantIds", string[]>
      >;
      message?: string;
      success?: boolean;
    }
  | undefined;

// Parsed message resolved against the group's members, ready to review.
export type ExpensePreview = {
  id: string;
  rawText: string;
  amount: number;
  currency: string;
  description: string | null;
  payerId: string;
  participantIds: string[];
  source: "rules" | "ai";
  notes: string[];
};

export type PreviewExpenseState =
  | {
      errors?: Partial<Record<"text", string[]>>;
      message?: string;
      text?: string;
      preview?: ExpensePreview;
    }
  | undefined;
