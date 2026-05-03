/**
 * CrisisNet Mobile - App Navigator
 * 
 * Bottom tab navigator with 3 tabs
 * Stack navigator for settings modal
 */

import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { VictimReportScreen } from '../screens/VictimReportScreen';
import { ResponderDashboardScreen } from '../screens/ResponderDashboardScreen';
import { OfflineQueueScreen } from '../screens/OfflineQueueScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useAppStore } from '../store/useAppStore';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function TabNavigator() {
  const { pendingCount, isOnline } = useAppStore();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#111827',
          borderTopColor: '#374151',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#6B7280',
      }}
    >
      <Tab.Screen
        name="Report"
        component={VictimReportScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🔔</Text>,
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
        }}
      />
      <Tab.Screen
        name="Responder"
        component={ResponderDashboardScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🗺️</Text>,
        }}
      />
      <Tab.Screen
        name="Queue"
        component={OfflineQueueScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>📥</Text>,
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { isOnline } = useAppStore();

  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Tabs"
          component={TabNavigator}
          options={({ navigation }) => ({
            title: 'CrisisNet',
            headerStyle: {
              backgroundColor: '#111827',
            },
            headerTintColor: '#F3F4F6',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            headerRight: () => (
              <TouchableOpacity
                onPress={() => navigation.navigate('Settings')}
                style={{ marginRight: 16, flexDirection: 'row', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 8, color: isOnline ? '#10B981' : '#EF4444', marginRight: 8 }}>
                  ●
                </Text>
                <Text style={{ fontSize: 20 }}>⚙️</Text>
              </TouchableOpacity>
            ),
          })}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Settings',
            headerStyle: {
              backgroundColor: '#111827',
            },
            headerTintColor: '#F3F4F6',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
