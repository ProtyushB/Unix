import React from 'react';
import { Wrench } from 'lucide-react-native';
import { DetailCard } from '../../shared/detail/parts/DetailCard';
import { DetailField } from '../../shared/detail/parts/DetailField';
import type { ServiceDetailSlots } from './ServiceDetailBase';
import type { ServiceFormState } from './serviceDetail.model';
import { isEditable, type DetailMode } from './serviceDetail.view';

interface PharmacySlotsInput {
  mode: DetailMode;
  form: ServiceFormState;
  onExtraChange: (field: string, value: unknown) => void;
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/**
 * Pharmacy's contribution: one field and one card, positionally parallel to parlour's.
 *
 * `equipmentRequired` is what the service is performed WITH. The DTO also carries `requirements` —
 * what the CUSTOMER must bring — which has no screen here and is deliberately left out of the
 * config so it round-trips untouched rather than being overwritten with a blank.
 */
export function pharmacySlots({
  mode,
  form,
  onExtraChange,
}: PharmacySlotsInput): ServiceDetailSlots {
  const editable = isEditable(mode);
  const consultationType = str(form.extras.consultationType);

  return {
    primaryField: (
      <DetailField
        label="Consultation Type"
        value={consultationType}
        editable={editable}
        onChange={(v) => onExtraChange('consultationType', v)}
        placeholder="e.g. In-Person / Telehealth"
      />
    ),
    badgeLabel: consultationType || undefined,
    moduleSections: (
      <DetailCard title="Equipment Required" icon={Wrench} gap={editable ? 13 : 12}>
        <DetailField
          label="Required Equipment"
          value={str(form.extras.equipmentRequired)}
          editable={editable}
          multiline
          readLayout="block"
          maxLength={255}
          onChange={(v) => onExtraChange('equipmentRequired', v)}
          placeholder="e.g. BP Monitor, Cuff, Stethoscope"
        />
      </DetailCard>
    ),
  };
}
