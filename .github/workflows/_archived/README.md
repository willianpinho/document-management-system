# Archived Workflows

Workflows in this directory are NOT run by GitHub Actions. GitHub Actions only
executes `*.yml` / `*.yaml` files located directly in `.github/workflows/`, not
in subdirectories. Each file here is preserved for reference only.

## deploy-dev.yml.bak

**Archived**: 2026-04-14
**Reason**: Broken since 2026-03-26 with SSH authentication failures
(`ssh: handshake failed: ssh: unable to authenticate, attempted methods
[none publickey]`). The `DEV_SSH_KEY` GitHub secret is stale or was never
appended to `~willian/.ssh/authorized_keys` on the VPS.

Manual deploys via `cd ~/infra/portfolio && docker compose up -d --build
dms-web dms-api` on the VPS work reliably and are the canonical deploy path.
See issue #18 for full context.

To restore this workflow:

1. Generate a new ed25519 keypair locally
2. Append the public key to `~willian/.ssh/authorized_keys` on the VPS
3. `gh secret set DEV_SSH_KEY < newkey.priv`
4. `git mv .github/workflows/_archived/deploy-dev.yml.bak
   .github/workflows/deploy-dev.yml`
5. Manually trigger the workflow to verify authentication
