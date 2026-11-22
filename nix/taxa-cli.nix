# `taxa`, the CLI, as a package that runs anywhere: the CLI and @taxa/shared
# bundled by esbuild into one file, run by Node, with its Claude Code skill.
#
# When pnpm-lock.yaml changes what the CLI or shared depend on, the build
# fails with a hash mismatch: put the hash it got in `pnpmDeps`.
{
  lib,
  stdenvNoCC,
  nodejs,
  pnpm,
  esbuild,
  fetchPnpmDeps,
  pnpmConfigHook,
  makeWrapper,
}:
let
  root = ../.;
in
stdenvNoCC.mkDerivation (finalAttrs: {
  pname = "taxa";
  version = (lib.importJSON ../packages/cli/package.json).version;

  # Only what the CLI is built from, so changes elsewhere don't rebuild it.
  # pnpm wants every workspace package's manifest to match the lockfile.
  src = lib.fileset.toSource {
    inherit root;
    fileset = lib.fileset.unions [
      ../package.json
      ../pnpm-lock.yaml
      ../pnpm-workspace.yaml
      ../packages/cli/package.json
      ../packages/cli/src
      ../packages/shared/package.json
      ../packages/shared/src
      ../packages/server/package.json
      ../packages/web/package.json
      ../.claude/skills/taxa
    ];
  };

  # The CLI and the workspace packages it depends on (@taxa/shared).
  pnpmWorkspaces = [ "@taxa/cli..." ];
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
    esbuild
    makeWrapper
  ];

  buildPhase = ''
    runHook preBuild
    esbuild packages/cli/src/main.ts \
      --bundle --platform=node --format=esm --target=node24 \
      --outfile=dist/taxa.mjs
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    install -Dm644 dist/taxa.mjs $out/lib/taxa/taxa.mjs
    makeWrapper ${lib.getExe nodejs} $out/bin/taxa --add-flags $out/lib/taxa/taxa.mjs
    # The Claude Code skill that teaches agents to use it, to install with it.
    install -Dm644 .claude/skills/taxa/SKILL.md $out/share/claude/skills/taxa/SKILL.md
    runHook postInstall
  '';

  doInstallCheck = true;
  installCheckPhase = ''
    $out/bin/taxa --help | grep -q "Usage: taxa"
  '';

  meta = {
    description = "Taxa's command line: tasks for people and their agents";
    mainProgram = "taxa";
  };
})
