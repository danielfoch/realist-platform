import { useEffect } from "react";
import { useLocation } from "wouter";

interface RedirectProps {
  to: string;
}

export function Redirect({ to }: RedirectProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(to, { replace: true });
  }, [to, setLocation]);

  return null;
}
