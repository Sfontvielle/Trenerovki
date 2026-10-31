import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { useToday } from '@/app-data/use-today';
import { ChoiceGroup } from '@/components/choice-group';
import { DataView } from '@/components/states';
import { AppText, Button, Screen, TextField } from '@/design-system';
import { type Checkin, MAX_SLEEP_HOURS, type Rating, isValidSleep } from '@/domains/recovery/recovery';
import { getCheckin, saveCheckin } from '@/domains/recovery/recovery-repository';
import { describeFailure } from '@/lib/describe-failure';
import { formatInputNumber, parseDecimal } from '@/lib/format';

const ratings: Rating[] = [1, 2, 3, 4, 5];

type CheckinFormProps = {
  day: string;
  initial: Checkin | null;
};

function CheckinForm({ day, initial }: CheckinFormProps) {
  const { database } = useAppData();
  const [sleepText, setSleepText] = useState(formatInputNumber(initial?.sleepHours));
  const [sleepQuality, setSleepQuality] = useState<Rating | null>(initial?.sleepQuality ?? null);
  const [energy, setEnergy] = useState<Rating | null>(initial?.energy ?? null);
  const [soreness, setSoreness] = useState<Rating | null>(initial?.soreness ?? null);
  const [stress, setStress] = useState<Rating | null>(initial?.stress ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scale = (label: string, value: Rating | null, onSelect: (rating: Rating | null) => void) => (
    <ChoiceGroup
      choices={ratings.map((rating) => ({ value: rating, label: String(rating) }))}
      isSelected={(rating) => value === rating}
      label={label}
      onSelect={(rating) => onSelect(value === rating ? null : rating)}
    />
  );

  const save = async () => {
    const sleepHours = parseDecimal(sleepText);
    if (!isValidSleep(sleepHours)) {
      setError(`Укажите сон числом от 0 до ${MAX_SLEEP_HOURS} часов.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveCheckin(
        database,
        { day, sleepHours, sleepQuality, energy, soreness, stress, note: note.trim() || null },
        new Date(),
      );
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(`Отметка не сохранена. ${describeFailure(cause)}`);
      setSaving(false);
    }
  };

  return (
    <>
      <AppText tone="secondary">
        Все поля необязательны. Отметки видны только вам и помогают Coach учитывать восстановление.
      </AppText>
      <TextField keyboardType="decimal-pad" label="Сон, часов" onChangeText={setSleepText} value={sleepText} />
      {scale('Качество сна, 1 плохо, 5 отлично', sleepQuality, setSleepQuality)}
      {scale('Энергия, 1 мало, 5 много', energy, setEnergy)}
      {scale('Мышечная боль, 1 нет, 5 сильная', soreness, setSoreness)}
      {scale('Стресс, 1 низкий, 5 высокий', stress, setStress)}
      <TextField label="Заметка" maxLength={200} onChangeText={setNote} value={note} />
      {error ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {error}
        </AppText>
      ) : null}
      <Button label="Сохранить отметку" loading={saving} onPress={save} />
    </>
  );
}

export default function CheckinScreen() {
  const { database } = useAppData();
  const today = useToday();
  const load = useCallback(() => getCheckin(database, today), [database, today]);
  const state = useScreenData(load);

  return (
    <Screen scroll belowHeader>
      <DataView state={state}>{(initial) => <CheckinForm key={today} day={today} initial={initial} />}</DataView>
    </Screen>
  );
}
