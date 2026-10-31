import { useCallback, useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { ChoiceGroup } from '@/components/choice-group';
import { DataView } from '@/components/states';
import { AppText, Button, Panel, Screen, TextField } from '@/design-system';
import {
  type MemoryEntry,
  addMemory,
  deleteMemory,
  listFrequentlyRemoved,
  listMemory,
  updateMemory,
} from '@/domains/coach/coach-repository';
import { createId } from '@/domains/data-platform/ids';
import { exerciseName } from '@/domains/exercises/catalog';
import { type CoachDetail, useCoachStyle } from '@/features/coach/use-coach-style';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { t } from '@/lib/i18n';

const MAX_MEMORY_LENGTH = 200;
const REMOVED_TIMES = 2;

const detailChoices: { value: CoachDetail; label: string }[] = [
  { value: 'detailed', label: t('Подробно') },
  { value: 'brief', label: t('Кратко') },
];

type MemoryRowProps = {
  entry: MemoryEntry;
  onChanged: () => void;
  onError: (message: string) => void;
};

function MemoryRow({ entry, onChanged, onError }: MemoryRowProps) {
  const { database } = useAppData();
  const [text, setText] = useState(entry.text);
  const fact = entry.kind === 'fact';

  const run = async (action: () => Promise<void>, failure: string) => {
    try {
      await action();
      onChanged();
    } catch (cause) {
      console.error(cause);
      onError(`${failure} ${describeFailure(cause)}`);
    }
  };

  const remove = async () => {
    const approved = await confirm({
      title: t('Удалить запись?'),
      message: entry.text,
      confirmLabel: t('Удалить'),
      destructive: true,
    });
    if (approved) {
      await run(() => deleteMemory(database, entry.id), t('Запись не удалена.'));
    }
  };

  return (
    <Panel>
      {fact ? (
        <TextField label={t('Запись')} maxLength={MAX_MEMORY_LENGTH} onChangeText={setText} value={text} />
      ) : (
        <AppText>{entry.text}</AppText>
      )}
      {fact && text.trim() && text !== entry.text ? (
        <Button
          label={t('Сохранить')}
          variant="secondary"
          onPress={() => run(() => updateMemory(database, entry.id, text, new Date()), t('Запись не сохранена.'))}
        />
      ) : null}
      <Button accessibilityLabel={t('Удалить: {0}', { 0: entry.text })} label={t('Удалить')} variant="secondary" onPress={remove} />
    </Panel>
  );
}

export default function CoachMemoryScreen() {
  const { database } = useAppData();
  const { detail, changeDetail } = useCoachStyle();
  const [newFact, setNewFact] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [entries, removed] = await Promise.all([
      listMemory(database),
      listFrequentlyRemoved(database, REMOVED_TIMES),
    ]);
    const avoided = entries.map(({ exerciseId }) => exerciseId);
    return { entries, observed: removed.filter((exerciseId) => !avoided.includes(exerciseId)) };
  }, [database]);
  const state = useScreenData(load);

  const add = async (entry: Pick<MemoryEntry, 'kind' | 'text' | 'exerciseId'>) => {
    setError(null);
    try {
      await addMemory(database, { ...entry, id: createId() }, new Date());
      setNewFact('');
      state.reload();
    } catch (cause) {
      console.error(cause);
      setError(t('Запись не сохранена. {0}', { 0: describeFailure(cause) }));
    }
  };

  return (
    <Screen scroll belowHeader>
      <AppText tone="secondary">
        {t('Здесь только то, что вы подтвердили сами. Записи хранятся на этом iPhone, попадают в резервную копию и не меняют историю тренировок.')}
      </AppText>

      <ChoiceGroup
        choices={detailChoices}
        isSelected={(value) => detail === value}
        label={t('Как подробно объяснять')}
        onSelect={(value) => {
          changeDetail(value).catch(console.error);
        }}
      />

      <DataView state={state}>
        {({ entries, observed }) => (
          <>
            {error ? (
              <AppText accessibilityLiveRegion="polite" tone="danger">
                {error}
              </AppText>
            ) : null}

            {observed.length > 0 ? (
              <>
                <AppText accessibilityRole="header" variant="heading">
                  {t('Наблюдения, не подтверждены')}
                </AppText>
                {observed.map((exerciseId) => (
                  <Panel key={exerciseId}>
                    <AppText>{t('Вы несколько раз убирали из тренировки: {0}.', { 0: exerciseName(exerciseId) })}</AppText>
                    <Button
                      accessibilityLabel={t('Не предлагать: {0}', { 0: exerciseName(exerciseId) })}
                      label={t('Не предлагать это упражнение')}
                      variant="secondary"
                      onPress={() =>
                        add({ kind: 'avoid_exercise', text: t('Не предлагать: {0}', { 0: exerciseName(exerciseId) }), exerciseId })
                      }
                    />
                  </Panel>
                ))}
              </>
            ) : null}

            <AppText accessibilityRole="header" variant="heading">
              {t('Подтверждённые записи')}
            </AppText>
            {entries.length === 0 ? <AppText tone="secondary">{t('Записей пока нет.')}</AppText> : null}
            {entries.map((entry) => (
              <MemoryRow
                key={`${entry.id}-${entry.updatedAt}`}
                entry={entry}
                onChanged={state.reload}
                onError={setError}
              />
            ))}

            <TextField
              hint={t('Например: тренируюсь по утрам, не люблю бег')}
              label={t('Новая запись')}
              maxLength={MAX_MEMORY_LENGTH}
              onChangeText={setNewFact}
              value={newFact}
            />
            <Button
              disabled={!newFact.trim()}
              label={t('Добавить запись')}
              variant="secondary"
              onPress={() => add({ kind: 'fact', text: newFact, exerciseId: null })}
            />
          </>
        )}
      </DataView>
    </Screen>
  );
}
