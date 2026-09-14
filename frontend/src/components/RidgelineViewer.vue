<script setup lang="ts">
import {
  CallbackProperty,
  Cartesian3,
  Cartographic,
  Color,
  ConstantPositionProperty,
  ImageryLayer,
  Matrix3,
  Matrix4,
  Math as CesiumMath,
  OpenStreetMapImageryProvider,
  PolygonHierarchy,
  Quaternion,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Transforms,
  Viewer,
} from "cesium";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
} from "vue";

import AreaOfInterestDetails from "./AreaOfInterestDetails.vue";
import AreaOfInterestForm from "./AreaOfInterestForm.vue";
import AssetTable from "./AssetTable.vue";
import CameraConeDetails from "./CameraConeDetails.vue";
import CameraConeForm from "./CameraConeForm.vue";
import EventRangeFields from "./EventRangeFields.vue";
import EventTable from "./EventTable.vue";
import FeatureDrawer from "./FeatureDrawer.vue";
import FeatureToolbar from "./FeatureToolbar.vue";
import PointOfInterestDetails from "./PointOfInterestDetails.vue";
import PointOfInterestForm from "./PointOfInterestForm.vue";
import TrailRouteDetails from "./TrailRouteDetails.vue";
import TrailRouteForm from "./TrailRouteForm.vue";

import {
  API_BASE_URL,
  aborted,
  eachPage,
  listCameraCones,
  listAreasOfInterest,
  listPointsOfInterest,
  listTrailRoutes,
} from "../api/index.ts";
import { MIN_PATH_POSITIONS, MIN_RING_POSITIONS } from "../types/geometry.ts";
import { MAX_PAGE_SIZE } from "../types/paging.ts";

import type { Cartesian2, Entity } from "cesium";
import type { DrawerView } from "../types/display.ts";
import type { FeatureType } from "../types/enums.ts";
import type {
  AreaOfInterest,
  CameraCone,
  Feature,
  PointOfInterest,
  TimeWindow,
  TrailRoute,
} from "../types/features.ts";
import type { Coordinate, Path, Ring } from "../types/geometry.ts";

import "cesium/Build/Cesium/Widgets/widgets.css";

const OPEN_STREET_MAP = "https://tile.openstreetmap.org/";

const GORE_RANGE_APPROACH = {
  destination: Cartesian3.fromDegrees(-106.4489, 39.498, 20000),
  orientation: {
    heading: 0,
    pitch: CesiumMath.toRadians(-50),
    roll: 0,
  },
  duration: 4,
};

const MARKER_COLOR = Color.fromCssColorString("#e8532b");
const TRAIL_COLOR = Color.ROYALBLUE;
const AREA_COLOR = Color.DARKGREEN;
const CAMERA_COLOR = Color.DARKORANGE;
const CAMERA_CONE_ID_PREFIX = "camera-cone:";

const MARKER = {
  pixelSize: 14,
  color: MARKER_COLOR,
  outlineColor: Color.WHITE,
  outlineWidth: 2,
  disableDepthTestDistance: Number.POSITIVE_INFINITY,
};

const TRAIL_WIDTH = 3;

const TRAIL_VERTEX = {
  pixelSize: 9,
  color: TRAIL_COLOR,
  outlineColor: Color.WHITE,
  outlineWidth: 2,
  disableDepthTestDistance: Number.POSITIVE_INFINITY,
};

const AREA_VERTEX = { ...TRAIL_VERTEX, color: AREA_COLOR };
const AREA_OUTLINE_WIDTH = 2;
const AREA_FILL = AREA_COLOR.withAlpha(0.3);
const CAMERA_FILL = CAMERA_COLOR.withAlpha(0.28);
const CAMERA_MARKER = { ...MARKER, color: CAMERA_COLOR };

const emit = defineEmits<{ create: [feature: Feature] }>();

const container = useTemplateRef<HTMLDivElement>("container");
const armedTool = ref<FeatureType | null>(null);
const markerPosition = ref<Coordinate | null>(null);
const trailPositions = shallowRef<Cartesian3[]>([]);
const trailComplete = ref(false);
const areaPositions = shallowRef<Cartesian3[]>([]);
const areaClosed = ref(false);
const mappedPoints = ref<PointOfInterest[]>([]);
const mappedTrails = ref<TrailRoute[]>([]);
const mappedAreas = ref<AreaOfInterest[]>([]);
const mappedCameras = ref<CameraCone[]>([]);
const selected = ref<Feature | null>(null);
const drawerOpen = ref(false);
const drawerView = ref<DrawerView>("assets");
const eventRange = ref<TimeWindow | null>(null);
const drawing = computed(() => armedTool.value !== null);

const assets = computed<Feature[]>(() => [
  ...mappedPoints.value,
  ...mappedTrails.value,
  ...mappedAreas.value,
  ...mappedCameras.value,
]);

const trailPath = computed<Path>(() => toPath(trailPositions.value));
const areaRing = computed<Ring>(() => toPath(areaPositions.value));

let viewer: Viewer | null = null;
let clicks: ScreenSpaceEventHandler | null = null;
let marker: Entity | null = null;
let mappedEntities = new Map<string, Entity>();
let load: AbortController | null = null;
let trailEntities: Entity[] = [];
let areaEntities: Entity[] = [];

onMounted(() => {
  const element = container.value;

  if (element === null) {
    throw new Error("the viewer container is not mounted");
  }

  viewer = new Viewer(element, {
    baseLayer: new ImageryLayer(
      new OpenStreetMapImageryProvider({ url: OPEN_STREET_MAP }),
    ),
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
  });

  viewer.camera.flyTo(GORE_RANGE_APPROACH);

  clicks = new ScreenSpaceEventHandler(viewer.canvas);
  clicks.setInputAction(onLeftClick, ScreenSpaceEventType.LEFT_CLICK);
  clicks.setInputAction(onRightClick, ScreenSpaceEventType.RIGHT_CLICK);

  void loadFeatures();
});

onBeforeUnmount(() => {
  load?.abort();
  load = null;
  clicks?.destroy();
  clicks = null;
  marker = null;
  markerPosition.value = null;
  selected.value = null;
  mappedPoints.value = [];
  mappedTrails.value = [];
  mappedAreas.value = [];
  mappedCameras.value = [];
  mappedEntities = new Map();
  trailPositions.value = [];
  trailComplete.value = false;
  trailEntities = [];
  areaPositions.value = [];
  areaClosed.value = false;
  areaEntities = [];
  viewer?.destroy();
  viewer = null;
});

async function loadFeatures(): Promise<void> {
  load = new AbortController();
  const options = { baseUrl: API_BASE_URL, signal: load.signal };

  try {
    await Promise.all([
      eachPage(
        (page) => listPointsOfInterest({ page, pageSize: MAX_PAGE_SIZE }, options),
        mapPoint,
      ),
      eachPage(
        (page) => listTrailRoutes({ page, pageSize: MAX_PAGE_SIZE }, options),
        mapTrail,
      ),
      eachPage(
        (page) => listAreasOfInterest({ page, pageSize: MAX_PAGE_SIZE }, options),
        mapArea,
      ),
      eachPage(
        (page) => listCameraCones({ page, pageSize: MAX_PAGE_SIZE }, options),
        mapCamera,
      ),
    ]);
  } catch (cause) {
    if (!aborted(cause)) {
      console.error("the saved features could not be loaded", cause);
    }
  } finally {
    load = null;
  }
}

function toggleTool(featureType: FeatureType): void {
  armedTool.value = armedTool.value === featureType ? null : featureType;
  selected.value = null;

  if (
    armedTool.value !== "PointOfInterest" &&
    armedTool.value !== "CameraCone"
  ) {
    discardMarker();
  }

  if (armedTool.value !== "TrailRoute") {
    discardTrail();
  }

  if (armedTool.value !== "AreaOfInterest") {
    discardArea();
  }
}

function onLeftClick(click: ScreenSpaceEventHandler.PositionedEvent): void {
  const view = viewer;

  if (view === null) {
    return;
  }

  if (armedTool.value === null) {
    selected.value = featureAt(view, click.position);
    return;
  }

  const position = view.camera.pickEllipsoid(
    click.position,
    view.scene.globe.ellipsoid,
  );

  if (position === undefined) {
    return;
  }

  if (
    armedTool.value === "PointOfInterest" ||
    armedTool.value === "CameraCone"
  ) {
    placeMarker(view, position);
  }

  if (armedTool.value === "TrailRoute") {
    extendTrail(view, position);
  }

  if (armedTool.value === "AreaOfInterest") {
    extendArea(view, position);
  }
}

function featureAt(view: Viewer, screenPosition: Cartesian2): Feature | null {
  const picked: unknown = view.scene.pick(screenPosition);
  const entityId = (picked as { id?: { id?: unknown } } | undefined)?.id?.id;

  if (typeof entityId !== "string") {
    return null;
  }

  const id = entityId.startsWith(CAMERA_CONE_ID_PREFIX)
    ? entityId.slice(CAMERA_CONE_ID_PREFIX.length)
    : entityId;

  return (
    mappedPoints.value.find((feature) => feature.id === id) ??
    mappedTrails.value.find((feature) => feature.id === id) ??
    mappedAreas.value.find((feature) => feature.id === id) ??
    mappedCameras.value.find((feature) => feature.id === id) ??
    null
  );
}

function onRightClick(): void {
  if (armedTool.value === "TrailRoute") {
    completeTrail();
  }

  if (armedTool.value === "AreaOfInterest") {
    completeArea();
  }
}

function placeMarker(view: Viewer, position: Cartesian3): void {
  markerPosition.value = toCoordinate(position);

  if (marker === null) {
    marker = view.entities.add({
      position: new ConstantPositionProperty(position),
      point: MARKER,
    });

    return;
  }

  marker.position = new ConstantPositionProperty(position);
}

function toCoordinate(position: Cartesian3): Coordinate | null {
  const cartographic = Cartographic.fromCartesian(position);

  if (cartographic === undefined) {
    return null;
  }

  return {
    longitude: CesiumMath.toDegrees(cartographic.longitude),
    latitude: CesiumMath.toDegrees(cartographic.latitude),
    elevationMetres: cartographic.height,
  };
}

function toPath(positions: Cartesian3[]): Path {
  return positions.flatMap((position) => {
    const coordinate = toCoordinate(position);
    return coordinate === null ? [] : [coordinate];
  });
}

function toCartesians(ring: Coordinate[]): Cartesian3[] {
  return Cartesian3.fromDegreesArrayHeights(
    ring.flatMap((coordinate) => [
      coordinate.longitude,
      coordinate.latitude,
      coordinate.elevationMetres,
    ]),
  );
}

function saveMarker(feature: PointOfInterest): void {
  discardMarker();
  mapPoint(feature);
  emit("create", feature);

  armedTool.value = null;
}

function mapPoint(feature: PointOfInterest): void {
  const view = viewer;

  if (view === null || feature.window !== null) {
    return;
  }

  const { longitude, latitude, elevationMetres } = feature.position;

  mappedPoints.value.push(feature);
  mappedEntities.set(
    feature.id,
    view.entities.add({
      id: feature.id,
      name: feature.name,
      position: new ConstantPositionProperty(
        Cartesian3.fromDegrees(longitude, latitude, elevationMetres),
      ),
      point: MARKER,
    }),
  );
}

function cancelMarker(): void {
  discardMarker();
  armedTool.value = null;
}

function discardMarker(): void {
  if (marker !== null) {
    viewer?.entities.remove(marker);
  }

  marker = null;
  markerPosition.value = null;
}

function saveCamera(feature: CameraCone): void {
  discardMarker();
  mapCamera(feature);
  emit("create", feature);
  armedTool.value = null;
}

function mapCamera(feature: CameraCone): void {
  const view = viewer;
  if (view === null || feature.window !== null) return;

  mappedCameras.value.push(feature);
  const { longitude, latitude, elevationMetres } = feature.position;
  const vertex = Cartesian3.fromDegrees(longitude, latitude, elevationMetres);
  const direction = cameraDirection(vertex, feature.headingDegrees, feature.pitchDegrees);
  const centre = Cartesian3.add(
    vertex,
    Cartesian3.multiplyByScalar(
      direction,
      feature.distanceFromVertexMetres / 2,
      new Cartesian3(),
    ),
    new Cartesian3(),
  );

  const markerEntity = view.entities.add({
    id: feature.id,
    name: feature.name,
    position: new ConstantPositionProperty(vertex),
    point: CAMERA_MARKER,
  });
  mappedEntities.set(feature.id, markerEntity);

  view.entities.add({
    id: `${CAMERA_CONE_ID_PREFIX}${feature.id}`,
    name: feature.name,
    position: new ConstantPositionProperty(centre),
    orientation: cameraOrientation(vertex, direction),
    cylinder: {
      length: feature.distanceFromVertexMetres,
      topRadius: feature.baseRadiusMetres,
      bottomRadius: 0,
      material: CAMERA_FILL,
      outline: true,
      outlineColor: CAMERA_COLOR,
      numberOfVerticalLines: 16,
    },
  });
}

function cameraDirection(
  vertex: Cartesian3,
  headingDegrees: number,
  pitchDegrees: number,
): Cartesian3 {
  const heading = CesiumMath.toRadians(headingDegrees);
  const pitch = CesiumMath.toRadians(pitchDegrees);
  const horizontal = Math.cos(pitch);
  const localDirection = new Cartesian3(
    Math.sin(heading) * horizontal,
    Math.cos(heading) * horizontal,
    Math.sin(pitch),
  );
  const localToFixed = Transforms.eastNorthUpToFixedFrame(vertex);
  return Cartesian3.normalize(
    Matrix4.multiplyByPointAsVector(localToFixed, localDirection, new Cartesian3()),
    new Cartesian3(),
  );
}

function cameraOrientation(vertex: Cartesian3, direction: Cartesian3): Quaternion {
  const up = Cartesian3.normalize(vertex, new Cartesian3());
  let xAxis = Cartesian3.cross(up, direction, new Cartesian3());

  if (Cartesian3.magnitudeSquared(xAxis) < CesiumMath.EPSILON12) {
    xAxis = Cartesian3.cross(Cartesian3.UNIT_X, direction, xAxis);
  }

  Cartesian3.normalize(xAxis, xAxis);
  const yAxis = Cartesian3.normalize(
    Cartesian3.cross(direction, xAxis, new Cartesian3()),
    new Cartesian3(),
  );
  const rotation = new Matrix3();
  Matrix3.setColumn(rotation, 0, xAxis, rotation);
  Matrix3.setColumn(rotation, 1, yAxis, rotation);
  Matrix3.setColumn(rotation, 2, direction, rotation);
  return Quaternion.fromRotationMatrix(rotation, new Quaternion());
}

function cancelCamera(): void {
  discardMarker();
  armedTool.value = null;
}

function extendTrail(view: Viewer, position: Cartesian3): void {
  if (trailComplete.value) {
    return;
  }

  if (trailEntities.length === 0) {
    trailEntities.push(
      view.entities.add({
        polyline: {
          positions: new CallbackProperty(() => trailPositions.value, false),
          width: TRAIL_WIDTH,
          material: TRAIL_COLOR,
          clampToGround: true,
        },
      }),
    );
  }

  trailPositions.value = [...trailPositions.value, position];
  trailEntities.push(
    view.entities.add({
      position: new ConstantPositionProperty(position),
      point: TRAIL_VERTEX,
    }),
  );
}

function completeTrail(): void {
  if (trailPositions.value.length < MIN_PATH_POSITIONS) {
    return;
  }

  trailComplete.value = true;
}

function saveTrail(feature: TrailRoute): void {
  discardTrail();
  mapTrail(feature);
  emit("create", feature);

  armedTool.value = null;
}

function mapTrail(feature: TrailRoute): void {
  const view = viewer;

  if (view === null || feature.window !== null) {
    return;
  }

  mappedTrails.value.push(feature);
  mappedEntities.set(
    feature.id,
    view.entities.add({
      id: feature.id,
      name: feature.name,
      polyline: {
        positions: toCartesians(feature.path),
        width: TRAIL_WIDTH,
        material: TRAIL_COLOR,
        clampToGround: true,
      },
    }),
  );
}

function cancelTrail(): void {
  discardTrail();
  armedTool.value = null;
}

function extendArea(view: Viewer, position: Cartesian3): void {
  if (areaClosed.value) {
    return;
  }

  if (areaEntities.length === 0) {
    areaEntities.push(
      view.entities.add({
        polygon: {
          hierarchy: new CallbackProperty(
            () => new PolygonHierarchy(areaPositions.value),
            false,
          ),
          material: AREA_FILL,
        },
      }),
      view.entities.add({
        polyline: {
          positions: new CallbackProperty(() => closedRing(), false),
          width: AREA_OUTLINE_WIDTH,
          material: AREA_COLOR,
          clampToGround: true,
        },
      }),
    );
  }

  areaPositions.value = [...areaPositions.value, position];
  areaEntities.push(
    view.entities.add({
      position: new ConstantPositionProperty(position),
      point: AREA_VERTEX,
    }),
  );
}

function closedRing(): Cartesian3[] {
  const positions = areaPositions.value;
  const [start] = positions;

  return areaClosed.value && start !== undefined
    ? [...positions, start]
    : positions;
}

function completeArea(): void {
  if (areaPositions.value.length < MIN_RING_POSITIONS - 1) {
    return;
  }

  areaClosed.value = true;
}

function saveArea(feature: AreaOfInterest): void {
  discardArea();
  mapArea(feature);
  emit("create", feature);

  armedTool.value = null;
}

function mapArea(feature: AreaOfInterest): void {
  const view = viewer;

  if (view === null || feature.window !== null) {
    return;
  }

  const holes = feature.shape.interiorRings.map(
    (ring) => new PolygonHierarchy(toCartesians(ring)),
  );

  mappedAreas.value.push(feature);
  mappedEntities.set(
    feature.id,
    view.entities.add({
      id: feature.id,
      name: feature.name,
      polygon: {
        hierarchy: new PolygonHierarchy(
          toCartesians(feature.shape.exteriorRing),
          holes,
        ),
        material: AREA_FILL,
        outline: true,
        outlineColor: AREA_COLOR,
      },
    }),
  );
}

function cancelArea(): void {
  discardArea();
  armedTool.value = null;
}

function discardArea(): void {
  for (const entity of areaEntities) {
    viewer?.entities.remove(entity);
  }

  areaPositions.value = [];
  areaClosed.value = false;
  areaEntities = [];
}

function discardTrail(): void {
  for (const entity of trailEntities) {
    viewer?.entities.remove(entity);
  }

  trailPositions.value = [];
  trailComplete.value = false;
  trailEntities = [];
}
</script>

<template>
  <div class="viewer">
    <div ref="container" class="scene" :class="{ drawing }"></div>

    <div
      v-if="armedTool === 'PointOfInterest'"
      class="metadata"
      :class="{ docked: drawerOpen }"
    >
      <PointOfInterestForm
        :position="markerPosition"
        @saved="saveMarker"
        @cancel="cancelMarker"
      />
    </div>

    <div
      v-else-if="armedTool === 'CameraCone'"
      class="metadata"
      :class="{ docked: drawerOpen }"
    >
      <CameraConeForm
        :position="markerPosition"
        @saved="saveCamera"
        @cancel="cancelCamera"
      />
    </div>

    <div
      v-else-if="armedTool === 'TrailRoute'"
      class="metadata"
      :class="{ docked: drawerOpen }"
    >
      <TrailRouteForm
        :path="trailPath"
        :complete="trailComplete"
        @saved="saveTrail"
        @cancel="cancelTrail"
      />
    </div>

    <div
      v-else-if="armedTool === 'AreaOfInterest'"
      class="metadata"
      :class="{ docked: drawerOpen }"
    >
      <AreaOfInterestForm
        :ring="areaRing"
        :closed="areaClosed"
        @saved="saveArea"
        @cancel="cancelArea"
      />
    </div>

    <div
      v-else-if="selected !== null"
      class="metadata"
      :class="{ docked: drawerOpen }"
    >
      <PointOfInterestDetails
        v-if="selected.featureType === 'PointOfInterest'"
        :feature="selected"
        @close="selected = null"
      />
      <TrailRouteDetails
        v-else-if="selected.featureType === 'TrailRoute'"
        :feature="selected"
        @close="selected = null"
      />
      <AreaOfInterestDetails
        v-else-if="selected.featureType === 'AreaOfInterest'"
        :feature="selected"
        @close="selected = null"
      />
      <CameraConeDetails
        v-else-if="selected.featureType === 'CameraCone'"
        :feature="selected"
        @close="selected = null"
      />
    </div>

    <FeatureToolbar :active="armedTool" @select="toggleTool" />

    <FeatureDrawer v-model:open="drawerOpen" v-model:view="drawerView">
      <template #controls>
        <EventRangeFields
          v-show="drawerView === 'events'"
          @change="eventRange = $event"
        />
      </template>

      <template #assets>
        <AssetTable :features="assets" />
      </template>

      <template #events>
        <EventTable :range="eventRange" />
      </template>
    </FeatureDrawer>
  </div>
</template>

<style scoped>
.viewer {
  --drawer-panel-height: 16rem;
  --drawer-handle-height: 2rem;
  --overlay-inset: 0.75rem;

  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.scene {
  width: 100%;
  height: 100%;
}

.metadata {
  position: absolute;
  top: var(--overlay-inset);
  left: var(--overlay-inset);
  z-index: 10;
  display: flex;
  max-height: calc(100% - var(--overlay-inset) * 2);
  transition: max-height 220ms ease;
}

.metadata.docked {
  max-height: calc(
    100% - var(--overlay-inset) * 2 - var(--drawer-panel-height) -
      var(--drawer-handle-height)
  );
}

@media (prefers-reduced-motion: reduce) {
  .metadata {
    transition: none;
  }
}

.scene.drawing :deep(canvas) {
  cursor: crosshair;
}
</style>
