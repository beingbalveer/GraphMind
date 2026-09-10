"use client";

import { AlertTriangle } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "./button";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "./modal";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default";
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "destructive",
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      ariaLabel={title}
      closeOnClickOutside={!isLoading}
      isOpen={isOpen}
      onClose={onClose}
      role="alertdialog"
      size="sm"
    >
      <ModalHeader
        icon={<AlertTriangle className="size-4" />}
        title={title}
      />
      <ModalBody className="py-3">
        <DialogPrimitive.Description className="whitespace-normal break-words text-xs text-foreground-muted">
          {description}
        </DialogPrimitive.Description>
      </ModalBody>
      <ModalFooter>
        <Button disabled={isLoading} onClick={onClose} type="button" variant="outline">
          {cancelText}
        </Button>
        <Button
          loading={isLoading}
          loadingLabel="Processing"
          onClick={async () => {
            await onConfirm();
            onClose();
          }}
          type="button"
          variant={variant === "destructive" ? "destructive" : "default"}
        >
          {confirmText}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
