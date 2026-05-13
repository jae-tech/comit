import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        default:     'bg-blue-700 text-blue-50 hover:bg-blue-800 rounded-md',
        outline:     'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 rounded-md',
        ghost:       'text-stone-500 hover:bg-stone-100 hover:text-stone-800 rounded-md',
        destructive: 'bg-red-600 text-white hover:bg-red-700 rounded-md',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:      'h-8 px-3 text-[13px]',
        lg:      'h-10 px-5',
        icon:    'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';
