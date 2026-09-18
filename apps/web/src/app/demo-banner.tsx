"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle, RotateCcw, Zap } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useToast,
} from "@reminder/ui";

export function DemoBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (pathname === "/login" || pathname?.startsWith("/login/")) {
    return null;
  }

  async function handleReset() {
    setResetting(true);
    try {
      const response = await fetch("/api/v1/demo/reset", {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || "Failed to reset demo data.");
      }
      toast("Demo data has been reset to its initial state.", "success");
      setOpen(false);
      router.refresh();
      // Reload page to re-fetch all state
      window.location.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error resetting demo data.";
      toast(message, "error");
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <div className="demo-banner" role="region" aria-label="Demo Mode Notice">
        <div className="demo-banner-content">
          <div className="demo-banner-left">
            <span className="demo-banner-badge">
              <Zap aria-hidden="true" size={13} className="demo-banner-icon" />
              Demo Mode
            </span>
            <span className="demo-banner-text">
              You are exploring a live interactive demo. External notifications are simulated.
            </span>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="demo-reset-btn"
            onClick={() => setOpen(true)}
          >
            <RotateCcw aria-hidden="true" size={14} />
            <span>Reset Demo Data</span>
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="dialog-content--confirm">
          <DialogHeader>
            <DialogTitle>Reset Demo Data</DialogTitle>
            <DialogDescription>
              This will restore all sample reminders, expenses, notes, and demo secrets to their
              clean initial state. Any changes or items you added will be replaced.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleReset} disabled={resetting}>
              {resetting ? (
                <>
                  <LoaderCircle aria-hidden="true" className="spin" size={16} />
                  Resetting...
                </>
              ) : (
                "Confirm Reset"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
