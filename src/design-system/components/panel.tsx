import { View, type ViewProps } from 'react-native';

import { useTheme } from '../theme-provider';

export function Panel({ style, ...props }: ViewProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.panel,
          boxShadow: theme.shadows.panel,
          gap: theme.spacing.m,
          padding: theme.spacing.l,
        },
        style,
      ]}
      {...props}
    />
  );
}
