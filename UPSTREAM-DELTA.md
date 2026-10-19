# Veer upstream delta ledger

This file records the boundary between the Veer fork and
[`stablyai/orca`](https://github.com/stablyai/orca). It is intentionally short:
the merge commit and git history contain the full patch, while this ledger keeps
the next upstream sync from guessing which local behavior is intentional.

The procedure for updating this file is
[`docs/reference/upstream-merge.md`](docs/reference/upstream-merge.md).

## Current baseline

- Fork remote: `origin` → `git@github.com:rahuljangirworks/veer.git`
- Upstream remote: `upstream` → `git@github.com:stablyai/orca.git` (fetch only; push URL `DISABLED`)
- Integration branch: `dev` (do not reset or force-push `main`)
- Merge command: `git merge upstream/main --no-ff` (never rebase)
- Previous absorbed upstream commit: `5813cb640ed342e872dcec03aee0ee7ef7536e7f` (2026-09-28), recorded by `6a0b46a7d62e2b5ac47548ea6ae7699b3a8a1933`
- Last recorded upstream merge: `1f555c095aa044df1438f963be8a80cc4298b95f` (2026-10-19)
- Do not use `67e22345da` / `ec591a82a4` or the 2026-09-03 brain summary as the current baseline

### 2026-10-19 — upstream/main @ 1f555c095aa044df1438f963be8a80cc4298b95f
- Merge commit: `bc3f5ffca37b3fb335e238a14d31cb9a140625f6` (`chore: merge upstream/main @ 1f555c095a`), parents `6a0b46a7d62e2b5ac47548ea6ae7699b3a8a1933` and `1f555c095aa044df1438f963be8a80cc4298b95f`
- Target branch: `dev`
- Range: `5813cb640ed342e872dcec03aee0ee7ef7536e7f..1f555c095aa044df1438f963be8a80cc4298b95f` (3153 upstream commits). Local `dev` was 125 commits ahead of that base before the merge.
- Backup: `backup/upstream-sync-20261019` at `6a0b46a7d62e2b5ac47548ea6ae7699b3a8a1933`
- Conflicts: 120 paths (94 content, 23 modify/delete, 3 delete/modify). Brand-only display conflicts took upstream and restored Veer display strings. Upstream-deleted files that Veer had only rebranded were removed. The three Linux `orca` shim files upstream still ships were restored; Veer `linux-veer-*` copies remain.
- Privacy: `TELEMETRY_ENABLED` is the literal `false`. `src/main/index.ts` arms updater, remote updater, marketplace, kill-list, star prompt, and diagnostics upload only when `PERSONAL_FORK_POLICY.firstPartyNetworkEnabled` is true, via real `if` statements. `attach-main-window-services.ts` skips updater setup unless that flag and the composition-root allow-list agree. Comment-only guards were removed. `verify-privacy-boundary.sh` no longer counts comments.
- Policy string: `updateStrategy` is `merge-upstream-no-ff`. Nothing branched on the old `git-upstream-rebase` value except the policy test, which was updated.
- Platform URLs: packaged Orca cloud auth no longer defaults to `login.onorca.dev` / `relay.onorca.dev`. It accepts only loopback or `https://api.veer.rahuljangir.work` via `VEER_PLATFORM_API_URL`. `fetch-config.ts` uses that API origin. Artifact sharing stays on the Veer platform client.
- Identity: `package.json` name is `veer`. `productName` is `Veer`. App id is `com.rahuljangir.veer`. Release artifact filenames are `veer-*`. `orca-cli`, `ORCA_*`, `orca://`, and `orca-ide` stay. Skill guide ids stay `veer-*` with `orca-*` aliases; new upstream `orca-jira` is kept under that id because that is the on-disk guide name.
- Release workflows: `release-cut.yml` and `release-mac-build.yml` run for `stablyai/orca` or `rahuljangirworks/veer`. macOS builds use `macos-15` (no Blacksmith on the fork). The Veer D1 upsert posts to `https://api.veer.rahuljangir.work/api/releases/publish` only on `rahuljangirworks/veer`.
- Workspace default: new installs use `~/veer/workspaces`; `getLegacyDefaultWorkspaceDir` keeps the old `orca/workspaces` root.
- Upstream changes intentionally not ported: comment-only privacy greps; implicit Orca/Stably production auth and relay URLs; rebasing `dev`.
- Veer-specific follow-up: brain ledger `.brain/veer/_agent/rules/UPSTREAM-DELTA.md` updated to this baseline. `.agents/brain` resolves to the same file.
- Validation: `verify-privacy-boundary.sh` passed. `verify-branding.sh` passed. `pnpm tc` passed (16,891 + 2,991 + 31 + 14,998 files). Vitest personal-fork plus profile auth config: 5 files, 23 tests passed. `pnpm build` was not run.

## Intentional Veer areas to re-check on every sync

- Veer product and CLI branding, including the canonical `veer` launcher and
  compatibility aliases for older Orca clients.
- Local-only privacy, update, and relay policy described in the project README
  and personal-fork policy modules.
- Orchestration CLI identity, reply/check/ask compatibility, and recovery help.
- Dev launcher environment names and runtime selection, especially when legacy
  `ORCA_*` variables remain in an existing managed terminal.
- SSH, WSL, Windows, folder-workspace, and mixed-version remote wire behavior.
- Generated localization/build artifacts and any repository-owned patch manifests.

## Sync entries

Add one entry after each reviewed upstream merge:

```text
### YYYY-MM-DD — upstream/main @ <full-sha>
- Merge commit: <full-sha>
- Target branch: <branch>
- Conflicts and decisions: <paths and short rationale>
- Upstream changes intentionally not ported: <items or none>
- Veer-specific follow-up: <tests/docs/issues>
- Validation: <commands and result>
```
