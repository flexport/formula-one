// @flow strict
import type {MetaForm, MetaField} from "./types";

export type FeedbackStrategy = (MetaForm, MetaField) => boolean;

const strategies: {[string]: FeedbackStrategy} = Object.freeze({
  Always() {
    return true;
  },
  Touched(metaForm: MetaForm, metaField: MetaField) {
    return metaField.touched;
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
});

export default strategies;
