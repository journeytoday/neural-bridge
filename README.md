# NeuralBridge v0.1 POC

A runnable, local adaptive communication demonstrator based on PRD v7.8. This initial implementation demonstrates the core loop; it does **not** yet satisfy every PRD v0.1 completion gate. All sensing is synthetic. No clinical benefit or dependable emergency alerting is claimed.

## Run

Install Node.js 22 or newer, then run:

```sh
npm start
```

Open http://127.0.0.1:4173. No package installation, API key, cloud account, or hardware is required. Run `npm test` for the contract tests and `npm run check` for syntax checks.

## Walkthrough

1. Select a phrase and choose **Confirm selection**. Review and optionally **Speak my words**.
2. Choose **Slower, less accurate selections** and run observations. Approve **Try this change**. The actual targets enlarge.
3. Choose **Undo adaptation**. The draft survives and target size returns.
4. Replay active-route loss, approve keyboard fallback, and complete another phrase. Replay recovery before undoing to a previously unavailable route.
5. Try switch or blink confirmation, approve the proposal, select a phrase, and confirm using the switch button or synthetic blink replay. Dwell requires keeping the pointer over a phrase for the configured interval.
6. Transfer preferences to host B and run its separate sandbox local check.
7. Open the sandbox receiver, send a request, acknowledge it, and mark the human task complete. Test timeout and no-intent rejection separately.

See [capabilities and remaining work](docs/README.md) and [SDK contracts](docs/SDK.md).

## Privacy and boundaries

The draft is stored in this browser's local storage and removed using Clear draft. Profiles persist locally in the ignored .neuralbridge-data directory; other state is in memory and resets on reload. Exported evidence includes selected phrase text: use fictional content for demonstrations. HTTP requests stay on this computer; no data is sent to outside services. Device voices are ordinary operating-system voices, not cloned personal voices. Model suggestions come from a small locally trained bigram model, not an LLM. The test order checksum is deliberately not cryptographic identity verification.

The server binds to loopback. Do not expose it publicly as a production service. Public repository visibility does not mean a live deployment exists.
