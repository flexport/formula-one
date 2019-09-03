import * as React from "react";

export type FeedbackStrategy = {__type__: FeedbackStrategy};
declare namespace FeedbackStrategies {
  export function and(
    a: FeedbackStrategy,
    b: FeedbackStrategy
  ): FeedbackStrategy;
  export function or(
    a: FeedbackStrategy,
    b: FeedbackStrategy
  ): FeedbackStrategy;
  export function not(x: FeedbackStrategy): FeedbackStrategy;
  export const Always: FeedbackStrategy;
  export const Touched: FeedbackStrategy;
  export const Blurred: FeedbackStrategy;
  export const Changed: FeedbackStrategy;
  export const ClientValidationSucceeded: FeedbackStrategy;
  export const Pristine: FeedbackStrategy;
  export const Submitted: FeedbackStrategy;
}

export type ExternalErrors = null | {[path: string]: ReadonlyArray<string>};

export type FieldLink<T> = {__type__: "FieldLink"};

export interface AdditionalRenderInfo<T> {
  touched: boolean;
  changed: boolean;
  shouldShowErrors: boolean;
  unfilteredErrors: ReadonlyArray<string>;
  valid: boolean;
  asyncValidationInFlight: boolean;
  value: T;
}

export interface FormProps<T, ExtraSubmitData> {
  initialValue: T;
  feedbackStrategy?: FeedbackStrategy;
  onSubmit?: (value: T, extraData: ExtraSubmitData) => void;
  onChange?: (value: T) => void;
  onValidation?: (valid: boolean) => void;
  externalErrors?: ExternalErrors;
  children: (
    link: FieldLink<T>,
    onSubmit: (extraData: ExtraSubmitData) => void,
    additionalInfo: AdditionalRenderInfo<T>
  ) => React.ReactNode;
}
declare class Form<T, ExtraSubmitData> extends React.Component<
  FormProps<T, ExtraSubmitData>
> {
  submit(extraData: ExtraSubmitData): void;
}

export type Validation<T> = (value: T) => string[];
export type CustomChange<T> = (prevValue: T, nextValue: T) => null | T;

type Links<T> = {[K in keyof T]: FieldLink<T[K]>};

export interface ObjectFieldProps<T extends object> {
  link: FieldLink<T>;
  validation?: Validation<T>;
  customChange?: CustomChange<T>;
  children: (
    links: Links<T>,
    additionalInfo: AdditionalRenderInfo<T>
  ) => React.ReactNode;
}
declare class ObjectField<T extends object> extends React.Component<
  ObjectFieldProps<T>
> {}

export type Span<T> = [number, ReadonlyArray<T>];
export type AddField<T> = (index: number, value: T) => void;
export type RemoveField = (index: number) => void;
export type MoveField = (oldIndex: number, newIndex: number) => void;
export type AddFields<T> = (spans: ReadonlyArray<Span<T>>) => void;
export type FilterFields<T> = (
  predicate: (value: T, index: number, arr: ReadonlyArray<T>) => boolean
) => void;
export type ModifyFields<T> = (modifiers: {
  insertSpans?: ReadonlyArray<Span<T>>;
  filterPredicate?: (value: T, index: number, arr: ReadonlyArray<T>) => boolean;
}) => void;

export interface ArrayFieldProps<E, T extends Array<E>> {
  link: FieldLink<T>;
  validation?: Validation<T>;
  customChange?: CustomChange<T>;
  children: (
    links: Links<T>,
    arrayOperations: {
      addField: AddField<E>;
      removeField: RemoveField;
      moveField: MoveField;
      addFields: AddFields<E>;
      filterFields: FilterFields<E>;
      modifyFields: ModifyFields<E>;
    },
    additionalInfo: AdditionalRenderInfo<T>
  ) => React.ReactNode;
}
declare class ArrayField<E, T extends Array<E>> extends React.Component<
  ArrayFieldProps<E, T>
> {}

export interface FieldProps<T> {
  link: FieldLink<T>;
  validation?: Validation<T>;
  children: (
    value: T,
    errors: ReadonlyArray<string>,
    onChange: (value: T) => void,
    onBlur: () => void,
    additionalInfo: AdditionalRenderInfo<T>
  ) => React.ReactNode;
}
declare class Field<T> extends React.Component<FieldProps<T>> {}

export type ClientErrors = ReadonlyArray<string> | "pending";
export type ExtErrors = ReadonlyArray<string> | "unchecked";
export interface ErrorsHelperProps<T> {
  link: FieldLink<T>;
  children: (errorsInfo: {
    shouldShowErrors: boolean;
    client: ClientErrors;
    external: ExtErrors;
    flattened: ReadonlyArray<string>;
  }) => React.ReactNode;
}
declare class ErrorsHelper<T> extends React.Component<ErrorsHelperProps<T>> {}
