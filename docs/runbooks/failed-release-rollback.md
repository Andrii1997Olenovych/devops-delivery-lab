# Runbook: failed release and Helm rollback

## Trigger

Run `make incident-bad-release`. The command intentionally supplies an image
tag that does not exist. `helm upgrade --atomic --wait` must fail and restore
the last healthy revision.

## Diagnose

```sh
helm -n devops-lab history devops-delivery-lab
kubectl -n devops-lab get events --sort-by=.lastTimestamp
kubectl -n devops-lab get pods
```

## Recover and confirm

The atomic upgrade performs the rollback. Run `make recover` only if the
release history or pod status shows that recovery is still required. Confirm the
last deployed image tag and `/healthz` response before closing the incident.
