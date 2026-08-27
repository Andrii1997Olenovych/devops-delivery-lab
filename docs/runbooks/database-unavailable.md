# Runbook: PostgreSQL unavailable

## Trigger

Start the local stack first with `make up` and `make observe`, then run
`make incident-db-down`. This stops Compose PostgreSQL while leaving the API,
Prometheus, Grafana, and Alertmanager running.

## Diagnose

```sh
docker compose ps
curl -i http://localhost:3000/readyz
```

The readiness endpoint returns `503` after PostgreSQL becomes unavailable,
while `/healthz` remains live. Prometheus raises `PostgreSQLUnavailable` after
the configured 30-second window, while `/metrics` continues to expose the
dependency state. Inspect it at <http://localhost:9093>.

## Recover and confirm

```sh
make recover-db
curl http://localhost:3000/readyz
```

Confirm `/readyz` returns 200 and the Grafana dependency-health panel shows
PostgreSQL as up. To separately practise Kubernetes endpoint removal, scale
`deployment/devops-delivery-lab-postgres` to zero and inspect the app Service
endpoints; this local Compose monitoring stack does not scrape the Kind cluster.
