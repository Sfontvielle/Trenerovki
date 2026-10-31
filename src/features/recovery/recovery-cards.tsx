import { router } from 'expo-router';

import { AppText, Button, Panel } from '@/design-system';
import type { Checkin, Readiness, ReadinessLevel } from '@/domains/recovery/recovery';
import type { StepsState } from '@/features/recovery/use-steps';
import { formatNumber } from '@/lib/format';

export const readinessLabels: Record<ReadinessLevel, string> = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
};

const readinessAdvice: Record<ReadinessLevel, string> = {
  high: 'Можно тренироваться по плану.',
  medium: 'Ориентируйтесь на самочувствие и не спешите с прибавкой веса.',
  low: 'Подумайте о более лёгкой тренировке или дне отдыха.',
};

type StepsCardProps = {
  state: StepsState;
  onRequestAccess: () => void;
};

export function StepsCard({ state, onRequestAccess }: StepsCardProps) {
  return (
    <Panel>
      <AppText variant="heading">Шаги</AppText>
      {state.status === 'ready' ? (
        <AppText tone="secondary">{`Сегодня: ${formatNumber(state.today)}`}</AppText>
      ) : null}
      {state.status === 'loading' ? <AppText tone="secondary">Читаем данные iPhone…</AppText> : null}
      {state.status === 'unavailable' ? (
        <AppText tone="secondary">Шаги недоступны на этом устройстве.</AppText>
      ) : null}
      {state.status === 'denied' ? (
        <AppText tone="secondary">Доступ к движению выключен. Его можно включить в настройках iPhone.</AppText>
      ) : null}
      {state.status === 'needs_permission' ? (
        <>
          <AppText tone="secondary">Шаги считает сам iPhone. Данные остаются на устройстве.</AppText>
          <Button label="Разрешить доступ к шагам" variant="secondary" onPress={onRequestAccess} />
        </>
      ) : null}
    </Panel>
  );
}

type RecoveryCardProps = {
  checkin: Checkin | null;
  readiness: Readiness | null;
};

export function RecoveryCard({ checkin, readiness }: RecoveryCardProps) {
  return (
    <Panel>
      <AppText variant="heading">Сон и восстановление</AppText>
      {checkin?.sleepHours !== null && checkin?.sleepHours !== undefined ? (
        <AppText tone="secondary">{`Сон: ${formatNumber(checkin.sleepHours)} ч`}</AppText>
      ) : null}
      {readiness ? (
        <>
          <AppText tone="secondary">{`Готовность: ${readinessLabels[readiness.level].toLowerCase()}`}</AppText>
          <AppText variant="callout" tone="secondary">
            {readinessAdvice[readiness.level]}
          </AppText>
          {readiness.reasons.length > 0 ? (
            <AppText variant="callout" tone="secondary">
              {`Причины: ${readiness.reasons.join(', ')}.`}
            </AppText>
          ) : null}
          <AppText variant="caption" tone="secondary">
            {`Ориентир по вашим отметкам (${readiness.sources.join(', ')}). Это не оценка здоровья.`}
          </AppText>
        </>
      ) : (
        <AppText tone="secondary">
          {checkin
            ? 'Для оценки готовности укажите сон и энергию или мышечную боль.'
            : 'Сегодня отметок нет. Оценка появится после отметки сна и самочувствия.'}
        </AppText>
      )}
      <Button
        label={checkin ? 'Изменить отметку' : 'Отметить сон и самочувствие'}
        variant="secondary"
        onPress={() => router.push('/check-in')}
      />
    </Panel>
  );
}
