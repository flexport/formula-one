// @flow

import * as React from "react";
import TestRenderer from "react-test-renderer";
import {FormContext} from "../Form";
import ObjectField from "../ObjectField";
import Form from "../Form";
import {type FieldLink} from "../types";

import {expectLink, mockLink, mockFormState} from "./tools";
import TestField, {TestInput} from "./TestField";
import TestForm from "./TestForm";

describe("ObjectField", () => {
  describe("Sneaky hacks", () => {
    it("exposes FormContext as its contextType", () => {
      expect(ObjectField._contextType).toBe(FormContext);
    });
  });

  describe("is a field", () => {
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
      const registerValidation = jest.fn(() => ({
        replace: jest.fn(),
        unregister,
      }));

      const renderer = TestRenderer.create(
        <TestForm registerValidation={registerValidation}>
          <ObjectField link={link} validation={jest.fn(() => [])}>
            {jest.fn(() => null)}
          </ObjectField>
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
            <ObjectField
              link={mockLink(mockFormState({hello: "world"}))}
              validation={() => []}
            >
              {() => null}
            </ObjectField>
          </TestForm>
        );
      }

      const renderer = TestRenderer.create(<Component />);
      expect(registerValidation).toBeCalledTimes(1);

      renderer.update(<Component />);
      expect(replace).toBeCalledTimes(1);
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

    it("calls its own validation when a child changes", () => {
      const renderFn = jest.fn(() => null);
      const validation = jest.fn(() => ["This is an error"]);

      TestRenderer.create(
        <Form
          initialValue={{
            string: "hello",
            number: 42,
          }}
        >
          {link => (
            <ObjectField link={link} validation={validation}>
              {renderFn}
            </ObjectField>
          )}
        </Form>
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

      const customChange = jest.fn((_oldValue, _newValue) => ({
        string: "A whole new value",
        number: 0,
      }));

      TestRenderer.create(
        <TestForm>
          <ObjectField
            link={link}
            validation={jest.fn(() => ["This is an error"])}
            customChange={customChange}
          >
            {renderFn}
          </ObjectField>
        </TestForm>
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
    });

    it("can return null to signal there was no custom change", () => {
      const renderFn = jest.fn(() => null);
      const validation = jest.fn(() => ["This is an error"]);

      const customChange = jest.fn((_oldValue, _newValue) => null);

      const renderer = TestRenderer.create(
        <Form
          initialValue={{
            string: "hello",
            number: 42,
          }}
        >
          {link => (
            <ObjectField
              link={link}
              validation={validation}
              customChange={customChange}
            >
              {renderFn}
            </ObjectField>
          )}
        </Form>
      );

      const objectLinks = renderFn.mock.calls[0][0];
      // call the child onChange
      const newChildMeta = mockFormState("newString");
      objectLinks.string.onChange(newChildMeta);

      expect(customChange).toHaveBeenCalledTimes(1);

      const link = renderer.root.findByType(ObjectField).instance.props.link;
      // the value we get out is as if customChange didn't exist
      expect(link.formState).toEqual([
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

    it("doesn't break validations for child fields", () => {
      const customChange = jest.fn((_oldValue, _newValue) => ({
        string: "a whole new value",
        string2: "modified sibling value",
      }));

      const childValidation = jest.fn(() => ["This is an error"]);
      const parentValidation = jest.fn(() => [
        "This is an error from the parent",
      ]);

      const renderer = TestRenderer.create(
        <Form
          initialValue={{
            string: "hello",
            string2: "goodbye",
          }}
        >
          {link => (
            <ObjectField
              link={link}
              customChange={customChange}
              validation={parentValidation}
            >
              {links => (
                <React.Fragment>
                  <TestField link={links.string} validation={childValidation} />
                  <TestField
                    link={links.string2}
                    validation={childValidation}
                  />
                </React.Fragment>
              )}
            </ObjectField>
          )}
        </Form>
      );

      // after mount, validate everything
      expect(parentValidation).toHaveBeenCalledTimes(1);
      expect(childValidation).toHaveBeenCalledTimes(2);

      // Now change one of the values
      parentValidation.mockClear();
      childValidation.mockClear();
      const inner = renderer.root.findAllByType(TestInput)[0];
      inner.instance.change("zach");

      // Validate the whole subtree due to the customChange child validates
      // once. Note that child validation will be called 3 times. Once after the
      // change, then twice more after the customChange triggers a validation fo
      // the entire subtree.
      expect(parentValidation).toHaveBeenCalledTimes(1);
      expect(childValidation).toHaveBeenCalledTimes(1 + 2);

      const link = renderer.root.findByType(ObjectField).instance.props.link;
      expect(link.formState).toEqual([
        {
          string: "a whole new value",
          string2: "modified sibling value",
        },
        expect.anything(),
      ]);
    });

    it("doesn't create a new instance (i.e. remount)", () => {
      const customChange = jest.fn((_oldValue, _newValue) => ({
        string: "A whole new value",
        number: 0,
      }));

      const renderer = TestRenderer.create(
        <ObjectField
          link={mockLink(
            mockFormState({
              string: "hello",
              number: 42,
            })
          )}
          customChange={customChange}
        >
          {links => <TestField link={links.string} />}
        </ObjectField>
      );

      const testInstance = renderer.root.findAllByType(TestInput)[0].instance;

      // now trigger a customChange, which used to cause a remount
      testInstance.change("hi");
      expect(customChange).toHaveBeenCalledTimes(1);

      // but we no longer cause a remount, so the instances should be the same
      const nextTestInstance = renderer.root.findAllByType(TestInput)[0]
        .instance;

      // Using Object.is here because toBe hangs as the objects are
      // self-referential and thus not printable
      expect(Object.is(testInstance, nextTestInstance)).toBe(true);
    });
  });
});
