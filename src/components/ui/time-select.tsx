import * as React from "react"
import { ClockIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TimeSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0")
  const m = i % 2 === 0 ? "00" : "30"
  return `${h}:${m}`
})

function parseInputTime(input: string): string | null {
  const match = input.match(/^(\d{1,2}):?(\d{2})$/)
  if (!match) return null
  const h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function getNowRounded(): string {
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  const rounded = m < 30 ? 0 : 30
  return `${String(h).padStart(2, "0")}:${String(rounded).padStart(2, "0")}`
}

export function TimeSelect({
  value,
  onChange,
  disabled,
  className,
}: TimeSelectProps) {
  const options = React.useMemo(() => {
    const base = value && !TIME_SLOTS.includes(value)
      ? [...TIME_SLOTS, value].sort((a, b) => a.localeCompare(b))
      : TIME_SLOTS
    return base
  }, [value])

  const [inputValue, setInputValue] = React.useState(value || "")

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => {
    setInputValue(value || "")
  }, [value])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value.replace(/[^0-9:]/g, "")
    if (v.length > 5) v = v.slice(0, 5)
    if (v.length === 2 && !v.includes(":") && inputValue.length < v.length) {
      v = `${v}:`
    }
    setInputValue(v)
    if (v.length === 5) {
      const parsed = parseInputTime(v)
      if (parsed) onChange(parsed)
    }
  }

  function handleAgora() {
    const now = getNowRounded()
    onChange(now)
    setInputValue(now)
  }

  return (
    <div className={cn("flex gap-1", className)}>
      <Select
        value={value}
        onValueChange={(v) => {
          onChange(v)
          setInputValue(v)
        }}
        disabled={disabled}
      >
        <SelectTrigger className="flex-1 data-[size=default]:h-9">
          <SelectValue placeholder="Selecionar horário">
            {value ? (
              <span className="flex items-center gap-2">
                <ClockIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
                <span>{value}</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ClockIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">Selecionar horário</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map(t => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={handleAgora}
        disabled={disabled}
        className="h-9 px-2 border border-input bg-background text-xs font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors shrink-0"
      >
        Agora
      </button>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder="HH:mm"
        disabled={disabled}
        className="h-9 w-16 border border-input bg-background px-2 text-sm text-center outline-none hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30 shrink-0"
      />
    </div>
  )
}
