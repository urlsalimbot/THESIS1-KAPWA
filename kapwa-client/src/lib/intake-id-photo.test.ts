import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setPendingIdPhoto, getPendingIdPhoto, uploadIntakeIdPhoto } from './intake-id-photo';
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
    setPendingIdPhoto(stubFile());
  });

  afterEach(() => {
    setPendingIdPhoto(null);
  });

  it('uploads the pending photo and clears the holder on success', async () => {
    (uploadWithProgress as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const ok = await uploadIntakeIdPhoto('case-1');

    expect(ok).toBe(true);
    expect(uploadWithProgress).toHaveBeenCalledWith(
      '/filing/upload',
      expect.any(FormData),
      expect.any(Function),
    );
    const formData = (uploadWithProgress as ReturnType<typeof vi.fn>).mock.calls[0][1] as FormData;
    expect(formData.get('file')).toBeInstanceOf(File);
    expect(formData.get('category')).toBe('id_photo');
    expect(formData.get('caseId')).toBe('case-1');
    expect(getPendingIdPhoto()).toBeNull();
  });

  it('invalidates the case photo SWR keys after a successful upload', async () => {
    (uploadWithProgress as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await uploadIntakeIdPhoto('case-1');

    expect(mutate).toHaveBeenCalledWith(queryKeys.filing.byCase('case-1'));
    expect(mutate).toHaveBeenCalledWith(queryKeys.filing.caseIdPhoto('case-1'));
  });

  it('clears the holder even when the upload fails', async () => {
    (uploadWithProgress as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));

    const ok = await uploadIntakeIdPhoto('case-1');

    expect(ok).toBe(false);
    expect(getPendingIdPhoto()).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('is a no-op when no photo is pending', async () => {
    setPendingIdPhoto(null);

    await expect(uploadIntakeIdPhoto('case-1')).resolves.toBe(true);
    expect(uploadWithProgress).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });
});