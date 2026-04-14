export async function handleSessionCompacted(
  owlDir: string,
  sessionId: string,
  output: { context: string[] }
): Promise<void> {
  output.context.push(
    "IMPORTANT: This project uses OpenOwl for context management.",
    "Read .owl/OWL.md for the operating protocol.",
    "Check .owl/cerebrum.md Do-Not-Repeat list before generating code.",
    "Check .owl/anatomy.md before reading files to avoid unnecessary reads.",
    "After edits, update .owl/anatomy.md and append to .owl/memory.md.",
    "Check .owl/buglog.json for known fixes before debugging.",
    "Read docs/specs/architecture.md for full project context if needed."
  );
}
