import placesUrl from "@/assets/places.txt?url";

import { createPlaceSource } from "./place-lookup.ts";

export const placeSource = createPlaceSource(async () => {
  const response = await fetch(placesUrl);
  if (!response.ok) throw new Error(String(response.status));
  return response.text();
});
