// @flow

import * as React from "react";
import TestRenderer from "react-test-renderer";
import FeedbackStrategies from "../feedbackStrategies";
import Form, {FormContext} from "../Form";
import ObjectField from "../ObjectField";
import ArrayField from "../ArrayField";
import Field from "../Field";

import {expectLink, mockFormState} from "./tools";
import TestField, {TestInput} from "./TestField";
import {forgetShape} from "../shapedTree";

class NaughtyRenderingInput extends React.Component<{|
  value: string,
  errors: $ReadOnlyArray<string>,
  onChange: string => void,
  onBlur: () => void,
|}> {
  componentDidMount() {
    this.props.onChange("hello from cDM()");
  }
  render() {
    return null;
  }
}
function NaughtyRenderingField(props) {
  return (
    <Field {...props}>
      {(value, errors, onChange, onBlur) => (
        <NaughtyRenderingInput
          value={value}
          errors={errors}
          onChange={onChange}
          onBlur={onBlur}
        />
      )}
    </Field>
  );
}

describe("Form", () => {
  describe("Form manages form state", () => {
    it("creates the initial formState from initialValue and externalErrors", () => {
      const onSubmit = jest.fn();
      const renderFn = jest.fn(() => null);
      TestRenderer.create(
        <Form
          initialValue={1}
          feedbackStrategy={FeedbackStrategies.Always}
          onSubmit={onSubmit}
          externalErrors={{"/": ["External error", "Another external error"]}}
        >
          {renderFn}
        </Form>
      );

      expect(renderFn).toHaveBeenCalled();

      const link = renderFn.mock.calls[0][0];
      expectLink(link);

      const [value, tree] = link.formState;
      expect(value).toBe(1);
      expect(forgetShape(tree).type).toBe("leaf");
      expect(forgetShape(tree).data).toEqual({
        meta: {
          touched: false,
          changed: false,
          succeeded: false,
          asyncValidationInFlight: false,
        },
        errors: {
          client: "pending",
          external: ["External error", "Another external error"],
        },
      });
    });

    it("parses and sets complex external errors", () => {
      const onSubmit = jest.fn();
      const renderFn = jest.fn(() => null);
      TestRenderer.create(
        <Form
          initialValue={{
            simple: 3,
            complex: [{inner: "hello"}, {inner: "there"}],
          }}
          feedbackStrategy={FeedbackStrategies.Always}
          onSubmit={onSubmit}
          externalErrors={{
            "/": ["Root error"],
            "/simple": ["One", "level", "down"],
            "/complex": [],
            "/complex/0": ["in an", "array"],
          }}
        >
          {renderFn}
        </Form>
      );

      expect(renderFn).toHaveBeenCalled();

      const link = renderFn.mock.calls[0][0];
      expectLink(link);

      const [_, tree] = link.formState;
      // Cross your fingers
      const root: any = tree;
      expect(root.data.errors.external).toEqual(["Root error"]);
      const simple = root.children.simple;
      expect(simple.data.errors.external).toEqual(["One", "level", "down"]);
      const complex = root.children.complex;
      expect(complex.data.errors.external).toEqual([]);
      const complex0 = complex.children[0];
      expect(complex0.data.errors.external).toEqual(["in an", "array"]);
      const complex1 = complex.children[1];
      expect(complex1.data.errors.external).toEqual([]);
    });

    it("updates the external errors", () => {
      const onSubmit = jest.fn();
      const renderFn = jest.fn(() => null);
      const renderer = TestRenderer.create(
        <Form
          initialValue={{
            array: [],
          }}
          feedbackStrategy={FeedbackStrategies.Always}
          onSubmit={onSubmit}
          externalErrors={{
            "/array": ["Cannot be empty"],
          }}
        >
          {link => <ObjectField link={link}>{renderFn}</ObjectField>}
        </Form>
      );

      expect(renderFn).toHaveBeenCalled();

      const links = renderFn.mock.calls[0][0];
      const newFormState = mockFormState([1]);
      links.array.onChange(newFormState);

      const anotherRenderFn = jest.fn();
      renderer.update(
        <Form
          initialValue={{
            array: [],
          }}
          feedbackStrategy={FeedbackStrategies.Always}
          onSubmit={onSubmit}
          externalErrors={{
            "/array": [],
            "/array/0": ["inner error"],
          }}
        >
          {anotherRenderFn}
        </Form>
      );

      expect(anotherRenderFn).toHaveBeenCalled();

      const link = anotherRenderFn.mock.calls[0][0];

      const [_, tree] = link.formState;
      // Cross your fingers
      const root: any = tree;
      expect(root.data.errors.external).toEqual([]);
      const array = root.children.array;
      expect(array.data.errors.external).toEqual([]);
      const array0 = array.children[0];
      expect(array0.data.errors.external).toEqual(["inner error"]);
    });

    it("collects the initial validations", () => {
      // This test is not very unit-y, but that's okay! It's more useful to
      // know that it's working with ArrayField and ObjectField and Field

      const onSubmit = jest.fn();
      const renderer = TestRenderer.create(
        <Form
          initialValue={{
            errors: "foo",
            noErrors: "bar",
            array: ["baz", "quux"],
          }}
          feedbackStrategy={FeedbackStrategies.Always}
          onSubmit={onSubmit}
          externalErrors={null}
        >
          {link => (
            <ObjectField link={link} validation={() => ["Toplevel error"]}>
              {link => (
                <React.Fragment>
                  <TestField
                    link={link.errors}
                    validation={() => ["Two", "errors"]}
                  />
                  <TestField link={link.noErrors} />
                  <ArrayField
                    link={link.array}
                    validation={() => ["Array errors"]}
                  >
                    {links =>
                      links.map((link, i) => (
                        <TestField
                          key={i}
                          link={link}
                          validation={
                            i === 1
                              ? () => ["Errors on the second item"]
                              : () => []
                          }
                        />
                      ))
                    }
                  </ArrayField>
                </React.Fragment>
              )}
            </ObjectField>
          )}
        </Form>
      );

      // Cross your fingers
      const root: any = forgetShape(renderer.root.instance.state.formState[1]);
      expect(root.data.errors.client).toEqual(["Toplevel error"]);
      expect(root.data.meta).toMatchObject({
        succeeded: false,
      });
      const errors = root.children.errors;
      expect(errors.data.errors.client).toEqual(["Two", "errors"]);
      const noErrors = root.children.noErrors;
      expect(noErrors.data.errors.client).toEqual([]);
      expect(noErrors.data.meta).toMatchObject({
        succeeded: true,
      });
      const array = root.children.array;
      expect(array.data.errors.client).toEqual(["Array errors"]);
      const array0 = array.children[0];
      expect(array0.data.errors.client).toEqual([]);
      const array1 = array.children[1];
      expect(array1.data.errors.client).toEqual(["Errors on the second item"]);
    });

    it("doesn't break on validation when given an input with bad behaviour", () => {
      const onSubmit = jest.fn();
      const renderer = TestRenderer.create(
        <Form
          initialValue={{
            naughty: "foo",
            nice: "bar",
          }}
          feedbackStrategy={FeedbackStrategies.Always}
          onSubmit={onSubmit}
          externalErrors={null}
        >
          {link => (
            <ObjectField link={link} validation={() => ["Toplevel error"]}>
              {link => (
                <React.Fragment>
                  <NaughtyRenderingField
                    link={link.naughty}
                    validation={() => ["Naughty", "errors"]}
                  />
                  <TestField
                    link={link.nice}
                    validation={() => ["Nice", "errors"]}
                  />
                </React.Fragment>
              )}
            </ObjectField>
          )}
        </Form>
      );

      const formState = renderer.root.instance.state.formState;
      expect(formState[0]).toEqual({
        naughty: "hello from cDM()",
        nice: "bar",
      });

      // Cross your fingers
      const root: any = formState[1];
      expect(root.data.errors.client).toEqual(["Toplevel error"]);
      const naughty = root.children.naughty;
      expect(naughty.data.errors.client).toEqual(["Naughty", "errors"]);
      const nice = root.children.nice;
      expect(nice.data.errors.client).toEqual(["Nice", "errors"]);
    });

    it("changes when link calls onChange", () => {
      const onSubmit = jest.fn();
      const renderFn = jest.fn(() => null);
      const renderer = TestRenderer.create(
        <Form
          initialValue={1}
          feedbackStrategy={FeedbackStrategies.Always}
          onSubmit={onSubmit}
          externalErrors={null}
        >
          {renderFn}
        </Form>
      );

      const link = renderFn.mock.calls[0][0];

      const newFormState = mockFormState(2);
      link.onChange(newFormState);

      expect(renderer.root.instance.state.formState).toBe(newFormState);
    });

    it("changes when link calls onBlur", () => {
      const onSubmit = jest.fn();
      const renderFn = jest.fn(() => null);
      const renderer = TestRenderer.create(
        <Form
          initialValue={1}
          feedbackStrategy={FeedbackStrategies.Always}
          onSubmit={onSubmit}
          externalErrors={null}
        >
          {renderFn}
        </Form>
      );

      const link = renderFn.mock.calls[0][0];

      const [_, newTree] = mockFormState(2);
      link.onBlur(newTree);

      expect(renderer.root.instance.state.formState[1]).toBe(newTree);
    });
  });

  describe("Form manages form-level meta information", () => {
    it("tracks whether the form has been modified", () => {
      const onSubmit = jest.fn();
      const contextExtractor = jest.fn(() => null);
      const renderFn = jest.fn(() => (
        <FormContext.Consumer>{contextExtractor}</FormContext.Consumer>
      ));
      TestRenderer.create(
        <Form
          initialValue={1}
          feedbackStrategy={FeedbackStrategies.Always}
          onSubmit={onSubmit}
          externalErrors={{"/": ["External error", "Another external error"]}}
        >
          {renderFn}
        </Form>
      );

      expect(contextExtractor).toHaveBeenCalledWith(
        expect.objectContaining({
          pristine: true,
        })
      );

      const link = renderFn.mock.calls[0][0];
      const nextFormState = mockFormState(2);
      link.onChange(nextFormState);

      expect(contextExtractor).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pristine: false,
        })
      );
    });

    it("tracks whether the form has been submitted", () => {
      const contextExtractor = jest.fn(() => null);
      const renderFn = jest.fn(() => (
        <FormContext.Consumer>{contextExtractor}</FormContext.Consumer>
      ));
      TestRenderer.create(
        <Form
          initialValue={1}
          feedbackStrategy={FeedbackStrategies.Always}
          onSubmit={jest.fn()}
          externalErrors={{"/": ["External error", "Another external error"]}}
        >
          {renderFn}
        </Form>
      );

      expect(contextExtractor).toHaveBeenCalledWith(
        expect.objectContaining({
          submitted: false,
        })
      );

      const onSubmit = renderFn.mock.calls[0][1];
      onSubmit();

      expect(contextExtractor).toHaveBeenLastCalledWith(
        expect.objectContaining({
          submitted: true,
        })
      );
    });

    it("gives children a shouldShowError", () => {
      const onSubmit = jest.fn();
      const contextExtractor = jest.fn(() => null);
      const renderFn = () => (
        <FormContext.Consumer>{contextExtractor}</FormContext.Consumer>
      );
      TestRenderer.create(
        <Form
          initialValue={1}
          feedbackStrategy={FeedbackStrategies.Always}
          onSubmit={onSubmit}
          externalErrors={{"/": ["External error", "Another external error"]}}
        >
          {renderFn}
        </Form>
      );

      expect(contextExtractor).toHaveBeenCalledWith(
        expect.objectContaining({
          shouldShowError: expect.any(Function),
        })
      );
    });

    it("Passes additional information to its render function", () => {
      const renderFn = jest.fn(() => null);

      TestRenderer.create(
        <Form
          initialValue={1}
          feedbackStrategy={FeedbackStrategies.Touched}
          onSubmit={jest.fn()}
          externalErrors={{"/": ["External error", "Another external error"]}}
        >
          {renderFn}
        </Form>
      );

      expect(renderFn).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          touched: false,
          changed: false,
          shouldShowErrors: false,
          unfilteredErrors: expect.arrayContaining([
            "External error",
            "Another external error",
          ]),
          // Currently, only care about client errors
          valid: true,
          asyncValidationInFlight: false,
          value: 1,
        })
      );
    });
  });

  it("Calls onSubmit with the value when submitted", () => {
    const onSubmit = jest.fn();
    const contextExtractor = jest.fn(() => null);
    const renderFn = jest.fn(() => (
      <FormContext.Consumer>{contextExtractor}</FormContext.Consumer>
    ));
    TestRenderer.create(
      <Form
        initialValue={1}
        feedbackStrategy={FeedbackStrategies.Always}
        onSubmit={onSubmit}
        externalErrors={{"/": ["External error", "Another external error"]}}
      >
        {renderFn}
      </Form>
    );

    expect(onSubmit).toHaveBeenCalledTimes(0);

    const linkOnSubmit = renderFn.mock.calls[0][1];
    linkOnSubmit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenLastCalledWith(1, undefined);
  });

  it("Calls onSubmit with extra info when submitted", () => {
    const onSubmit = jest.fn();
    const renderFn = jest.fn();
    TestRenderer.create(
      <Form
        initialValue={1}
        feedbackStrategy={FeedbackStrategies.Always}
        onSubmit={onSubmit}
        externalErrors={{"/": ["External error", "Another external error"]}}
      >
        {renderFn}
      </Form>
    );

    expect(onSubmit).toHaveBeenCalledTimes(0);

    const linkOnSubmit = renderFn.mock.calls[0][1];
    linkOnSubmit("extra");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenLastCalledWith(expect.anything(), "extra");
  });

  it("Enforces types on onSubmit", () => {
    const onSubmit: (value: number, extra: "extra") => void = () => {};
    TestRenderer.create(
      <Form
        initialValue={1}
        feedbackStrategy={FeedbackStrategies.Always}
        onSubmit={onSubmit}
        externalErrors={{"/": ["External error", "Another external error"]}}
      >
        {(_, onSubmit) => (
          <button
            onClick={() => {
              // $ExpectError
              onSubmit();
              // $ExpectError
              onSubmit("hello");
              onSubmit("extra");
            }}
          />
        )}
      </Form>
    );
  });

  it("accepts multiple feedback strategies", () => {
    const renderFn = jest.fn(() => null);
    TestRenderer.create(
      <Form
        initialValue={1}
        feedbackStrategy={[FeedbackStrategies.Changed, FeedbackStrategies.Pristine]}
        externalErrors={{"/": ["External error", "Another external error"]}}
      >
        {renderFn}
      </Form>
    );

    const link = renderFn.mock.calls[0][0];
    expect(link.formState[1].data.errors.external)
      .toBe(["External error", "Another external error"]);
  });

  it("Calls onChange when the value is changed", () => {
    const onChange = jest.fn();
    const renderFn = jest.fn(() => null);
    TestRenderer.create(
      <Form
        initialValue={1}
        feedbackStrategy={FeedbackStrategies.Always}
        onChange={onChange}
        externalErrors={{"/": ["External error", "Another external error"]}}
      >
        {renderFn}
      </Form>
    );

    const link = renderFn.mock.calls[0][0];
    const nextFormState = mockFormState(2);
    link.onChange(nextFormState);

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("Calls onValidation when a part of the value is validated", () => {
    const onValidation = jest.fn();
    const renderer = TestRenderer.create(
      <Form
        initialValue={""}
        feedbackStrategy={FeedbackStrategies.Always}
        onValidation={onValidation}
        externalErrors={{"/": ["External error", "Another external error"]}}
      >
        {link => (
          <TestField
            link={link}
            validation={s => {
              if (s.length > 0) {
                return [];
              } else {
                return ["No blank strings"];
              }
            }}
          />
        )}
      </Form>
    );

    expect(onValidation).toHaveBeenCalledTimes(1);
    expect(onValidation).toHaveBeenLastCalledWith(false);

    const inner = renderer.root.findByType(TestInput);
    inner.instance.change("zach");

    expect(onValidation).toHaveBeenCalledTimes(2);
    expect(onValidation).toHaveBeenLastCalledWith(true);
  });
});
