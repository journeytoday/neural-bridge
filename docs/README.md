# Implementation evidence and remaining scope

Implementation date: 9 September 2026. Reference: NeuralBridge Intelligence Layer PRD v7.8, especially sections 14–19. The confidential source PDF is not distributed in this repository.

## Capability matrix

| Path | Current implementation | Remaining PRD gate |
| --- | --- | --- |
| Core interaction | Phrase selection/confirmation, free text, draft persistence, explicit speech, stop | Hardware access and participant validation |
| Adaptation | Quality-qualified trials, bounded target/dwell changes, approval/refusal, expiry, undo, fallback, recovery | Explicit refusals and feedback persist locally; synthetic paired comparison included. Richer learned longitudinal reasoning remains research |
| M01 EEG fusion | Synthetic synchronized candidate agreement; abstains on disagreement or invalid evidence | Real signal replay/decoder and live EEG |
| M02 physiology | Timestamped context/missingness changes the number of direct observations required before support | No physiological validity established |
| M03 blink | WebM video decoding and pixel-measured synthetic geometry; long/short/no-intent/occluded fixtures | Real human-face models and clinical blink validation |
| M04 speech input | Voice evidence gates transcript use; unreliable input requires explicit corrected-text approval | ASR and real speech evaluation remain optional/later-stage |
| M05 language | Actual small statistical bigram model, local training corpus, editable suggestions, quick/story composition | 1,000-word English bank plus explicit personal vocabulary added; broader model quality remains limited |
| M06 voice | Selectable installed device voices, default fallback | Personal voice asset lifecycle and consented cloning |
| M07 profiles | Persistent loopback HTTP profile service, export/import, two independent browser hosts, conflict/offline/revocation tests | Authenticated cross-device production sync |
| M08 SDK | Browser-compatible ES modules and HTTP SDK, independent Host B UI | Broader conformance suite and real devices |
| M09 care | HTTP sandbox receiver with deduplication, timeout, acknowledgement and completion | Real care integration remains later-stage |
| M10 medication | Two-event fictional timeline, acknowledgement, reported administration and unknown/missingness | Imported prescribed plans and real pharmacokinetic research |
| M11 orders | Installed test order with author/scope/version/expiry/checksum checks; later apply and undo enforce dwell bound | Explicit expired-order review added; production signatures remain later-stage |
| M12 MI alert | Synthetic candidates reach HTTP sandbox; no-intent/artifacts/low quality rejected | Calibrated live decoder and supervised evaluation |

## Verification

33 automated tests pass across engine, language model and platform contracts. Browser walkthrough verified phrase confirmation, target enlargement to 125%, undo to 100%, and draft preservation. Syntax checks pass. Browser speech API is connected to installed device voices; auditory intelligibility was not independently assessed. Browser also verified 30-frame WebM decoding (400 ms accepted vs 100 ms abstained), HTTP delivery/acknowledgement/completion, and Host B target validation. Browser also verified word search, explicit personal vocabulary saving, unreliable voice abstention/correction, and expired-order recovery. The 390-pixel layout was visually reviewed. Keyboard-focus dwell, synthetic posture fallback and per-channel revalidation were checked in-browser. A 42-second annotated walkthrough of actual UI states is included in walkthrough/neuralbridge-walkthrough.webm. See evaluation/README.md for the reproducible comparison and its mixed results.

## Architecture

```mermaid
flowchart LR
  R[Synthetic observations] --> E[Local intelligence engine]
  E --> P[Bounded proposal]
  U[User approval or refusal] --> G[Authority guard]
  P --> G
  G --> A[Reference communication app]
  A --> D[Draft and explicit speech]
  A --> O[Evidence and undo]
  O --> E
  A --> S[Versioned profile SDK]
  S --> H[Host B local validation]
  A --> C[HTTP sandbox receiver]
```

## Next milestone and cost assumptions

The bounded software walkthrough and final audit are recorded in ACCEPTANCE.md. Next work is live access integration and evidence gathering, with optional model/voice enhancements. History retains at most 300 text-free event summaries and explicit feedback/refusals; it never restores stale sensor evidence or device calibration. Video fixture decoding is an actual pixel-processing path, not a human face detector. The four generated fixtures use no personal data. Then select one live access integration and agree a supervised evaluation protocol with appropriate experts. No participant benefit can be inferred from this demonstrator.

Current runtime requires no paid API. Engineering labor, supported hardware, specialist evaluation, hosting/security and contingency remain unquoted. No funding amount or runway has been fabricated; founders must supply capacity and obtain quotations before a costed ask is complete.
