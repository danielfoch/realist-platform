import { Button } from "@/components/ui/button";
import { SiGoogle } from "react-icons/si";

interface GoogleSignInButtonProps {
  variant?: "login" | "signup" | "continue";
  className?: string;
  disabled?: boolean;
}

export function GoogleSignInButton({ 
  variant = "continue", 
  className = "",
  disabled = false 
}: GoogleSignInButtonProps) {
  const handleClick = () => {
    // Pass current returnUrl to Google OAuth flow
    const searchParams = new URLSearchParams(window.location.search);
    const returnUrl = searchParams.get("returnUrl");
    const googleUrl = returnUrl 
      ? `/api/auth/google/start?returnUrl=${encodeURIComponent(returnUrl)}`
      : "/api/auth/google/start";
    window.location.href = googleUrl;
  };

  const buttonText = {
    login: "Sign in with Google",
    signup: "Sign up with Google",
    continue: "Continue with Google",
  }[variant];

  return (
    <Button
      type="button"
      variant="outline"
      className={`w-full flex items-center justify-center gap-2 ${className}`}
      onClick={handleClick}
      disabled={disabled}
      data-testid="button-google-signin"
    >
      <SiGoogle className="h-4 w-4" />
      {buttonText}
    </Button>
  );
}
