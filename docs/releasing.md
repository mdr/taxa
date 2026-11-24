# Releasing

Making a release and adopting it are separate steps. A release builds a
version and makes it available; nothing runs it until a machine's
configuration is pointed at it.

## Making a release

Run the Release workflow (`.github/workflows/release.yml`) on `main`:
Actions → Release → Run workflow, or

```sh
gh workflow run release.yml -R mdr/taxa --ref main -f version=X.Y.Z
```

It releases the commit at the tip of `main`. It refuses unless:

- the version is `X.Y.Z` and later than the last release's;
- no tag `vX.Y.Z` exists yet;
- CI has passed on that commit.

Then it:

1. writes the release notes (below);
2. sets `"version"` in every `package.json`, commits `Release vX.Y.Z` to
   `main` and tags it `vX.Y.Z`;
3. builds, from the tag, `taxa-server` and `taxa` for x86_64 Linux and
   `taxa` for Apple silicon, and pushes them to the `mdr-taxa` Cachix cache;
4. publishes the GitHub release.

Pull afterwards: `main` has moved on by the version commit.

### Choosing the number

Before 1.0:

- patch (`0.1.1`): fixes only;
- minor (`0.2.0`): new features, a database migration, or a change to
  `services.taxa`'s options.

### What the release notes say

- **Upgrading**: the migrations added since the last release, if any, and
  whether `services.taxa` (`nix/module.nix`, `nix/dump-before-upgrade.nix`)
  changed. This is what someone deploying needs to know first.
- **Installing**: what to pin, and the cache's address and key.
- **Changes**: the commits since the last release.

### The version a build reports

`taxa health` and the server's startup log report `version+commit`, such as
`0.1.0+26109f9`. Between releases, `main` still carries the last release's
version, so a build of `main` reports that version with a later commit.

## The cache

`mdr-taxa` on Cachix is public; CI pushes to it with the `CACHIX_AUTH_TOKEN`
repository secret. A machine that trusts it downloads releases instead of
building them:

```nix
nix.settings = {
  extra-substituters = [ "https://mdr-taxa.cachix.org" ];
  extra-trusted-public-keys = [
    "mdr-taxa.cachix.org-1:tHW34mvFiWUUPwC1vjS+FQji6A7HvH9u/bOVbpW+OEI="
  ];
};
```

## Adopting a release

A machine follows a release through a flake input pinned to its tag:

```nix
inputs.taxa.url = "github:mdr/taxa/vX.Y.Z";
```

`packages.<system>.taxa` is the CLI and `nixosModules.default` the server
(`services.taxa`). To move to a new release: change the tag, run
`nix flake lock`, and deploy. The CLI and the server can follow different
releases through two inputs.

When a new server package first starts, `services.taxa`:

1. dumps the database to `/var/lib/taxa/before-upgrade/` (keeping the newest
   five), unless `dumpBeforeUpgrade.enable` is off;
2. starts the server, which applies any new migrations before serving.

## Rolling back

Pin the previous tag and deploy. Migrations only go forwards, so if the
release you're leaving migrated the database, the older server may not
understand it: restore the dump taken before the upgrade, with
`pg_restore --clean`, while the server is stopped. Anything written since that dump is lost.
