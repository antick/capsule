# Releasing Capsule

## Cutting a release

1. Bump `CFBundleShortVersionString` in `Support/CapsuleApp/Info.plist`
2. Add a `## <version>` section to `CHANGELOG.md` describing what changed
3. Commit both
4. Run `scripts/tag-release.sh`
5. Push the tag it prints

`scripts/tag-release.sh` refuses to tag a dirty tree, a branch other than main,
a version already tagged, or a version with no changelog section. Pushing the
tag runs the Release workflow: it re-runs the tests, builds the Apple silicon
app, and publishes a zip and a DMG to GitHub Releases.

The changelog section becomes the release body **and** the "What's new" text
inside Settings → Updates. There is no second place to write release notes.

To build the same artifacts locally without publishing:

```bash
taskpolicy -b scripts/package-macos.sh
```

They land in `.build/release-artifacts`. Set `CAPSULE_SIGN_IDENTITY` to a
Developer ID identity to sign them, and `NOTARY_PROFILE` to a `notarytool`
keychain profile to notarise them.

## Why signing matters here

- **Unsigned release.** People download the DMG, and macOS blocks the first
  launch until they allow it in Privacy & Security. Network filters such as
  Little Snitch or LuLu ask about it again with every release.
- **Signed and notarised release.** People download and open the DMG normally.
  Installing updates in place, through Sparkle, needs a signed build as well.

Signing needs an Apple Developer Program membership (currently $99/year).

## Setting up signing, once

### 1. Get a Developer ID Application certificate

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

The next release is signed and notarised. The workflow warns in the run log
when the secrets are missing rather than failing, so an unsigned release stays
possible.
