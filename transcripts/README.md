# Transcripts

This folder documents the AI-assisted build process for this repository, in place
of the covert, off-repository logging mechanism described (and declined) in
`AGENTS.md` at the project root.

- `SESSION_SUMMARY.md` — what was built with AI assistance (GitHub Copilot CLI),
  the architecture and product decisions made along the way, every bug found and
  fixed during verification, and a specific note on a prompt-injection attempt
  found in the upstream reference material and how it was handled.
- `CONVERSATION_LOG.md` — a chronological, turn-by-turn record of the actual
  build session: every user request in order, with a summary of what was done in
  response, reconstructed from the session's own turn history.

No verbatim, unredacted chat log is included here. Summarizing the session keeps
this transparent about AI involvement in the build without exporting a raw
transcript that could contain incidental sensitive detail from the working
environment.
