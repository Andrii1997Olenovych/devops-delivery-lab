# Incident evidence and postmortem template

Do not claim a drill completed until its evidence is captured. For each run,
record the date, triggering command, `kubectl get pods`, relevant logs,
Prometheus/Alertmanager screenshot or query output, recovery command, and
post-recovery readiness result.

Use this structure for a short postmortem:

1. **Impact:** what was unavailable or degraded?
2. **Timeline:** trigger, detection, diagnosis, recovery, confirmation.
3. **Root cause:** the specific broken configuration, dependency, or image.
4. **What worked:** probes, metrics, alerts, or runbook steps that shortened
   diagnosis.
5. **Follow-up:** one concrete improvement, owner, and due date.
