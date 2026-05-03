/**
 * LocationService Tests
 * 
 * Tests GPS permissions, capture, retry logic, and fallback
 */

import LocationService from '../../src/services/LocationService';

// Mock react-native-geolocation-service
jest.mock('react-native-geolocation-service', () => ({
  requestAuthorization: jest.fn(),
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}));

// Mock react-native PermissionsAndroid
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  PermissionsAndroid: {
    PERMISSIONS: { ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION' },
    request: jest.fn(),
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
  },
}));

describe('LocationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestPermissions', () => {
    it('should return granted when permission is granted', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.request.mockResolvedValue('granted');

      const result = await LocationService.requestPermissions();

      expect(result).toBe('granted');
      expect(PermissionsAndroid.request).toHaveBeenCalledWith(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
    });

    it('should return denied when permission is denied', async () => {
      const { PermissionsAndroid } = require('react-native');
      PermissionsAndroid.request.mockResolvedValue('denied');

      const result = await LocationService.requestPermissions();

      expect(result).toBe('denied');
    });
  });

  describe('getCurrentLocation', () => {
    it('should return location with good accuracy on first try', async () => {
      const Geolocation = require('react-native-geolocation-service');
      
      Geolocation.getCurrentPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 19.9975,
            longitude: 73.7898,
            accuracy: 15,
          },
          timestamp: Date.now(),
        });
      });

      const location = await LocationService.getCurrentLocation();

      expect(location.lat).toBe(19.9975);
      expect(location.lng).toBe(73.7898);
      expect(location.accuracy).toBe(15);
      expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    });

    it('should retry up to 3 times if accuracy is poor', async () => {
      const Geolocation = require('react-native-geolocation-service');
      
      let attempt = 0;
      Geolocation.getCurrentPosition.mockImplementation((success) => {
        attempt++;
        success({
          coords: {
            latitude: 19.9975,
            longitude: 73.7898,
            accuracy: attempt === 3 ? 25 : 60, // Good accuracy on 3rd try
          },
          timestamp: Date.now(),
        });
      });

      const location = await LocationService.getCurrentLocation();

      expect(location.accuracy).toBe(25);
      expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(3);
    });

    it('should fallback to last known location if all retries fail', async () => {
      const Geolocation = require('react-native-geolocation-service');
      
      // First call: store a good location
      Geolocation.getCurrentPosition.mockImplementationOnce((success) => {
        success({
          coords: {
            latitude: 20.0000,
            longitude: 74.0000,
            accuracy: 10,
          },
          timestamp: Date.now(),
        });
      });

      await LocationService.getCurrentLocation();

      // Second call: all retries fail
      Geolocation.getCurrentPosition.mockImplementation((success, error) => {
        error({ code: 2, message: 'Position unavailable' });
      });

      const location = await LocationService.getCurrentLocation();

      // Should return last known location
      expect(location.lat).toBe(20.0000);
      expect(location.lng).toBe(74.0000);
    });

    it('should use default fallback if no last known location', async () => {
      const Geolocation = require('react-native-geolocation-service');
      
      Geolocation.getCurrentPosition.mockImplementation((success, error) => {
        error({ code: 2, message: 'Position unavailable' });
      });

      const location = await LocationService.getCurrentLocation();

      // Should return default location (0, 0)
      expect(location.lat).toBe(0);
      expect(location.lng).toBe(0);
      expect(location.accuracy).toBe(999999);
    });
  });

  describe('startWatching', () => {
    it('should start watching location and call callback', () => {
      const Geolocation = require('react-native-geolocation-service');
      const callback = jest.fn();
      
      Geolocation.watchPosition.mockImplementation((success) => {
        success({
          coords: {
            latitude: 19.9975,
            longitude: 73.7898,
            accuracy: 20,
          },
          timestamp: Date.now(),
        });
        return 123; // watch ID
      });

      LocationService.startWatching(callback);

      expect(Geolocation.watchPosition).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          lat: 19.9975,
          lng: 73.7898,
          accuracy: 20,
        })
      );
    });

    it('should stop watching when stopWatching is called', () => {
      const Geolocation = require('react-native-geolocation-service');
      
      Geolocation.watchPosition.mockReturnValue(123);

      LocationService.startWatching(jest.fn());
      LocationService.stopWatching();

      expect(Geolocation.clearWatch).toHaveBeenCalledWith(123);
    });
  });
});
