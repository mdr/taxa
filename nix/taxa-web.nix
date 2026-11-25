# The web app, built: the static files the server serves (TAXA_WEB_ROOT).
#
# When pnpm-lock.yaml changes what the web app or shared depend on, the build
# fails with a hash mismatch: put the hash it got in `pnpmDeps`.
{
  lib,
  stdenvNoCC,
  nodejs,
  pnpm,
  fetchPnpmDeps,
  pnpmConfigHook,
}:
let
  root = ../.;
in
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "taxa-web";
  version = (lib.importJSON ../packages/web/package.json).version;

  # pnpm wants every workspace package's manifest to match the lockfile.
  src = lib.fileset.toSource {
    inherit root;
    fileset = lib.fileset.unions [
      ../package.json
      ../pnpm-lock.yaml
      ../pnpm-workspace.yaml
      ../tsconfig.base.json
      ../packages/cli/package.json
      ../packages/server/package.json
      ../packages/shared/package.json
      ../packages/shared/src
      ../packages/web/package.json
      ../packages/web/tsconfig.json
      ../packages/web/vite.config.ts
      ../packages/web/index.html
      ../packages/web/public
      ../packages/web/scripts
      ../packages/web/src
    ];
  };

  # Building needs the web app's development dependencies (Vite and its plugins).
  pnpmWorkspaces = [ "@taxa/web..." ];

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version src pnpmWorkspaces;
    inherit pnpm;
    fetcherVersion = 4;
    # Vite+'s native packages, one per platform, are large: fetched all at
    # once, some fail and pnpm skips them as optional, giving a store missing them.
    prePnpmInstall = "pnpm config set network-concurrency 4";
    hash = "sha256-DLs8brKfml8My/9M3XedK82KlicN22fgS2/nmiPdUTk=";
  };

  nativeBuildInputs = [
    nodejs
    pnpm
    pnpmConfigHook
  ];

  buildPhase = ''
    runHook preBuild
    (cd packages/web && pnpm exec vp build)
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    cp -r packages/web/dist $out
    runHook postInstall
  '';

  # The files served as they are (the icons), which Vite copies from public/: missing once when public/ wasn't in src.
  doInstallCheck = true;
  installCheckPhase = ''
    for file in favicon.svg favicon-32.png apple-touch-icon.png; do
      test -f "$out/$file" || { echo "the built web app has no $file"; exit 1; }
    done
  '';

  meta.description = "Taxa's web app, built";
})
