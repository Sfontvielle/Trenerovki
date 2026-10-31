import { type PropsWithChildren, useEffect, useState } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/design-system';

const RISE_PX = 14;

type FadeInProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function FadeIn({ children, style }: FadeInProps) {
  const { theme } = useTheme();
  const duration = theme.motion.slow;
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (duration === 0) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [duration, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [RISE_PX, 0] }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
