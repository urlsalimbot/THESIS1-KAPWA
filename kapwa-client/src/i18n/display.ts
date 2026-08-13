import type { TFunction } from 'i18next';

export const statusLabel = (t: TFunction, raw: string): string =>
  t(`status.${raw}`, { defaultValue: raw });

export const categoryLabel = (t: TFunction, raw: string): string =>
  t(`category.${raw}`, { defaultValue: raw });

export const interventionTypeLabel = (t: TFunction, raw: string): string =>
  t(`interventionType.${raw}`, { defaultValue: raw });

export const referralStatusLabel = (t: TFunction, raw: string): string =>
  t(`referralStatus.${raw}`, { defaultValue: raw });

export const syncStatusLabel = (t: TFunction, raw: string): string =>
  t(`syncStatus.${raw}`, { defaultValue: raw });
