import { FileUploadList, type FilingDoc } from './FileUploadList';
import type { ReactNode } from 'react';

export type { FilingDoc };

interface RequirementFileUploadProps {
  caseId: string;
  requirementKey: string;
  canUpload?: boolean;
  docs: FilingDoc[];
  onChanged: () => void;
  /** Per-file controls (on-site status, verify toggle) rendered in the file row. */
  renderDocExtras?: (doc: FilingDoc) => ReactNode;
}

export function RequirementFileUpload(props: RequirementFileUploadProps) {
  return (
    <FileUploadList
      compact
      docs={props.docs}
      canUpload={props.canUpload}
      onChanged={props.onChanged}
      renderDocExtras={props.renderDocExtras}
      formExtras={{ caseId: props.caseId, requirementKey: props.requirementKey, category: 'requirement' }}
    />
  );
}