---
name: veer-emulator-android
description: >-
  Android device and emulator control from inside Veer over adb, with the live
  device view in Veer's emulator pane. Use when driving an adb-connected emulator
  or phone on Windows, Linux, or macOS: booting AVDs, taps, swipes, typing,
  hardware buttons, rotation, app install and launch, runtime permissions, the
  accessibility tree, and logcat. For an iOS simulator use the iOS emulator
  skill; build the APK with Gradle first.
license: Apache-2.0
---

# Veer Emulator (Android)

This discovery stub loads the version-matched guide from the Orca executable used for this session.

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
ORCA skills get veer-emulator-android
```

Prefer `--json`. Use the selected executable's `--help` for commands or flags the guide does
not cover. If a command reports that Veer is not running, start it with `ORCA open --json`
and retry. If it fails with `runtime_access_denied`, your sandbox blocked the connection:
re-run it with escalated permissions, and do not run `ORCA open` or restart Veer. If
`skills get` is unknown, explain that updating Veer restores the guide; use `--help` for
read-only discovery and do not guess unsupported commands.
