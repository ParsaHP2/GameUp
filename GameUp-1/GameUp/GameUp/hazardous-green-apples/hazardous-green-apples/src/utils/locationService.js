import * as Location from 'expo-location';

// Request location permissions from user
export const requestLocationPermissions = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted'; // Returns true if permission granted
};

// Get user's current location and convert to city/region/country
export const getCurrentRegion = async () => {
  // First, request permission to access location
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) {
    throw new Error('Location permission denied');
  }

  // Get current GPS coordinates
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Lowest, // Use lowest accuracy to save battery
  });

  // Convert GPS coordinates to address information (reverse geocoding)
  const [place] = await Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });

  if (!place) {
    throw new Error('Unable to determine location');
  }

  // Return city, region, and country information
  return {
    city: place.city || place.subregion || 'Unknown city',
    region: place.region || place.subregion || 'Unknown region',
    country: place.country || 'Unknown country',
  };
};

