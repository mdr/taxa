{
  description = "Taxa – a task manager built for people and their agents";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    {
      # `services.taxa`, for the machine that hosts it.
      nixosModules.default = import ./nix/module.nix self;
    }
    // flake-utils.lib.eachDefaultSystem (system:
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
        taxa = pkgs.callPackage ./nix/taxa-cli.nix { inherit nodejs pnpm; };
        taxa-web = pkgs.callPackage ./nix/taxa-web.nix { inherit nodejs pnpm; };
        taxa-server = pkgs.callPackage ./nix/taxa-server.nix {
          inherit nodejs pnpm taxa-web;
          build = self.shortRev or self.dirtyShortRev or "unknown";
        };
      in
      {
        packages = {
          inherit taxa taxa-web taxa-server;
          default = taxa;
        };

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
            # `taxa`, the CLI, run from source.
            export PATH="$PWD/bin:$PATH"
            echo "taxa dev shell: node $(node --version), pnpm $(pnpm --version), postgres $(postgres --version | cut -d' ' -f3) (nix-pinned)"
          '';
        });

        # A NixOS VM test of `services.taxa`: Linux only, and it needs KVM.
        checks = pkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
          module = import ./nix/module-test.nix { inherit pkgs self; };
        };

        # What the checks need and nothing else, all from cache.nixos.org.
        devShells.ci = pkgs.mkShell (corepack // {
          packages = [ nodejs pnpm pkgs.jq ];
        });
      });
}
