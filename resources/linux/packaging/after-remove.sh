#!/bin/bash
# Why: remove the PATH symlink that after-install.sh created, but only if it
# still points into a Veer or legacy Orca install dir — never delete an unrelated
# /usr/bin command a user or other package may own.
set -e

# RPM passes an instance count; dpkg passes the package lifecycle action.
case "${1-}" in
  0 | remove | purge) ;;
  *) exit 0 ;;
esac

for entry in veer:veer-ide orca-ide:orca-ide; do
  command_name="${entry%%:*}"
  launcher_name="${entry#*:}"
  link="/usr/bin/$command_name"
  if [ -L "$link" ]; then
    target="$(readlink "$link" || true)"
    case "$target" in
      /opt/Veer/resources/bin/"$launcher_name"|/opt/Orca/resources/bin/"$launcher_name"|/opt/orca-ide/resources/bin/"$launcher_name"|/opt/orca/resources/bin/"$launcher_name")
        rm -f "$link"
        ;;
    esac
  fi
done

exit 0
