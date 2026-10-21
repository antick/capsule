# TODO

## Secrets hardening

Remaining manual step to rotate the Homebrew tap token. The release keeps working with the current token until it is revoked, so do the revoke step last.

- [ ] Replace `HOMEBREW_TAP_TOKEN` in the `release` environment (Settings > Environments > release > Environment secrets, edit `HOMEBREW_TAP_TOKEN`) with a new fine-grained GitHub token: GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens, repository access limited to `antick/homebrew-tap`, Contents read and write only, with an expiration date.
- [ ] Verify on the next `v*` tag: the "Update the Homebrew cask" step in the `macos` job of `release.yml` should push the cask update to `antick/homebrew-tap`.
- [ ] Revoke the old `HOMEBREW_TAP_TOKEN` token once the new one has worked.
- [ ] Nothing else to move: the other signing secrets already live in `release`, and there are no repo-level secrets.
