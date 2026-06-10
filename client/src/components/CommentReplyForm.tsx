import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  onSubmit: (body: string) => void;
}

export function CommentReplyForm({ onSubmit }: Props) {
  const [body, setBody] = useState("");
  return (
    <div className="space-y-2">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Write a reply..." />
      <Button size="sm" onClick={() => {
        if (!body.trim()) return;
        onSubmit(body.trim());
        setBody("");
      }}>
        Reply
      </Button>
    </div>
  );
}
