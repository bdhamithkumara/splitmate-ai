// Deterministic mapping from names the model returned to real group members.
// Order: exact (case-insensitive) → unique prefix → small typo distance.

export type MemberRef = { id: string; name: string };

export function matchMember<T extends MemberRef>(
  name: string,
  members: T[],
): T | null {
  const target = name.trim().toLowerCase();
  if (!target) return null;

  const exact = members.find((m) => m.name.toLowerCase() === target);
  if (exact) return exact;

  // "Has" → Hasaru, but only if exactly one member starts that way.
  if (target.length >= 3) {
    const prefixed = members.filter((m) =>
      m.name.toLowerCase().startsWith(target),
    );
    if (prefixed.length === 1) return prefixed[0];
  }

  // "Kasn" → Kasun. Allow 1 edit for short names, 2 for longer ones, and
  // only accept a single best match so we never guess between two people.
  const maxDistance = target.length <= 4 ? 1 : 2;
  let best: T | null = null;
  let bestDistance = Infinity;
  let tie = false;

  for (const member of members) {
    const distance = levenshtein(target, member.name.toLowerCase());
    if (distance < bestDistance) {
      best = member;
      bestDistance = distance;
      tie = false;
    } else if (distance === bestDistance) {
      tie = true;
    }
  }

  return best && bestDistance <= maxDistance && !tie ? best : null;
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }

  return previous[b.length];
}
