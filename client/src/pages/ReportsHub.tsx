import { Redirect } from "wouter";

// /reports is retired as a standalone archive — /insights is the canonical hub.
export default function ReportsHub() {
  return <Redirect to="/insights" />;
}
