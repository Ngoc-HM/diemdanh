import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/// Khoảng cách Haversine giữa hai toạ độ, đơn vị mét.
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters == null) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export type NearestLocation = {
  locationId: string | null;
  locationName: string | null;
  distance: number | null;
  withinRadius: boolean;
};

/// Tìm vị trí làm việc gần nhất và kiểm tra có nằm trong bán kính cho phép không.
/// Khi công ty chưa khai báo vị trí nào thì không chặn được gì — trả về
/// withinRadius = false kèm distance = null để phía gọi tự quyết định.
export function resolveNearestLocation(
  latitude: number,
  longitude: number,
  locations: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
  }[]
): NearestLocation {
  if (locations.length === 0) {
    return {
      locationId: null,
      locationName: null,
      distance: null,
      withinRadius: false,
    };
  }

  let nearest = locations[0];
  let minDistance = calculateDistance(
    latitude,
    longitude,
    nearest.latitude,
    nearest.longitude
  );

  for (const location of locations.slice(1)) {
    const distance = calculateDistance(
      latitude,
      longitude,
      location.latitude,
      location.longitude
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearest = location;
    }
  }

  return {
    locationId: nearest.id,
    locationName: nearest.name,
    distance: minDistance,
    withinRadius: minDistance <= nearest.radius,
  };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
