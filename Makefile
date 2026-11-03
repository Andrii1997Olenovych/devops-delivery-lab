SHELL := /bin/sh

COMPOSE := docker compose
KIND_CLUSTER := devops-lab
NAMESPACE := devops-lab
RELEASE_NAME := devops-delivery-lab
IMAGE_REPOSITORY ?= devops-delivery-lab
IMAGE_TAG ?= dev

.PHONY: up down test ci cluster-up cluster-down image deploy observe incident-crashloop incident-db-down incident-bad-release recover recover-db

up:
	$(COMPOSE) up --build --detach

down:
	$(COMPOSE) down --volumes --remove-orphans

test:
	npm test

ci:
	npm ci
	npm run format:check
	npm run lint
	npm run typecheck
	npm test
	npm run build

cluster-up:
	kind create cluster --name $(KIND_CLUSTER) --config infrastructure/kind-config.yaml
	kubectl label node $(KIND_CLUSTER)-control-plane ingress-ready=true --overwrite
	kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.0/deploy/static/provider/kind/deploy.yaml
	kubectl rollout status --namespace ingress-nginx deployment/ingress-nginx-controller --timeout=120s

cluster-down:
	kind delete cluster --name $(KIND_CLUSTER)

image:
	docker build --tag $(IMAGE_REPOSITORY):$(IMAGE_TAG) .
	kind load docker-image $(IMAGE_REPOSITORY):$(IMAGE_TAG) --name $(KIND_CLUSTER)

deploy: image
	helm upgrade --install $(RELEASE_NAME) helm/devops-delivery-lab --namespace $(NAMESPACE) --create-namespace --atomic --wait --timeout 3m --set image.repository=$(IMAGE_REPOSITORY) --set image.tag=$(IMAGE_TAG) --set image.pullPolicy=IfNotPresent
	kubectl --namespace $(NAMESPACE) rollout status deployment/$(RELEASE_NAME) --timeout=90s

observe:
	$(COMPOSE) up --detach prometheus alertmanager grafana
	@echo "Grafana: http://localhost:3001 (admin/admin)"
	@echo "Prometheus: http://localhost:9090"
	@echo "Alertmanager: http://localhost:9093"

incident-crashloop:
	kubectl --namespace $(NAMESPACE) set env deployment/$(RELEASE_NAME) --containers=app DATABASE_URL=
	@echo "Observe CrashLoopBackOff with: kubectl -n $(NAMESPACE) get pods -l app.kubernetes.io/component=api"

incident-db-down:
	$(COMPOSE) stop database
	@echo "Observe /readyz returning 503 and the PostgreSQLUnavailable alert in Alertmanager."

incident-bad-release:
	@if helm upgrade $(RELEASE_NAME) helm/devops-delivery-lab --namespace $(NAMESPACE) --atomic --wait --timeout 90s --set image.tag=not-a-real-image; then echo "Unexpectedly accepted bad image tag"; exit 1; else echo "Helm rejected the bad release and rolled back atomically"; fi

recover:
	$(MAKE) deploy

recover-db:
	$(COMPOSE) up --detach database
