import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

function parseInputDate(input: string): string | null {
  const match = input.replace(/\D/g, "").match(/^(\d{2})(\d{2})(\d{4})$/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const d = parseInt(dd, 10)
  const m = parseInt(mm, 10)
  const y = parseInt(yyyy, 10)
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2000 || y > 2100) return null
  const date = new Date(y, m - 1, d)
  if (date.getDate() !== d || date.getMonth() !== m - 1) return null
  return format(date, "yyyy-MM-dd")
}

export function DatePicker({
  value,
  onChange,
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = value ? new Date(`${value}T00:00:00`) : undefined
  const [inputValue, setInputValue] = React.useState(
    value ? format(new Date(`${value}T00:00:00`), "dd/MM/yyyy") : ""
  )

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => {
    setInputValue(value ? format(new Date(`${value}T00:00:00`), "dd/MM/yyyy") : "")
  }, [value])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value.replace(/\D/g, "")
    if (v.length > 8) v = v.slice(0, 8)
    if (v.length > 4) v = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`
    else if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`
    setInputValue(v)
    if (v.length === 10) {
      const parsed = parseInputDate(v)
      if (parsed) onChange(parsed)
    }
  }

  function handleToday() {
    const today = format(new Date(), "yyyy-MM-dd")
    onChange(today)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="dd/mm/aaaa"
            disabled={disabled}
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 border border-input bg-background px-3 pr-9 text-sm transition-colors outline-none select-none hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30",
              !value && "text-muted-foreground",
              className
            )}
            onClick={() => setOpen(true)}
          />
          <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, "yyyy-MM-dd"))
              setInputValue(format(d, "dd/MM/yyyy"))
            }
            setOpen(false)
          }}
          locale={ptBR}
        />
        <div className="border-t border-border p-2">
          <Button variant="ghost" size="sm" className="w-full text-xs font-medium" onClick={handleToday}>
            Hoje
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
