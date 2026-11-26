# A NixOS machine with Postgres and `services.taxa`, as the home server has:
# Taxa starts, migrates, serves the web app and the API on 127.0.0.1 only,
# and dumps the database before a new package first starts. A second machine
# has people sign in instead, its client secret handed over as a credential.
{ pkgs, self }:
let
  postgresql = pkgs.postgresql_17;
  database = {
    enable = true;
    package = postgresql;
    ensureDatabases = [ "taxa" ];
    ensureUsers = [
      {
        name = "taxa";
        ensureDBOwnership = true;
      }
    ];
  };
in
pkgs.testers.runNixOSTest {
  name = "taxa-module";

  nodes.machine = {
    imports = [ self.nixosModules.default ];
    services.postgresql = database;
    services.taxa = {
      enable = true;
      singlePerson = "Sam";
    };
    environment.systemPackages = [
      pkgs.curl
      pkgs.jq
    ];
    virtualisation.memorySize = 2048;
  };

  nodes.signingIn = {
    imports = [ self.nixosModules.default ];
    services.postgresql = database;
    services.taxa = {
      enable = true;
      publicUrl = "https://taxa.example.com";
      signIn = {
        enable = true;
        clientId = "taxa-test";
        clientSecretFile = "/etc/taxa-oidc-secret";
        people = [
          {
            name = "Sam";
            email = "sam@example.com";
          }
        ];
      };
    };
    # In the store, which a real secret mustn't be; root-only, as it would be.
    environment.etc."taxa-oidc-secret" = {
      text = "not-a-real-secret";
      mode = "0400";
    };
    environment.systemPackages = [ pkgs.curl ];
    virtualisation.memorySize = 2048;
  };

  testScript = ''
    from datetime import timedelta

    health = """curl -sf http://127.0.0.1:8787/api/health | jq -e '.status == "OK"'"""
    dumps = "ls /var/lib/taxa/before-upgrade/*.dump | wc -l"
    listening = "ss -ltnH 'sport = :8787'"

    machine.wait_for_unit("taxa.service")
    machine.wait_until_succeeds(health, timeout=timedelta(minutes=2))

    with subtest("serves the web app beside the API"):
        machine.succeed("curl -sf http://127.0.0.1:8787/ | grep -qi '<!doctype html'")
        machine.succeed("curl -sf http://127.0.0.1:8787/today | grep -qi '<!doctype html'")
        machine.succeed("curl -sf http://127.0.0.1:8787/api/domains | jq -e '.items'")

    with subtest("listens on 127.0.0.1 only"):
        machine.succeed(f"{listening} | grep -q '127.0.0.1:8787'")
        machine.fail(f"{listening} | grep -v '127.0.0.1:8787'")

    with subtest("dumps the database before a new package first starts, and only then"):
        machine.succeed(f"test $({dumps}) -eq 1")
        machine.succeed("systemctl restart taxa.service")
        machine.wait_until_succeeds(health, timeout=timedelta(minutes=1))
        machine.succeed(f"test $({dumps}) -eq 1")
        machine.succeed("printf /nix/store/an-older-taxa > /var/lib/taxa/dumped-before")
        machine.succeed("sleep 1 && systemctl restart taxa.service")
        machine.wait_until_succeeds(health, timeout=timedelta(minutes=1))
        machine.succeed(f"test $({dumps}) -eq 2")
        newest = machine.succeed("ls /var/lib/taxa/before-upgrade/*.dump | tail -1").strip()
        machine.succeed(f"${postgresql}/bin/pg_restore --list {newest} | grep 'TABLE public tasks' > /dev/null")

    with subtest("with sign-in, reads its secret as a credential and lets no one in unsigned"):
        signingIn.wait_for_unit("taxa.service")
        signingIn.wait_until_succeeds("curl -sf http://127.0.0.1:8787/api/health", timeout=timedelta(minutes=2))
        signingIn.succeed("test $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8787/api/me) -eq 401")
        signingIn.succeed("journalctl -u taxa.service | grep -q 'person may sign in'")
        # With no way out to the provider, it says so rather than failing.
        signingIn.succeed(
            "curl -s -o /dev/null -w '%{redirect_url}' --max-time 60 'http://127.0.0.1:8787/auth/sign-in?then=/today'"
            " | grep -q '^https://taxa.example.com/today?sign-in=failed$'"
        )
  '';
}
