"use client";
import { isValidElement, useEffect, useId, useRef, useState } from "react";

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

const POSITION_CLASSES = {
  top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
  bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
  left: "right-full mr-2 top-1/2 -translate-y-1/2",
  right: "left-full ml-2 top-1/2 -translate-y-1/2",
};

const ARROW_CLASSES = {
  top: "top-full border-t-gray-900 border-l-transparent border-r-transparent border-b-transparent",
  bottom: "bottom-full border-b-gray-900 border-l-transparent border-r-transparent border-t-transparent",
  left: "left-full border-l-gray-900 border-t-transparent border-b-transparent border-r-transparent",
  right: "right-full border-r-gray-900 border-t-transparent border-b-transparent border-l-transparent",
};

export function Tooltip({ text, children, position = "top" }: TooltipProps) {
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [pinned, setPinned] = useState(false);
  const childIsNaturallyInteractive =
    isValidElement(children) &&
    typeof children.type === "string" &&
    ["button", "a", "input", "select", "textarea", "summary"].includes(children.type);

  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target)) {
        setVisible(false);
        setPinned(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [visible]);

  const openTooltip = () => setVisible(true);
  const closeTooltip = () => {
    if (!pinned) {
      setVisible(false);
    }
  };
  const togglePinnedTooltip = () => {
    setPinned((wasPinned) => {
      const nextPinned = !wasPinned;
      setVisible(nextPinned);
      return nextPinned;
    });
  };
  const handleClick = () => {
    if (!childIsNaturallyInteractive) {
      togglePinnedTooltip();
    }
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      togglePinnedTooltip();
    }
    if (event.key === "Escape") {
      setPinned(false);
      setVisible(false);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <div
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
        onFocus={openTooltip}
        onBlur={closeTooltip}
        onClick={handleClick}
        onKeyDown={childIsNaturallyInteractive ? undefined : handleKeyDown}
        className="cursor-help"
        tabIndex={childIsNaturallyInteractive ? undefined : 0}
        role={childIsNaturallyInteractive ? undefined : "button"}
        aria-expanded={visible}
        aria-describedby={visible ? id : undefined}
      >
        {children}
      </div>

      {visible && (
        <div
          id={id}
          role="tooltip"
          className={`absolute z-50 w-max min-w-[14rem] max-w-[22rem] rounded-lg bg-gray-900 px-3 py-2 text-sm leading-relaxed text-white whitespace-normal break-normal [overflow-wrap:normal] shadow-lg pointer-events-none animate-fade-in ${POSITION_CLASSES[position]}`}
        >
          {text}
          <div
            className={`absolute w-0 h-0 border-4 ${ARROW_CLASSES[position]}`}
          />
        </div>
      )}
    </div>
  );
}
