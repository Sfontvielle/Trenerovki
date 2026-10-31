import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { AppText, Button, Panel, Screen, useTheme } from '@/design-system';
import type { Meal } from '@/domains/nutrition/nutrition';
import { findFoodByBarcode } from '@/domains/nutrition/nutrition-repository';
import { lookupProduct } from '@/domains/nutrition/product-lookup';
import { t } from '@/lib/i18n';

const barcodeTypes = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

type Outcome = 'searching' | 'not_found' | 'incomplete' | 'offline' | 'failed';

const outcomeTexts: Record<Exclude<Outcome, 'searching'>, string> = {
  not_found: t('Этого штрихкода нет в открытой базе. Введите значения с упаковки.'),
  incomplete: t('В открытой базе нет полных данных о продукте. Введите значения с упаковки.'),
  offline: t('Не удалось связаться с базой. Проверьте интернет или введите значения вручную.'),
  failed: t('Не удалось прочитать штрихкод. Попробуйте ещё раз.'),
};

export default function ScanBarcodeScreen() {
  const { day, meal } = useLocalSearchParams<{ day: string; meal: Meal }>();
  const { database } = useAppData();
  const { theme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [barcode, setBarcode] = useState<string | null>(null);
  const handled = useRef(false);

  const openForm = (values: Record<string, string>) =>
    router.replace({ pathname: '/food/add', params: { day, meal, ...values } });

  const handleScan = async (data: string) => {
    if (handled.current) {
      return;
    }
    handled.current = true;
    setBarcode(data);
    setOutcome('searching');
    try {
      const known = await findFoodByBarcode(database, data);
      const result = known ? null : await lookupProduct(data);
      const found = known ?? (result?.status === 'found' ? result.product : null);
      if (found) {
        openForm({
          barcode: data,
          name: found.name,
          kcal: String(found.kcal),
          protein: String(found.protein),
          fat: String(found.fat),
          carbs: String(found.carbs),
        });
        return;
      }
      setOutcome(result?.status === 'found' || !result ? 'failed' : result.status);
    } catch (error) {
      console.error(error);
      setOutcome('failed');
    }
  };

  const retry = () => {
    handled.current = false;
    setBarcode(null);
    setOutcome(null);
  };

  if (Platform.OS === 'web') {
    return (
      <Screen scroll belowHeader>
        <Panel>
          <AppText tone="secondary">{t('Сканер штрихкодов работает на iPhone.')}</AppText>
        </Panel>
      </Screen>
    );
  }

  const manual = (
    <Button
      label={t('Ввести вручную')}
      variant="secondary"
      onPress={() => (barcode ? openForm({ barcode, name: '' }) : router.back())}
    />
  );

  return (
    <Screen scroll belowHeader>
      {!permission?.granted ? (
        <Panel>
          <AppText tone="secondary">
            {t('Камера нужна только для чтения штрихкода. Фото не сохраняются. Номер штрихкода отправляется в открытую базу Open Food Facts, больше никаких данных.')}
          </AppText>
          {permission && !permission.canAskAgain ? (
            <AppText tone="secondary">{t('Доступ к камере выключен. Его можно включить в настройках iPhone.')}</AppText>
          ) : (
            <Button label={t('Разрешить камеру')} onPress={requestPermission} />
          )}
          {manual}
        </Panel>
      ) : outcome === null || outcome === 'searching' ? (
        <>
          <View style={[styles.camera, { borderRadius: theme.radii.panel, height: theme.sizes.scannerHeight }]}>
            <CameraView
              barcodeScannerSettings={{ barcodeTypes: [...barcodeTypes] }}
              onBarcodeScanned={({ data }) => handleScan(data)}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <AppText accessibilityLiveRegion="polite" tone="secondary">
            {outcome === 'searching' ? t('Ищем продукт…') : t('Наведите камеру на штрихкод на упаковке.')}
          </AppText>
          {manual}
        </>
      ) : (
        <Panel>
          <AppText accessibilityLiveRegion="polite" tone="secondary">
            {outcomeTexts[outcome]}
          </AppText>
          <Button label={t('Сканировать ещё раз')} variant="secondary" onPress={retry} />
          {manual}
        </Panel>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: {
    overflow: 'hidden',
  },
});
