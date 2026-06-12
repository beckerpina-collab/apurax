import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'primary' | 'accent' | 'destructive';
}

const variants: Record<string, string> = {
  default: 'bg-card border',
  primary: 'bg-primary text-primary-foreground',
  accent: 'bg-accent text-accent-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
};

export default function StatCard({ title, value, subtitle, icon: Icon, variant = 'default' }: StatCardProps) {
  const isDefault = variant === 'default';
  return (
    <div className={cn('rounded-xl p-6 shadow-sm', variants[variant])}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className={cn('text-xs font-medium uppercase tracking-wider', isDefault ? 'text-muted-foreground' : 'opacity-80')}>
            {title}
          </p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className={cn('text-xs', isDefault ? 'text-muted-foreground' : 'opacity-70')}>{subtitle}</p>}
        </div>
        {Icon && (
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', isDefault ? 'bg-primary/10' : 'bg-white/15')}>
            <Icon className={cn('h-5 w-5', isDefault ? 'text-primary' : 'text-current')} />
          </div>
        )}
      </div>
    </div>
  );
}
