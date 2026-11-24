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

    singlePerson = mkOption {
      type = types.nullOr types.str;
      default = null;
      example = "Sam";
      description = "No sign-in: every browser request is the person of this name, made the first time. Until sign-in exists; anyone who can reach Taxa acts as them.";
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
      // lib.optionalAttrs (cfg.singlePerson != null) { TAXA_DEV_USER = cfg.singlePerson; };

      serviceConfig = {
        ExecStartPre = lib.optional cfg.dumpBeforeUpgrade.enable "${lib.getExe dumpBeforeUpgrade} ${cfg.package}";
        ExecStart = lib.getExe cfg.package;
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
