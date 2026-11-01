import { Children, type PropsWithChildren, type ReactNode, isValidElement } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme-provider';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

type ListGroupProps = PropsWithChildren<{
  title?: string;
  footer?: string;
}>;

// The iOS inset group: rows share one surface, divided by hairlines.
export function ListGroup({ title, footer, children }: ListGroupProps) {
  const { theme } = useTheme();
  const { colors, radii, sizes, spacing } = theme;
  const rows = Children.toArray(children).filter((child) => isValidElement(child));

  return (
    <View style={{ gap: spacing.s }}>
      {title ? (
        <AppText accessibilityRole="header" variant="heading" style={{ paddingHorizontal: spacing.xs }}>
          {title}
        </AppText>
      ) : null}
      {rows.length > 0 ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: radii.panel, overflow: 'hidden' }}>
          {rows.map((row, index) => (
            <View
              key={(isValidElement(row) && row.key) || index}
              style={
                index > 0
                  ? { borderTopColor: colors.hairline, borderTopWidth: sizes.hairline, marginLeft: spacing.l }
                  : undefined
              }
            >
              {row}
            </View>
          ))}
        </View>
      ) : null}
      {footer ? (
        <AppText variant="caption" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

type ListRowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: { name: IconName; glyph: string; color?: string };
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  tone?: 'primary' | 'accent' | 'danger';
};

export function ListRow({
  title,
  subtitle,
  value,
  icon,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  tone = 'primary',
}: ListRowProps) {
  const { theme } = useTheme();
  const { sizes, spacing } = theme;

  const content = (
    <View
      style={[
        styles.row,
        { gap: spacing.m, minHeight: sizes.rowMinHeight, paddingLeft: spacing.l, paddingRight: spacing.m, paddingVertical: spacing.s },
      ]}
    >
      {icon ? <Icon color={icon.color} glyph={icon.glyph} name={icon.name} /> : null}
      {leading}
      <View style={styles.text}>
        <AppText tone={tone}>{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="callout" tone="secondary">
          {value}
        </AppText>
      ) : null}
      {trailing}
      {onPress && !trailing ? (
        <Icon glyph="›" name="chevron.right" size={sizes.chevron} color={theme.colors.textSecondary} />
      ) : null}
    </View>
  );

  if (!onPress) {
    return content;
  }
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.surfaceRaised : 'transparent' })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  text: {
    flex: 1,
  },
});
