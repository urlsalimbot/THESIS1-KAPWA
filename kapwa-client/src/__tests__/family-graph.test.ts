import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API module
vi.mock('../lib/api', () => ({
  getFamilyGraph: vi.fn(),
}));

import { getFamilyGraph } from '../lib/api';

describe('FamilyGraph — Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call getFamilyGraph with correct beneficiary ID', async () => {
    const mockResponse = {
      primary: { id: 'fm-1', fullName: 'Juan Cruz', relationship: 'Self', age: 45, isPrimary: true },
      members: [
        { id: 'fm-1', fullName: 'Juan Cruz', relationship: 'Self', age: 45, isPrimary: true },
        { id: 'fm-2', fullName: 'Maria Cruz', relationship: 'Spouse', age: 42, isPrimary: false },
      ],
      totalCount: 2,
    };

    vi.mocked(getFamilyGraph).mockResolvedValue(mockResponse);

    const result = await getFamilyGraph('ben-123');
    expect(getFamilyGraph).toHaveBeenCalledWith('ben-123');
    expect(result.members).toHaveLength(2);
    expect(result.primary.fullName).toBe('Juan Cruz');
  });

  it('should return empty when no family members exist', async () => {
    const mockResponse = { primary: null, members: [], totalCount: 0 };
    vi.mocked(getFamilyGraph).mockResolvedValue(mockResponse);

    const result = await getFamilyGraph('ben-456');
    expect(result.members).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it('should include depth information in response', async () => {
    const mockResponse = {
      primary: { id: 'fm-1', fullName: 'Juan Cruz', depth: 0, isPrimary: true },
      members: [
        { id: 'fm-1', fullName: 'Juan Cruz', depth: 0, isPrimary: true },
        { id: 'fm-3', fullName: 'Pedro Cruz', depth: 1, isPrimary: false },
      ],
      totalCount: 2,
    };

    vi.mocked(getFamilyGraph).mockResolvedValue(mockResponse);

    const result = await getFamilyGraph('ben-789');
    const depths = result.members.map((m: any) => m.depth);
    expect(depths).toContain(0);
    expect(depths).toContain(1);
  });
});
