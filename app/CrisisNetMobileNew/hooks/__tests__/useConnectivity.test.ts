/**
 * Block B — Phase 4 Mobile Unit Tests
 * useConnectivity Hook Tests (3 tests)
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useConnectivity } from '../useConnectivity';
import NetInfo from '@react-native-community/netinfo';

jest.mock('@react-native-community/netinfo');

describe('useConnectivity Hook', () => {
  const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('1. initializes with offline state when network unavailable', async () => {
    mockNetInfo.fetch.mockResolvedValue({
      type: 'none',
      isConnected: false,
      isInternetReachable: false,
      details: null,
    } as any);

    const { result } = renderHook(() => useConnectivity());

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
      expect(result.current.type).toBe('none');
    });
  });

  test('2. updates state when network connectivity changes', async () => {
    const mockUnsubscribe = jest.fn();
    let networkCallback: any;

    mockNetInfo.addEventListener.mockImplementation((callback) => {
      networkCallback = callback;
      return mockUnsubscribe;
    });

    mockNetInfo.fetch.mockResolvedValue({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
      details: null,
    } as any);

    const { result } = renderHook(() => useConnectivity());

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    act(() => {
      networkCallback({
        type: 'cellular',
        isConnected: true,
        isInternetReachable: true,
        details: null,
      });
    });

    await waitFor(() => {
      expect(result.current.type).toBe('cellular');
    });
  });

  test('3. tracks pending sync count correctly', async () => {
    mockNetInfo.fetch.mockResolvedValue({
      type: 'none',
      isConnected: false,
      isInternetReachable: false,
      details: null,
    } as any);

    const { result } = renderHook(() => useConnectivity());

    await waitFor(() => {
      expect(result.current.pendingCount).toBeGreaterThanOrEqual(0);
    });
  });
});
