// The buy & hold engine lives in shared/ so the server (agent API, MCP, hosted
// result views) and the web analyzer run the exact same math. This file stays
// as the client import path.
export * from "@shared/buyHoldAnalysis";
