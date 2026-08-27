# Runbook: CrashLoopBackOff caused by missing configuration

## Trigger

Run `make incident-crashloop`. It overrides the API container's `DATABASE_URL`
with an empty value, so startup validation exits the application process and
Kubernetes restarts that container. The separate migration URL keeps the init
container healthy, making this an application `CrashLoopBackOff` drill.

## Diagnose

```sh
kubectl -n devops-lab get pods
kubectl -n devops-lab describe pod -l app.kubernetes.io/name=devops-delivery-lab
kubectl -n devops-lab get pods -l app.kubernetes.io/component=api --sort-by=.metadata.creationTimestamp
kubectl -n devops-lab logs "$(kubectl -n devops-lab get pods -l app.kubernetes.io/component=api --sort-by=.metadata.creationTimestamp -o name | tail -n 1)" -c app --previous
```

Expected evidence: a pod in `CrashLoopBackOff` and the log message
`DATABASE_URL is required`.

## Recover and confirm

```sh
make recover
kubectl -n devops-lab rollout status deployment/devops-delivery-lab
```

Confirm the pod is Ready. For application liveness, port-forward the Service
and call it directly; ingress-nginx reserves the external `/healthz` route for
its own controller check:

```sh
kubectl -n devops-lab port-forward service/devops-delivery-lab 18080:80
curl http://localhost:18080/healthz
```
