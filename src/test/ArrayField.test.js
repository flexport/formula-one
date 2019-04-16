// @flow

import * as React from "react";
import TestRenderer from "react-test-renderer";
import Form from "../Form";
import ArrayField from "../ArrayField";
import {type FieldLink} from "../types";
import TestField, {TestInput} from "./TestField";
import TestForm from "./TestForm";

import {expectLink, mockLink, mockFormState} from "./tools";

describe("ArrayField", () => {
  describe("is a field", () => {
    it("ensures that the link inner type matches the type of the validation", () => {
      const formState = mockFormState(["one", "two", "three"]);
      const link = mockLink(formState);

      // $ExpectError
      <ArrayField link={link} validation={(_e: empty) => []}>
        {() => null}
      </ArrayField>;

      <ArrayField link={link} validation={(_e: Array<string>) => []}>
        {() => null}
      </ArrayField>;
    });

    it("Registers and unregisters for validation", () => {
      const formState = mockFormState([]);
      const link = mockLink(formState);
      const unregister = jest.fn();
      const registerValidation = jest.fn(() => ({
        replace: jest.fn(),
        unregister,
      }));

      const renderer = TestRenderer.create(
        <TestForm registerValidation={registerValidation}>
          <ArrayField link={link} validation={() => []}>
            {() => null}
          </ArrayField>
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
            <ArrayField
              link={mockLink(mockFormState(["hello", "world"]))}
              validation={() => []}
            >
              {() => null}
            </ArrayField>
          </TestForm>
        );
      }

      const renderer = TestRenderer.create(<Component />);
      expect(registerValidation).toBeCalledTimes(1);

      renderer.update(<Component />);
      expect(replace).toBeCalledTimes(1);
    });

    it("Passes additional information to its render function", () => {
      const formState = mockFormState(["value"]);
      // $FlowFixMe
      formState[1].data.errors = {
        server: ["A server error"],
        client: ["A client error"],
      };
      const link = mockLink(formState);
      const renderFn = jest.fn(() => null);

      TestRenderer.create(<ArrayField link={link}>{renderFn}</ArrayField>);

      expect(renderFn).toHaveBeenCalled();
      expect(renderFn).toHaveBeenCalledWith(
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
          value: ["value"],
        })
      );
    });
  });

  describe("An ArrayField disassembles an array into each item", () => {
    it("breaks apart a link into an array of links", () => {
      const formStateValue = ["one", "two", "three"];
      const formState = mockFormState(formStateValue);
      const link = mockLink(formState);
      const renderFn = jest.fn(() => null);

      TestRenderer.create(<ArrayField link={link}>{renderFn}</ArrayField>);

      expect(renderFn).toHaveBeenCalled();
      const arrayLinks = renderFn.mock.calls[0][0];
      expect(arrayLinks.length).toBe(3);
      arrayLinks.forEach(expectLink);
    });

    it("has the correct type for the links object", () => {
      const formState = mockFormState(["one", "two", "three"]);
      const link = mockLink(formState);

      <ArrayField link={link}>
        {/* $ExpectError */}
        {(links: empty) => {
          console.log(links);
          return null;
        }}
      </ArrayField>;

      <ArrayField link={link}>
        {(links: Array<FieldLink<string>>) => {
          console.log(links);
          return null;
        }}
      </ArrayField>;
    });

    it("validates new values from children and passes result to onChange", () => {
      const formState = mockFormState(["one", "two", "three"]);
      const link = mockLink(formState);
      const renderFn = jest.fn(() => null);

      const applyValidationAtPath = jest.fn((path, formState) => formState);

      TestRenderer.create(
        <TestForm applyValidationAtPath={applyValidationAtPath}>
          <ArrayField link={link}>{renderFn}</ArrayField>
        </TestForm>
      );

      expect(applyValidationAtPath).toHaveBeenCalledTimes(0);
      expect(link.onChange).toHaveBeenCalledTimes(0);

      // call a child's onChange
      const arrayLinks = renderFn.mock.calls[0][0];
      const newElementFormState = mockFormState("newTwo");
      arrayLinks[1].onChange(newElementFormState);

      expect(applyValidationAtPath).toHaveBeenCalledTimes(1);
      expect(applyValidationAtPath).toHaveBeenCalledWith(
        [],
        [["one", "newTwo", "three"], expect.anything()]
      );

      expect(link.onChange).toHaveBeenCalledTimes(1);
      expect(link.onChange).toHaveBeenCalledWith([
        ["one", "newTwo", "three"],
        formState[1],
      ]);
    });

    it("calls onBlur when a child is blurred", () => {
      const formStateValue = ["one", "two", "three"];
      const formState = mockFormState(formStateValue);
      const link = mockLink(formState);
      const renderFn = jest.fn(() => null);

      TestRenderer.create(<ArrayField link={link}>{renderFn}</ArrayField>);

      const arrayLinks = renderFn.mock.calls[0][0];
      const newElementTree = mockFormState("")[1];
      arrayLinks[0].onBlur(newElementTree);

      expect(link.onBlur).toHaveBeenCalled();
      const newArrayTree = link.onBlur.mock.calls[0][0];
      expect(newArrayTree.data.meta).toMatchObject({
        touched: true,
        changed: false,
      });
      expect(newArrayTree.children[0]).toBe(newElementTree);
    });

    it("calls its validation when a child changes", () => {
      const renderFn = jest.fn(() => null);
      const validation = jest.fn(() => ["This is an error"]);

      TestRenderer.create(
        <Form initialValue={["one", "two", "three"]}>
          {link => (
            <ArrayField link={link} validation={validation}>
              {renderFn}
            </ArrayField>
          )}
        </Form>
      );

      expect(validation).toHaveBeenCalledTimes(1);

      const arrayLinks = renderFn.mock.calls[0][0];
      const newElementFormState = mockFormState("newOne");
      arrayLinks[0].onChange(newElementFormState);

      expect(validation).toHaveBeenCalledTimes(2);
      expect(validation).toHaveBeenLastCalledWith(["newOne", "two", "three"]);
    });
  });

  describe("An ArrayField provides a way to modify the array", () => {
    describe("addField", () => {
      it("exposes addField to add an entry", () => {
        const formStateValue = ["one", "two", "three"];
        const formState = mockFormState(formStateValue);
        const link = mockLink(formState);
        const renderFn = jest.fn(() => null);

        TestRenderer.create(<ArrayField link={link}>{renderFn}</ArrayField>);

        expect(renderFn).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            addField: expect.any(Function),
          }),
          expect.anything()
        );
      });
      it("validates after entry is added", () => {
        const renderFn = jest.fn(() => null);
        const validation = jest.fn(() => ["an error"]);

        TestRenderer.create(
          <Form initialValue={["one", "two", "three"]}>
            {link => (
              <ArrayField validation={validation} link={link}>
                {renderFn}
              </ArrayField>
            )}
          </Form>
        );

        expect(validation).toHaveBeenCalledTimes(1);

        const [_, {addField}] = renderFn.mock.calls[0];
        addField(0, "zero");

        expect(validation).toHaveBeenCalledTimes(2);
        expect(validation).toHaveBeenLastCalledWith([
          "zero",
          "one",
          "two",
          "three",
        ]);
      });
    });

    describe("removeField", () => {
      it("exposes removeField to remove an entry", () => {
        const formStateValue = ["one", "two", "three"];
        const formState = mockFormState(formStateValue);
        const link = mockLink(formState);
        const renderFn = jest.fn(() => null);

        TestRenderer.create(<ArrayField link={link}>{renderFn}</ArrayField>);

        expect(renderFn).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            removeField: expect.any(Function),
          }),
          expect.anything()
        );
      });
      it("validates after entry is removed", () => {
        const renderFn = jest.fn(() => null);
        const validation = jest.fn(() => ["an error"]);

        TestRenderer.create(
          <Form initialValue={["one", "two", "three"]}>
            {link => (
              <ArrayField validation={validation} link={link}>
                {renderFn}
              </ArrayField>
            )}
          </Form>
        );

        expect(validation).toHaveBeenCalledTimes(1);

        const [_, {removeField}] = renderFn.mock.calls[0];
        removeField(1);

        expect(validation).toHaveBeenCalledTimes(2);
        expect(validation).toHaveBeenLastCalledWith(["one", "three"]);
      });
    });

    describe("moveField", () => {
      it("exposes moveField to move an entry", () => {
        const formStateValue = ["one", "two", "three"];
        const formState = mockFormState(formStateValue);
        const link = mockLink(formState);
        const renderFn = jest.fn(() => null);

        TestRenderer.create(<ArrayField link={link}>{renderFn}</ArrayField>);

        expect(renderFn).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            moveField: expect.any(Function),
          }),
          expect.anything()
        );
      });
      it("validates after the entry is moved", () => {
        const renderFn = jest.fn(() => null);
        const validation = jest.fn(() => ["an error"]);

        TestRenderer.create(
          <Form initialValue={["one", "two", "three"]}>
            {link => (
              <ArrayField validation={validation} link={link}>
                {renderFn}
              </ArrayField>
            )}
          </Form>
        );

        expect(validation).toHaveBeenCalledTimes(1);

        const [_, {moveField}] = renderFn.mock.calls[0];
        moveField(2, 1);

        expect(validation).toHaveBeenCalledTimes(2);
        expect(validation).toHaveBeenLastCalledWith(["one", "three", "two"]);
      });
    });

    describe("addFields", () => {
      it("exposes addFields to add an entry", () => {
        const formStateValue = ["one", "two", "three"];
        const formState = mockFormState(formStateValue);
        const link = mockLink(formState);
        const renderFn = jest.fn(() => null);

        TestRenderer.create(<ArrayField link={link}>{renderFn}</ArrayField>);

        expect(renderFn).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            addFields: expect.any(Function),
          }),
          expect.anything()
        );
      });
      it("validates after fields are added", () => {
        const renderFn = jest.fn(() => null);
        const validation = jest.fn(() => ["an error"]);

        TestRenderer.create(
          <Form initialValue={["one", "two", "three"]}>
            {link => (
              <ArrayField validation={validation} link={link}>
                {renderFn}
              </ArrayField>
            )}
          </Form>
        );

        expect(validation).toHaveBeenCalledTimes(1);

        const [_, {addFields}] = renderFn.mock.calls[0];
        addFields([[0, ["negative one", "zero"]], [3, ["four", "five"]]]);

        expect(validation).toHaveBeenCalledTimes(2);
        expect(validation).toHaveBeenLastCalledWith([
          "negative one",
          "zero",
          "one",
          "two",
          "three",
          "four",
          "five",
        ]);
      });
    });

    describe("filterFields", () => {
      it("exposes filterFields to filter entries", () => {
        const formStateValue = ["one", "two", "three"];
        const formState = mockFormState(formStateValue);
        const link = mockLink(formState);
        const renderFn = jest.fn(() => null);

        TestRenderer.create(<ArrayField link={link}>{renderFn}</ArrayField>);

        expect(renderFn).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            filterFields: expect.any(Function),
          }),
          expect.anything()
        );
      });
      it("validates after fields are filtered", () => {
        const renderFn = jest.fn(() => null);
        const validation = jest.fn(() => ["an error"]);

        TestRenderer.create(
          <Form initialValue={["one", "two", "three"]}>
            {link => (
              <ArrayField validation={validation} link={link}>
                {renderFn}
              </ArrayField>
            )}
          </Form>
        );

        expect(validation).toHaveBeenCalledTimes(1);

        const [_, {filterFields}] = renderFn.mock.calls[0];
        // remove numbers without "o" and the fourth element
        filterFields((v, i) => v.indexOf("o") !== -1 && i !== 3);

        expect(validation).toHaveBeenCalledTimes(2);
        expect(validation).toHaveBeenLastCalledWith(["one", "two"]);
      });
    });

    describe("modifyFields", () => {
      it("exposes modifyFields to add and remove entries atomically", () => {
        const formStateValue = ["one", "two", "three"];
        const formState = mockFormState(formStateValue);
        const link = mockLink(formState);
        const renderFn = jest.fn(() => null);

        TestRenderer.create(<ArrayField link={link}>{renderFn}</ArrayField>);

        expect(renderFn).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            modifyFields: expect.any(Function),
          }),
          expect.anything()
        );
      });
      it("validates after fields are modified", () => {
        const renderFn = jest.fn(() => null);
        const validation = jest.fn(() => ["an error"]);

        TestRenderer.create(
          <Form initialValue={["one", "two", "three"]}>
            {link => (
              <ArrayField validation={validation} link={link}>
                {renderFn}
              </ArrayField>
            )}
          </Form>
        );

        expect(validation).toHaveBeenCalledTimes(1);

        const [_, {modifyFields}] = renderFn.mock.calls[0];
        modifyFields({
          insertSpans: [[0, ["start"]], [2, ["middle", "content"]]],
          filterPredicate: v => v !== "one",
        });

        expect(validation).toHaveBeenCalledTimes(2);
        expect(validation).toHaveBeenLastCalledWith([
          "start",
          "two",
          "middle",
          "content",
          "three",
        ]);
      });
    });
  });

  describe("customChange", () => {
    it("allows sibling fields to be overwritten", () => {
      const formStateInner = ["one", "two", "three"];
      const formState = mockFormState(formStateInner);
      const link = mockLink(formState);
      const renderFn = jest.fn(() => null);
      const validation = jest.fn(() => ["This is an error"]);

      const customChange = jest.fn((_oldValue, _newValue) => [
        "uno",
        "dos",
        "tres",
      ]);

      TestRenderer.create(
        <TestForm>
          <ArrayField
            link={link}
            validation={validation}
            customChange={customChange}
          >
            {renderFn}
          </ArrayField>
        </TestForm>
      );

      const arrayLinks = renderFn.mock.calls[0][0];
      // call the child onChange
      const newChildMeta = mockFormState("zwei");
      arrayLinks[1].onChange(newChildMeta);

      // customChange should be called with the correct args
      expect(customChange).toHaveBeenCalledTimes(1);
      expect(customChange).toHaveBeenCalledWith(
        ["one", "two", "three"],
        ["one", "zwei", "three"]
      );

      // onChange should be called with the result of customChange
      expect(link.onChange).toHaveBeenCalledTimes(1);
      expect(link.onChange).toHaveBeenCalledWith([
        ["uno", "dos", "tres"],
        expect.anything(),
      ]);
    });

    it("can return null to signal there was no custom change", () => {
      const customChange = jest.fn((_oldValue, _newValue) => null);

      const renderFn = jest.fn(() => null);
      const validation = jest.fn(() => ["an error"]);

      const renderer = TestRenderer.create(
        <Form initialValue={["one", "two", "three"]}>
          {link => (
            <ArrayField
              validation={validation}
              link={link}
              customChange={customChange}
            >
              {renderFn}
            </ArrayField>
          )}
        </Form>
      );

      const arrayLinks = renderFn.mock.calls[0][0];
      // call the child onChange
      const newChildMeta = mockFormState("zwei");
      arrayLinks[1].onChange(newChildMeta);

      expect(customChange).toHaveBeenCalledTimes(1);

      // onChange should be called with the result of customChange
      const link = renderer.root.findByType(ArrayField).instance.props.link;
      expect(link.formState).toEqual([
        ["one", "zwei", "three"],
        expect.anything(),
      ]);

      // Validated the result of customChange
      expect(validation).toHaveBeenCalledTimes(2);
      expect(validation.mock.calls[1][0]).toEqual(["one", "zwei", "three"]);
    });

    it("doesn't break validations for child fields", () => {
      const customChange = jest.fn((_oldValue, _newValue) => ["1", "2"]);

      const childValidation = jest.fn(() => ["This is an error"]);
      const parentValidation = jest.fn(() => [
        "This is an error from the parent",
      ]);

      const renderer = TestRenderer.create(
        <Form initialValue={["1", "2"]}>
          {link => (
            <ArrayField
              link={link}
              customChange={customChange}
              validation={parentValidation}
            >
              {links => (
                <React.Fragment>
                  {links.map((link, i) => (
                    <TestField
                      key={i}
                      link={link}
                      validation={childValidation}
                    />
                  ))}
                </React.Fragment>
              )}
            </ArrayField>
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

      const link = renderer.root.findByType(ArrayField).instance.props.link;
      expect(link.formState).toEqual([["1", "2"], expect.anything()]);
    });

    it("doesn't create a new instance (i.e. remount)", () => {
      const customChange = jest.fn((_oldValue, _newValue) => ["uno", "dos"]);

      const renderer = TestRenderer.create(
        <ArrayField
          link={mockLink(mockFormState(["1", "2"]))}
          customChange={customChange}
        >
          {links => <TestField link={links[0]} />}
        </ArrayField>
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
