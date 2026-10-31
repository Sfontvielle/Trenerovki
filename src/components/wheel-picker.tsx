import { useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
} from 'react-native';

import { AppText, useTheme } from '@/design-system';

const VISIBLE_ROWS = 5;
const SETTLE_DELAY_MS = 140;

type WheelPickerProps = {
  label: string;
  values: number[];
  value: number | null;
  start: number;
  onChange: (value: number) => void;
};

export function WheelPicker({ label, values, value, start, onChange }: WheelPickerProps) {
  const { theme } = useTheme();
  const { colors, radii, sizes } = theme;
  const rowHeight = sizes.wheelRow;
  const scrollRef = useRef<ScrollViewInstance>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  const touched = useRef(false);
  const indexOf = (target: number | null) => Math.max(0, values.indexOf(target ?? start));
  const [shown, setShown] = useState(() => indexOf(value));

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(settleTimer.current);
    };
  }, []);

  useEffect(() => {
    const index = values.indexOf(value ?? Number.NaN);
    if (index >= 0) {
      scrollRef.current?.scrollTo({ y: index * rowHeight, animated: true });
    }
  }, [rowHeight, value, values]);

  const choose = (index: number) => {
    setShown(index);
    if (values[index] !== value) {
      onChange(values[index]);
    }
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / rowHeight);
    const clamped = Math.max(0, Math.min(values.length - 1, index));
    setShown(clamped);
    // The initial positioning also scrolls: only the person's own gesture is an answer.
    if (!touched.current) {
      return;
    }
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (mounted.current) {
        choose(clamped);
      }
    }, SETTLE_DELAY_MS);
  };

  return (
    <View
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      accessibilityLabel={label}
      accessibilityRole="adjustable"
      accessibilityValue={{ text: value === null ? 'не выбрано' : String(value) }}
      accessible
      onAccessibilityAction={(event) => {
        const delta = event.nativeEvent.actionName === 'increment' ? 1 : -1;
        choose(Math.max(0, Math.min(values.length - 1, shown + delta)));
      }}
      style={[styles.wheel, { height: rowHeight * VISIBLE_ROWS }]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.band,
          {
            backgroundColor: colors.accentSoft,
            borderRadius: radii.control,
            height: rowHeight,
            top: ((VISIBLE_ROWS - 1) / 2) * rowHeight,
          },
        ]}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingVertical: ((VISIBLE_ROWS - 1) / 2) * rowHeight }}
        decelerationRate="fast"
        nestedScrollEnabled
        onLayout={() => scrollRef.current?.scrollTo({ y: indexOf(value) * rowHeight, animated: false })}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          touched.current = true;
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToInterval={rowHeight}
      >
        {values.map((item, index) => {
          const distance = Math.abs(index - shown);
          return (
            <Pressable
              key={item}
              importantForAccessibility="no"
              onPress={() => choose(index)}
              style={[styles.row, { height: rowHeight, opacity: 1 - Math.min(distance, 2) * 0.35 }]}
            >
              <AppText variant={distance === 0 ? 'title' : 'heading'} tone={distance === 0 ? 'primary' : 'secondary'}>
                {item}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    left: 0,
    position: 'absolute',
    right: 0,
  },
  row: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheel: {
    alignSelf: 'center',
    overflow: 'hidden',
    width: 200,
  },
});
