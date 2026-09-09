# Reproducible synthetic comparison

Run `node scripts/evaluate.js` from the repository root. No extra packages are needed. `results.json` retains every episode and its seed as well as totals. Ten fixed seeds each produce 60 trials per policy. This is a mechanism check; seeds are frozen, but no independent evaluator or preregistered human study is implied.

Every policy sees the same kinds of observations, uses the same engine authority guard and available action set, and receives scripted approval for every change. The simulator shares latent schedules and random draws across policies. Outcomes depend on the applied action, rather than replaying identical success labels. Simulator truth is not exposed to a policy.

The deliberately simple environment makes larger targets reduce synthetic miss probability and increase selection time. Keyboard fallback has a constant error rate and takes longer. These assumptions are invented for software testing, not fitted to a person. All misses are immediately observable in the simulator, unlike ordinary conversation.

| Policy | Completed / 600 | Misses | Total simulated seconds | Changes |
| --- | --- | --- | --- | --- |
| Fixed | 465 | 135 | 480.00 | 0 |
| Reactive | 480 | 120 | 521.65 | 177 |
| Personalized threshold | 489 | 111 | 547.20 | 22 |
| Fallback | 519 | 81 | 813.90 | 10 |
| NeuralBridge | 488 | 112 | 596.20 | 19 |

NeuralBridge makes fewer changes than the reactive comparator but does not dominate the alternatives. The personalized comparator completes one more trial in less simulated time. Fallback completes more trials at greater time cost. No clinical advantage or statistical superiority is claimed. Prompt count equals approval requests; all are accepted in this fixture. Refusal/recovery paths are tested separately in the engine suite. Persistent explicit feedback is supported, but this single-session comparison does not demonstrate longitudinal benefit.
