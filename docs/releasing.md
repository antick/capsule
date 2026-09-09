# Releasing Capsule

## Cutting a release

1. Bump `version` in `apps/desktop/package.json`
2. Add a `## <version>` section to `CHANGELOG.md` describing what changed
3. Commit both
4. Run `pnpm release:tag`
5. Push the tag it prints

`pnpm release:tag` refuses to tag a dirty tree, a branch other than main, a
version already tagged, or a version with no changelog section. Pushing the tag
runs the Release workflow: it re-runs the checks, builds arm64 and x64 apps, and
publishes the DMGs, the zips, and `latest-mac.yml` to GitHub Releases.

The changelog section becomes the release body **and** the "What's new" text
inside Settings → Updates. There is no second place to write release notes.

## Why signing matters here

macOS will not let an app replace itself unless it is signed with a Developer ID
certificate — this is a Gatekeeper rule, not an electron-updater limitation.
So:

- **Unsigned release.** People download the DMG, and macOS blocks the first
  launch until they allow it in Privacy & Security. Capsule reports its updates
  as manual and links to the release page. Everything else works.
- **Signed and notarised release.** People download and open the DMG normally,
  and Capsule downloads and installs its own updates from then on.

There is no third option. Auto-update needs an Apple Developer Program
membership (currently $99/year).

## Setting up signing, once

### 1. Get a Developer ID Application certificate

Requires an Apple Developer Program membership.

1. Open **Xcode → Settings → Accounts**, add your Apple ID, select the team
2. Click **Manage Certificates…**, then **+ → Developer ID Application**
3. Close the sheet. Open **Keychain Access → login → My Certificates**
4. Right-click **Developer ID Application: …** and choose **Export…**
5. Save it as a `.p12` and set a password when asked — you need that password

Check it landed:

```bash
security find-identity -v -p codesigning
```

One line reading `Developer ID Application: <your name> (<TEAMID>)` means you
are ready. The 10-character `TEAMID` in the parentheses is your Team ID.

### 2. Get an app-specific password for notarising

1. Go to [account.apple.com](https://account.apple.com), sign in
2. Under **Sign-In and Security**, open **App-Specific Passwords**
3. Create one named `Capsule notarisation` and copy it

### 3. Put both into the repository secrets

From the repo, with the `.p12` path and the values above:

```bash
base64 -i /path/to/DeveloperID.p12 | tr -d '\n' | gh secret set MAC_CERTIFICATE
gh secret set MAC_CERTIFICATE_PASSWORD
gh secret set APPLE_ID
gh secret set APPLE_APP_SPECIFIC_PASSWORD
gh secret set APPLE_TEAM_ID
```

Each `gh secret set` without a value prompts for it, so nothing lands in your
shell history.

The next release is signed, notarised, and updates itself. The workflow reads
the secrets and warns in the run log when they are missing rather than failing,
so an unsigned release stays possible.

### Using an App Store Connect API key instead

An API key survives Apple ID password changes, which matters more for a team
than for one person. Create one under **Users and Access → Integrations** in
App Store Connect, download the `.p8` (once only), then:

```bash
base64 -i /path/to/AuthKey_XXXXXXXX.p8 | tr -d '\n' | gh secret set APPLE_API_KEY_P8
gh secret set APPLE_API_KEY_ID
gh secret set APPLE_API_ISSUER
```

Set these *instead of* `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` /
`APPLE_TEAM_ID`. The workflow prefers the Apple ID when both are present. Note
that `APPLE_API_KEY_P8` holds the base64 of the file — the notarisation tool
wants a path, and the workflow writes the file itself.

## Secrets reference

| Secret | Purpose | Needed for |
| --- | --- | --- |
| `MAC_CERTIFICATE` | Base64 of the Developer ID `.p12` | Signing |
| `MAC_CERTIFICATE_PASSWORD` | The `.p12` export password | Signing |
| `APPLE_ID` | Your Apple ID email | Notarising |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password | Notarising |
| `APPLE_TEAM_ID` | 10-character team ID | Notarising |
| `APPLE_API_KEY_P8` | Base64 of the `.p8` key | Notarising (alternative) |
| `APPLE_API_KEY_ID` | Key ID | Notarising (alternative) |
| `APPLE_API_ISSUER` | Issuer UUID | Notarising (alternative) |

## Checking a release actually updates

After the first signed release, confirm the loop rather than assuming it:

1. Install the published DMG into `/Applications`
2. Cut a second release with a higher version
3. In the installed copy, open **Settings → Updates** and press **Check now**
4. It should offer the new version, download it, and install it on restart

Until that has been done once, treat auto-update as untested.

## Building without publishing

```bash
pnpm dist
```

The DMGs and zips land in `apps/desktop/release`. Add `CSC_IDENTITY_AUTO_DISCOVERY=false`
to skip signing on a machine that has a certificate installed.
