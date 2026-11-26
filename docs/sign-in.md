# Signing in

Taxa can have people sign in with Google, or any OpenID Connect provider,
instead of running as one person (`TAXA_DEV_USER`, `services.taxa.singlePerson`).
Only the people it's told about can sign in, by the email the provider vouches
for. The CLI and agents keep using API keys.

## A Google client

In the [Google Cloud console](https://console.cloud.google.com/), in a project
of your own, under **Google Auth Platform**:

1. **Branding**: give the app a name (Taxa) and a support email.
2. **Audience**: External. While the app is in testing, only the test users
   listed there can sign in, so add each person, or publish it. Taxa asks only
   for `openid` and `email`.
3. **Clients** → **Create client** → **Web application**, with the
   **authorised redirect URI** `https://<where people reach Taxa>/auth/callback`,
   such as `https://taxa.example.com/auth/callback`.
4. Keep the client's ID and secret: the secret in a password manager, as you
   would any.

Google wants redirect URIs over HTTPS, on a domain in the public suffix list,
not an IP address ([its rules](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation)).
A Tailscale name (`*.ts.net`) or a Fly one (`*.fly.dev`) will do.

## Telling Taxa

Everything's in environment variables, so it works the same wherever Taxa
runs:

| Variable                       | What                                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `TAXA_OIDC_CLIENT_ID`          | The client's ID: setting it turns sign-in on.                                                                                          |
| `TAXA_OIDC_CLIENT_SECRET`      | The client's secret, such as from `fly secrets set`; or                                                                                |
| `TAXA_OIDC_CLIENT_SECRET_FILE` | a file holding it, such as a systemd credential.                                                                                       |
| `TAXA_PUBLIC_URL`              | Where people reach Taxa, such as `https://taxa.example.com`. The callback and the cookie follow from it, whatever proxy is in between. |
| `TAXA_PEOPLE`                  | Who may sign in: `Sam <sam@example.com>, Alex <alex@example.com>`.                                                                     |
| `TAXA_OIDC_ISSUER`             | The provider, if not Google (`https://accounts.google.com`).                                                                           |

Someone in `TAXA_PEOPLE` who's already in Taxa by that name, with no email
yet, becomes them: so a server that ran as one person keeps its tasks once
that person signs in. Anyone else is made the first time the server starts.

Taxa won't start with both sign-in and `TAXA_DEV_USER`, nor with sign-in
missing any of the rest.

### On NixOS

```nix
services.taxa = {
  enable = true;
  publicUrl = "https://taxa.example.com";
  signIn = {
    enable = true;
    clientId = "1234-abc.apps.googleusercontent.com";
    # Outside the Nix store, readable by root: systemd hands it to Taxa.
    clientSecretFile = "/run/secrets/taxa-oidc-client-secret";
    people = [ { name = "Sam"; email = "sam@example.com"; } ];
  };
};
```

`singlePerson` must go: the two don't go together.

## Rolling back

Turning sign-in off and `singlePerson` (or `TAXA_DEV_USER`) back on needs
nothing else: the person keeps their email, ready for next time.
