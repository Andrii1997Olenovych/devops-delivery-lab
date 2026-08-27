# Trusted local GitHub runner setup

The automatic Kind deployment is deliberately opt-in because it grants a
GitHub workflow access to the local machine and Docker/Kind environment.

1. Run `make cluster-up` after Docker Desktop and Helm are available.
2. In the GitHub repository, open **Settings → Actions → Runners → New
   self-hosted runner**, select macOS, and follow GitHub’s generated commands
   on this Mac. Do not copy a registration token into this repository.
3. Add the custom label `local-kind`; the workflow requires all three labels:
   `self-hosted`, `macos`, and `local-kind`.
4. Protect `main` so only reviewed changes can reach it. The workflow must not
   be changed to run the local runner on pull requests.
5. After the first main-push image publication, make the GHCR package public
   in the package settings. If it remains private, create and reference a
   Kubernetes `imagePullSecret` instead.

When those prerequisites are met, a push to `main` validates the project on a
hosted runner, publishes `ghcr.io/<owner>/devops-delivery-lab:<commit-sha>`,
and then performs a Helm atomic deploy followed by `/healthz` smoke testing.
