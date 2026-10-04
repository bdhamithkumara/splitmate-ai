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
