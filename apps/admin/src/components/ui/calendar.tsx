import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 精简版 Calendar：只做「选日期 / 选范围」需要的那部分，
 * 不引 shadcn 官方那份 200 行的 calendar.tsx（它的 classNames 表针对 rdp v8/v9，
 * 与当前安装的 v10 键名不完全对得上）。样式直接用本项目的 token。
 */
export function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      locale={zhCN}
      weekStartsOn={1}
      showOutsideDays
      className={cn('relative', className)}
      classNames={{
        months: 'flex gap-4',
        month: 'flex flex-col gap-2',
        month_caption: 'flex h-8 items-center justify-center',
        caption_label: 'text-sm font-medium',
        nav: 'absolute inset-x-0 top-0 flex h-8 items-center justify-between',
        button_previous:
          'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40',
        button_next:
          'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40',
        month_grid: 'border-collapse',
        weekday: 'size-9 pb-1 text-xs font-normal text-muted-foreground',
        day: 'p-0 text-center',
        day_button:
          'inline-flex size-9 items-center justify-center rounded-md text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        // 选中态：cell 上挂 bg-primary，按钮文字转白
        selected: 'bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary',
        // 区间两端加圆角；中段用浅底，和两端区分开。
        // rdp v10 不输出 data-range-* 属性，selected/range_middle 会同时挂在这个 cell 上，
        // 所以要靠 ! 强制覆盖 selected 的 bg-primary，否则会整段同色。
        range_start: 'rounded-l-md',
        range_end: 'rounded-r-md',
        range_middle:
          'bg-accent! [&>button]:text-accent-foreground! [&>button:hover]:bg-accent!',
        // today / outside 只在未选中时生效，否则会盖掉白字导致看不见
        today: '[&:not([data-selected])>button]:font-semibold [&:not([data-selected])>button]:text-primary',
        outside: '[&:not([data-selected])>button]:text-muted-foreground/40',
        disabled: 'opacity-40',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          ),
      }}
      {...props}
    />
  );
}
