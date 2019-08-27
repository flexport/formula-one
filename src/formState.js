// @flow strict

import {
  type ShapedTree,
  dangerouslyReplaceObjectChild,
  dangerouslyReplaceArrayChild,
  forgetShape,
  shapedObjectChild,
  shapedArrayChild,
  foldMapShapedTree,
  getRootData,
  treeFromValue,
} from "./shapedTree";
import {cleanMeta, cleanErrors} from "./types";
import type {Extras} from "./types";
import {replaceAt} from "./utils/array";

// invariant, Tree is shaped like T
export type FormState<T> = [T, ShapedTree<T, Extras>];

export function getExtras<T>(formState: FormState<T>): Extras {
  return forgetShape(formState[1]).data;
}

export function freshFormState<T>(value: T): FormState<T> {
  return [
    value,
    treeFromValue(value, {
      errors: cleanErrors,
      meta: cleanMeta,
    }),
  ];
}

export function changedFormState<T>(value: T): FormState<T> {
  return [
    value,
    treeFromValue(value, {
      errors: cleanErrors,
      meta: {
        touched: true,
        changed: true,
        succeeded: false,
        asyncValidationInFlight: false,
      },
    }),
  ];
}

export function flatRootErrors<T>(formState: FormState<T>): Array<string> {
  const errors = getRootData(formState[1]).errors;

  let flatErrors = [];
  if (errors.client !== "pending") {
    flatErrors = flatErrors.concat(errors.client);
  }
  if (errors.external !== "unchecked") {
    flatErrors = flatErrors.concat(errors.external);
  }
  return flatErrors;
}

export function objectChild<T: {}, V>(
  key: string,
  formState: FormState<T>
): FormState<V> {
  const [value, tree] = formState;
  return [value[key], shapedObjectChild(key, tree)];
}

export function arrayChild<E>(
  index: number,
  formState: FormState<Array<E>>
): FormState<E> {
  const [value, tree] = formState;
  return [value[index], shapedArrayChild(index, tree)];
}

export function setExtrasBlurred({errors, meta}: Extras): Extras {
  return {errors, meta: {...meta, touched: true, blurred: true}};
}

export function replaceObjectChild<T: {}, V>(
  key: string,
  child: FormState<V>,
  formState: FormState<T>
): FormState<T> {
  const [value, tree] = formState;
  const [childValue, childTree] = child;
  return [
    {...value, [key]: childValue},
    dangerouslyReplaceObjectChild(key, childTree, tree),
  ];
}

export function replaceArrayChild<E>(
  index: number,
  child: FormState<E>,
  formState: FormState<Array<E>>
): FormState<Array<E>> {
  const [value, tree] = formState;
  const [childValue, childTree] = child;
  return [
    replaceAt(index, childValue, value),
    dangerouslyReplaceArrayChild(index, childTree, tree),
  ];
}

// Is whole tree client valid?
// TODO(zach): This will have to change with asynchronous validations. We will
// need a "pending" value as well as an "unchecked" value.
// Currently, things in the tree which are not reflected in the React tree are
// marked "pending", which means they can be valid :grimace:.
export function isValid<T>(formState: FormState<T>): boolean {
  return foldMapShapedTree(
    ({errors: {client}}) => client === "pending" || client.length === 0,
    true,
    (l, r) => l && r,
    formState[1]
  );
}

export function isExternallyValid<T>(formState: FormState<T>): boolean {
  return foldMapShapedTree(
    ({errors: {external}}) => external === "unchecked" || external.length === 0,
    true,
    (l, r) => l && r,
    formState[1]
  );
}
