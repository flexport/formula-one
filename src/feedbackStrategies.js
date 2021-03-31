// @flow strict
import type {MetaForm, MetaField} from "./types";

export type FeedbackStrategy = (MetaForm, MetaField) => boolean;

const strategies = {
  Always(): boolean {
    return true;
  },
  Touched(metaForm: MetaForm, metaField: MetaField): boolean {
    return metaField.touched;
  },
  Blurred(metaForm: MetaForm, metaField: MetaField): boolean {
    return metaField.blurred;
  },
  Changed(metaForm: MetaForm, metaField: MetaField): boolean {
    return metaField.changed;
  },
  ClientValidationSucceeded(metaForm: MetaForm, metaField: MetaField): boolean {
    return metaField.succeeded;
  },
  Pristine(metaForm: MetaForm): boolean {
    return metaForm.pristine;
  },
  Submitted(metaForm: MetaForm): boolean {
    return metaForm.submitted;
  },
};

export default strategies;

export function and(
  a: FeedbackStrategy,
  b: FeedbackStrategy
): FeedbackStrategy {
  return (metaForm: MetaForm, metaField: MetaField) => {
    return a(metaForm, metaField) && b(metaForm, metaField);
  };
}

export function or(a: FeedbackStrategy, b: FeedbackStrategy): FeedbackStrategy {
  return (metaForm: MetaForm, metaField: MetaField) => {
    return a(metaForm, metaField) || b(metaForm, metaField);
  };
}

export function not(s: FeedbackStrategy): FeedbackStrategy {
  return (metaForm: MetaForm, metaField: MetaField) => {
    return !s(metaForm, metaField);
  };
}
