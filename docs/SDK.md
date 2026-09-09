# Local SDK v0.1

ES modules are shared directly between Node tests and the browser; no build step is required.

```js
import { createEngine } from '../src/engine.js';
const engine = createEngine();
engine.setDraft('My unfinished message');
for (let i = 0; i < 6; i++) {
  engine.observe({modality:'pointer',quality:0.95,available:true,error:true,latencyMs:1800,provenance:'synthetic'});
}
const proposal = engine.propose();
// Call apply only after explicit user approval.
engine.apply(proposal.id);
engine.undo();
```

Observations include timestamp, modality, task/context, configuration version, quality, missingness, availability and provenance. Reliability is a bounded recent-window descriptive estimate, not a calibrated clinical probability. Proposals contain reason, scope, expiry, authority, expected benefit/burden and the prior configuration. Outcomes remain unknown unless observable.

`requestConfiguration(patch)` proposes user-requested targetScale, dwellMs, confirmation or modality changes through the same guard. `reviewRecovery()` clears recovery only when the current route is usable. `select(text)` and `confirm(method)` separate selection and confirmation. Host implementations must faithfully map actual route availability; the demo only simulates it.

`ProfileService` provides create/get/update/export/import/revoke/connectHost. Updates require expectedVersion. Host sync does not copy calibration; `validateLocally` requires a host-specific passing fixture. Offline authorization is unknown. These are logical clients, not authenticated network clients.

`SandboxSink` provides request/acknowledge/complete/tick/list. Duplicate IDs with matching payload return the original request; conflicting payloads fail. Timeout does not imply human completion. `routeMICandidate` applies a fixed synthetic candidate gate without generative interpretation.

`MedicationTimeline` separates reminder acknowledgement and reported administration. `signTestOrder`, `validateOrder`, and `enforceDwell` demonstrate test integrity and scope checks. The checksum is not security-grade authentication, and the sample UI proposes a dwell rule rather than establishing a trusted clinical authority service.
