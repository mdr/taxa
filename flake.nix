{
  description = "Taxa – a task manager built for people and their agents";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          # The 1Password CLI is the one unfree package we use.
          config.allowUnfreePredicate = pkg: builtins.elem (pkgs.lib.getName pkg) [ "1password-cli" ];
        };
        nodejs = pkgs.nodejs_24;
        # nixpkgs' pnpm bundles its own Node runtime. Rebuild it on the
        # shell's Node major so there is one Node here.
        pnpm = pkgs.pnpm.override { nodejs-slim = pkgs.nodejs-slim_24; };
        # The same major as PGlite, which the in-process tests run on.
        postgresql = pkgs.postgresql_17;

        # Keep corepack inert so pnpm always comes from the Nix store.
        corepack = {
          COREPACK_ENABLE_STRICT = "0";
          COREPACK_ENABLE_AUTO_PIN = "0";
          COREPACK_ENABLE_DOWNLOAD_PROMPT = "0";
          COREPACK_ENABLE_NETWORK = "0";
        };
      in
      {
        devShells.default = pkgs.mkShell (corepack // {
          packages = [
            nodejs
            pnpm
            postgresql
            pkgs.jq
            pkgs._1password-cli
            pkgs.go-task # `task`: the menu of what to run (Taskfile.yml)
          ];

          shellHook = ''
            echo "taxa dev shell: node $(node --version), pnpm $(pnpm --version), postgres $(postgres --version | cut -d' ' -f3) (nix-pinned)"
          '';
        });

        # What the checks need and nothing else, all from cache.nixos.org.
        devShells.ci = pkgs.mkShell (corepack // {
          packages = [ nodejs pnpm pkgs.jq ];
        });
      });
}
