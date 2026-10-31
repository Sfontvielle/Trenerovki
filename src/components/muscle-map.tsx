import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText, useTheme } from '@/design-system';
import type { Muscle } from '@/domains/exercises/catalog';

type Region = {
  muscle: Muscle;
  d: string;
};

// A schematic figure drawn for this app, not an anatomical illustration.
const frontRegions: Region[] = [
  { muscle: 'front_delts', d: 'M32 36 q-8 3 -9 15 l9 2 q3 -9 7 -13 z M68 36 q8 3 9 15 l-9 2 q-3 -9 -7 -13 z' },
  { muscle: 'side_delts', d: 'M23 51 q-3 6 -2 11 l6 1 l3 -10 z M77 51 q3 6 2 11 l-6 1 l-3 -10 z' },
  { muscle: 'chest', d: 'M36 40 q13 -4 13 0 v19 q-11 4 -18 -2 q0 -11 5 -17 z M64 40 q-13 -4 -13 0 v19 q11 4 18 -2 q0 -11 -5 -17 z' },
  { muscle: 'biceps', d: 'M22 64 l7 1 l-1 19 l-7 -1 z M78 64 l-7 1 l1 19 l7 -1 z' },
  { muscle: 'forearms', d: 'M20 85 l7 1 l-3 25 l-6 -1 z M80 85 l-7 1 l3 25 l6 -1 z' },
  { muscle: 'abs', d: 'M42 62 h16 v34 q-8 6 -16 0 z' },
  { muscle: 'obliques', d: 'M33 62 l7 1 v32 l-6 -5 q-2 -14 -1 -28 z M67 62 l-7 1 v32 l6 -5 q2 -14 1 -28 z' },
  { muscle: 'quads', d: 'M34 102 l14 5 l-2 41 l-10 0 q-4 -22 -2 -46 z M66 102 l-14 5 l2 41 l10 0 q4 -22 2 -46 z' },
  { muscle: 'calves', d: 'M37 155 l8 0 l-1 34 l-5 0 z M63 155 l-8 0 l1 34 l5 0 z' },
];

const backRegions: Region[] = [
  { muscle: 'traps', d: 'M42 28 h16 l8 10 l-16 22 l-16 -22 z' },
  { muscle: 'rear_delts', d: 'M31 37 q-8 3 -9 14 l10 2 q2 -8 5 -12 z M69 37 q8 3 9 14 l-10 2 q-2 -8 -5 -12 z' },
  { muscle: 'side_delts', d: 'M22 52 q-2 5 -1 10 l6 1 l3 -9 z M78 52 q2 5 1 10 l-6 1 l-3 -9 z' },
  { muscle: 'upper_back', d: 'M36 45 l12 16 v5 l-14 -4 q0 -10 2 -17 z M64 45 l-12 16 v5 l14 -4 q0 -10 -2 -17 z' },
  { muscle: 'lats', d: 'M34 64 l14 4 v18 l-12 -4 q-3 -9 -2 -18 z M66 64 l-14 4 v18 l12 -4 q3 -9 2 -18 z' },
  { muscle: 'lower_back', d: 'M38 85 l24 0 l-2 13 h-20 z' },
  { muscle: 'triceps', d: 'M22 64 l7 1 l-1 19 l-7 -1 z M78 64 l-7 1 l1 19 l7 -1 z' },
  { muscle: 'forearms', d: 'M20 85 l7 1 l-3 25 l-6 -1 z M80 85 l-7 1 l3 25 l6 -1 z' },
  { muscle: 'glutes', d: 'M36 100 h13 v18 q-8 4 -15 -2 q0 -9 2 -16 z M64 100 h-13 v18 q8 4 15 -2 q0 -9 -2 -16 z' },
  { muscle: 'hamstrings', d: 'M35 120 l13 2 l-2 28 l-10 0 q-2 -15 -1 -30 z M65 120 l-13 2 l2 28 l10 0 q2 -15 1 -30 z' },
  { muscle: 'calves', d: 'M36 155 l10 0 l-2 34 l-6 0 z M64 155 l-10 0 l2 34 l6 0 z' },
];

const FIGURE_WIDTH = 100;
const FIGURE_HEIGHT = 200;
const SECONDARY_OPACITY = 0.45;

type MuscleMapProps = {
  primary: Muscle[];
  secondary: Muscle[];
  summary: string;
};

export function MuscleMap({ primary, secondary, summary }: MuscleMapProps) {
  const { theme } = useTheme();
  const { colors, spacing } = theme;

  const figure = (title: string, regions: Region[]) => (
    <View style={{ alignItems: 'center', flex: 1, gap: spacing.xs }}>
      <Svg height={FIGURE_HEIGHT * 1.1} viewBox={`0 0 ${FIGURE_WIDTH} ${FIGURE_HEIGHT}`} width="100%">
        <Circle cx={50} cy={16} fill={colors.border} r={11} />
        {regions.map(({ muscle, d }) => {
          const main = primary.includes(muscle);
          const helping = secondary.includes(muscle);
          return (
            <Path
              key={muscle}
              d={d}
              fill={main || helping ? colors.accent : colors.border}
              opacity={helping && !main ? SECONDARY_OPACITY : 1}
            />
          );
        })}
      </Svg>
      <AppText variant="caption" tone="secondary">
        {title}
      </AppText>
    </View>
  );

  return (
    <View accessibilityLabel={summary} accessibilityRole="image" accessible style={{ flexDirection: 'row', gap: spacing.m }}>
      {figure('Спереди', frontRegions)}
      {figure('Сзади', backRegions)}
    </View>
  );
}
