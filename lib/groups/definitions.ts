import { z } from "zod";

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `${label} is required.` })
    .max(50, { error: `${label} must be at most 50 characters.` });

export const createGroupSchema = z.object({
  name: name("Group name"),
});

export const addMemberSchema = z.object({
  groupId: z.uuid(),
  name: name("Name"),
});

export type GroupFormState =
  | {
      errors?: Partial<Record<"name", string[]>>;
      message?: string;
      success?: boolean;
      values?: { name?: string };
    }
  | undefined;
