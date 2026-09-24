### Summary

<!-- What and why. For AI-authored PRs, include the agent brief (the task the
     agent was given) so reviewers can check intent-vs-diff alignment. -->

### Verification

<!-- What you ran and what it showed. "Reproduced in the browser, URL kept
     the code, 335 tests pass" — concrete, not "works". Bug fixes must
     include the regression test that fails on the old code. -->

### Author self-review — complete before marking ready

**🔴 Decisions** (read the diff, not the summary)
- [ ] Public API: exported names and shapes are the ones I'd choose (check `docs/api-reports/` diff)
- [ ] Dependencies/versioning: dep-section moves and changeset tier are my call, not the agent's default

**🟡 Behavior** (run it, don't just read it)
- [ ] The changed flow verified on the actual target — noted where, under Verification

**⚙️ Mechanical**
- [ ] `pnpm install --frozen-lockfile` passes; affected package suites green
