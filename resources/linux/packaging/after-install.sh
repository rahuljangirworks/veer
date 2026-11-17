#!/bin/bash
# Why: register the bundled Veer CLI and legacy `orca-ide` alias on PATH.
# The in-app "Install CLI" action (CliInstaller) can never run on a headless
# server, so without these symlinks `veer serve` is unreachable from the shell on
# the exact hosts that need it most. deb/rpm both run this after unpacking.
#
# The shim resolves the real app by walking up from its own location, so a
# symlink works. We discover the install dir instead of hardcoding /opt/Veer
# because electron-builder's directory name can vary by productName sanitization.
set -e

install_dirs=(/opt/Veer /opt/Orca /opt/orca-ide /opt/orca)

is_owned_link() {
  local link="$1" launcher_name="$2" link_target candidate candidate_target dir
  [ -L "$link" ] || return 1
  link_target="$(readlink -f -- "$link" 2>/dev/null || true)"
  for dir in "${install_dirs[@]}"; do
    candidate="$dir/resources/bin/$launcher_name"
    candidate_target="$(readlink -f -- "$candidate" 2>/dev/null || true)"
    if [ -n "$candidate_target" ] && [ "$link_target" = "$candidate_target" ]; then
      return 0
    fi
  done
  return 1
}

for dir in "${install_dirs[@]}"; do
  sandbox="$dir/chrome-sandbox"
  if [ -f "$sandbox" ]; then
    # Why: packaged Linux installs must leave Chromium's sandbox helper usable
    # on hosts where unprivileged user namespaces are unavailable.
    chmod 4755 "$sandbox" || true
  fi

  found=0
  for entry in veer:veer-ide orca-ide:orca-ide; do
    command_name="${entry%%:*}"
    launcher_name="${entry#*:}"
    shim="$dir/resources/bin/$launcher_name"
    if [ -x "$shim" ]; then
      found=1
      link="/usr/bin/$command_name"
      # Only manage our own symlink; never clobber an unrelated command.
      if { [ ! -e "$link" ] && [ ! -L "$link" ]; } || is_owned_link "$link" "$launcher_name"; then
        ln -sfn -- "$shim" "$link"
      fi
    fi
  done
  if [ "$found" -eq 1 ]; then
    break
  fi
done

exit 0
