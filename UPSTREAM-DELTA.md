# Veer upstream delta ledger

This file records the boundary between the Veer fork and
[`stablyai/orca`](https://github.com/stablyai/orca). It is intentionally short:
the merge commit and git history contain the full patch, while this ledger keeps
the next upstream sync from guessing which local behavior is intentional.

The procedure for updating this file is
[`docs/reference/upstream-merge.md`](docs/reference/upstream-merge.md).

## Current baseline

- Fork remote: `origin` → `git@github.com:rahuljangirworks/veer.git`
- Upstream remote: `upstream` → `git@github.com:stablyai/orca.git` (fetch only)
- Integration branch: `dev` → `origin/dev`
- Last recorded upstream merge: `67e22345da`, merged by `ec591a82a4`
- Audit date: 2026-09-07
- Fetched upstream head at audit: `184885551527499aff6ae1aec69bcbe329bf861f`
- Audit relationship: `HEAD...upstream/main` = `123` ahead / `390` behind

The fetched upstream head is not merged. Treat it as a candidate range until a
sync is explicitly reviewed and recorded here.

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
