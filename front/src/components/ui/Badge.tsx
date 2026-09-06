import { cn } from '../../utils/cn'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'draft' | 'published' | 'active' | 'inactive' | 'default'
}

const variants = {
  draft: 'bg-amber-100 text-amber-800',
  published: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-600',
  default: 'bg-gray-100 text-gray-700',
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
      )}
    >
      {children}
    </span>
  )
}
