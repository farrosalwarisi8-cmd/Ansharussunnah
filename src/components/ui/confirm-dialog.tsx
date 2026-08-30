// src/components/ui/confirm-dialog.tsx

"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog"
import { Button } from "./button"
import { AlertTriangle, Loader2 } from "lucide-react"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "destructive" | "default" | "warning"
  isLoading?: boolean
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Lanjutkan",
  cancelText = "Batal",
  variant = "destructive",
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="gap-2">
          <div className="mx-auto sm:mx-0 w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle className="text-lg font-bold text-gray-900">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="min-h-[44px] sm:min-h-[38px]"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isLoading}
            className="min-h-[44px] sm:min-h-[38px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memproses...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
