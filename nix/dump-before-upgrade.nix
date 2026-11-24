# Dumps Taxa's database the first time a new package starts, before its
# migrations run: they only go forwards, so this dump is what a rollback
# restores. Usage: taxa-dump-before-upgrade <the package's store path>.
{
  writeShellApplication,
  coreutils,
  findutils,
  postgresql,
  keep,
}:
writeShellApplication {
  name = "taxa-dump-before-upgrade";
  runtimeInputs = [
    postgresql
    coreutils
    findutils
  ];
  text = ''
    package=$1
    dumps="$STATE_DIRECTORY/before-upgrade"
    dumped_before="$STATE_DIRECTORY/dumped-before"
    if [ "$(cat "$dumped_before" 2>/dev/null || true)" = "$package" ]; then exit 0; fi
    mkdir -p "$dumps"
    dump="$dumps/taxa-$(date -u +%Y%m%dT%H%M%SZ).dump"
    trap 'rm -f "$dump.partial"' EXIT
    pg_dump --format=custom --dbname="$DATABASE_URL" --file="$dump.partial"
    mv "$dump.partial" "$dump"
    printf '%s' "$package" > "$dumped_before"
    find "$dumps" -name 'taxa-*.dump' -printf '%f\n' | sort -r | tail -n +${toString (keep + 1)} \
      | xargs -r -I{} rm -- "$dumps/{}"
  '';
}
