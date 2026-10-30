import { SectionPlaceholder } from '@/components/section-placeholder';
import { TabScreen } from '@/components/tab-screen';

export default function CoachScreen() {
  return (
    <TabScreen title="Coach">
      <SectionPlaceholder description="Здесь будут чат и предложения Coach. Любые изменения плана вы будете подтверждать сами." />
    </TabScreen>
  );
}
