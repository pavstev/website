import { en } from "@/lib/i18n";

interface TechHub {
  key: TechHubKey;
  latitude: number;
  longitude: number;
  name: string;
  rank: number;
}

type TechHubKey = keyof typeof en.city.hubs;

const places: ReadonlyArray<Omit<TechHub, "name">> = [
  { key: "siliconValley", latitude: 37.3861, longitude: -122.0839, rank: 1 },
  { key: "newYork", latitude: 40.7128, longitude: -74.006, rank: 2 },
  { key: "london", latitude: 51.5074, longitude: -0.1278, rank: 3 },
  { key: "telAviv", latitude: 32.0853, longitude: 34.7818, rank: 4 },
  { key: "boston", latitude: 42.3601, longitude: -71.0589, rank: 5 },
  { key: "beijing", latitude: 39.9042, longitude: 116.4074, rank: 6 },
  { key: "losAngeles", latitude: 34.0522, longitude: -118.2437, rank: 7 },
  { key: "singapore", latitude: 1.3521, longitude: 103.8198, rank: 8 },
  { key: "seoul", latitude: 37.5665, longitude: 126.978, rank: 9 },
  { key: "seattle", latitude: 47.6062, longitude: -122.3321, rank: 10 },
  { key: "shanghai", latitude: 31.2304, longitude: 121.4737, rank: 11 },
  { key: "tokyo", latitude: 35.6762, longitude: 139.6503, rank: 12 },
  { key: "toronto", latitude: 43.6532, longitude: -79.3832, rank: 13 },
  { key: "paris", latitude: 48.8566, longitude: 2.3522, rank: 13 },
  { key: "bengaluru", latitude: 12.9716, longitude: 77.5946, rank: 15 },
  { key: "washington", latitude: 38.9072, longitude: -77.0369, rank: 16 },
];

export const techHubs: readonly TechHub[] = places.map((place) => ({
  ...place,
  name: en.city.hubs[place.key],
}));
