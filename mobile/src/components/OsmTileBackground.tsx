import { Image } from 'expo-image';
import { useMemo } from 'react';
import {
  boundsFor,
  osmTileLayout,
  osmTilesForBounds,
  pickOsmZoom,
  projectLatLngInBounds,
  type LatLng,
} from '@/lib/map-route';

export function projectPointInBounds(
  point: LatLng,
  bounds: ReturnType<typeof boundsFor>,
  width: number,
  height: number,
  zoom?: number,
) {
  const z = zoom ?? pickOsmZoom(bounds);
  return projectLatLngInBounds(point, bounds, width, height, z);
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

  if (!width || !height) return null;

  return (
    <>
      {tiles.map(({ x, y, zoom: z, url }) => {
        const layout = osmTileLayout(x, y, bounds, width, height, z);
        return (
          <Image
            key={`${z}-${x}-${y}`}
            source={{ uri: url }}
            style={{
              position: 'absolute',
              left: layout.left,
              top: layout.top,
              width: layout.width,
              height: layout.height,
            }}
            contentFit="fill"
          />
        );
      })}
    </>
  );
}
