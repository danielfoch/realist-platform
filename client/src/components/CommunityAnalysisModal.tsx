import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnalysisHistoryList } from "@/components/AnalysisHistoryList";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analyses: any[];
  onDuplicate?: (analysisId: string) => void;
  onFeedback?: (analysisId: string, feedbackType: "useful" | "not_useful" | "disagree") => void;
}

export function CommunityAnalysisModal({ open, onOpenChange, analyses, onDuplicate, onFeedback }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Community analyses</DialogTitle>
        </DialogHeader>
        <AnalysisHistoryList analyses={analyses} onDuplicate={onDuplicate} onFeedback={onFeedback} />
      </DialogContent>
    </Dialog>
  );
}
