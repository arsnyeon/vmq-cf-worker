import { useState } from 'react';
import { format, subDays, startOfMonth } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/** 传值统一用 'YYYY-MM-DD'（与后端约定的日期格式），空串表示不限 */
export interface DateRangeValue {
  start: string;
  end: string;
}

const EMPTY: DateRangeValue = { start: '', end: '' };

/** 'YYYY-MM-DD' → 本地零点的 Date（用本地时区构造，避免 UTC 偏移把日期错一天） */
function toDate(v: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toStr(d: Date | undefined): string {
  return d ? format(d, 'yyyy-MM-dd') : '';
}

const PRESETS: Array<{ label: string; get: () => DateRangeValue }> = [
  {
    label: '今天',
    get: () => ({ start: toStr(new Date()), end: toStr(new Date()) }),
  },
  {
    label: '近 7 天',
    get: () => ({ start: toStr(subDays(new Date(), 6)), end: toStr(new Date()) }),
  },
  {
    label: '近 30 天',
    get: () => ({ start: toStr(subDays(new Date(), 29)), end: toStr(new Date()) }),
  },
  {
    label: '本月',
    get: () => ({ start: toStr(startOfMonth(new Date())), end: toStr(new Date()) }),
  },
];

export function DateRangePicker({
  value,
  onChange,
  className,
}: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  // 日历的操作态是草稿，点「确定」才回传，避免选一半就触发查询
  const [draft, setDraft] = useState<DateRange | undefined>(() => {
    const from = toDate(value.start);
    const to = toDate(value.end);
    return from ? { from, to } : undefined;
  });

  const label =
    value.start && value.end
      ? `${value.start} ~ ${value.end}`
      : value.start
        ? `${value.start} 起`
        : value.end
          ? `至 ${value.end}`
          : '';

  function openChange(next: boolean) {
    if (next) {
      const from = toDate(value.start);
      const to = toDate(value.end);
      setDraft(from ? { from, to } : undefined);
    }
    setOpen(next);
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Popover open={open} onOpenChange={openChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('h-9 w-56 justify-start font-normal', !label && 'text-muted-foreground')}
          >
            <CalendarIcon className="size-4 opacity-60" />
            {label || '选择时间范围'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="range"
            selected={draft}
            onSelect={setDraft}
            numberOfMonths={2}
            defaultMonth={draft?.from}
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-1 border-t border-border p-2">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="ghost"
                size="sm"
                onClick={() => {
                  const v = p.get();
                  setDraft({ from: toDate(v.start), to: toDate(v.end) });
                  onChange(v);
                  setOpen(false);
                }}
              >
                {p.label}
              </Button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(undefined);
                  onChange(EMPTY);
                  setOpen(false);
                }}
              >
                清除
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onChange({ start: toStr(draft?.from), end: toStr(draft?.to) });
                  setOpen(false);
                }}
              >
                确定
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {label ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          title="清除时间范围"
          onClick={() => onChange(EMPTY)}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
