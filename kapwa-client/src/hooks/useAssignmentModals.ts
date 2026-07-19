import { useState } from 'react';
import { api } from '../lib/api';

interface ModalState {
  assignmentId: string;
  stepOrder: number;
  stepName: string;
}

export function useAssignmentModals() {
  const [rejectModal, setRejectModal] = useState<ModalState | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [overrideModal, setOverrideModal] = useState<ModalState | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'approved' | 'rejected'>('approved');
  const [overrideReason, setOverrideReason] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  function openRejectModal(assignmentId: string, stepOrder: number, stepName: string) {
    setRejectModal({ assignmentId, stepOrder, stepName });
    setRejectReason('');
  }

  function openOverrideModal(assignmentId: string, stepOrder: number, stepName: string) {
    setOverrideModal({ assignmentId, stepOrder, stepName });
    setOverrideStatus('approved');
    setOverrideReason('');
  }

  async function handleConfirmReject(onDone: () => void) {
    if (!rejectModal || !rejectReason.trim()) return;
    setActionMsg('');
    try {
      await api.post(`/program-assignments/${rejectModal.assignmentId}/steps/${rejectModal.stepOrder}/reject`, {
        stepOrder: rejectModal.stepOrder, remarks: rejectReason,
      });
      setActionMsg(`Step ${rejectModal.stepOrder + 1} rejected`);
      setRejectModal(null);
      setRejectReason('');
      onDone();
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : 'Error rejecting step');
    }
  }

  async function handleConfirmOverride(onDone: () => void) {
    if (!overrideModal || !overrideReason.trim()) return;
    setActionMsg('');
    try {
      await api.post(`/program-assignments/${overrideModal.assignmentId}/steps/${overrideModal.stepOrder}/override`, {
        stepOrder: overrideModal.stepOrder, overrideStatus, remarks: overrideReason,
      });
      setActionMsg(`Step ${overrideModal.stepOrder + 1} overridden to ${overrideStatus}`);
      setOverrideModal(null);
      setOverrideReason('');
      onDone();
    } catch (err: unknown) {
      setActionMsg(err instanceof Error ? err.message : 'Error overriding step');
    }
  }

  return {
    rejectModal, setRejectModal, rejectReason, setRejectReason,
    overrideModal, setOverrideModal, overrideStatus, setOverrideStatus, overrideReason, setOverrideReason,
    actionMsg, setActionMsg,
    openRejectModal, openOverrideModal, handleConfirmReject, handleConfirmOverride,
  };
}
