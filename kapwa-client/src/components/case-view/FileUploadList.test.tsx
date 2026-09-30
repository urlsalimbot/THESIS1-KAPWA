import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toaster } from 'sonner';
import { FileUploadList, type FilingDoc } from './FileUploadList';

const { mockGetFilingObjectUrl, mockDownloadFilingDoc, mockDel } = vi.hoisted(() => ({
  mockGetFilingObjectUrl: vi.fn(),
  mockDownloadFilingDoc: vi.fn(),
  mockDel: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    del: (...args: unknown[]) => mockDel(...args),
  },
  uploadWithProgress: vi.fn().mockResolvedValue({ id: 'new' }),
  downloadFilingDoc: (...args: unknown[]) => mockDownloadFilingDoc(...args),
  getFilingObjectUrl: (...args: unknown[]) => mockGetFilingObjectUrl(...args),
}));

const PDF: FilingDoc = { id: 'd1', originalName: 'valid-id.pdf', fileSize: 12288, mimeType: 'application/pdf' };
const DOCX: FilingDoc = { id: 'd2', originalName: 'waiver.docx', fileSize: 4096, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const IMAGE: FilingDoc = { id: 'd3', originalName: 'id-photo.jpg', fileSize: 20480, mimeType: 'image/jpeg' };

function renderList(docs: FilingDoc[], extra: { renderPreviewFooter?: (d: FilingDoc) => React.ReactNode } = {}) {
  return render(
    <>
      <Toaster />
      <FileUploadList
        docs={docs}
        canUpload={false}
        onChanged={() => {}}
        formExtras={{ caseId: 'c1' }}
        {...extra}
      />
    </>,
  );
}

describe('FileUploadList document preview', () => {
  let created: string[];

  beforeEach(() => {
    created = [];
    mockGetFilingObjectUrl.mockReset();
    mockDownloadFilingDoc.mockReset().mockResolvedValue(undefined);
    mockDel.mockReset().mockResolvedValue({});
    // jsdom has no blob-URL implementation; track every URL so the tests can
    // assert the component actually releases them.
    URL.createObjectURL = vi.fn(() => {
      const url = `blob:mock/${created.length + 1}`;
      created.push(url);
      return url;
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    mockGetFilingObjectUrl.mockImplementation(async (id: string) => {
      await Promise.resolve();
      return URL.createObjectURL(new Blob());
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a PDF in the dialog instead of bouncing the worker to a new tab', async () => {
    const user = userEvent.setup();
    renderList([PDF]);

    await user.click(screen.getByRole('button', { name: /Preview valid-id\.pdf/ }));

    // The browser's own viewer handles paging and zoom, so a PDF dependency
    // would buy nothing.
    const frame = await screen.findByTitle('Preview valid-id.pdf');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('src')).toBe(created[created.length - 1]);
    expect(screen.queryByText(/cannot be shown in the browser/)).toBeNull();
  });

  it('renders an image inline', async () => {
    const user = userEvent.setup();
    renderList([IMAGE]);

    await user.click(screen.getByRole('button', { name: /Preview id-photo\.jpg/ }));

    const img = await screen.findByRole('img', { name: 'id-photo.jpg' });
    expect(img.getAttribute('src')).toBe(created[created.length - 1]);
  });

  it('treats a PDF with no recorded mimeType as a PDF rather than an unknown file', async () => {
    // mimeType is optional on the row payload; losing it must not downgrade a
    // readable document to a download button.
    const user = userEvent.setup();
    renderList([{ id: 'd4', originalName: 'birth-cert.pdf', fileSize: 900 }]);

    await user.click(screen.getByRole('button', { name: /Preview birth-cert\.pdf/ }));

    const frame = await screen.findByTitle('Preview birth-cert.pdf');
    expect(frame.tagName).toBe('IFRAME');
  });

  it('offers a download and says why for a type no browser can render', async () => {
    const user = userEvent.setup();
    renderList([DOCX]);

    await user.click(screen.getByRole('button', { name: /Preview waiver\.docx/ }));

    expect(await screen.findByText(/cannot be shown in the browser/)).toBeTruthy();
    expect(document.querySelector('iframe')).toBeNull();

    await user.click(screen.getByRole('button', { name: /^Download$/ }));
    expect(mockDownloadFilingDoc).toHaveBeenCalledWith('d2', 'waiver.docx');
  });

  it('revokes the preview blob when the dialog closes', async () => {
    const user = userEvent.setup();
    renderList([PDF]);

    await user.click(screen.getByRole('button', { name: /Preview valid-id\.pdf/ }));
    await screen.findByTitle('Preview valid-id.pdf');
    const previewUrl = created[created.length - 1];

    await user.keyboard('{Escape}');

    // Without this the object URL leaks for the life of the tab, once per
    // document a worker ever opened.
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith(previewUrl));
  });

  it('keeps an open preview alive when the underlying list revalidates', async () => {
    // The thumbnail effect re-runs on every SWR revalidation and revokes what it
    // created. If the preview shared that slot, the document would blank out
    // mid-read every time the case refreshed.
    const user = userEvent.setup();
    const { rerender } = renderList([PDF]);
    await user.click(screen.getByRole('button', { name: /Preview valid-id\.pdf/ }));
    const frame = await screen.findByTitle('Preview valid-id.pdf');
    const src = frame.getAttribute('src');

    rerender(
      <>
        <Toaster />
        <FileUploadList
          docs={[{ ...PDF }]}
          canUpload={false}
          onChanged={() => {}}
          formExtras={{ caseId: 'c1' }}
        />
      </>,
    );

    await waitFor(() => expect(screen.getByTitle('Preview valid-id.pdf')).toBeTruthy());
    expect(screen.getByTitle('Preview valid-id.pdf').getAttribute('src')).toBe(src);
  });

  it('surfaces a load failure instead of showing an empty dialog', async () => {
    const user = userEvent.setup();
    mockGetFilingObjectUrl.mockRejectedValueOnce(new Error('boom'));
    renderList([PDF]);

    await user.click(screen.getByRole('button', { name: /Preview valid-id\.pdf/ }));

    expect(await screen.findByText(/could not be loaded/)).toBeTruthy();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('renders footer actions for the open document only', async () => {
    const user = userEvent.setup();
    renderList([PDF], {
      renderPreviewFooter: (doc) => <button type="button">Confirm {doc.id}</button>,
    });

    expect(screen.queryByRole('button', { name: /Confirm d1/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: /Preview valid-id\.pdf/ }));
    expect(await screen.findByRole('button', { name: 'Confirm d1' })).toBeTruthy();
  });
});
