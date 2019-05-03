// @flow strict

import type {ShapedTree, ShapedPath} from "./shapedTree";
import type {Path} from "./tree";
import {type FormState} from "./formState";

export type ClientErrors = Array<string> | "pending";
export type ServerErrors = Array<string> | "unchecked";
export type Err = {
  client: ClientErrors,
  server: ServerErrors,
};

export type MetaField = {
  touched: boolean, // a blur or a change
  changed: boolean,
  succeeded: boolean,
  asyncValidationInFlight: boolean,
};

export type MetaForm = {
  pristine: boolean,
  submitted: boolean,
};

export const cleanMeta: MetaField = {
  touched: false,
  changed: false,
  succeeded: false,
  asyncValidationInFlight: false,
};

export const cleanErrors: Err = {
  client: "pending",
  server: "unchecked",
};

export type Extras = {
  errors: Err,
  meta: MetaField,
};

export type AdditionalRenderInfo<T> = {|
  +touched: boolean,
  +changed: boolean,
  +shouldShowErrors: boolean,
  +unfilteredErrors: $ReadOnlyArray<string>,
  +valid: boolean,
  +asyncValidationInFlight: boolean,
  +value: T,
|};

export type OnChange<T> = (FormState<T>) => void;
export type OnBlur<T> = (ShapedTree<T, Extras>) => void;
// This seems like it should be ClientError => void, but the new subtree needs to travel up
export type OnValidation<T> = (ShapedPath<T>, ClientErrors) => void;

export type FieldLink<T> = {|
  +formState: FormState<T>,
  +onChange: OnChange<T>,
  +onBlur: OnBlur<T>,
  +path: Path,
|};

export type Validation<T> = T => Array<string>;

export type CustomChange<T> = (oldValue: T, newValue: T) => null | T;
