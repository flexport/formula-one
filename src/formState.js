// @flow strict

import {
  type ShapedTree,
  mapRoot,
  dangerouslyReplaceObjectChild,
  dangerouslyReplaceArrayChild,
  forgetShape,
  dangerouslySetChildren,
  shapedObjectChild,
  shapedArrayChild,
  shapedZipWith,
  foldMapShapedTree,
  getRootData,
  treeFromValue,
} from "./shapedTree";
import {cleanMeta, cleanErrors} from "./types";
import type {Extras, ServerErrors} from "./types";
import {replaceAt} from "./utils/array";
import invariant from "./utils/invariant";

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
  if (errors.server !== "unchecked") {
    flatErrors = flatErrors.concat(errors.server);
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

export function setTouched<T>(formState: FormState<T>): FormState<T> {
  return [
    formState[0],
    mapRoot(
      ({errors, meta}) => ({errors, meta: {...meta, touched: true}}),
      formState[1]
    ),
  ];
}

export function setExtrasTouched({errors, meta}: Extras): Extras {
  return {errors, meta: {...meta, touched: true}};
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

export function replaceArrayChildren<E>(
  children: Array<FormState<E>>,
  formState: FormState<Array<E>>
): FormState<Array<E>> {
  const [_, tree] = formState;
  const [childValues, childTrees]: [
    Array<E>,
    Array<ShapedTree<E, Extras>>,
  ] = children.reduce(
    (memo, child) => {
      const [childValue, childTree] = child;
      return [memo[0].concat([childValue]), memo[1].concat([childTree])];
    },
    [[], []]
  );
  return [childValues, dangerouslySetChildren(childTrees, tree)];
}

function combineExtrasForValidation(oldExtras: Extras, newExtras: Extras) {
  const {meta: oldMeta, errors: oldErrors} = oldExtras;
  const {meta: newMeta, errors: newErrors} = newExtras;

  // Only asyncValidationInFlight + succeeded may change
  invariant(
    oldMeta.touched === newMeta.touched,
    "Recieved a new meta.touched when monoidally combining errors"
  );
  invariant(
    oldMeta.changed === newMeta.changed,
    "Recieved a new meta.changed when monoidally combining errors"
  );

  // No combination is possible if the old client errors are not pending
  if (oldErrors.client !== "pending") {
    return oldExtras;
  }

  // No combination is possible if the new client errors are pending
  if (newErrors.client === "pending") {
    return oldExtras;
  }

  return {
    meta: {
      touched: oldMeta.touched,
      changed: oldMeta.changed,
      succeeded: newMeta.succeeded,
      asyncValidationInFlight:
        oldMeta.asyncValidationInFlight || newMeta.asyncValidationInFlight,
    },
    errors: {
      client: newErrors.client,
      server: newErrors.server,
    },
  };
}

function monoidallyCombineTreesForValidation<T>(
  oldTree: ShapedTree<T, Extras>,
  newTree: ShapedTree<T, Extras>
): ShapedTree<T, Extras> {
  return shapedZipWith(combineExtrasForValidation, oldTree, newTree);
}

// Also sets asyncValidationInFlight
export function monoidallyCombineFormStatesForValidation<T>(
  oldState: FormState<T>,
  newState: FormState<T>
): FormState<T> {
  // Value should never change when combining errors
  invariant(
    oldState[0] === newState[0],
    "Received a new value when monoidally combining errors"
  );

  return [
    oldState[0],
    monoidallyCombineTreesForValidation(oldState[1], newState[1]),
  ];
}

function replaceServerErrorsExtra(
  newErrors: ServerErrors,
  oldExtras: Extras
): Extras {
  const {meta, errors} = oldExtras;
  return {
    meta,
    errors: {
      client: errors.client,
      server: newErrors,
    },
  };
}
export function replaceServerErrors<T>(
  serverErrors: ShapedTree<T, ServerErrors>,
  formState: FormState<T>
): FormState<T> {
  return [
    formState[0],
    shapedZipWith(replaceServerErrorsExtra, serverErrors, formState[1]),
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
