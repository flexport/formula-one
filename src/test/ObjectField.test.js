// @flow

import * as React from "react";
import TestRenderer from "react-test-renderer";
import {FormContext} from "../Form";
import FeedbackStrategies from "../feedbackStrategies";
import ObjectField from "../ObjectField";
import {type FieldLink} from "../types";

import {expectLink, mockLink, mockFormState} from "./tools";
import TestField, {TestInput} from "./TestField";

describe("ObjectField", () => {
  describe("Sneaky hacks", () => {
    it("exposes FormContext as its contextType", () => {
      expect(ObjectField._contextType).toBe(FormContext);
    });
  });

  describe("ObjectField is a field", () => {
    describe("validates on mount", () => {
      it("ensures that the link inner type matches the type of the validation", () => {
        type TestObject = {|
          string: string,
          number: number,
        |};
        const formStateInner: TestObject = {
          string: "hello",
          number: 42,
        };
        const formState = mockFormState(formStateInner);
        const link: FieldLink<TestObject> = mockLink(formState);

        // $ExpectError
        <ObjectField link={link} validation={(_e: empty) => []}>
          {() => null}
        </ObjectField>;

        // $ExpectError
        <ObjectField link={link} validation={(_e: {|string: string|}) => []}>
          {() => null}
        </ObjectField>;

        <ObjectField link={link} validation={(_e: TestObject) => []}>
          {() => null}
        </ObjectField>;
      });

      it("Registers and unregisters for validation", () => {
        const formState = mockFormState({inner: "value"});
        const link = mockLink(formState);
        const unregister = jest.fn();
        const registerValidation = jest.fn(() => unregister);

        const renderer = TestRenderer.create(
          <FormContext.Provider
            value={{
              shouldShowError: FeedbackStrategies.Always,
              registerValidation,
              validateFormStateAtPath: jest.fn(),
              pristine: true,
              submitted: false,
            }}
          >
            <ObjectField link={link} validation={jest.fn(() => [])}>
              {jest.fn(() => null)}
            </ObjectField>
          </FormContext.Provider>
        );

        expect(registerValidation).toBeCalledTimes(1);
        renderer.unmount();
        expect(unregister).toBeCalledTimes(1);
      });

      it("Sets errors.client and meta.succeeded when there are no errors", () => {
        const validation = jest.fn(() => []);
        const formState = mockFormState({inner: "value"});
        const link = mockLink(formState);

        TestRenderer.create(
          <ObjectField link={link} validation={validation}>
            {jest.fn(() => null)}
          </ObjectField>
        );

        expect(validation).toHaveBeenCalledTimes(1);
        expect(validation).toHaveBeenCalledWith(formState[0]);
        expect(link.onValidation).toHaveBeenCalledTimes(1);

        const [path, errors] = link.onValidation.mock.calls[0];
        expect(path).toEqual([]);
        expect(errors).toEqual([]);
      });

      it("Sets errors.client and meta.succeeded when there are errors", () => {
        const validation = jest.fn(() => ["This is an error"]);
        const formState = mockFormState({inner: "value"});
        const link = mockLink(formState);

        TestRenderer.create(
          <ObjectField link={link} validation={validation}>
            {jest.fn(() => null)}
          </ObjectField>
        );

        expect(validation).toHaveBeenCalledTimes(1);
        expect(validation).toHaveBeenCalledWith(formState[0]);
        expect(link.onValidation).toHaveBeenCalledTimes(1);

        const [path, errors] = link.onValidation.mock.calls[0];
        expect(path).toEqual([]);
        expect(errors).toEqual(["This is an error"]);
      });

      it("Treats no validation as always passing", () => {
        const formState = mockFormState({inner: "value"});
        const link = mockLink(formState);

        TestRenderer.create(
          <ObjectField link={link}>{jest.fn(() => null)}</ObjectField>
        );

        expect(link.onValidation).toHaveBeenCalledTimes(1);

        const [path, errors] = link.onValidation.mock.calls[0];
        expect(path).toEqual([]);
        expect(errors).toEqual([]);
      });

      it("Passes additional information to its render function", () => {
        const formState = mockFormState({inner: "value"});
        // $FlowFixMe
        formState[1].data.errors = {
          server: ["A server error"],
          client: ["A client error"],
        };
        const link = mockLink(formState);
        const renderFn = jest.fn(() => null);

        TestRenderer.create(<ObjectField link={link}>{renderFn}</ObjectField>);

        expect(renderFn).toHaveBeenCalled();
        expect(renderFn).toHaveBeenCalledWith(
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
            value: {inner: "value"},
          })
        );
      });
    });
  });

  describe("An ObjectField disassembles an object into its fields", () => {
    it("breaks apart a link to an object into an object of links", () => {
      const formStateInner = {
        string: "hello",
        number: 42,
      };
      const formState = mockFormState(formStateInner);
      const link = mockLink(formState);
      const renderFn = jest.fn(() => null);

      TestRenderer.create(<ObjectField link={link}>{renderFn}</ObjectField>);

      expect(renderFn).toHaveBeenCalled();
      const objectLinks = renderFn.mock.calls[0][0];
      expect(Object.keys(objectLinks)).toEqual(Object.keys(formStateInner));
      Object.keys(formStateInner).forEach(k => {
        expect(objectLinks).toHaveProperty(k);
        const link = objectLinks[k];
        expectLink(link);
      });
    });

    it("has the correct type for the links object", () => {
      type TestObject = {|
        string: string,
        number: number,
      |};
      const formStateInner: TestObject = {
        string: "hello",
        number: 42,
      };
      const formState = mockFormState(formStateInner);
      const link: FieldLink<TestObject> = mockLink(formState);

      <ObjectField link={link}>
        {/* $ExpectError */}
        {(links: empty) => {
          console.log(links);
          return null;
        }}
      </ObjectField>;

      <ObjectField link={link}>
        {/* $ExpectError */}
        {(links: {|string: FieldLink<string>|}) => {
          console.log(links);
          return null;
        }}
      </ObjectField>;

      <ObjectField link={link}>
        {(links: {|string: FieldLink<string>, number: FieldLink<number>|}) => {
          console.log(links);
          return null;
        }}
      </ObjectField>;
    });

    it("calls onChange when a child changes", () => {
      const formStateInner = {
        string: "hello",
        number: 42,
      };
      const formState = mockFormState(formStateInner);
      const link = mockLink(formState);
      const renderFn = jest.fn(() => null);

      TestRenderer.create(<ObjectField link={link}>{renderFn}</ObjectField>);

      const objectLinks = renderFn.mock.calls[0][0];
      // call the child onChange
      const newChildMeta = mockFormState("newString");
      objectLinks.string.onChange(newChildMeta);

      expect(link.onChange).toHaveBeenCalled();
      const newObjectFormState = link.onChange.mock.calls[0][0];
      expect(newObjectFormState[0]).toHaveProperty("string", "newString");
      expect(newObjectFormState[1].data.meta).toMatchObject({
        touched: true,
        changed: true,
      });
      expect(newObjectFormState[1].children.string).toBe(newChildMeta[1]);
    });

    it("calls onBlur when a child is blurred", () => {
      const formStateInner = {
        string: "hello",
        number: 42,
      };
      const formState = mockFormState(formStateInner);
      const link = mockLink(formState);
      const renderFn = jest.fn(() => null);

      TestRenderer.create(<ObjectField link={link}>{renderFn}</ObjectField>);

      const objectLinks = renderFn.mock.calls[0][0];
      // call the child onBlur
      const newChildTree = mockFormState("")[1];
      objectLinks.number.onBlur(newChildTree);

      expect(link.onBlur).toHaveBeenCalled();
      const newObjectTree = link.onBlur.mock.calls[0][0];
      expect(newObjectTree.children.number).toBe(newChildTree);
      expect(newObjectTree.data.meta).toMatchObject({
        touched: true,
        changed: false,
      });
    });

    it("calls onValidation when a child runs validations", () => {
      const formStateInner = {
        string: "hello",
        number: 42,
      };
      const formState = mockFormState(formStateInner);
      const link = mockLink(formState);
      const renderFn = jest.fn(() => null);

      TestRenderer.create(<ObjectField link={link}>{renderFn}</ObjectField>);

      const objectLinks = renderFn.mock.calls[0][0];
      // call the child onValidation
      objectLinks.string.onValidation([], ["Some", "errors"]);

      expect(link.onValidation).toHaveBeenCalledTimes(2);
      // Important: the first call to onValidation is for the initial render validation
      const [path, errors] = link.onValidation.mock.calls[1];
      expect(path).toEqual([{type: "object", key: "string"}]);
      expect(errors).toEqual(["Some", "errors"]);
    });

    it("calls its own validation when a child changes", () => {
      const formStateInner = {
        string: "hello",
        number: 42,
      };
      const formState = mockFormState(formStateInner);
      const link = mockLink(formState);
      const renderFn = jest.fn(() => null);
      const validation = jest.fn(() => ["This is an error"]);

      TestRenderer.create(
        <ObjectField link={link} validation={validation}>
          {renderFn}
        </ObjectField>
      );

      expect(validation).toHaveBeenCalledTimes(1);

      const objectLinks = renderFn.mock.calls[0][0];
      // call the child onChange
      const newChildMeta = mockFormState("newString");
      objectLinks.string.onChange(newChildMeta);

      expect(validation).toHaveBeenCalledTimes(2);
      expect(validation.mock.calls[1][0]).toEqual({
        string: "newString",
        number: 42,
      });
    });
  });

  describe("customChange", () => {
    it("allows sibling fields to be overwritten", () => {
      const formStateInner = {
        string: "hello",
        number: 42,
      };
      const formState = mockFormState(formStateInner);
      const link = mockLink(formState);
      const renderFn = jest.fn(() => null);
      const validateFormStateAtPath = jest.fn(
        (_subtreePath, formState) => formState
      );

      const customChange = jest.fn((_oldValue, _newValue) => ({
        string: "A whole new value",
        number: 0,
      }));

      TestRenderer.create(
        <FormContext.Provider
          value={{
            shouldShowError: FeedbackStrategies.Always,
            registerValidation: jest.fn(),
            validateFormStateAtPath,
            pristine: true,
            submitted: false,
          }}
        >
          <ObjectField
            link={link}
            validation={jest.fn(() => ["This is an error"])}
            customChange={customChange}
          >
            {renderFn}
          </ObjectField>
        </FormContext.Provider>
      );

      const objectLinks = renderFn.mock.calls[0][0];
      // call the child onChange
      const newChildMeta = mockFormState("newString");
      objectLinks.string.onChange(newChildMeta);

      // customChange should be called with the correct args
      expect(customChange).toHaveBeenCalledTimes(1);
      expect(customChange).toHaveBeenCalledWith(
        {
          string: "hello",
          number: 42,
        },
        {
          string: "newString",
          number: 42,
        }
      );

      // onChange should be called with the result of customChange
      expect(link.onChange).toHaveBeenCalledTimes(1);
      expect(link.onChange).toHaveBeenCalledWith([
        {
          string: "A whole new value",
          number: 0,
        },
        expect.anything(),
      ]);

      // Validated the result of customChange
      // TODO(dmnd): Remove this as it's about validation?
      expect(validateFormStateAtPath).toHaveBeenCalledTimes(1);
      expect(validateFormStateAtPath).toHaveBeenCalledWith(
        [], // The ObjectField is at the root, so empty path
        [{string: "A whole new value", number: 0}, expect.anything()]
      );
    });

    it("can return null to signal there was no custom change", () => {
      const formStateInner = {
        string: "hello",
        number: 42,
      };
      const formState = mockFormState(formStateInner);
      const link = mockLink(formState);
      const renderFn = jest.fn(() => null);
      const validation = jest.fn(() => ["This is an error"]);

      const customChange = jest.fn((_oldValue, _newValue) => null);

      TestRenderer.create(
        <ObjectField
          link={link}
          validation={validation}
          customChange={customChange}
        >
          {renderFn}
        </ObjectField>
      );

      const objectLinks = renderFn.mock.calls[0][0];
      // call the child onChange
      const newChildMeta = mockFormState("newString");
      objectLinks.string.onChange(newChildMeta);

      expect(customChange).toHaveBeenCalledTimes(1);

      // onChange should be called with the result of customChange
      expect(link.onChange).toHaveBeenCalledTimes(1);
      expect(link.onChange).toHaveBeenCalledWith([
        {
          string: "newString",
          number: 42,
        },
        expect.anything(),
      ]);

      // Validated the result of customChange
      expect(validation).toHaveBeenCalledTimes(2);
      expect(validation.mock.calls[1][0]).toEqual({
        string: "newString",
        number: 42,
      });
    });

    // this test seems redundant since the first one asserts that the subtree is
    // validated
    it("doesn't break validations for child fields", () => {
      const formStateInner = {
        string: "hello",
        string2: "goodbye",
      };
      const formState = mockFormState(formStateInner);
      const link = mockLink(formState);
      const validateFormStateAtPath = jest.fn(
        (_subtreePath, formState) => formState
      );

      const customChange = jest.fn((_oldValue, _newValue) => ({
        string: "a whole new value",
        string2: "modified sibling value",
      }));

      const childValidation = jest.fn(() => ["This is an error"]);

      const renderer = TestRenderer.create(
        <FormContext.Provider
          value={{
            shouldShowError: FeedbackStrategies.Always,
            registerValidation: jest.fn(),
            validateFormStateAtPath,
            pristine: true,
            submitted: false,
          }}
        >
          <ObjectField link={link} customChange={customChange}>
            {links => (
              <React.Fragment>
                <TestField link={links.string} validation={childValidation} />
                <TestField link={links.string2} validation={childValidation} />
              </React.Fragment>
            )}
          </ObjectField>
          )}
        </FormContext.Provider>
      );

      // 5 validations:
      // 1) Child initial validation x2
      // 2) Parent initial validation
      // 3) Subtree upon customChange
      // (No parent onValidation call, because it will use onChange)

      // 1) and 2)
      expect(link.onValidation).toHaveBeenCalledTimes(3);
      link.onValidation.mockClear();

      // Now change one of the values
      validateFormStateAtPath.mockClear();
      const inner = renderer.root.findAllByType(TestInput)[0];
      inner.instance.change("zach");

      // 3)
      expect(validateFormStateAtPath).toHaveBeenCalledTimes(1);
      expect(validateFormStateAtPath).toHaveBeenCalledWith(
        [], // The ObjectField is at the root path, so empty path
        [
          {
            string: "a whole new value",
            string2: "modified sibling value",
          },
          expect.anything(),
        ]
      );
    });
  });
});
