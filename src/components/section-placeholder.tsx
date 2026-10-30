import { AppText, Panel } from '@/design-system';

type SectionPlaceholderProps = {
  description: string;
};

export function SectionPlaceholder({ description }: SectionPlaceholderProps) {
  return (
    <Panel>
      <AppText variant="heading">Раздел в разработке</AppText>
      <AppText tone="secondary">{description}</AppText>
    </Panel>
  );
}
