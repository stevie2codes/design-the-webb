import type { ReactNode } from 'react';

export interface ChipProps {
  children: ReactNode;
  /** Render as a list item inside a <ul> of tags. */
  as?: 'span' | 'li';
  className?: string;
}

/** Tag chip: .t-label ink-2, 1px line border, pill (SPEC §5 C3). */
export default function Chip({ children, as: Tag = 'span', className }: ChipProps) {
  return <Tag className={className ? `chip ${className}` : 'chip'}>{children}</Tag>;
}
