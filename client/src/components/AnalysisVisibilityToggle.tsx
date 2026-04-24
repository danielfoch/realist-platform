import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Props {
  visibility: "public" | "private";
  onChange: (visibility: "public" | "private") => void;
}

export function AnalysisVisibilityToggle({ visibility, onChange }: Props) {
  const isPublic = visibility === "public";
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm font-medium">Public community analysis</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Your analysis will be visible to other users by default. Switch to Private if you only want it visible to you.
          </p>
        </div>
        <Switch checked={isPublic} onCheckedChange={(checked) => onChange(checked ? "public" : "private")} />
      </div>
    </div>
  );
}
