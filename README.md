# DevOps Delivery Lab

An independent local TypeScript delivery lab for containers, Kubernetes, CI/CD, observability and operational troubleshooting.

## Explore the implementation

The complete implementation is currently on the feature branch and in an open pull request:

- [Pull request and review](https://github.com/Andrii1997Olenovych/devops-delivery-lab/pull/1)
- [Implementation and setup guide](https://github.com/Andrii1997Olenovych/devops-delivery-lab/tree/feat/devops-delivery-lab-v1)
- [Architecture decision](https://github.com/Andrii1997Olenovych/devops-delivery-lab/blob/feat/devops-delivery-lab-v1/docs/adr/001-hosted-ci-and-local-cd.md)
- [Operational runbooks](https://github.com/Andrii1997Olenovych/devops-delivery-lab/tree/feat/devops-delivery-lab-v1/docs/runbooks)

## Included components

- Fastify/TypeScript API with PostgreSQL, Redis integration and automated tests.
- Multi-stage Docker build and a non-root runtime image.
- Helm manifests for a local kind cluster, including probes, resource settings and container security configuration.
- GitHub Actions workflow, Prometheus/Grafana configuration and release/incident runbooks.

## Recorded verification

[PR validation succeeded on 27 August 2026](https://github.com/Andrii1997Olenovych/devops-delivery-lab/actions/runs/33050259844/job/98443751166) for the implementation at commit `39d52e7`.

Image publication and local deployment were skipped in that run. This historical result is not a claim that deployment or incident exercises have been completed.

## Scope

This is a local learning and engineering project. The PostgreSQL manifest uses temporary storage, and the postmortem directory currently contains a template. The code and documentation are available for inspection through the links above.
