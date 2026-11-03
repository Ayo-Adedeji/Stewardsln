"use client";

import CreateSessionForm from "@/components/forms/create-session-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AttendanceSession } from "@/types/attendance";

interface CreateSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (session: AttendanceSession) => void;
}

export default function CreateSessionModal({
  open,
  onOpenChange,
  onCreated,
}: CreateSessionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92dvh] overflow-y-auto custom-scrollbar p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle>Create Attendance Session</DialogTitle>
          <DialogDescription>
            Configure the service schedule and generate a unique QR code and
            registration link for Light Nation Ibadan attendees.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <CreateSessionForm
            onCancel={() => onOpenChange(false)}
            onSuccess={(session) => {
              onOpenChange(false);
              onCreated?.(session);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
