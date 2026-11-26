# `services.taxa`: the app alone, its user, unit and environment. The machine's
# own config provides Postgres (a database `taxa` its user owns), the way in
# (Tailscale) and backups.
self:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.taxa;
  inherit (lib) mkOption types;

  dumpBeforeUpgrade = pkgs.callPackage ./dump-before-upgrade.nix {
    postgresql = cfg.dumpBeforeUpgrade.postgresqlPackage;
    inherit (cfg.dumpBeforeUpgrade) keep;
  };
in
{
  options.services.taxa = {
    enable = lib.mkEnableOption "Taxa, tasks for people and their agents";

    package = mkOption {
      type = types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.taxa-server;
      defaultText = lib.literalExpression "taxa.packages.\${system}.taxa-server";
      description = "The server, with the built web app it serves.";
    };

    host = mkOption {
      type = types.str;
      default = "127.0.0.1";
      description = "The address to listen on. Keep it local: what reaches Taxa should come through the machine's proxy (Tailscale).";
    };

    port = mkOption {
      type = types.port;
      default = 8787;
      description = "The port to listen on.";
    };

    databaseUrl = mkOption {
      type = types.str;
      default = "postgres://taxa@/taxa?host=/run/postgresql";
      description = "The Postgres database, which the user `taxa` must own: the server migrates it as it starts. The default is the local socket with peer authentication.";
    };

    publicUrl = mkOption {
      type = types.nullOr types.str;
      default = null;
      example = "https://taxa.example.com";
      description = "Where people reach Taxa, through whatever proxy: signing in sends them back here, and changes must come from its pages.";
    };

    signIn = {
      enable = lib.mkEnableOption "signing in through an OpenID Connect provider, Google unless `issuer` says otherwise";
      issuer = mkOption {
        type = types.str;
        default = "https://accounts.google.com";
        description = "The OpenID Connect provider people sign in with.";
      };
      clientId = mkOption {
        type = types.str;
        description = "Taxa's OAuth client at the provider.";
      };
      clientSecretFile = mkOption {
        # A string, not a path: a path would copy the secret into the world-readable Nix store.
        type = types.str;
        example = "/run/secrets/taxa-oidc-client-secret";
        description = "A file holding that client's secret, outside the Nix store; systemd hands it to Taxa as a credential.";
      };
      people = mkOption {
        type = types.listOf (
          types.submodule {
            options = {
              name = mkOption { type = types.str; };
              email = mkOption { type = types.str; };
            };
          }
        );
        default = [ ];
        example = [
          {
            name = "Sam";
            email = "sam@example.com";
          }
        ];
        description = "People to make sure Taxa knows by email; anyone it knows by email may sign in. Someone already in Taxa by that name, with no email yet (as the single person is), becomes them; anyone else is made.";
      };
    };

    singlePerson = mkOption {
      type = types.nullOr types.str;
      default = null;
      example = "Sam";
      description = "No sign-in: every browser request is the person of this name, made the first time. Anyone who can reach Taxa acts as them; `signIn` is the alternative.";
    };

    dumpBeforeUpgrade = {
      enable = mkOption {
        type = types.bool;
        default = true;
        description = "Dump the database before a new package first starts, since its migrations can't be undone. Taxa doesn't start if the dump fails.";
      };
      postgresqlPackage = mkOption {
        type = types.package;
        default = config.services.postgresql.package;
        defaultText = lib.literalExpression "config.services.postgresql.package";
        description = "The Postgres whose `pg_dump` makes the dump: the server's major version or newer.";
      };
      keep = mkOption {
        type = types.ints.positive;
        default = 5;
        description = "How many of these dumps to keep, newest first, in /var/lib/taxa/before-upgrade.";
      };
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = lib.optionals cfg.signIn.enable [
      {
        assertion = cfg.singlePerson == null;
        message = "services.taxa: signIn and singlePerson don't go together: singlePerson lets anyone in.";
      }
      {
        assertion = cfg.publicUrl != null;
        message = "services.taxa.signIn needs publicUrl, where people reach Taxa.";
      }
    ];

    users.users.taxa = {
      isSystemUser = true;
      group = "taxa";
    };
    users.groups.taxa = { };

    systemd.services.taxa = {
      description = "Taxa";
      wantedBy = [ "multi-user.target" ];
      wants = [ "network.target" ] ++ lib.optional config.services.postgresql.enable "postgresql.target";
      after = [ "network.target" ] ++ lib.optional config.services.postgresql.enable "postgresql.target";

      environment = {
        DATABASE_URL = cfg.databaseUrl;
        HOST = cfg.host;
        PORT = toString cfg.port;
      }
      // lib.optionalAttrs (cfg.singlePerson != null) { TAXA_DEV_USER = cfg.singlePerson; }
      // lib.optionalAttrs (cfg.publicUrl != null) { TAXA_PUBLIC_URL = cfg.publicUrl; }
      // lib.optionalAttrs cfg.signIn.enable {
        TAXA_OIDC_ISSUER = cfg.signIn.issuer;
        TAXA_OIDC_CLIENT_ID = cfg.signIn.clientId;
        # %d: the unit's credentials directory, where LoadCredential puts the secret.
        TAXA_OIDC_CLIENT_SECRET_FILE = "%d/oidc-client-secret";
        TAXA_PEOPLE = lib.concatMapStringsSep ", " (
          { name, email }: "${name} <${email}>"
        ) cfg.signIn.people;
      };

      serviceConfig = {
        ExecStartPre = lib.optional cfg.dumpBeforeUpgrade.enable "${lib.getExe dumpBeforeUpgrade} ${cfg.package}";
        ExecStart = lib.getExe cfg.package;
        LoadCredential = lib.optional cfg.signIn.enable "oidc-client-secret:${cfg.signIn.clientSecretFile}";
        User = "taxa";
        Group = "taxa";
        Restart = "always";
        RestartSec = 5;
        StateDirectory = "taxa";
        StateDirectoryMode = "0700";
        UMask = "0077";

        NoNewPrivileges = true;
        # "full", not "strict": it leaves /run writable, for Postgres's socket.
        ProtectSystem = "full";
        ProtectHome = true;
        PrivateTmp = true;
        PrivateDevices = true;
        ProtectKernelTunables = true;
        ProtectKernelModules = true;
        ProtectKernelLogs = true;
        ProtectControlGroups = true;
        ProtectClock = true;
        ProtectHostname = true;
        RestrictAddressFamilies = [
          "AF_UNIX"
          "AF_INET"
          "AF_INET6"
        ];
        RestrictNamespaces = true;
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
        LockPersonality = true;
        SystemCallArchitectures = "native";
      };
    };
  };
}
