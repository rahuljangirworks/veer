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

## 2026-10-25 — Preserve the Veer skill binding and update source

- Working baseline: `dev` at `e7445ad07da8be35f87c375294909f6c0226f97f`.
  This hash identifies the state before the skill repair.
- Failure observed in the running dev app: **Update skills** showed `Updated 0 of
  2 skills` and `skills add exited with code 1` for `computer-use` and
  `orchestration`. Npm's log confirmed that the updater tried
  `skills@1.7.2 add https://github.com/rahuljangirworks/veer/tree/<build-commit>`.
  The local `dev` branch was 3,155 commits ahead of `origin/dev`, and both skill
  bundles differed from that build commit. Even a successful fetch of that commit
  could not match the working-tree `resources/skills/current-manifest.json`.
- Intentional fix: unpackaged desktop updates and `veer-dev skills install/update`
  use the absolute current checkout as the `skills add` source. Packaged builds
  retain their pinned GitHub commit source. The updater must pass explicit agent
  targets and `-y`, then rescan installed bytes before reporting success. The
  dialog's **Copy command** must show the actual source and arguments used by
  that run, with a quoted local path.
- Local installs truthfully record the checkout path as the skills lock source.
  Treat it as Veer-owned **only when it equals this running dev checkout**; do
  not rewrite the lock to claim the GitHub repository supplied dirty local bytes.
  Preserve the Veer GitHub source check for packaged installs and reject
  unrelated same-named skills from other paths.
- Keep all ten `skills/*/SKILL.md` frontmatter names, `skill-guides/`,
  `skill-stubs/`, `src/cli/bundled-skill-guides.ts`, and
  `resources/skills/current-manifest.json` in sync through the two generators.
  In particular, the workspace environment ID is `veer-per-workspace-env`,
  while `orca://` and other compatibility identifiers remain intentional.
  Regenerate with `node config/scripts/generate-bundled-skill-guides.mjs --write`
  and `node config/scripts/generate-skill-bundle-manifest.mjs --write`; verify
  with `pnpm run verify:bundled-skill-guides` and
  `pnpm run verify:skill-bundle-manifest` before testing.
- Owned source seams to preserve in an upstream merge:
  `src/main/ipc/skills.ts`, `src/main/skills/skill-update-run.ts`,
  `src/main/skills/skill-freshness-inventory.ts`,
  `src/shared/agent-feature-install-commands.ts`,
  `src/shared/skill-freshness.ts`, `src/cli/handlers/skills.ts`,
  `src/renderer/src/components/skills/SkillFreshnessUpdateDialog.tsx`,
  `skill-freshness-grouping.ts`, `SkillFreshnessNudge.tsx`, and
  `src/renderer/src/lib/skill-freshness-display-status.ts`.
- If the same error returns: expand **Show log** and inspect the failing source;
  compare the running build's manifest digest with the actual installed skill
  package; check whether `dev` is ahead of the GitHub fork or has uncommitted
  skill edits; run `veer-dev skills update --skill computer-use --skill
  orchestration --agent universal --dry-run --json` to verify the dev source is
  the checkout. Do not diagnose from exit code 1 alone. The main process caches
  its skill manifest for its lifetime, so restart the dev app after changing
  the manifest or main updater before judging the live UI.
- Verification completed: the local `skills@1.7.2 add` updated both installed
  bundles, and their package digests matched the current Veer manifest; a fresh
  inventory reported both `current` and ineligible for another update. The
  skill suite passed 1,105 tests, personal-fork passed 27 tests, `pnpm tc` and
  privacy/branding audits passed. The changed-code quality gate had five
  findings only in separate, already uncommitted voice files. The dev app was
  rebuilt and restarted; live IPC then reported both canonical copies `current`,
  no eligible update for either skill, and runtime `ready`.

### Same-day system repair: dangling workspace skill alias

- A later **Update skills** dialog showed `veer-per-workspace-env` as **Skipped**
  with two “inaccessible” locations. Live inventory identified a real broken
  link at `~/.kiro/skills/veer-per-workspace-env` pointing to the missing
  `~/.agents/skills/veer-per-workspace-env`. The global lock still named the
  Veer GitHub source, so lock provenance alone did not prove files existed.
- Restored only that missing global skill from this checkout with
  `npx --yes skills@1.7.2 add /home/rahul/projacts/veer --skill
  veer-per-workspace-env --global --agent universal -y`. The Kiro link then
  resolved to the canonical directory, both paths matched the current manifest
  digest, and live inventory reported a `current` canonical copy with no
  eligible update. The renderer was sent its installed-skills change event.
- The other row had `rootId: repo-scan-limit` and
  `errorCategory: repository-scan-limit`. It is a sentinel for omitted
  repository provider roots after the 128-root scan cap, **not an observed
  skill copy**. The registered `gms-pulse-dash` repository exists, but its
  `.codebuddy/skills` directory does not; do not create that directory or
  remove the repository to silence this marker. If a future dialog shows it,
  inspect `rootId`, `topology`, and `errorCategory` before repairing a path.
  With the global copy current, the repo-scope sentinel does not make this
  skill eligible or appear as an update row on a fresh review.
- The GitHub skill round-trip workflow previously watched `main` pushes while
  Veer's active branch is `dev`. It now watches skill-related changes on both
  branches and offers a manual run. Check the workflow result for the pushed
  fix commit; a local test cannot prove the pinned GitHub source can be fetched.
- The scheduled backend monitor and release notifier still referenced the old
  `workers.dev` hostname, which returned 404 and made the monitor fail. Both
  now use `https://api.veer.rahuljangir.work`; `/config.json` and
  `/api/updates/check?version=1.4.178&platform=linux` returned HTTP 200 there
  before the workflow change. Rerun the backend monitor after pushing.

## 2026-10-25 — Temporary Fedora-only desktop build mode

- Veer's active desktop artifact is the x86_64 RPM. The dedicated
  `.github/workflows/fedora-rpm.yml` builds only that target from `dev` and
  matching pull requests, installs it in a Fedora 44 container, and uploads
  the RPM as a short-lived Actions artifact. It does not tag, publish, or
  deploy a release. Package on Ubuntu 22.04, then enforce the 2.31 glibc
  floor before the Fedora install check. `ubuntu-latest` linked three bundled
  node-pty binaries against GLIBC_2.42 and failed that guard in the first PR
  run; do not silence the guard to make the RPM build green.
- The Fedora install smoke caught a stale postinstall directory list: product
  files now live under `/opt/Veer`, but the PATH symlink and sandbox repair
  searched only legacy `/opt/Orca` names. Keep `/opt/Veer` in both package
  lifecycle scripts; removing it breaks `orca-ide` on Fedora after install.
- The daily `node-next-compat.yml` x86 sweep had broad, pre-existing fork test
  drift unrelated to RPM packaging. Its schedule is paused; manual dispatch
  remains for later repair. The skill round-trip workflow runs its pinned and
  latest CLI checks on Linux only while macOS/Windows builds are paused.
- Veer PR routing sets the old AppImage/DEB/RPM package lane and Windows package
  lane to `false`, matching the required aggregate's skip logic. The separate
  Fedora RPM workflow supplies package evidence. Set repository variable
  `VEER_CROSS_PLATFORM_PACKAGES=true` to restore the old PR package lanes.
- The fork's PR aggregate fell into a queued state on upstream Blacksmith runner
  labels. Its jobs now use GitHub-hosted Ubuntu 24.04/22.04 on Veer, while
  upstream keeps Blacksmith. Keep this fork-specific runner fallback when
  syncing `pr.yml`; otherwise PR checks cannot exercise the Fedora change.
- The required PR preflight also exposed localization drift in this fork:
  restore missing Veer English keys with `pnpm run sync:localization-catalog`,
  regenerate `en-runtime-required.json` with
  `pnpm run sync:localization-runtime-catalog`, and remove obsolete target
  locale keys. Run `bun config/scripts/verify-localization-catalogs.mjs` and
  `bun config/scripts/audit-localization-coverage.mjs --check` before pushing.
- The coupled `release-cut.yml` pipeline requires Windows, macOS, AppImage,
  DEB, and RPM assets before publication. Do not delete its matrix rows to
  create an RPM-only release: that would strand a draft. Restore that release
  pipeline only when the other platforms are ready. The upstream-only hourly,
  daily, and ad hoc Mac workflows already skip on Rahul's fork.

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
