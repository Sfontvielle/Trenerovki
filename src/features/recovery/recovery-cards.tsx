import { router } from 'expo-router';

import { AppText, Button, Panel } from '@/design-system';
import type { Checkin, Readiness, ReadinessLevel } from '@/domains/recovery/recovery';
import type { StepsState } from '@/features/recovery/use-steps';
import { formatNumber } from '@/lib/format';
import { t } from '@/lib/i18n';

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

type StepsCardProps = {
  state: StepsState;
  onRequestAccess: () => void;
};

export function StepsCard({ state, onRequestAccess }: StepsCardProps) {
  return (
    <Panel>
      <AppText variant="heading">{t('Шаги')}</AppText>
      {state.status === 'ready' ? (
        <AppText tone="secondary">{t('Сегодня: {0}', { 0: formatNumber(state.today) })}</AppText>
      ) : null}
      {state.status === 'loading' ? <AppText tone="secondary">{t('Читаем данные iPhone…')}</AppText> : null}
      {state.status === 'unavailable' ? (
        <AppText tone="secondary">{t('Шаги недоступны на этом устройстве.')}</AppText>
      ) : null}
      {state.status === 'denied' ? (
        <AppText tone="secondary">{t('Доступ к движению выключен. Его можно включить в настройках iPhone.')}</AppText>
      ) : null}
      {state.status === 'needs_permission' ? (
        <>
          <AppText tone="secondary">{t('Шаги считает сам iPhone. Данные остаются на устройстве.')}</AppText>
          <Button label={t('Разрешить доступ к шагам')} variant="secondary" onPress={onRequestAccess} />
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
      <AppText variant="heading">{t('Сон и восстановление')}</AppText>
      {checkin?.sleepHours !== null && checkin?.sleepHours !== undefined ? (
        <AppText tone="secondary">{t('Сон: {0} ч', { 0: formatNumber(checkin.sleepHours) })}</AppText>
      ) : null}
      {readiness ? (
        <>
          <AppText tone="secondary">{t('Готовность: {0}', { 0: readinessLabels[readiness.level].toLowerCase() })}</AppText>
          <AppText variant="callout" tone="secondary">
            {readinessAdvice[readiness.level]}
          </AppText>
          {readiness.reasons.length > 0 ? (
            <AppText variant="callout" tone="secondary">
              {t('Причины: {0}.', { 0: readiness.reasons.join(', ') })}
            </AppText>
          ) : null}
          <AppText variant="caption" tone="secondary">
            {t('Ориентир по вашим отметкам ({0}). Это не оценка здоровья.', { 0: readiness.sources.join(', ') })}
          </AppText>
        </>
      ) : (
        <AppText tone="secondary">
          {checkin
            ? t('Для оценки готовности укажите сон и энергию или мышечную боль.')
            : t('Сегодня отметок нет. Оценка появится после отметки сна и самочувствия.')}
        </AppText>
      )}
      <Button
        label={checkin ? t('Изменить отметку') : t('Отметить сон и самочувствие')}
        variant="secondary"
        onPress={() => router.push('/check-in')}
      />
    </Panel>
  );
}
