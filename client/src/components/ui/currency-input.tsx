import * as React from "react";
import { Input } from "@/components/ui/input";

function formatNumber(value: number): string {
  if (!value) return "";
  return value.toLocaleString("ru-RU");
}

function parseDigits(value: string): number {
  const cleaned = value.replace(/[^\d]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

export interface CurrencyInputProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ id, value, onChange, placeholder = "0" }, ref) => {
    const [display, setDisplay] = React.useState(formatNumber(value));

    React.useEffect(() => {
      setDisplay(formatNumber(value));
    }, [value]);

    return (
      <Input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={display}
        onChange={(e) => {
          const parsed = parseDigits(e.target.value);
          setDisplay(parsed ? formatNumber(parsed) : "");
          onChange(parsed);
        }}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";
