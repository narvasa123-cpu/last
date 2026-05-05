import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { STORE_LOCATION } from '../lib/trackingRoute';

interface Coordinate {
  latitude: number;
  longitude: number;
}

function normalizeAddress(address?: string | null) {
  return address?.replace(/\s+/g, ' ').trim() ?? '';
}

function buildGeocodeAddress(address: string) {
  if (/philippines/i.test(address)) {
    return address;
  }

  if (/(valencia|bukidnon|makati|pasig|taguig|manila|davao|cebu|cagayan de oro)/i.test(address)) {
    return `${address}, Philippines`;
  }

  return `${address}, Valencia City, Bukidnon, Philippines`;
}

async function geocodeAddress(address: string, signal?: AbortSignal): Promise<Coordinate | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', buildGeocodeAddress(address));

  const response = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to geocode delivery address (${response.status})`);
  }

  const data = (await response.json()) as Array<{ lat: string; lon: string }>;
  const match = data[0];

  if (!match) {
    return null;
  }

  return {
    latitude: Number(match.lat),
    longitude: Number(match.lon),
  };
}

async function fetchDrivingRoute(
  origin: Coordinate,
  destination: Coordinate,
  signal?: AbortSignal,
): Promise<Coordinate[]> {
  const url = new URL(
    `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`,
  );
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');

  const response = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to load driving route (${response.status})`);
  }

  const data = (await response.json()) as {
    routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
  };

  const coordinates = data.routes?.[0]?.geometry?.coordinates ?? [];

  return coordinates.map(([longitude, latitude]) => ({
    latitude,
    longitude,
  }));
}

export function useRoadDirections(deliveryAddress?: string | null, currentLocation?: Coordinate | null) {
  const normalizedAddress = useMemo(() => normalizeAddress(deliveryAddress), [deliveryAddress]);
  const routeOrigin = currentLocation ?? STORE_LOCATION;

  const destinationQuery = useQuery({
    queryKey: ['map', 'geocode', normalizedAddress],
    enabled: Boolean(normalizedAddress),
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    queryFn: ({ signal }) => geocodeAddress(normalizedAddress, signal),
  });

  const destination = destinationQuery.data ?? null;

  const routeQuery = useQuery({
    queryKey: [
      'map',
      'route',
      routeOrigin.latitude.toFixed(6),
      routeOrigin.longitude.toFixed(6),
      destination?.latitude.toFixed(6) ?? '',
      destination?.longitude.toFixed(6) ?? '',
    ],
    enabled: Boolean(destination),
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: ({ signal }) => fetchDrivingRoute(routeOrigin, destination as Coordinate, signal),
  });

  return {
    destination,
    routeCoordinates: routeQuery.data ?? [],
    isLoading: destinationQuery.isLoading || routeQuery.isLoading,
    hasAccurateRoute: Boolean(destination && routeQuery.data?.length),
  };
}
