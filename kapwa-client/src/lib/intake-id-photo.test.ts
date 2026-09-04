import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setPendingBeneficiaryIdPhoto, getPendingBeneficiaryIdPhoto,
  setPendingClaimantIdPhoto, getPendingClaimantIdPhoto,
  clearPendingIdPhoto, uploadIntakeIdPhotos,
} from './intake-id-photo';
import { uploadWithProgress } from './api';
import { mutate } from 'swr';
import { queryKeys } from './query-keys';

vi.mock('./api', () => ({
  uploadWithProgress: vi.fn(),
}));

vi.mock('swr', () => ({
  mutate: vi.fn(),
}));

const stubFile = () => new File(['id'], 'id.png', { type: 'image/png' });

describe('intake-id-photo holder lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPendingBeneficiaryIdPhoto(stubFile());
    setPendingClaimantIdPhoto(stubFile());
  });

  afterEach(() => {
    clearPendingIdPhoto();
  });

  it('uploads both pending photos tagged by subject and clears the holders on success', async () => {
    (uploadWithProgress as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const ok = await uploadIntakeIdPhotos('case-1');

    expect(ok).toBe(true);
    expect(uploadWithProgress).toHaveBeenCalledTimes(2);

    const calls = (uploadWithProgress as ReturnType<typeof vi.fn>).mock.calls;
    const categories = calls.map((c) => (c[1] as FormData).get('category'));
    const notes = calls.map((c) => (c[1] as FormData).get('notes'));
    const caseIds = calls.map((c) => (c[1] as FormData).get('caseId'));
    expect(categories).toEqual(['id_photo', 'id_photo']);
    expect(notes).toEqual(['beneficiary', 'claimant']);
    expect(caseIds).toEqual(['case-1', 'case-1']);
    expect(getPendingBeneficiaryIdPhoto()).toBeNull();
    expect(getPendingClaimantIdPhoto()).toBeNull();
  });

  it('invalidates the case photo SWR keys after a successful upload', async () => {
    (uploadWithProgress as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await uploadIntakeIdPhotos('case-1');

    expect(mutate).toHaveBeenCalledWith(queryKeys.filing.byCase('case-1'));
    expect(mutate).toHaveBeenCalledWith(queryKeys.filing.caseIdPhoto('case-1'));
  });

  it('clears the holders even when an upload fails', async () => {
    (uploadWithProgress as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));

    const ok = await uploadIntakeIdPhotos('case-1');

    expect(ok).toBe(false);
    expect(getPendingBeneficiaryIdPhoto()).toBeNull();
    expect(getPendingClaimantIdPhoto()).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('is a no-op when no photos are pending', async () => {
    clearPendingIdPhoto();
    expect(getPendingBeneficiaryIdPhoto()).toBeNull();
    expect(getPendingClaimantIdPhoto()).toBeNull();

    await expect(uploadIntakeIdPhotos('case-1')).resolves.toBe(true);
    expect(uploadWithProgress).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('uploads only the beneficiary photo when only that one is pending', async () => {
    setPendingClaimantIdPhoto(null);
    (uploadWithProgress as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const ok = await uploadIntakeIdPhotos('case-1');

    expect(ok).toBe(true);
    expect(uploadWithProgress).toHaveBeenCalledTimes(1);
    expect((uploadWithProgress as ReturnType<typeof vi.fn>).mock.calls[0][1].get('notes')).toBe('beneficiary');
  });
});