/**
 * macOS-only boot shim for local E2E runs.
 *
 * server/index.ts listens with `reusePort: true` (correct for the Linux
 * production host and CI runners, where SO_REUSEPORT balances restarts).
 * On macOS with Node >= 22 that option throws `listen ENOTSUP`, so booting
 * dist/index.cjs directly fails locally. This shim strips the option and
 * then loads the real bundle — app code stays untouched.
 *
 * Usage (only needed on macOS, see e2e/README.md):
 *   E2E_SERVER_COMMAND="node e2e/local-boot-shim.cjs" npm run test:e2e
 *
 * CI does NOT use this file.
 */
const net = require("net");
const path = require("path");

const originalListen = net.Server.prototype.listen;
net.Server.prototype.listen = function (options, ...rest) {
  if (options && typeof options === "object" && "reusePort" in options) {
    options = { ...options, reusePort: false };
  }
  return originalListen.call(this, options, ...rest);
};

require(path.join(__dirname, "..", "dist", "index.cjs"));
