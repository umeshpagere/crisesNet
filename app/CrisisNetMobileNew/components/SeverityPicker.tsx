/**
 * CrisisNet Mobile - Severity Picker Component
 * 
 * 4 large colored buttons for severity selection
 * Each button: icon + label + brief description
 * Selected state: border glow + scale animation
 * Used in VictimReportScreen
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SeverityLevel } from '../types';
import { SEVERITY_COLORS } from '../constants';

interface SeverityPickerProps {
  selected: SeverityLevel | null;
  onSelect: (severity: SeverityLevel) => void;
}

interface SeverityOption {
  level: SeverityLevel;
  label: string;
  description: string;
  icon: string;
}

const SEVERITY_OPTIONS: SeverityOption[] = [
  {
    level: 'critical',
    label: 'Critical',
    description: 'Life-threatening emergency',
    icon: '🚨',
  },
  {
    level: 'high',
    label: 'High',
    description: 'Urgent response needed',
    icon: '⚠️',
  },
  {
    level: 'moderate',
    label: 'Moderate',
    description: 'Assistance required',
    icon: '⚡',
  },
  {
    level: 'low',
    label: 'Low',
    description: 'Monitoring needed',
    icon: 'ℹ️',
  },
];

export const SeverityPicker: React.FC<SeverityPickerProps> = ({ selected, onSelect }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Severity Level</Text>
      <View style={styles.grid}>
        {SEVERITY_OPTIONS.map((option) => {
          const isSelected = selected === option.level;
          const color = SEVERITY_COLORS[option.level];

          return (
            <TouchableOpacity
              key={option.level}
              style={[
                styles.button,
                { borderColor: color },
                isSelected && styles.buttonSelected,
                isSelected && { borderWidth: 3, transform: [{ scale: 1.05 }] },
              ]}
              onPress={() => onSelect(option.level)}
              activeOpacity={0.7}
            >
              <Text style={styles.icon}>{option.icon}</Text>
              <Text style={[styles.label, { color }]}>{option.label}</Text>
              <Text style={styles.description}>{option.description}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  button: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  buttonSelected: {
    backgroundColor: '#374151',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    fontSize: 32,
    marginBottom: 8,
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  description: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
  },
});
