# Release checklist

- [ ] Pull request checks are green: format, lint, typecheck, unit tests,
      integration tests, image scan, actionlint, Helm lint and manifest validation.
- [ ] The change has a tested rollback path and does not add secrets to Git.
- [ ] `main` is protected and the self-hosted runner has the labels
      `self-hosted`, `macos`, and `local-kind`.
- [ ] The GHCR package is public, or the Kind namespace has a deliberately
      configured `imagePullSecret`.
- [ ] The main-push workflow publishes the exact commit SHA image and the
      local CD job finishes its `/healthz` smoke test.
- [ ] Grafana and Alertmanager were checked after a change that affects runtime
      behavior.
