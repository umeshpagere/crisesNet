/**
 * Block B — Phase 4 Mobile Unit Tests
 * ConnectivityBanner Component Tests (3 tests)
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { ConnectivityBanner } from '../ConnectivityBanner';
import * as useConnectivityHook from '../../hooks/useConnectivity';

jest.mock('../../hooks/useConnectivity');

describe('ConnectivityBanner Component', () => {
  const mockUseConnectivity = useConnectivityHook.useConnectivity as jest.MockedFunction<
    typeof useConnectivityHook.useConnectivity
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. displays offline banner when network is disconnected', () => {
    mockUseConnectivity.mockReturnValue({
      isConnected: false,
      isInternetReachable: false,
      type: 'none',
      syncStatus: 'idle',
      pendingCount: 5,
      triggerSync: jest.fn(),
    });

    const { getByText } = render(<ConnectivityBanner />);

    expect(getByText(/offline/i)).toBeTruthy();
  });

  test('2. shows pending sync count when items are queued', () => {
    mockUseConnectivity.mockReturnValue({
      isConnected: false,
      isInternetReachable: false,
      type: 'none',
      syncStatus: 'idle',
      pendingCount: 12,
      triggerSync: jest.fn(),
    });

    const { getByText } = render(<ConnectivityBanner />);

    expect(getByText(/12/)).toBeTruthy();
  });

  test('3. hides banner when online and no pending items', () => {
    mockUseConnectivity.mockReturnValue({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
      syncStatus: 'idle',
      pendingCount: 0,
      triggerSync: jest.fn(),
    });

    const { queryByText } = render(<ConnectivityBanner />);

    expect(queryByText(/offline/i)).toBeNull();
  });
});
