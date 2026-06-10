import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PrivateNoteToggle } from "@/components/PrivateNoteToggle";

interface Props {
  onSubmit: (body: string, visibility: "public" | "private") => void;
}

export function CommentComposer({ onSubmit }: Props) {
  const [body, setBody] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  return (
    <div className="space-y-3 rounded-lg border border-border/60 p-3">
      <PrivateNoteToggle checked={isPrivate} onCheckedChange={setIsPrivate} />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={isPrivate ? "Add a private note for yourself..." : "Share a public comment about this listing..."}
        rows={3}
      />
      <Button onClick={() => {
        if (!body.trim()) return;
        onSubmit(body.trim(), isPrivate ? "private" : "public");
        setBody("");
      }}>
        {isPrivate ? "Save private note" : "Post comment"}
      </Button>
    </div>
  );
}
