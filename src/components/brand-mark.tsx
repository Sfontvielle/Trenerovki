import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

import { AppText, useTheme } from '@/design-system';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// The neural shield: a faceted shield around a glowing core, joined by three
// lines that read as circuits or as an upward arrow. The same paths draw the icon.
export const SHIELD_PATH = 'M60 6 L108 24 V64 C108 92 86 108 60 116 C34 108 12 92 12 64 V24 Z';
export const NERVE_PATHS = ['M60 44 V20', 'M42 72 L24 86', 'M78 72 L96 86'];
const SHIELD_LENGTH = 330;
const NERVE_LENGTH = 34;
const CORE_RADIUS = 15;
const GLOW_RADIUS = 34;
const VIEW_BOX = 120;
const LETTER_SPACING = 6;

type BrandMarkProps = {
  size: number;
  animated?: boolean;
  wordmark?: boolean;
};

// Energy Genesis: an impulse lights the core, runs along the nerves, draws the
// shield and finally reveals the name. With Reduce Motion it is simply there.
export function BrandMark({ size, animated = true, wordmark = false }: BrandMarkProps) {
  const { theme } = useTheme();
  const { colors, motion, spacing } = theme;
  const still = !animated || motion.slow === 0;
  const [progress] = useState(() => new Animated.Value(still ? 1 : 0));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (still) {
      progress.setValue(1);
      return;
    }
    const genesis = Animated.timing(progress, {
      toValue: 1,
      duration: motion.slow * 4,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: motion.slow * 3, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: motion.slow * 3, useNativeDriver: true }),
      ]),
    );
    genesis.start(({ finished }) => {
      if (finished) {
        breathing.start();
      }
    });
    return () => {
      genesis.stop();
      breathing.stop();
    };
  }, [motion.slow, progress, pulse, still]);

  const shieldOffset = progress.interpolate({ inputRange: [0.25, 1], outputRange: [SHIELD_LENGTH, 0], extrapolate: 'clamp' });
  const nerveOffset = progress.interpolate({ inputRange: [0, 0.45], outputRange: [NERVE_LENGTH, 0], extrapolate: 'clamp' });
  const nameOpacity = progress.interpolate({ inputRange: [0.7, 1], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View
      accessibilityElementsHidden={!wordmark}
      importantForAccessibility={wordmark ? 'auto' : 'no-hide-descendants'}
      style={[styles.center, { gap: spacing.l }]}
    >
      <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }] }}>
        <Svg height={size} viewBox={`0 0 ${VIEW_BOX} ${VIEW_BOX}`} width={size}>
          <Defs>
            <RadialGradient cx="50%" cy="50%" id="core-glow" r="50%">
              <Stop offset="0" stopColor={colors.accent} stopOpacity="0.55" />
              <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={60} cy={60} fill="url(#core-glow)" r={GLOW_RADIUS} />
          <AnimatedPath
            d={SHIELD_PATH}
            fill="none"
            stroke={colors.accent}
            strokeDasharray={SHIELD_LENGTH}
            strokeDashoffset={shieldOffset}
            strokeLinejoin="round"
            strokeWidth={4}
          />
          <G>
            {NERVE_PATHS.map((d) => (
              <AnimatedPath
                key={d}
                d={d}
                stroke={colors.accent}
                strokeDasharray={NERVE_LENGTH}
                strokeDashoffset={nerveOffset}
                strokeLinecap="round"
                strokeWidth={3}
              />
            ))}
          </G>
          <Circle cx={60} cy={60} fill={colors.accent} r={CORE_RADIUS} />
        </Svg>
      </Animated.View>
      {wordmark ? (
        <Animated.View style={{ opacity: nameOpacity }}>
          <AppText accessibilityRole="header" variant="display" style={{ letterSpacing: LETTER_SPACING }}>
            IRONVANT
          </AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
});
