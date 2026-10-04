import type { MemberRef } from "./match-members";
import { quickParse } from "./quick-parse";
import {
  parseExpenseText,
  type ParseExpenseOptions,
  type ParsedExpense,
} from "./parse-expense";

export { matchMember, type MemberRef } from "./match-members";
export {
  ExpenseParseError,
  type ExpenseParseErrorReason,
  type ParsedExpense,
} from "./parse-expense";

export type ParseResult = {
  expense: ParsedExpense;
  source: "rules" | "ai";
};

// Instant rule-based parse for common formats; local model for the rest.
export async function parseExpense(
  text: string,
  members: MemberRef[],
  options: Omit<ParseExpenseOptions, "memberNames"> = {},
): Promise<ParseResult> {
  const quick = quickParse(text, members);
  if (quick) return { expense: quick, source: "rules" };

  const expense = await parseExpenseText(text, {
    ...options,
    memberNames: members.map((m) => m.name),
  });
  return { expense, source: "ai" };
}
