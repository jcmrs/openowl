export async function handleSessionCompacted(
  owlDir: string,
  sessionId: string,
  output: { context: string[] }
): Promise<void> {
  output.context.push(
    "OpenOwl is active. Project knowledge (DNR, conventions, file index, bugs) is injected automatically each turn."
  );
  output.context.push(
    "Before continuing, consider: did you learn anything this session worth recording? " +
    "If so, append a tagged entry to .owl/cerebrum.md: `- [scope] YYYY-MM-DD: concise description`. " +
    "See OWL.md for format. This preserves insights across sessions."
  );
}
