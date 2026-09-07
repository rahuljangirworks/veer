# Upstream merge procedure

Veer is a personal fork of `stablyai/orca`. Keep `origin` pointed at the Veer
fork and keep `upstream` fetch-only. Never push personal changes to `upstream`.

The root [`UPSTREAM-DELTA.md`](../../UPSTREAM-DELTA.md) is the ledger for each
sync. Update it in the same change as the upstream merge so the next sync starts
with an exact baseline.

## Before merging

Run these commands from the primary Veer worktree:

```bash
git status --short
git branch --show-current
git remote -v
git fetch upstream --tags --prune
git rev-parse upstream/main
```

The worktree must be clean before the merge. Record the current upstream commit
from `UPSTREAM-DELTA.md`, then inspect the candidate range before changing files:

```bash
git log --oneline <last-merged-upstream>..upstream/main
git diff --stat <last-merged-upstream>..upstream/main
git diff --name-only <last-merged-upstream>..upstream/main
```

Confirm the target branch before merging. This fork has historically recorded
upstream sync merge commits on `dev`; do not merge directly into a release branch
without an explicit release decision.

## Merge

Create a recoverable local pointer, then make a real merge commit so upstream
provenance remains visible:

```bash
git branch backup/upstream-sync-YYYYMMDD HEAD
git merge --no-ff upstream/main -m "chore: merge upstream/main @ <upstream-sha>"
```

If the merge is not the intended change, stop and use `git merge --abort` before
editing the ledger. For conflicts, list every unresolved path first:

```bash
git diff --name-only --diff-filter=U
```

Resolve conflicts with these Veer invariants in mind:

- Keep Veer as the canonical product and CLI name. Preserve `orca`, `orca-ide`,
  and `orca-dev` only where they are required as compatibility aliases for mixed
  client/server versions.
- Preserve the personal-fork privacy and update policy; do not reintroduce
  upstream-only telemetry, relay, or automatic-update behavior accidentally.
- Preserve cross-platform and SSH behavior. Do not make local-only assumptions
  in code that runs on WSL, Windows, or a remote execution host.
- Treat generated files, localization catalogs, lockfiles, and patch manifests
  as deliberate merge inputs. Regenerate them only with the repository command
  documented for that file.

After resolving conflicts, verify that no unmerged paths remain:

```bash
git diff --name-only --diff-filter=U
git status --short
```

## Validate before pushing

Run the smallest relevant tests first, then the full required checks when the
merge touches shared or runtime code:

```bash
pnpm install --frozen-lockfile   # only when the lockfile changed
pnpm tc
pnpm test <focused-tests>
pnpm run check:code-quality:changed
pnpm build:cli
veer status --json
veer orchestration check --peek --format --json
```

For orchestration or CLI changes, also verify that `check`, `ask`, and `reply`
help use `veer`, that `--format` remains a boolean local-rendering flag, and
that legacy `orca*` compatibility values still parse. A healthy empty check is
valid evidence when there is no test message; do not create production mail just
to make an inbox non-empty.

Update [`UPSTREAM-DELTA.md`](../../UPSTREAM-DELTA.md) with the exact upstream
commit merged, conflict decisions, intentionally retained Veer changes, and the
commands that passed. Review the complete diff and merge commit before pushing:

```bash
git diff HEAD^ --stat
git show --check --stat HEAD
git push origin dev
```

If the branch was rebased, amended, or otherwise rewritten after it was pushed,
use an explicit `git push --force-with-lease` only after confirming the remote
tip. Plain push must never silently replace remote history.

## Recovery and follow-up

- If validation fails because of a conflict resolution, fix the working tree and
  amend the merge commit; do not create a second merge commit for the same sync.
- If upstream adds a breaking wire or protocol change, follow the repository's
  remote compatibility guidance before accepting it.
- If the merge includes a release, update the ledger first, then follow the
  normal Veer release process. Do not use an upstream release tag as a Veer
  release without checking branding, signing, and update-channel behavior.
