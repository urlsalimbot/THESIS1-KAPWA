import { SetMetadata } from '@nestjs/common';
import { ResourceSensitivity as ResourceSensitivityType } from '../services/abac.service';

export const RESOURCE_SENSITIVITY_KEY = 'resourceSensitivity';
export const Sensitivity = (sensitivity: ResourceSensitivityType) =>
  SetMetadata(RESOURCE_SENSITIVITY_KEY, sensitivity);
