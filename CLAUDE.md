@AGENTS.md

# Working rules for Claude Code

- Build only what the round's spec asks.
- If something is unclear or conflicts with the code, stop and ask. Don't pick an interpretation silently.
- List anything built beyond the spec under **EXTRA** in the phase report.
- Evidence before "verified": never write "verified" or "checked" without a test name, screenshot path or command output. Label signed-out `/dev/app/*` checks as signed-out.
- Never read or edit `.env*`, never print secrets, never `git push`.
- Commit once per phase, only after "commit and continue".
- Follow `docs/design/TANGENT-STYLE.md` for every UI change.
- Keep the round's plan log current (Round 5A: `docs/tangent/ROUND5A-PLAN.md`) so a fresh session can continue from it.
