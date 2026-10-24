---
name: veer-emulator
description: >-
  iOS Simulator control from inside Veer, with the live device view in Veer's
  emulator pane. Use when driving a booted Apple Simulator on macOS: taps,
  gestures, typing, hardware buttons, rotation, and the accessibility tree, or
  when an iOS change needs simulator evidence. For an Android device or emulator
  use the Android emulator skill; build and install the app with xcodebuild or
  simctl first.
license: Apache-2.0
---

# Veer Emulator

This discovery stub loads the version-matched guide from the Orca executable used for this session.

Prefer Orca over raw `serve-sim` or direct `simctl` for simulator control inside Orca; it
handles device scoping, helper lifecycle, and worktree context.

## Resolve the CLI for this session

Choose the executable once and reuse it for every later command:

- If `VEER_CLI_COMMAND` is set, use its value. Otherwise use `ORCA_CLI_COMMAND`
  when set; Veer exports that compatibility variable in managed sessions.
- Otherwise, in a dev checkout whose session exposes `VEER_DEV_REPO_ROOT` or
  `ORCA_DEV_REPO_ROOT`, use `veer-dev`.
- Otherwise, on Linux outside a Veer-managed terminal, use `orca-ide`. Never run bare
  `orca` there — it normally resolves to the GNOME Orca screen reader (`/usr/bin/orca`).
- Otherwise, use the packaged `orca` compatibility CLI.

Below, `ORCA` is a placeholder for the executable you resolved. Substitute it before
running anything; do not create a shell variable or run `ORCA` literally. This works the
same way in POSIX shells, PowerShell, and cmd.exe.

If the selected executable cannot run, report its exact error and stop. Do not fall through
to another executable, which could silently target a different Veer build.

## Load the version-matched guide before running Orca commands

```text
ORCA skills get veer-emulator
```

Prefer `--json`. Use the selected executable's `--help` for commands or flags the guide does
not cover. If a command reports that Veer is not running, start it with `ORCA open --json`
and retry. If it fails with `runtime_access_denied`, your sandbox blocked the connection:
re-run it with escalated permissions, and do not run `ORCA open` or restart Veer. If
`skills get` is unknown, explain that updating Veer restores the guide; use `--help` for
read-only discovery and do not guess unsupported commands.
