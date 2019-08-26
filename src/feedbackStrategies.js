// @flow strict
import type {MetaForm, MetaField} from "./types";

export type FeedbackStrategy = (MetaForm, MetaField) => boolean;

const strategies = {
  Always() {
    return true;
  },
  Touched(metaForm: MetaForm, metaField: MetaField) {
    return metaField.touched;
  },
  Blurred(metaForm: MetaForm, metaField: MetaField) {
    return metaField.blurred;
  },
  Changed(metaForm: MetaForm, metaField: MetaField) {
    return metaField.changed;
  },
  ClientValidationSucceeded(metaForm: MetaForm, metaField: MetaField) {
    return metaField.succeeded;
  },
  Pristine(metaForm: MetaForm) {
    return metaForm.pristine;
  },
  Submitted(metaForm: MetaForm) {
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
