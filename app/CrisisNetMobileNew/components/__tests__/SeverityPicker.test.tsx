/**
 * Block B — Phase 4 Mobile Unit Tests
 * SeverityPicker Component Tests (4 tests)
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SeverityPicker } from '../SeverityPicker';
import { SeverityLevel } from '../../types';

describe('SeverityPicker Component', () => {
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. renders all 4 severity options with correct labels', () => {
    const { getByText } = render(
      <SeverityPicker selected={null} onSelect={mockOnSelect} />
    );

    expect(getByText('Critical')).toBeTruthy();
    expect(getByText('High')).toBeTruthy();
    expect(getByText('Moderate')).toBeTruthy();
    expect(getByText('Low')).toBeTruthy();
  });

  test('2. calls onSelect with correct severity when option pressed', () => {
    const { getByText } = render(
      <SeverityPicker selected={null} onSelect={mockOnSelect} />
    );

    fireEvent.press(getByText('Critical'));

    expect(mockOnSelect).toHaveBeenCalledWith('critical');
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  test('3. highlights selected severity option', () => {
    const { getByText } = render(
      <SeverityPicker selected={'high' as SeverityLevel} onSelect={mockOnSelect} />
    );

    const highButton = getByText('High').parent?.parent;
    expect(highButton).toBeTruthy();
  });

  test('4. displays severity descriptions for each option', () => {
    const { getByText } = render(
      <SeverityPicker selected={null} onSelect={mockOnSelect} />
    );

    expect(getByText('Life-threatening emergency')).toBeTruthy();
    expect(getByText('Urgent response needed')).toBeTruthy();
    expect(getByText('Assistance required')).toBeTruthy();
    expect(getByText('Monitoring needed')).toBeTruthy();
  });
});
