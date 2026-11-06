import { ListGroup, Separator, type ListGroupRootProps } from 'heroui-native';
import { Fragment, type ReactNode } from 'react';
import { Text } from 'react-native';
import { cn } from './cn';

export interface KeyValueItem {
  /** Stable React key. */
  id: string;
  label: string;
  /** Text renders right-aligned; any other node renders as is (a chip, a copy button). */
  value: ReactNode;
  /**
   * Fix wave J round two (JA2-17): what a screen reader says for a value that is a NODE (a chip, a spinner).
   * With it the row is one unit "label, spoken" in every state. Without it a row whose value changes from
   * text to a node kept the accessible name of its text state on Android (the recovery rows were announced
   * "..., Waiting" while they showed INTACT).
   */
  spokenValue?: string;
  /** Monospace value (IDs, hashes, timestamps; 01S §2.7 `data`). */
  mono?: boolean;
  testID?: string;
}

export interface KeyValueListProps extends Omit<ListGroupRootProps, 'children'> {
  items: readonly KeyValueItem[];
  /** Hairline separators between rows (the MB 6 look). Default true. */
  separators?: boolean;
}

/**
 * Key-value list recipe (04_mobile_specs §4.0; MB 6 detail rows): a kit `ListGroup`, one row per
 * item, muted label on the left and the value on the right. A text row reads as one unit to
 * TalkBack ("label, value"). The typography tokens sit on plain `Text` (D41(d)).
 */
export function KeyValueList({ items, separators = true, className, variant = 'transparent', ...listProps }: KeyValueListProps) {
  return (
    <ListGroup {...listProps} variant={variant} className={cn('rounded-xl', className)}>
      {items.map((item, index) => {
        const isText = typeof item.value === 'string' || typeof item.value === 'number';
        const spoken = isText ? String(item.value) : item.spokenValue;
        return (
          <Fragment key={item.id}>
            {separators && index > 0 ? <Separator /> : null}
            <ListGroup.Item
              testID={item.testID}
              accessible={spoken !== undefined}
              accessibilityLabel={spoken !== undefined ? `${item.label}, ${spoken}` : undefined}
              className="gap-3"
            >
              <ListGroup.ItemContent>
                <Text className="text-body text-muted">{item.label}</Text>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix className="max-w-[60%] items-end">
                {isText ? (
                  <Text
                    selectable={item.mono}
                    className={item.mono ? 'font-mono text-data text-foreground' : 'text-body text-foreground'}
                  >
                    {item.value}
                  </Text>
                ) : (
                  item.value
                )}
              </ListGroup.ItemSuffix>
            </ListGroup.Item>
          </Fragment>
        );
      })}
    </ListGroup>
  );
}
