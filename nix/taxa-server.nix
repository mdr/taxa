# `taxa-server`: the API server, serving the built web app beside it. It runs
# from its TypeScript source, as in development, with its production
# dependencies; the sources stay outside node_modules, where Node strips types.
#
# When pnpm-lock.yaml changes what the server or shared depend on, the build
# fails with a hash mismatch: put the hash it got in `pnpmDeps`.
{
  lib,
  stdenvNoCC,
  nodejs,
  pnpm,
  fetchPnpmDeps,
  pnpmConfigHook,
  makeWrapper,
  taxa-web,
  # The commit it's built from, which the health check reports.
  build ? "unknown",
}:
let
  root = ../.;
in
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "taxa-server";
  version = (lib.importJSON ../packages/server/package.json).version;

  src = lib.fileset.toSource {
    inherit root;
    fileset = lib.fileset.unions [
      ../package.json
      ../pnpm-lock.yaml
      ../pnpm-workspace.yaml
      ../packages/cli/package.json
      ../packages/web/package.json
      ../packages/server/package.json
      ../packages/server/src
      ../packages/server/drizzle
      ../packages/shared/package.json
      ../packages/shared/src
    ];
  };

  pnpmWorkspaces = [ "@taxa/server..." ];
  pnpmInstallFlags = [ "--prod" ];

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version src pnpmWorkspaces pnpmInstallFlags;
    inherit pnpm;
    fetcherVersion = 4;
    hash = "sha256-wnCHu81GJ5PdGQdhKQGAPvCbY6UGou79iGHlcchs4sk=";
  };

  nativeBuildInputs = [
    nodejs
    pnpm
    pnpmConfigHook
    makeWrapper
  ];

  dontBuild = true;

  installPhase = ''
    runHook preInstall
    app=$out/lib/taxa-server
    mkdir -p $app/packages
    cp -r package.json node_modules $app/
    cp -r packages/server packages/shared $app/packages/
    makeWrapper ${lib.getExe nodejs} $out/bin/taxa-server \
      --add-flags "--experimental-transform-types --disable-warning=ExperimentalWarning $app/packages/server/src/main.ts" \
      --set-default TAXA_WEB_ROOT ${taxa-web} \
      --set-default TAXA_BUILD ${lib.escapeShellArg build}
    runHook postInstall
  '';

  # Every module loads: it stops only at the missing DATABASE_URL.
  doInstallCheck = true;
  installCheckPhase = ''
    ( $out/bin/taxa-server 2>&1 || true ) | grep -q "DATABASE_URL"
  '';

  meta = {
    description = "Taxa's server: tasks for people and their agents";
    mainProgram = "taxa-server";
  };
})
