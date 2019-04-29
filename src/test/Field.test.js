// @flow

import * as React from "react";
import TestRenderer from "react-test-renderer";

import Field from "../Field";
import {type FieldLink} from "../types";
import {mockFormState, mockLink} from "./tools";
import TestField, {TestInput} from "./TestField";
import TestForm from "./TestForm";
import {mapRoot} from "../shapedTree";

describe("Field", () => {
  it("ensures that the link inner type matches the type of the validation", () => {
    const formState = mockFormState("Hello world.");
    const link = mockLink(formState);

    // $ExpectError
    <Field link={link} validation={(_e: empty) => []}>
      {() => null}
    </Field>;

    <Field link={link} validation={(_e: string) => []}>
      {() => null}
    </Field>;
  });

  it("registers and unregisters for validation", () => {
    const formState = mockFormState("Hello world.");
    const link = mockLink(formState);
    const unregister = jest.fn();
    const registerValidation = jest.fn(() => ({
      replace: jest.fn(),
      unregister,
    }));

    const renderer = TestRenderer.create(
      <TestForm registerValidation={registerValidation}>
        <Field link={link} validation={jest.fn(() => [])}>
          {jest.fn(() => null)}
        </Field>
      </TestForm>
    );

    expect(registerValidation).toBeCalledTimes(1);
    renderer.unmount();
    expect(unregister).toBeCalledTimes(1);
  });

  it("calls replace when changing the validation function", () => {
    const replace = jest.fn();
    const registerValidation = jest.fn(() => ({
      replace,
      unregister: jest.fn(),
    }));

    function Component() {
      return (
        <TestForm registerValidation={registerValidation}>
          <Field
            link={mockLink(mockFormState("Hello world."))}
            validation={() => []}
          >
            {() => null}
          </Field>
        </TestForm>
      );
    }

    const renderer = TestRenderer.create(<Component />);
    expect(registerValidation).toBeCalledTimes(1);

    renderer.update(<Component />);
    expect(replace).toBeCalledTimes(1);
  });

  it("validates new values and passes result to onChange", () => {
    const formState = mockFormState("Hello world.");
    const link = mockLink(formState);

    const updateNodeAtPath = jest.fn((path, formState) => formState);

    const renderer = TestRenderer.create(
      <TestForm updateNodeAtPath={updateNodeAtPath}>
        <TestField link={link} />
      </TestForm>
    );
    const inner = renderer.root.findByType(TestInput);

    expect(updateNodeAtPath).toHaveBeenCalledTimes(0);
    expect(link.onChange).toHaveBeenCalledTimes(0);

    inner.instance.change("You've got mail");

    expect(updateNodeAtPath).toHaveBeenCalledTimes(1);
    expect(updateNodeAtPath).toHaveBeenCalledWith(
      [],
      ["You've got mail", expect.anything()]
    );

    expect(link.onChange).toHaveBeenCalledTimes(1);
    expect(link.onChange).toHaveBeenCalledWith([
      "You've got mail",
      formState[1],
    ]);
  });

  it("calls the link onBlur with correct meta", () => {
    const formState = mockFormState("");
    const link = mockLink(formState);

    const renderer = TestRenderer.create(<TestField link={link} />);
    const inner = renderer.root.findByType(TestInput);

    expect(link.onBlur).toHaveBeenCalledTimes(0);
    inner.instance.blur();
    expect(link.onBlur).toHaveBeenCalledTimes(1);

    const tree = link.onBlur.mock.calls[0][0];
    expect(tree.data).toMatchObject({
      meta: {
        touched: true,
        changed: false,
        succeeded: false,
      },
    });
  });

  it("flattens errors for the inner component", () => {
    let formState = mockFormState("");
    formState[1] = mapRoot(
      oldRoot => ({
        ...oldRoot,
        errors: {
          client: ["Some", "client", "errors"],
          server: ["Server errors", "go here"],
        },
      }),
      formState[1]
    );
    const link = mockLink(formState);

    const renderer = TestRenderer.create(<TestField link={link} />);
    const inner = renderer.root.findByType(TestInput);

    expect(inner.props.errors).toEqual([
      "Some",
      "client",
      "errors",
      "Server errors",
      "go here",
    ]);
  });

  it("Passes value of the right type to its render function", () => {
    const formState = mockFormState("Hello there");
    const link = mockLink(formState);

    <Field link={link}>
      {/* $ExpectError */}
      {(_value: empty) => null}
    </Field>;

    <Field link={link}>{(_value: string) => null}</Field>;
  });

  it("Passes onChange of the right type to its render function", () => {
    const formState = mockFormState("Hello there");
    const link: FieldLink<string> = mockLink(formState);

    <Field link={link}>
      {/* $ExpectError */}
      {(_value, _errors, _onChange: empty) => null}
    </Field>;

    // $ExpectError
    <Field link={link}>
      {(_value, _errors, _onChange: number => void) => null}
    </Field>;

    <Field link={link}>
      {(_value, _errors, _onChange: string => void) => null}
    </Field>;
  });

  it("Passes additional information to its render function", () => {
    const formState = mockFormState(10);
    // $FlowFixMe
    formState[1].data.errors = {
      server: ["A server error"],
      client: ["A client error"],
    };
    const link = mockLink(formState);
    const renderFn = jest.fn(() => null);

    TestRenderer.create(<Field link={link}>{renderFn}</Field>);

    expect(renderFn).toHaveBeenCalled();
    expect(renderFn).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        touched: false,
        changed: false,
        shouldShowErrors: expect.anything(),
        unfilteredErrors: expect.arrayContaining([
          "A server error",
          "A client error",
        ]),
        valid: false,
        asyncValidationInFlight: false,
        value: 10,
      })
    );
  });
});
