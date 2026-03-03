"use client";

import { ReactNode, RefObject, useEffect, useRef } from "react";

interface ModalShellProps {
  children: ReactNode;
  onClose: () => void;
  maxWidthClassName?: string;
  titleId?: string;
  ariaLabel?: string;
  initialFocusRef?: RefObject<HTMLElement>;
}

const FOCUSABLE_SELECTOR =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ModalShell({
  children,
  onClose,
  maxWidthClassName = "max-w-md",
  titleId,
  ariaLabel,
  initialFocusRef,
}: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const dialogElement = dialogRef.current;
    const focusable = dialogElement
      ? (Array.from(dialogElement.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[])
      : [];
    const initialTarget = initialFocusRef?.current || focusable[0] || dialogElement;
    initialTarget?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const root = dialogRef.current;
      if (!root) return;
      const nodes = Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[];
      if (nodes.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }

      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeElement === firstNode || activeElement === root) {
          event.preventDefault();
          lastNode.focus();
        }
        return;
      }

      if (activeElement === lastNode) {
        event.preventDefault();
        firstNode.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [initialFocusRef, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-lg bg-white shadow-xl ${maxWidthClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
