import { Card, type CardRootProps } from 'heroui-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { cn } from './cn';

export interface SectionCardProps extends Omit<CardRootProps, 'children'> {
  /** Section title (h3). */
  title?: string;
  /** One muted line under the title. */
  description?: string;
  /** Trailing header content, e.g. a `LinkButton` "See All" or a status chip. */
  action?: ReactNode;
  /** Card footer content (actions). */
  footer?: ReactNode;
  children?: ReactNode;
}

/**
 * Section card recipe (04_mobile_specs §4.0; 01S §2.10): the kit `Card` at the design radius
 * (`rounded-xl`, 12 dp; the kit default of 24 dp is off the design scale) with an optional
 * header (title, description, action) and footer. Elevation 1 (bronze hairline and glow) comes
 * from the theme's `--surface-shadow`. The h3 size sits on an inner plain `Text` (D41(d)).
 */
export function SectionCard({ title, description, action, footer, children, className, ...cardProps }: SectionCardProps) {
  const hasHeader = Boolean(title || description || action);
  return (
    <Card {...cardProps} className={cn('rounded-xl', className)}>
      {hasHeader ? (
        <Card.Header className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            {title ? (
              <Card.Title className="text-foreground">
                <Text accessibilityRole="header" className="text-h3 font-semibold">
                  {title}
                </Text>
              </Card.Title>
            ) : null}
            {description ? <Card.Description>{description}</Card.Description> : null}
          </View>
          {action ? <View className="shrink-0">{action}</View> : null}
        </Card.Header>
      ) : null}
      {children !== undefined && children !== null ? <Card.Body className="gap-3">{children}</Card.Body> : null}
      {footer ? <Card.Footer className="gap-3">{footer}</Card.Footer> : null}
    </Card>
  );
}
