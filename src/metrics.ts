import { Counter, Gauge, Histogram, Registry } from 'prom-client';

type HttpMetricLabel = 'method' | 'route' | 'status_code';
type DependencyMetricLabel = 'dependency';

export class AppMetrics {
  private readonly registry = new Registry();
  private readonly httpRequestsTotal = new Counter<HttpMetricLabel>({
    name: 'http_requests_total',
    help: 'Total HTTP responses produced by the application',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });
  private readonly httpRequestDuration = new Histogram<HttpMetricLabel>({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });
  private readonly dependencyUp = new Gauge<DependencyMetricLabel>({
    name: 'dependency_up',
    help: 'Whether an application dependency is reachable',
    labelNames: ['dependency'],
    registers: [this.registry],
  });

  public recordRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const labels = { method, route, status_code: String(statusCode) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationSeconds);
  }

  public setDependencyUp(dependency: 'postgres' | 'redis', reachable: boolean): void {
    this.dependencyUp.set({ dependency }, reachable ? 1 : 0);
  }

  public async render(): Promise<string> {
    return this.registry.metrics();
  }

  public get contentType(): string {
    return this.registry.contentType;
  }
}
