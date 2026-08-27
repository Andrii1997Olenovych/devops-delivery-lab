# ADR 001: Hosted CI with a trusted local deployment runner

**Status:** accepted

GitHub-hosted runners validate every pull request because they are disposable and
cannot reach the developer’s local Docker socket or Kind cluster. The workflow
does not use `pull_request_target`, and its PR jobs receive only read access to
repository contents.

Deployment runs only after a push to `main`, after the validation job publishes
an image whose tag is the immutable commit SHA. That job requires the
`self-hosted`, `macos`, and `local-kind` labels. It is intentionally not
eligible for pull-request events, so untrusted contributor code cannot execute
on the Mac that owns the Kind cluster.

This is a teaching setup, not a recommendation to expose a self-hosted runner
to public pull requests. Protect `main` in GitHub before enabling the runner.
