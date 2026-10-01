import { FileUploadList, type FilingDoc } from './FileUploadList';
import type { ReactNode } from 'react';

export type { FilingDoc };

interface RequirementFileUploadProps {
  caseId: string;
  requirementKey: string;
  canUpload?: boolean;
  /** A sealed step refuses the upload and the removal, so both controls go. */
  readOnly?: boolean;
  docs: FilingDoc[];
  onChanged: () => void;
  /** Per-file status rendered in the file row. */
  renderDocExtras?: (doc: FilingDoc) => ReactNode;
  /** Per-file actions rendered in the preview dialog footer. */
  renderPreviewFooter?: (doc: FilingDoc) => ReactNode;
}

export function RequirementFileUpload(props: RequirementFileUploadProps) {
  return (
    <FileUploadList
      compact
      docs={props.docs}
      canUpload={props.canUpload && !props.readOnly}
      onChanged={props.onChanged}
      renderDocExtras={props.renderDocExtras}
      renderPreviewFooter={props.renderPreviewFooter}
      formExtras={{ caseId: props.caseId, requirementKey: props.requirementKey, category: 'requirement' }}
    />
  );
}