// @flow

import * as React from "react";
import TestRenderer from "react-test-renderer";
import FeedbackStrategies from "../feedbackStrategies";
import Form, {FormContext} from "../Form";
import ObjectField from "../ObjectField";
import ArrayField from "../ArrayField";
import Field from "../Field";
import type {FieldLink} from "../types";

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
  describe("validations", () => {
    it("runs validations", () => {
      const objectValidation = jest.fn(() => []);
      const arrayValidation = jest.fn(() => []);
      const arrayElValidation = jest.fn(() => []);
      const fieldValidation = jest.fn(() => []);

      TestRenderer.create(
        <Form initialValue={{a: ["1", "2"], s: "string"}}>
          {link => (
            <ObjectField link={link} validation={objectValidation}>
              {links => (
                <>
                  <ArrayField link={links.a} validation={arrayValidation}>
                    {links =>
                      links.map((link, i) => (
                        <TestField
                          key={i}
                          link={link}
                          validation={arrayElValidation}
                        />
                      ))
                    }
                  </ArrayField>
                  <TestField link={links.s} validation={fieldValidation} />
                </>
              )}
            </ObjectField>
          )}
        </Form>
      );

      expect(objectValidation).toHaveBeenCalledTimes(1);
      expect(objectValidation).toHaveBeenCalledWith({
        a: ["1", "2"],
        s: "string",
      });

      expect(arrayValidation).toHaveBeenCalledTimes(1);
      expect(arrayValidation).toHaveBeenCalledWith(["1", "2"]);

      expect(arrayElValidation).toHaveBeenCalledTimes(2);
      expect(arrayElValidation).toHaveBeenCalledWith("1");
      expect(arrayElValidation).toHaveBeenCalledWith("2");

      expect(fieldValidation).toHaveBeenCalledTimes(1);
      expect(fieldValidation).toHaveBeenCalledWith("string");
    });

    it("sets validation information on formState", () => {
      const objectValidation = jest.fn(() => ["object error"]);
      const arrayValidation = jest.fn(() => ["array", "error"]);
      const arrayElValidation = jest.fn(s => [`error ${s}`]);
      const fieldValidation = jest.fn(() => []);

      const renderer = TestRenderer.create(
        <Form initialValue={{a: ["1", "2"], s: "string"}}>
          {link => (
            <ObjectField link={link} validation={objectValidation}>
              {links => (
                <>
                  <ArrayField link={links.a} validation={arrayValidation}>
                    {links =>
                      links.map((link, i) => (
                        <TestField
                          key={i}
                          link={link}
                          validation={arrayElValidation}
                        />
                      ))
                    }
                  </ArrayField>
                  <TestField link={links.s} validation={fieldValidation} />
                </>
              )}
            </ObjectField>
          )}
        </Form>
      );

      const formState = renderer.root.findByType(ObjectField).instance.props
        .link.formState;

      let node = formState[1];
      expect(node.data.errors.client).toEqual(["object error"]);
      expect(node.data.meta.succeeded).toBe(false);

      node = node.children.a;
      expect(node.data.errors.client).toEqual(["array", "error"]);
      expect(node.data.meta.succeeded).toBe(false);

      const child0 = node.children[0];
      expect(child0.data.errors.client).toEqual(["error 1"]);
      expect(child0.data.meta.succeeded).toBe(false);

      const child1 = node.children[1];
      expect(child1.data.errors.client).toEqual(["error 2"]);
      expect(child1.data.meta.succeeded).toBe(false);

      node = formState[1].children.s;
      expect(node.data.errors.client).toEqual([]);
      expect(node.data.meta.succeeded).toBe(true);
    });

    it("treats no validation as always passing", () => {
      const renderer = TestRenderer.create(
        <Form initialValue={{a: ["1", "2"], s: "string"}}>
          {link => (
            <ObjectField link={link}>
              {links => (
                <>
                  <ArrayField link={links.a}>
                    {links =>
                      links.map((link, i) => <TestField key={i} link={link} />)
                    }
                  </ArrayField>
                  <TestField link={links.s} />
                </>
              )}
            </ObjectField>
          )}
        </Form>
      );

      const formState = renderer.root.findByType(ObjectField).instance.props
        .link.formState;

      let node = formState[1];
      expect(node.data.errors.client).toEqual([]);
      expect(node.data.meta.succeeded).toBe(true);

      node = node.children.a;
      expect(node.data.errors.client).toEqual([]);
      expect(node.data.meta.succeeded).toBe(true);

      const child0 = node.children[0];
      expect(child0.data.errors.client).toEqual([]);
      expect(child0.data.meta.succeeded).toBe(true);

      const child1 = node.children[1];
      expect(child1.data.errors.client).toEqual([]);
      expect(child1.data.meta.succeeded).toBe(true);

      node = formState[1].children.s;
      expect(node.data.errors.client).toEqual([]);
      expect(node.data.meta.succeeded).toBe(true);
    });
  });
  describe("Form manages form state", () => {
    it("creates the initial formState from initialValue and serverErrors", () => {
      const onSubmit = jest.fn();
      const renderFn = jest.fn(() => null);
      TestRenderer.create(
        <Form
          initialValue={1}
          onSubmit={onSubmit}
          serverErrors={{"/": ["Server error", "Another server error"]}}
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
          server: ["Server error", "Another server error"],
        },
      });
    });

    it("parses and sets complex server errors", () => {
      const onSubmit = jest.fn();
      const renderFn = jest.fn(() => null);
      TestRenderer.create(
        <Form
          initialValue={{
            simple: 3,
            complex: [{inner: "hello"}, {inner: "there"}],
          }}
          onSubmit={onSubmit}
          serverErrors={{
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
      expect(root.data.errors.server).toEqual(["Root error"]);
      const simple = root.children.simple;
      expect(simple.data.errors.server).toEqual(["One", "level", "down"]);
      const complex = root.children.complex;
      expect(complex.data.errors.server).toEqual([]);
      const complex0 = complex.children[0];
      expect(complex0.data.errors.server).toEqual(["in an", "array"]);
      const complex1 = complex.children[1];
      expect(complex1.data.errors.server).toEqual([]);
    });

    it("updates the server errors", () => {
      const onSubmit = jest.fn();
      const renderFn = jest.fn(() => null);
      const renderer = TestRenderer.create(
        <Form
          initialValue={{
            array: [],
          }}
          onSubmit={onSubmit}
          serverErrors={{
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
          onSubmit={onSubmit}
          serverErrors={{
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
      expect(root.data.errors.server).toEqual([]);
      const array = root.children.array;
      expect(array.data.errors.server).toEqual([]);
      const array0 = array.children[0];
      expect(array0.data.errors.server).toEqual(["inner error"]);
    });

    it("doesn't cause an infinite loop when using inline validation function", () => {
      expect(() => {
        TestRenderer.create(
          <Form initialValue="hello">
            {link => <TestField link={link} validation={() => []} />}
          </Form>
        );
      }).not.toThrow(/Maximum update depth exceeded/);
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
          onSubmit={onSubmit}
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
          onSubmit={onSubmit}
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
        <Form initialValue={1} onSubmit={onSubmit}>
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
        <Form initialValue={1} onSubmit={onSubmit}>
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
        <Form initialValue={1} onSubmit={onSubmit}>
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
        <Form initialValue={1} onSubmit={jest.fn()}>
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
        <Form initialValue={1} onSubmit={onSubmit}>
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
          serverErrors={{"/": ["Server error", "Another server error"]}}
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
            "Server error",
            "Another server error",
          ]),
          // Currently, only care about client errors
          valid: true,
          asyncValidationInFlight: false,
          value: 1,
        })
      );
    });

    it("removes errors when a child unmounts", () => {
      const validation1 = jest.fn(() => ["error 1"]);
      const validation2 = jest.fn(() => ["error 2"]);

      class TestForm extends React.Component<{
        hideSecondField: boolean,
        link: FieldLink<{string1: string, string2: string}>,
      }> {
        render() {
          return (
            <ObjectField link={this.props.link}>
              {links => (
                <>
                  <TestField
                    key={"1"}
                    link={links.string1}
                    validation={validation1}
                  />
                  {this.props.hideSecondField ? null : (
                    <TestField
                      key={"2"}
                      link={links.string2}
                      validation={validation2}
                    />
                  )}
                </>
              )}
            </ObjectField>
          );
        }
      }

      const renderer = TestRenderer.create(
        <Form
          initialValue={{
            string1: "hello",
            string2: "world",
          }}
        >
          {link => <TestForm link={link} hideSecondField={false} />}
        </Form>
      );

      expect(validation1).toHaveBeenCalledTimes(1);
      expect(validation2).toHaveBeenCalledTimes(1);

      let rootFormState = renderer.root.findByType(TestForm).instance.props.link
        .formState[1];

      let string1Errors = rootFormState.children.string1.data.errors.client;
      expect(string1Errors).toEqual(["error 1"]);
      let string2Errors = rootFormState.children.string2.data.errors.client;
      expect(string2Errors).toEqual(["error 2"]);

      // now hide the second field, causing it to unmount and unregister the
      // validation handler
      renderer.update(
        <Form
          initialValue={{
            string1: "hello",
            string2: "world",
          }}
        >
          {link => <TestForm link={link} hideSecondField={true} />}
        </Form>
      );

      // no addition validation calls
      expect(validation1).toHaveBeenCalledTimes(1);
      expect(validation2).toHaveBeenCalledTimes(1);

      rootFormState = renderer.root.findByType(TestForm).instance.props.link
        .formState[1];

      // error for string1 remains
      string1Errors = rootFormState.children.string1.data.errors.client;
      expect(string1Errors).toEqual(["error 1"]);

      // string2's error is gone
      string2Errors = rootFormState.children.string2.data.errors.client;
      expect(string2Errors).toEqual([]);
    });

    it("runs all validations when a link has multiple fields", () => {
      const validation1 = jest.fn(() => ["error 1"]);
      const validation2 = jest.fn(() => ["error 2"]);

      const renderer = TestRenderer.create(
        <Form initialValue="hello">
          {link => (
            <>
              {/* note both fields point to the same link!! */}
              <TestField key={"1"} link={link} validation={validation1} />
              <TestField key={"2"} link={link} validation={validation2} />
            </>
          )}
        </Form>
      );

      expect(validation1).toHaveBeenCalledTimes(1);
      expect(validation2).toHaveBeenCalledTimes(1);

      renderer.root.findAllByType(TestInput)[0].instance.change("dmnd");

      expect(validation1).toHaveBeenCalledTimes(2);
      expect(validation2).toHaveBeenCalledTimes(2);

      renderer.root.findAllByType(TestInput)[1].instance.change("zach");

      expect(validation1).toHaveBeenCalledTimes(3);
      expect(validation2).toHaveBeenCalledTimes(3);
    });

    it("only removes errors from validation that was unmounted", () => {
      const validation1 = jest.fn(() => ["error 1"]);
      const validation2 = jest.fn(() => ["error 2"]);

      const renderer = TestRenderer.create(
        <Form initialValue="hello">
          {link => (
            <>
              {/* note both fields point to the same link!! */}
              <TestField key={"1"} link={link} validation={validation1} />
              <TestField key={"2"} link={link} validation={validation2} />
            </>
          )}
        </Form>
      );

      let link = renderer.root.findAllByType(TestField)[0].instance.props.link;
      let errors = link.formState[1].data.errors.client;
      expect(errors).toEqual(["error 1", "error 2"]);

      renderer.update(
        <Form initialValue="hello">
          {link => (
            <>
              <TestField key={"1"} link={link} validation={validation1} />
            </>
          )}
        </Form>
      );

      link = renderer.root.findAllByType(TestField)[0].instance.props.link;
      errors = link.formState[1].data.errors.client;
      expect(errors).toEqual(["error 1"]);
    });
  });

  it("updates errors when a new validation function is provided via props", () => {
    const renderer = TestRenderer.create(
      <Form initialValue="hello">
        {link => <TestField link={link} validation={() => ["error 1"]} />}
      </Form>
    );

    let link = renderer.root.findAllByType(TestField)[0].instance.props.link;
    let errors = link.formState[1].data.errors.client;
    expect(errors).toEqual(["error 1"]);

    renderer.update(
      <Form initialValue="hello">
        {link => <TestField link={link} validation={() => ["error 2"]} />}
      </Form>
    );

    link = renderer.root.findAllByType(TestField)[0].instance.props.link;
    errors = link.formState[1].data.errors.client;
    expect(errors).toEqual(["error 2"]);
  });

  it("Calls onSubmit with the value when submitted", () => {
    const onSubmit = jest.fn();
    const contextExtractor = jest.fn(() => null);
    const renderFn = jest.fn(() => (
      <FormContext.Consumer>{contextExtractor}</FormContext.Consumer>
    ));
    TestRenderer.create(
      <Form initialValue={1} onSubmit={onSubmit}>
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
      <Form initialValue={1} onSubmit={onSubmit}>
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
      <Form initialValue={1} onSubmit={onSubmit}>
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

  it("Calls onChange when the value is changed", () => {
    const onChange = jest.fn();
    const renderFn = jest.fn(() => null);
    TestRenderer.create(
      <Form initialValue={1} onChange={onChange}>
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
      <Form initialValue={""} onValidation={onValidation}>
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
