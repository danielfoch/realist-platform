import { Button } from "@/components/ui/button";

interface Props {
  onClick?: () => void;
}

export function CommentReportButton({ onClick }: Props) {
  return (
    <Button size="sm" variant="ghost" onClick={onClick}>
      Report
    </Button>
  );
}
