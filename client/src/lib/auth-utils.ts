import { authPath } from "@/lib/authReturn";

export function isUnauthorizedError(error: Error): boolean {
  const status = (error as Error & { status?: number }).status;
  return status === 401 || /^401: .*Unauthorized/.test(error.message);
}

// Redirect to login with a toast notification
export function redirectToLogin(toast?: (options: { title: string; description: string; variant: string }) => void) {
  if (toast) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
  }
  setTimeout(() => {
    window.location.href = authPath("/login");
  }, 500);
}
