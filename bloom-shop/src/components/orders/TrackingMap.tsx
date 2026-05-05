import { Clock3, MapPin, Navigation, Phone, Route } from 'lucide-react';
import { useEffect, useMemo } from 'react';

import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { useRoadDirections } from '../../hooks/useRoadDirections';
import { BASE_TRACKING_ROUTE, STORE_LOCATION } from '../../lib/trackingRoute';
import type { DeliveryTrackingPoint, OrderStatus, UserProfile } from '../../lib/types';
import { formatDateTime } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface TrackingMapProps {
  orderId: string;
  rider?: UserProfile | null;
  customer?: UserProfile | null;
  deliveryAddress?: string | null;
  eta: string;
  orderStatus: OrderStatus;
  trackingPoints: DeliveryTrackingPoint[];
  variant?: 'customer' | 'rider';
}

const BASE_PREVIEW_ROUTE: LatLngTuple[] = BASE_TRACKING_ROUTE.map(({ latitude, longitude }) => [latitude, longitude]);
const DEFAULT_CENTER: LatLngTuple = [STORE_LOCATION.latitude, STORE_LOCATION.longitude];

function hasCoordinates(
  point: DeliveryTrackingPoint | undefined | null,
): point is DeliveryTrackingPoint & { latitude: number; longitude: number } {
  return typeof point?.latitude === 'number'
    && Number.isFinite(point.latitude)
    && typeof point?.longitude === 'number'
    && Number.isFinite(point.longitude);
}

function getOrderRouteOffset(orderId: string) {
  const seed = Array.from(orderId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const latOffset = ((seed % 7) - 3) * 0.00022;
  const lngOffset = (((seed >> 1) % 7) - 3) * 0.00024;

  return { latOffset, lngOffset };
}

function getPreviewRoute(orderId: string): LatLngTuple[] {
  const { latOffset, lngOffset } = getOrderRouteOffset(orderId);

  return BASE_PREVIEW_ROUTE.map(([latitude, longitude]) => ([
    Number((latitude + latOffset).toFixed(6)),
    Number((longitude + lngOffset).toFixed(6)),
  ]));
}

function getPreviewMarkerIndex(status: OrderStatus) {
  if (status === 'delivered') return BASE_PREVIEW_ROUTE.length - 1;
  if (status === 'on_the_way') return 3;
  if (status === 'picked_up') return 2;
  if (status === 'preparing' || status === 'confirmed') return 1;
  return 0;
}

function getPreviewCoordinates(orderId: string, orderStatus: OrderStatus): LatLngTuple[] {
  const previewRoute = getPreviewRoute(orderId);
  const markerIndex = getPreviewMarkerIndex(orderStatus);

  return previewRoute.slice(0, Math.max(markerIndex + 1, 2));
}

function buildDirectionsUrl(origin: LatLngTuple, destination: LatLngTuple) {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', `${origin[0]},${origin[1]}`);
  url.searchParams.set('destination', `${destination[0]},${destination[1]}`);
  url.searchParams.set('travelmode', 'driving');
  return url.toString();
}

function MapViewportSync({ points }: { points: LatLngTuple[] }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) {
      map.setView(DEFAULT_CENTER, 14);
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 16);
      return;
    }

    map.fitBounds(points, {
      padding: [36, 36],
      animate: true,
    });
  }, [map, points]);

  return null;
}

export function TrackingMap({
  orderId,
  rider,
  customer,
  deliveryAddress,
  eta,
  orderStatus,
  trackingPoints,
  variant = 'customer',
}: TrackingMapProps) {
  const livePoints = trackingPoints.filter(hasCoordinates);
  const latestTrackingPoint = trackingPoints.length ? trackingPoints[trackingPoints.length - 1] : null;
  const latestLivePoint = livePoints.length ? livePoints[livePoints.length - 1] : null;
  const currentLocation = latestLivePoint
    ? { latitude: latestLivePoint.latitude, longitude: latestLivePoint.longitude }
    : null;
  const { destination, routeCoordinates: roadRoute, hasAccurateRoute } = useRoadDirections(
    deliveryAddress ?? customer?.address,
    currentLocation,
  );

  const previewRoute = useMemo(() => getPreviewCoordinates(orderId, orderStatus), [orderId, orderStatus]);
  const liveTrailCoordinates = livePoints.map((point) => [point.latitude, point.longitude] as LatLngTuple);
  const roadRouteCoordinates = roadRoute.map((point) => [point.latitude, point.longitude] as LatLngTuple);
  const routeCoordinates = hasAccurateRoute
    ? roadRouteCoordinates
    : liveTrailCoordinates.length
      ? liveTrailCoordinates
      : previewRoute;
  const viewportCoordinates =
    hasAccurateRoute && liveTrailCoordinates.length
      ? [...liveTrailCoordinates, ...routeCoordinates]
      : routeCoordinates;

  const dispatchPoint = DEFAULT_CENTER;
  const currentPoint = latestLivePoint
    ? ([latestLivePoint.latitude, latestLivePoint.longitude] as LatLngTuple)
    : hasAccurateRoute
      ? routeCoordinates[0] ?? dispatchPoint
      : routeCoordinates[routeCoordinates.length - 1] ?? dispatchPoint;
  const destinationPoint = destination
    ? ([destination.latitude, destination.longitude] as LatLngTuple)
    : routeCoordinates[routeCoordinates.length - 1] ?? dispatchPoint;
  const directionsUrl = destination
    ? buildDirectionsUrl(latestLivePoint ? currentPoint : dispatchPoint, destinationPoint)
    : null;

  const contact = variant === 'rider' ? customer : rider;
  const contactTitle = variant === 'rider' ? 'Delivery Contact' : 'Your Rider';
  const contactDescription =
    variant === 'rider'
      ? 'Call the customer if the drop-off instructions need clarification.'
      : 'Reach out if you need to adjust the drop-off instructions.';
  const contactButtonLabel = variant === 'rider' ? 'Call Customer' : 'Call';
  const contactBadge = variant === 'rider' ? 'Delivery recipient' : 'Floral delivery specialist';

  return (
    <div className="tracking-layout">
      <Card className="map-card">
        <div className="summary-row">
          <div className="section" style={{ gap: '0.25rem' }}>
            <strong>Live Delivery Map</strong>
            <p>
              {hasAccurateRoute
                ? latestLivePoint
                  ? "Road directions now follow the rider's current location to the delivery address."
                  : 'Road directions are calculated from Bloom Shop to the delivery address.'
                : liveTrailCoordinates.length
                  ? 'Live rider checkpoints are now plotted on the delivery map.'
                  : 'Preview route is active until the rider shares a GPS update.'}
            </p>
          </div>
          <span className="badge badge-success">ETA {eta}</span>
        </div>

        <div className="delivery-map-shell">
          <div className="delivery-map-chip delivery-map-chip-start">Bloom Shop</div>
          <div className="delivery-map-chip delivery-map-chip-end">
            {orderStatus === 'delivered' ? 'Delivered' : 'Drop-off'}
          </div>

          <MapContainer
            center={currentPoint}
            zoom={15}
            scrollWheelZoom={false}
            className="delivery-map-leaflet"
          >
            <MapViewportSync points={viewportCoordinates} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {routeCoordinates.length > 1 ? (
              <Polyline
                positions={routeCoordinates}
                pathOptions={{
                  color: hasAccurateRoute ? 'rgba(76,175,125,0.95)' : 'rgba(233,30,99,0.7)',
                  weight: 5,
                  dashArray: hasAccurateRoute ? undefined : '8 10',
                }}
              />
            ) : null}

            {hasAccurateRoute && liveTrailCoordinates.length > 1 ? (
              <Polyline
                positions={liveTrailCoordinates}
                pathOptions={{
                  color: 'rgba(233,30,99,0.45)',
                  weight: 4,
                  dashArray: '6 8',
                }}
              />
            ) : null}

            <CircleMarker
              center={dispatchPoint}
              radius={7}
              pathOptions={{
                color: '#ffffff',
                weight: 2,
                fillColor: '#e91e63',
                fillOpacity: 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -10]}>
                Bloom Shop dispatch at {STORE_LOCATION.name}
              </Tooltip>
            </CircleMarker>

            {(hasAccurateRoute || routeCoordinates.length > 1) ? (
              <CircleMarker
                center={destinationPoint}
                radius={7}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2,
                  fillColor: '#4caf7d',
                  fillOpacity: 1,
                }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  {orderStatus === 'delivered' ? 'Delivered' : 'Delivery destination'}
                </Tooltip>
              </CircleMarker>
            ) : null}

            {liveTrailCoordinates.slice(0, -1).map((point, index) => (
              <CircleMarker
                key={`${point[0]}-${point[1]}-${index}`}
                center={point}
                radius={4}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2,
                  fillColor: 'rgba(233,30,99,0.34)',
                  fillOpacity: 0.9,
                }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  {`Checkpoint ${index + 1}`}
                </Tooltip>
              </CircleMarker>
            ))}

            {latestLivePoint || !hasAccurateRoute ? (
              <CircleMarker
                center={currentPoint}
                radius={8}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2,
                  fillColor: '#e91e63',
                  fillOpacity: 1,
                }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  {latestLivePoint ? 'Latest rider position' : 'Preview rider position'}
                </Tooltip>
              </CircleMarker>
            ) : null}
          </MapContainer>
        </div>

        <div className="tracking-feed-grid">
          <div className="glass-card tracking-feed-card">
            <div className="tracking-feed-icon">
              <Clock3 size={16} />
            </div>
            <div className="section" style={{ gap: '0.15rem' }}>
              <strong>Latest signal</strong>
              <p>{latestTrackingPoint ? formatDateTime(latestTrackingPoint.created_at) : 'Waiting for first route update'}</p>
            </div>
          </div>

          <div className="glass-card tracking-feed-card">
            <div className="tracking-feed-icon">
              <Navigation size={16} />
            </div>
            <div className="section" style={{ gap: '0.15rem' }}>
              <strong>Coordinates</strong>
              <p>
                {latestLivePoint
                  ? `${latestLivePoint.latitude.toFixed(4)}, ${latestLivePoint.longitude.toFixed(4)}`
                  : hasAccurateRoute
                    ? `${dispatchPoint[0].toFixed(4)}, ${dispatchPoint[1].toFixed(4)}`
                    : 'Preview route only'}
              </p>
            </div>
          </div>

          <div className="glass-card tracking-feed-card">
            <div className="tracking-feed-icon">
              <Route size={16} />
            </div>
            <div className="section" style={{ gap: '0.15rem' }}>
              <strong>Checkpoints</strong>
              <p>{trackingPoints.length ? `${trackingPoints.length} updates received` : 'No shared checkpoints yet'}</p>
            </div>
          </div>
        </div>

        {directionsUrl ? (
          <div className="action-row" style={{ marginTop: '1rem' }}>
            <Button variant="secondary" onClick={() => window.open(directionsUrl, '_blank', 'noopener,noreferrer')}>
              <Navigation size={18} />
              {variant === 'rider' ? 'Open Directions' : 'Open in Maps'}
            </Button>
          </div>
        ) : null}
      </Card>

      <Card className="map-card">
        <div className="summary-row">
          <div className="section" style={{ gap: '0.25rem' }}>
            <strong>{contactTitle}</strong>
            <p>{contactDescription}</p>
          </div>
          <Button variant="secondary" onClick={() => contact?.phone && window.open(`tel:${contact.phone}`)}>
            <Phone size={18} />
            {contactButtonLabel}
          </Button>
        </div>

        {contact ? (
          <div className="summary-row" style={{ justifyContent: 'flex-start' }}>
            <img
              src={contact.avatar_url}
              alt={contact.full_name}
              style={{ width: '4rem', height: '4rem', borderRadius: '50%', objectFit: 'cover' }}
            />
            <div className="section" style={{ gap: '0.2rem' }}>
              <strong>{contact.full_name}</strong>
              <p>{contact.phone}</p>
              <span className="badge badge-primary">{contactBadge}</span>
            </div>
          </div>
        ) : (
          <p>{variant === 'rider' ? 'Customer details are still loading.' : 'Rider assignment is still in progress.'}</p>
        )}

        {latestTrackingPoint?.note ? (
          <div className="glass-card tracking-note">
            <div className="summary-row" style={{ justifyContent: 'flex-start' }}>
              <MapPin size={16} color="var(--bloom-rose)" />
              <strong>Latest route note</strong>
            </div>
            <p>{latestTrackingPoint.note}</p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
