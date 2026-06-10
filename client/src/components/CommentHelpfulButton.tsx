import { Button } from "@/components/ui/button";
import { ThumbsUp } from "lucide-react";

interface Props {
  count?: number | null;
  onClick?: () => void;
}

export function CommentHelpfulButton({ count, onClick }: Props) {
  return (
    <Button size="sm" variant="ghost" onClick={onClick}>
      <ThumbsUp className="mr-1 h-3.5 w-3.5" />
      Helpful{count ? ` (${count})` : ""}
    </Button>
  );
}
