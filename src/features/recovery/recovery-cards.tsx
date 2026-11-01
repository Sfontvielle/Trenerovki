import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText, Button, ListGroup, ListRow, useTheme } from '@/design-system';
import type { Checkin, Readiness, ReadinessLevel } from '@/domains/recovery/recovery';
import type { StepsState } from '@/features/recovery/use-steps';
import { formatNumber } from '@/lib/format';
import { t } from '@/lib/i18n';

const SEVERE_SORENESS = 5;

export const readinessLabels: Record<ReadinessLevel, string> = {
  high: t('Высокая'),
  medium: t('Средняя'),
  low: t('Низкая'),
};

const readinessAdvice: Record<ReadinessLevel, string> = {
  high: t('Можно тренироваться по плану.'),
  medium: t('Ориентируйтесь на самочувствие и не спешите с прибавкой веса.'),
  low: t('Подумайте о более лёгкой тренировке или дне отдыха.'),
};

type StepsNoteProps = {
  state: StepsState;
  onRequestAccess: () => void;
};

// Explains an empty step count. A working one needs no words.
export function StepsNote({ state, onRequestAccess }: StepsNoteProps) {
  if (state.status === 'needs_permission') {
    return (
      <View>
        <AppText variant="caption" tone="secondary">
          {t('Шаги считает сам iPhone. Данные остаются на устройстве.')}
        </AppText>
        <Button label={t('Разрешить доступ к шагам')} variant="plain" onPress={onRequestAccess} />
      </View>
    );
  }
  if (state.status === 'denied') {
    return (
      <AppText variant="caption" tone="secondary">
        {t('Доступ к движению выключен. Его можно включить в настройках iPhone.')}
      </AppText>
    );
  }
  return null;
}

type RecoveryCardProps = {
  checkin: Checkin | null;
  readiness: Readiness | null;
};

export function RecoveryCard({ checkin, readiness }: RecoveryCardProps) {
  const { theme } = useTheme();
  const slept = checkin?.sleepHours ?? null;
  const notes = [
    readiness?.reasons.length ? t('Причины: {0}.', { 0: readiness.reasons.join(', ') }) : null,
    readiness ? t('Ориентир по вашим отметкам ({0}). Это не оценка здоровья.', { 0: readiness.sources.join(', ') }) : null,
    !readiness && checkin ? t('Для оценки готовности укажите сон и энергию или мышечную боль.') : null,
    !readiness && !checkin ? t('Сегодня отметок нет. Оценка появится после отметки сна и самочувствия.') : null,
  ].filter((note) => note !== null);

  return (
    <View style={{ gap: theme.spacing.s }}>
      <ListGroup title={t('Сон и восстановление')} footer={notes.join(' ')}>
        {readiness ? (
          <ListRow
            icon={{ name: 'bolt.heart', glyph: '♥', color: theme.colors.accent }}
            subtitle={readinessAdvice[readiness.level]}
            title={t('Готовность')}
            value={readinessLabels[readiness.level]}
          />
        ) : null}
        {slept !== null ? (
          <ListRow
            icon={{ name: 'moon.zzz', glyph: '☾', color: theme.colors.accent }}
            title={t('Сон')}
            value={t('{0} ч', { 0: formatNumber(slept) })}
          />
        ) : null}
        <ListRow
          accessibilityLabel={checkin ? t('Изменить отметку') : t('Отметить сон и самочувствие')}
          onPress={() => router.push('/check-in')}
          title={checkin ? t('Изменить отметку') : t('Отметить сон и самочувствие')}
          tone="accent"
        />
      </ListGroup>
      {readiness && checkin?.soreness === SEVERE_SORENESS ? (
        <AppText variant="callout" tone="warning">
          {t('Если сильная мышечная боль не проходит несколько дней, появились отёк или тёмная моча, обратитесь к врачу.')}
        </AppText>
      ) : null}
    </View>
  );
}
