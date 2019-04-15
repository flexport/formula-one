// @flow

import {type FormState} from "../formState";
import {type FieldLink} from "../types";
import {treeFromValue} from "../shapedTree";
import {cleanErrors, cleanMeta} from "../types";

export function mockFormState<T>(value: T): FormState<T> {
  return [
    value,
    treeFromValue(value, {
      errors: cleanErrors,
      meta: cleanMeta,
    }),
  ];
}

export function expectLink(link: any) {
  expect(link).toEqual(
    expect.objectContaining({
      // TODO(dmnd): Would be nice if we could do something like
      // path: expect.arrayContaining(
      //   expect.objectContaining({
      //     type: expect.stringMatching(/(object)|(array)/),
      //   })
      // ),
      path: expect.anything(),
      formState: expect.anything(),
      onChange: expect.any(Function),
      onBlur: expect.any(Function),
    })
  );
  expect(Object.keys(link).length).toBe(4);
}

export function mockLink<T>(formState: FormState<T>): FieldLink<T> {
  return {
    path: [],
    formState,
    onChange: jest.fn(),
    onBlur: jest.fn(),
  };
}
