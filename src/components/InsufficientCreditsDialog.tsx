"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function InsufficientCreditsDialog({
  open,
  onOpenChange,
  required,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  required: number;
  current: number | null;
}) {
  const router = useRouter();
  const missing = Math.max(0, (required ?? 0) - (typeof current === "number" ? current : 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insufficient credits</DialogTitle>
          <DialogDescription>
            You need {required} credits to continue. Your current balance is {typeof current === "number" ? current : 0}.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 text-sm text-white/80">
          {missing > 0 ? (
            <span>You are short by {missing} credits.</span>
          ) : (
            <span>Please add credits to continue.</span>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onOpenChange(false); router.push("/app/subscription"); }}>Add Credit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
