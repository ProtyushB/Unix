import React from 'react';
import { Wrench } from 'lucide-react-native';
import { DetailCard } from '../../shared/detail/parts/DetailCard';
import { DetailField } from '../../shared/detail/parts/DetailField';
import type { ServiceDetailSlots } from './ServiceDetailBase';
import type { ServiceFormState } from './serviceDetail.model';
import { isEditable, type DetailMode } from './serviceDetail.view';

interface ParlourSlotsInput {
  mode: DetailMode;
  form: ServiceFormState;
  onExtraChange: (field: string, value: unknown) => void;
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/**
 * Parlour's contribution to the service detail screen: one field and one card.
 *
 * A "wrapper" here is genuinely only JSX. Everything with a decision in it — which fields exist,
 * what they default to, what validation they carry — lives in `serviceDetail.modules.ts`, because
 * that file is a `.ts` and therefore testable under this repo's jest config.
 */
export function parlourSlots({ mode, form, onExtraChange }: ParlourSlotsInput): ServiceDetailSlots {
  const editable = isEditable(mode);
  const expertiseLevel = str(form.extras.expertiseLevel);

  return {
    primaryField: (
      <DetailField
        label="Expertise Level"
        value={expertiseLevel}
        editable={editable}
        onChange={(v) => onExtraChange('expertiseLevel', v)}
        placeholder="e.g. Basic / Advanced / Premium"
      />
    ),
    // Free text server-side, so whatever the owner types is what the badge says.
    badgeLabel: expertiseLevel || undefined,
    moduleSections: (
      <DetailCard title="Tools Required" icon={Wrench} gap={editable ? 13 : 12}>
        <DetailField
          label="Required Tools"
          value={str(form.extras.toolsRequired)}
          editable={editable}
          multiline
          readLayout="block"
          // varchar(255) behind a 70-tall box — see the same cap on Service Includes.
          maxLength={255}
          onChange={(v) => onExtraChange('toolsRequired', v)}
          placeholder="e.g. Airbrush Gun, Professional Makeup Kit"
        />
      </DetailCard>
    ),
  };
}
