import { Text, View } from 'react-native';
import { StatusColor, StatusLabel } from '@/theme/colors';
import type { RoadStatus } from '@/models/types';

export function StatusBadge({ status, superseded }: { status: RoadStatus; superseded?: boolean }) {
  const color = superseded ? StatusColor.none : StatusColor[status];
  const label = superseded ? '반려 · 재촬영됨' : StatusLabel[status];
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: color + '22' }}>
      <Text style={{ fontSize: 12, color }}>{label}</Text>
    </View>
  );
}
