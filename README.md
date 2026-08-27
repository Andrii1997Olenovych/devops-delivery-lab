# DevOps Delivery Lab

A local, production-like TypeScript project for practising the delivery path
from API code to a container image, CI/CD, Kubernetes, observability, and
incident response. The task API is intentionally small; operational practice is
the product.

```text
Pull request → hosted GitHub CI → immutable GHCR image
                                     ↓
main push → trusted self-hosted runner → Helm atomic deploy → local Kind
                                                          ↓
                                        Prometheus → Grafana / Alertmanager
```

## What is included

- Fastify TypeScript task API with PostgreSQL persistence and best-effort Redis
  cache.
- `/healthz`, `/readyz`, and `/metrics` endpoints; Fastify emits structured
  JSON logs.
- Multi-stage, non-root Docker image and Docker Compose runtime with PostgreSQL,
  Redis, Prometheus, Grafana, and Alertmanager.
- Kind-compatible Helm chart with migrations, probes, resource limits, Ingress,
  rolling updates, and atomic rollback.
- GitHub Actions hosted CI plus a deployment job restricted to a trusted local
  self-hosted runner on pushes to `main` only.
- Runbooks for CrashLoopBackOff, database failure, and bad-release rollback.

## Prerequisites

- Node.js 22.14+ and npm
- Docker Desktop running
- Kind, kubectl, Helm, Make, and GitHub CLI
- A GitHub self-hosted runner labelled `self-hosted`, `macos`, and `local-kind`
  for automatic local CD

## Run locally with Compose

```sh
cp .env.example .env
make up
curl http://localhost:3000/healthz
curl http://localhost:3000/readyz
make observe
```

Open Grafana at <http://localhost:3001> with `admin` / `admin`, Prometheus at
<http://localhost:9090>, and Alertmanager at <http://localhost:9093>.

Use `make down` to stop the stack and remove its local data volumes.

## Run in local Kubernetes

```sh
make cluster-up
make deploy
curl http://localhost:8080/readyz
```

The chart uses local development credentials and `emptyDir` PostgreSQL storage;
it is intentionally not a production secrets or persistence design.

The kind ingress controller reserves its external `/healthz` route for the
controller itself. To test the API liveness endpoint directly, use a Service
port-forward in a second terminal:

```sh
kubectl -n devops-lab port-forward service/devops-delivery-lab 18080:80
curl http://localhost:18080/healthz
```

## API

| Method  | Path             | Purpose                                                        |
| ------- | ---------------- | -------------------------------------------------------------- |
| `POST`  | `/api/tasks`     | Create `{ "title": "Prepare a release" }`                      |
| `GET`   | `/api/tasks`     | List tasks, using Redis when available                         |
| `PATCH` | `/api/tasks/:id` | Update `title` and/or `status` (`todo`, `in_progress`, `done`) |
| `GET`   | `/healthz`       | Process liveness                                               |
| `GET`   | `/readyz`        | PostgreSQL readiness; returns `503` when unavailable           |
| `GET`   | `/metrics`       | Prometheus metrics                                             |

## Useful commands

```sh
make ci
make test
make incident-crashloop
make incident-db-down
make incident-bad-release
make recover
make recover-db
```

The complete drill instructions are in [docs/runbooks](docs/runbooks), the
security decision is in [ADR 001](docs/adr/001-hosted-ci-and-local-cd.md), and
the review gate is in the [release checklist](docs/release-checklist.md).
Follow the [trusted runner setup](docs/self-hosted-runner.md) before enabling
automatic local CD.

## CI/CD safety model

Pull requests run only on GitHub-hosted runners. They never receive access to
the Mac or its Kind cluster. A push to protected `main` publishes a commit-SHA
image to GHCR and runs the Helm deploy job on the separately labelled local
runner. Do not enable the local runner for public pull-request jobs.

After the first publication, ensure the GHCR package is public, or configure an
`imagePullSecret` in the `devops-lab` namespace before enabling local CD.
