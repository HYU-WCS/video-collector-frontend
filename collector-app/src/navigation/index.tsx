import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeView } from '@/views/HomeView';
import { LoginView } from '@/views/LoginView';
import { RecordView } from '@/views/RecordView';
import { CoverageMapView } from '@/views/MapView';
import { AlbumView } from '@/views/AlbumView';
import { VideoDetailView } from '@/views/VideoDetailView';
import { UploadQueueView } from '@/views/UploadQueueView';
import { SettingsView } from '@/views/SettingsView';

const Stack = createNativeStackNavigator();

export function Navigation({ signedIn }: { signedIn: boolean }) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!signedIn ? (
          <Stack.Screen name="Login" component={LoginView} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeView} />
            <Stack.Screen name="Record" component={RecordView} />
            <Stack.Screen name="Map" component={CoverageMapView} />
            <Stack.Screen name="Album" component={AlbumView} />
            <Stack.Screen name="VideoDetail" component={VideoDetailView} />
            <Stack.Screen name="UploadQueue" component={UploadQueueView} />
            <Stack.Screen name="Settings" component={SettingsView} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
