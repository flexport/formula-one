// @flow strict
// Just re-exports and some masssaging

import FeedbackStrategies, {and, or, not} from "./feedbackStrategies";
import {LinkTap} from "./testutils";

export {default as Tracer} from "./tracer";
export {default as Form} from "./Form";
export {default as ObjectField} from "./ObjectField";
export {default as ArrayField} from "./ArrayField";
export {default as ErrorsHelper} from "./ErrorsHelper";
export {default as Field} from "./Field";

const mergedStrategies = {
  ...FeedbackStrategies,
  and,
  or,
  not,
};
export {mergedStrategies as FeedbackStrategies};

export type {FeedbackStrategy} from "./feedbackStrategies";
export type {Validation, FieldLink} from "./types";

export {LinkTap};
