import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Props {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function PrivateNoteToggle({ checked, onCheckedChange }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
      <div>
        <Label className="text-sm font-medium">Make this a private note</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Public comments are visible to other Realist users.
        </p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
