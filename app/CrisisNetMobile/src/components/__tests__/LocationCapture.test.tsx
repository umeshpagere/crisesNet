/**
 * Block B — Phase 4 Mobile Unit Tests
 * LocationCapture Component Tests (5 tests)
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LocationCapture } from '../LocationCapture';
import * as useLocationCaptureHook from '../../hooks/useLocationCapture';

jest.mock('../../hooks/useLocationCapture');

describe('LocationCapture Component', () => {
  const mockUseLocationCapture = useLocationCaptureHook.useLocationCapture as jest.MockedFunction<
    typeof useLocationCaptureHook.useLocationCapture
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. renders compact mode with location coordinates', () => {
    mockUseLocationCapture.mockReturnValue({
      location: { lat: 19.9975, lng: 73.7898 },
      accuracy: 15,
      accuracyStatus: 'good',
      isCapturing: false,
      recapture: jest.fn(),
    });

    const { getByText } = render(<LocationCapture compact={true} />);

    expect(getByText('19.9975, 73.7898')).toBeTruthy();
    expect(getByText('±15m')).toBeTruthy();
  });

  test('2. displays accuracy ring with correct color for good accuracy', () => {
    mockUseLocationCapture.mockReturnValue({
      location: { lat: 20.0, lng: 74.0 },
      accuracy: 8,
      accuracyStatus: 'good',
      isCapturing: false,
      recapture: jest.fn(),
    });

    const { getByText } = render(<LocationCapture />);

    expect(getByText('8m')).toBeTruthy();
    expect(getByText('Good')).toBeTruthy();
  });

  test('3. shows loading indicator when capturing location', () => {
    mockUseLocationCapture.mockReturnValue({
      location: null,
      accuracy: 0,
      accuracyStatus: 'unknown',
      isCapturing: true,
      recapture: jest.fn(),
    });

    const { UNSAFE_getByType } = render(<LocationCapture />);
    const { ActivityIndicator } = require('react-native');

    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  test('4. calls recapture when button pressed', () => {
    const mockRecapture = jest.fn();
    mockUseLocationCapture.mockReturnValue({
      location: { lat: 19.5, lng: 73.5 },
      accuracy: 20,
      accuracyStatus: 'fair',
      isCapturing: false,
      recapture: mockRecapture,
    });

    const { getByText } = render(<LocationCapture />);

    fireEvent.press(getByText('Recapture Location'));

    expect(mockRecapture).toHaveBeenCalledTimes(1);
  });

  test('5. triggers onLocationUpdate callback when location changes', async () => {
    const mockOnLocationUpdate = jest.fn();

    mockUseLocationCapture.mockReturnValue({
      location: { lat: 19.9975, lng: 73.7898 },
      accuracy: 10,
      accuracyStatus: 'good',
      isCapturing: false,
      recapture: jest.fn(),
    });

    render(<LocationCapture onLocationUpdate={mockOnLocationUpdate} />);

    await waitFor(() => {
      expect(mockOnLocationUpdate).toHaveBeenCalledWith(19.9975, 73.7898);
    });
  });
});
