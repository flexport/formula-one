// @flow

import * as React from "react";
import TestRenderer from "react-test-renderer";
import {FormContext} from "../Form";
import FeedbackStrategies from "../feedbackStrategies";
import ArrayField from "../ArrayField";
import {type FieldLink} from "../types";
import TestField, {TestInput} from "./TestField";

import {expectLink, mockLink, mockFormState} from "./tools";

describe("ArrayField", () => {
  describe("ArrayField is a field", () => {
    describe("validates on mount", () => {
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
            <ArrayField link={link} validation={jest.fn(() => [])}>
              {jest.fn(() => null)}
            </ArrayField>
          </FormContext.Provider>
        );

        expect(registerValidation).toBeCalledTimes(1);
        renderer.unmount();
        expect(unregister).toBeCalledTimes(1);
      });

      it("Sets errors.client and meta.succeeded when there are no errors", () => {
        const validation = jest.fn(() => []);
        const formState = mockFormState([]);
        const link = mockLink(formState);

        TestRenderer.create(
          <ArrayField link={link} validation={validation}>
            {jest.fn(() => null)}
          </ArrayField>
        );

        expect(validation).toHaveBeenCalledTimes(1);
        expect(validation).toHaveBeenCalledWith(formState[0]);
        expect(link.onValidation).toHaveBeenCalledTimes(1);

        const [path, errors] = link.onValidation.mock.calls[0];
        expect(path).toEqual([]);
        expect(errors).toEqual([]);
      });

      it("Sets errors.client and meta.succeeded when there are errors", () => {
        const validation = jest.fn(() => ["This is an error", "another error"]);
        const formState = mockFormState([]);
        const link = mockLink(formState);

        TestRenderer.create(
          <ArrayField link={link} validation={validation}>
            {jest.fn(() => null)}
          </ArrayField>
        );

        expect(validation).toHaveBeenCalledTimes(1);
        expect(validation).toHaveBeenCalledWith(formState[0]);
        expect(link.onValidation).toHaveBeenCalledTimes(1);

        const [path, errors] = link.onValidation.mock.calls[0];
        expect(path).toEqual([]);
        expect(errors).toEqual(["This is an error", "another error"]);
      });

      it("Treats no validation as always passing", () => {
        const formState = mockFormState([]);
        const link = mockLink(formState);

        TestRenderer.create(
          <ArrayField link={link}>{jest.fn(() => null)}</ArrayField>
        );

        expect(link.onValidation).toHaveBeenCalledTimes(1);

        const [path, errors] = link.onValidation.mock.calls[0];
        expect(path).toEqual([]);
        expect(errors).toEqual([]);
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

    it("calls onChange when a child changes", () => {
      const formStateValue = ["one", "two", "three"];
      const formState = mockFormState(formStateValue);
      const link = mockLink(formState);
      const renderFn = jest.fn(() => null);

      TestRenderer.create(<ArrayField link={link}>{renderFn}</ArrayField>);

      const arrayLinks = renderFn.mock.calls[0][0];
      const newElementFormState = mockFormState("newTwo");
      arrayLinks[1].onChange(newElementFormState);

      expect(link.onChange).toHaveBeenCalled();
      const newArrayFormState = link.onChange.mock.calls[0][0];
      expect(newArrayFormState[0]).toEqual(["one", "newTwo", "three"]);
      expect(newArrayFormState[1].data.meta).toMatchObject({
        touched: true,
        changed: true,
      });
      expect(newArrayFormState[1].children[1]).toBe(newElementFormState[1]);
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

    it("calls onValidation when a child initially validates", () => {
      const formStateValue = ["one", "two", "three"];
      const formState = mockFormState(formStateValue);
      const link = mockLink(formState);
      const renderFn = jest.fn(() => null);

      TestRenderer.create(<ArrayField link={link}>{renderFn}</ArrayField>);

      const arrayLinks = renderFn.mock.calls[0][0];
      arrayLinks[2].onValidation([], ["These are", "some errors"]);

      expect(link.onValidation).toHaveBeenCalledTimes(2);
      // Important: the first call to onValidation is for the initial render validation
      const [path, errors] = link.onValidation.mock.calls[1];
      expect(path).toEqual([{type: "array", index: 2}]);
      expect(errors).toEqual(["These are", "some errors"]);
    });

    it("calls its validation when a child changes", () => {
      const formStateValue = ["one", "two", "three"];
      const formState = mockFormState(formStateValue);
      const link = mockLink(formState);
      const renderFn = jest.fn(() => null);
      const validation = jest.fn(() => ["This is an error"]);

      TestRenderer.create(
        <ArrayField link={link} validation={validation}>
          {renderFn}
        </ArrayField>
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
        const formStateValue = ["one", "two", "three"];
        const formState = mockFormState(formStateValue);
        const link = mockLink(formState);
        const renderFn = jest.fn(() => null);
        const validation = jest.fn(() => ["an error"]);

        TestRenderer.create(
          <ArrayField validation={validation} link={link}>
            {renderFn}
          </ArrayField>
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
        const formStateValue = ["one", "two", "three"];
        const formState = mockFormState(formStateValue);
        const link = mockLink(formState);
        const renderFn = jest.fn(() => null);
        const validation = jest.fn(() => ["an error"]);

        TestRenderer.create(
          <ArrayField validation={validation} link={link}>
            {renderFn}
          </ArrayField>
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
        const formStateValue = ["one", "two", "three"];
        const formState = mockFormState(formStateValue);
        const link = mockLink(formState);
        const renderFn = jest.fn(() => null);
        const validation = jest.fn(() => ["an error"]);

        TestRenderer.create(
          <ArrayField validation={validation} link={link}>
            {renderFn}
          </ArrayField>
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
        const formStateValue = ["one", "two", "three"];
        const formState = mockFormState(formStateValue);
        const link = mockLink(formState);
        const renderFn = jest.fn(() => null);
        const validation = jest.fn(() => ["an error"]);

        TestRenderer.create(
          <ArrayField validation={validation} link={link}>
            {renderFn}
          </ArrayField>
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
        const formStateValue = ["one", "two", "three", "four", "five"];
        const formState = mockFormState(formStateValue);
        const link = mockLink(formState);
        const renderFn = jest.fn(() => null);
        const validation = jest.fn(() => ["an error"]);

        TestRenderer.create(
          <ArrayField validation={validation} link={link}>
            {renderFn}
          </ArrayField>
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
        const formStateValue = ["one", "two", "three"];
        const formState = mockFormState(formStateValue);
        const link = mockLink(formState);
        const renderFn = jest.fn(() => null);
        const validation = jest.fn(() => ["an error"]);

        TestRenderer.create(
          <ArrayField validation={validation} link={link}>
            {renderFn}
          </ArrayField>
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
      const validateFormStateAtPath = jest.fn(
        (_subtreePath, formState) => formState
      );

      const customChange = jest.fn((_oldValue, _newValue) => [
        "uno",
        "dos",
        "tres",
      ]);

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
          <ArrayField
            link={link}
            validation={validation}
            customChange={customChange}
          >
            {renderFn}
          </ArrayField>
        </FormContext.Provider>
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

      // Validated the result of customChange
      // TODO(dmnd): Remove this as it's about validation?
      expect(validateFormStateAtPath).toHaveBeenCalledTimes(1);
      expect(validateFormStateAtPath).toHaveBeenCalledWith(
        [], // The ArrayField is at the root, so empty path
        [["uno", "dos", "tres"], expect.anything()]
      );
    });

    it("can return null to signal there was no custom change", () => {
      const formStateInner = ["one", "two", "three"];
      const formState = mockFormState(formStateInner);
      const link = mockLink(formState);
      const renderFn = jest.fn(() => null);
      const validation = jest.fn(() => ["This is an error"]);

      const customChange = jest.fn((_oldValue, _newValue) => null);

      TestRenderer.create(
        <ArrayField
          link={link}
          validation={validation}
          customChange={customChange}
        >
          {renderFn}
        </ArrayField>
      );

      const arrayLinks = renderFn.mock.calls[0][0];
      // call the child onChange
      const newChildMeta = mockFormState("zwei");
      arrayLinks[1].onChange(newChildMeta);

      expect(customChange).toHaveBeenCalledTimes(1);

      // onChange should be called with the result of customChange
      expect(link.onChange).toHaveBeenCalledTimes(1);
      expect(link.onChange).toHaveBeenCalledWith([
        ["one", "zwei", "three"],
        expect.anything(),
      ]);

      // Validated the result of customChange
      expect(validation).toHaveBeenCalledTimes(2);
      expect(validation.mock.calls[1][0]).toEqual(["one", "zwei", "three"]);
    });

    it("doesn't break validations for child fields", () => {
      const formStateInner = ["one", "two", "three"];
      const formState = mockFormState(formStateInner);
      const link = mockLink(formState);
      const validateFormStateAtPath = jest.fn(
        (_subtreePath, formState) => formState
      );
      const customChange = jest.fn((_oldValue, _newValue) => ["1", "2"]);

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
          <ArrayField link={link} customChange={customChange}>
            {links => (
              <React.Fragment>
                {links.map((link, i) => (
                  <TestField key={i} link={link} validation={childValidation} />
                ))}
              </React.Fragment>
            )}
          </ArrayField>
        </FormContext.Provider>
      );

      // 6 validations:
      // 1) Child initial validation x3
      // 2) Parent initial validation
      // 3) Subtree upon customChange
      // (No parent onValidation call, because it will use onChange)

      // 1) and 2)
      expect(link.onValidation).toHaveBeenCalledTimes(4);
      link.onValidation.mockClear();

      const inner = renderer.root.findAllByType(TestInput)[0];
      inner.instance.change("zach");

      // 3)
      expect(validateFormStateAtPath).toHaveBeenCalledTimes(1);
      expect(validateFormStateAtPath).toHaveBeenCalledWith(
        [], // The Array is at the root, so empty path
        [["1", "2"], expect.anything()]
      );
    });
  });
});
