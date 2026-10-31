import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { AppText, Panel, Screen, useTheme } from '@/design-system';
import { t } from '@/lib/i18n';

const MARK_SIZE = 96;

export default function AboutScreen() {
  const { theme } = useTheme();

  return (
    <Screen scroll belowHeader>
      <View style={[styles.center, { gap: theme.spacing.s }]}>
        <BrandMark animated={false} size={MARK_SIZE} wordmark />
        <AppText variant="callout" tone="secondary">
          {t('Версия {0}', { 0: Constants.expoConfig?.version ?? '1.0.0' })}
        </AppText>
      </View>

      <Panel>
        <AppText variant="heading">{t('Здоровье и безопасность')}</AppText>
        <AppText tone="secondary">
          {t('IRONVANT — приложение для фитнеса и самоконтроля. Оно не диагностирует, не лечит и не заменяет врача или тренера. Планы, цели питания и оценка готовности рассчитываются правилами и не проверены специалистом.')}
        </AppText>
        <AppText tone="secondary">
          {t('При боли прекратите упражнение. При боли в груди, сильной одышке, головокружении или слабости остановите тренировку и обратитесь за неотложной помощью.')}
        </AppText>
      </Panel>

      <Panel>
        <AppText variant="heading">{t('Конфиденциальность')}</AppText>
        <AppText tone="secondary">
          {t('Ваши данные хранятся на этом iPhone. У приложения нет аккаунтов, рекламы и аналитики. Шаги читаются только с вашего разрешения и остаются на устройстве. Камера используется только для штрихкодов, снимки не сохраняются.')}
        </AppText>
        <AppText tone="secondary">
          {t('При сканировании номер штрихкода отправляется в открытую базу Open Food Facts. Как при любом запросе в интернете, сервер видит IP-адрес устройства. Других данных приложение не отправляет. Если включено резервное копирование iPhone, данные приложения попадают в него. Свои копии данных вы создаёте сами, а перед обновлением приложения на iPhone сохраняется локальная копия. Удалить всё можно в профиле.')}
        </AppText>
      </Panel>

      <Panel>
        <AppText variant="heading">{t('Источники данных')}</AppText>
        <AppText tone="secondary">
          {t('Данные о продуктах по штрихкоду: Open Food Facts, лицензия Open Database License. Значения в базе продуктов типовые и составлены вручную. Памятки по технике и схема мышц созданы для этого приложения и пока не проверены специалистом. Оценка калорий: формула Миффлина — Сан Жеора.')}
        </AppText>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
});
