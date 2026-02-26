"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { LogOut, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/store/auth-store";

export function DangerZone() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuthStore();
  const router = useRouter();

  const handleDisconnect = () => {
    logout();
    setOpen(false);
    router.push("/");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.12, ease: "easeOut" }}
    >
      <div className="rounded-xl border-2 border-red-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-semibold text-red-600">Danger Zone</h3>
        </div>
        <p className="mb-4 text-sm text-ld-slate">
          Disconnecting your wallet will remove all session data. You can reconnect at any time.
        </p>
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="border-red-200 text-red-600 transition-transform active:scale-[0.97] hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect Wallet
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Disconnect Wallet
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect your wallet? This will end your
              current session and redirect you to the home page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDisconnect}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Yes, Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
