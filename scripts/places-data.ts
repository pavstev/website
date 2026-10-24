export const placesPath = "src/assets/places.txt";

const minPopulation = 15_000;

export interface SourceCity {
  country: string;
  lat: number;
  lon: number;
  name: string;
  population: number;
}

const tenth = (value: number): number => Math.round(value * 10);

const column = { country: 8, lat: 4, lon: 5, name: 1, people: 14, type: 6 };

export const parseGeoNames = (tsv: string): SourceCity[] => {
  const cities: SourceCity[] = [];
  for (const line of tsv.split("\n")) {
    const cells = line.split("\t");
    const city = {
      country: cells[column.country] ?? "",
      lat: Number(cells[column.lat]),
      lon: Number(cells[column.lon]),
      name: cells[column.name] ?? "",
      population: Number(cells[column.people]),
    };
    if (
      cells[column.type] === "P" &&
      /^[A-Z]{2}$/.test(city.country) &&
      city.name.length > 0 &&
      Number.isFinite(city.lat) &&
      Number.isFinite(city.lon) &&
      city.population >= minPopulation
    ) {
      cities.push(city);
    }
  }
  return cities;
};

export const encodePlaces = (cities: readonly SourceCity[]): string => {
  const cells = new Map<string, SourceCity>();
  for (const city of cities) {
    const key = `${String(tenth(city.lat))},${String(tenth(city.lon))}`;
    const held = cells.get(key);
    if (!held || held.population < city.population) {
      cells.set(key, city);
    }
  }
  const sorted = cells
    .values()
    .map((city) => ({ ...city, lat: tenth(city.lat), lon: tenth(city.lon) }))
    .toArray()
    .toSorted(
      (a, b) => a.lat - b.lat || a.lon - b.lon || a.name.localeCompare(b.name)
    );
  let before = 0;
  return sorted
    .map((city) => {
      const row = `${String(city.lat - before)},${String(city.lon)},${city.country},${city.name}`;
      before = city.lat;
      return row;
    })
    .join("\n");
};
