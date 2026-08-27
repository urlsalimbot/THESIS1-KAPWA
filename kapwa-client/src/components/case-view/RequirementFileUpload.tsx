import { FileUploadList, type FilingDoc } from './FileUploadList';

export type { FilingDoc };

interface RequirementFileUploadProps {
  caseId: string;
  requirementKey: string;
  canUpload?: boolean;
  docs: FilingDoc[];
  onChanged: () => void;
}

export function RequirementFileUpload(props: RequirementFileUploadProps) {
  return (
    <FileUploadList
      compact
      docs={props.docs}
      canUpload={props.canUpload}
      onChanged={props.onChanged}
      formExtras={{ caseId: props.caseId, requirementKey: props.requirementKey }}
    />
  );
}