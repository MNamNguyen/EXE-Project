import { useCallback } from 'react';
import { format } from 'date-fns';
import { certificateApi } from '../../services/api';
import LayoutEditorModal from '../certificates/LayoutEditorModal';
import { FIELD_LABELS, DEFAULT_FIELDS } from '../certificates/certRender';

// Chỉnh bố cục chứng nhận — editor dùng chung với thiệp mời (LayoutEditorModal).
export default function CertificateEditorModal({ open, onClose, event, template, imageUrl, onSaved }) {
  const makeValues = useCallback((name) => ({
    name,
    event: event.name,
    date: `Ngày ${format(event.checkinOpen ? new Date(event.checkinOpen) : new Date(), 'dd/MM/yyyy')}`,
    code: 'Mã chứng nhận: CN-XXXX-XXXX',
  }), [event.name, event.checkinOpen]);

  return (
    <LayoutEditorModal
      open={open}
      onClose={onClose}
      title="Chỉnh bố cục chứng nhận"
      template={template}
      imageUrl={imageUrl}
      fieldLabels={FIELD_LABELS}
      defaultFields={DEFAULT_FIELDS}
      makeValues={makeValues}
      onSave={(fields) => certificateApi.saveFields(event.id, fields)}
      onSaved={onSaved}
      onPreview={(name) => certificateApi.previewPdf(event.id, name)}
      previewFilename={`xem-thu-chung-nhan-${event.name}.pdf`}
    />
  );
}
