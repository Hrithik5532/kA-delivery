import { Image } from 'expo-image';
import { useMemo } from 'react';
import {
  boundsFor,
  osmTilesForBounds,
  pickOsmZoom,
  tileNorthWestLatLng,
  tileSouthEastLatLng,
  type LatLng,
} from '@/lib/map-route';

export function projectPointInBounds(
  point: LatLng,
  bounds: ReturnType<typeof boundsFor>,
  width: number,
  height: number,
) {
  const latRange = bounds.maxLat - bounds.minLat || 1;
  const lngRange = bounds.maxLng - bounds.minLng || 1;
  const x = ((point.lng - bounds.minLng) / lngRange) * (width * 0.84) + width * 0.08;
  const y = (1 - (point.lat - bounds.minLat) / latRange) * (height * 0.78) + height * 0.1;
  return { x, y };
}

export function OsmTileBackground({
  bounds,
  width,
  height,
}: {
  bounds: ReturnType<typeof boundsFor>;
  width: number;
  height: number;
}) {
  const zoom = useMemo(() => pickOsmZoom(bounds), [bounds]);
  const tiles = useMemo(() => osmTilesForBounds(bounds, zoom), [bounds, zoom]);
  const project = (point: LatLng) => projectPointInBounds(point, bounds, width, height);

  if (!width || !height) return null;

  return (
    <>
      {tiles.map(({ x, y, zoom: z, url }) => {
        const nw = project(tileNorthWestLatLng(x, y, z));
        const se = project(tileSouthEastLatLng(x, y, z));
        const left = Math.min(nw.x, se.x);
        const top = Math.min(nw.y, se.y);
        const tileWidth = Math.max(Math.abs(se.x - nw.x), 1);
        const tileHeight = Math.max(Math.abs(se.y - nw.y), 1);
        return (
          <Image
            key={`${z}-${x}-${y}`}
            source={{ uri: url }}
            style={{ position: 'absolute', left, top, width: tileWidth, height: tileHeight }}
            contentFit="fill"
          />
        );
      })}
    </>
  );
}
