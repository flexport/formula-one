// @flow

import React, {useLayoutEffect} from "react";
import TestRenderer from "react-test-renderer";
import FeedbackStrategies from "../feedbackStrategies";
import Form, {FormContext} from "../Form";
import ObjectField from "../ObjectField";
import ArrayField from "../ArrayField";
import Field from "../Field";
import type {FieldLink} from "../types";

import {expectLink, mockFormState} from "./tools";
import TestField, {TestInput} from "./TestField";
import LinkTap from "../testutils/LinkTap";
import {forgetShape} from "../shapedTree";
import Tracer from "../tracer";

type NaughtyProps = {|
  value: string,
  errors: $ReadOnlyArray<string>,
  onChange: string => void,
  onBlur: () => void,
|};

const NaughtyRenderingInput = (props: NaughtyProps) => {
  // identical to useEffect, but it fires synchronously
  useLayoutEffect(() => {
    props.onChange("hello from cDM()");
  }, []);
  return null;
};

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

function expectMetaTouched(meta, value) {
  expect(meta).toEqual(
    expect.objectContaining({
      touched: value,
      changed: value,
      blurred: value,
    })
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

      const formState = renderer.root.findByType(ObjectField).props.link
        .formState;

      let node = formState[1];
      expect(node.data.errors.client).toEqual(["object error"]);
      expectMetaTouched(node.data.meta, false);
      expect(node.data.meta.succeeded).toBe(false);

      node = node.children.a;
      expect(node.data.errors.client).toEqual(["array", "error"]);
      expectMetaTouched(node.data.meta, false);
      expect(node.data.meta.succeeded).toBe(false);

      const child0 = node.children[0];
      expect(child0.data.errors.client).toEqual(["error 1"]);
      expectMetaTouched(node.data.meta, false);
      expect(node.data.meta.succeeded).toBe(false);

      const child1 = node.children[1];
      expect(child1.data.errors.client).toEqual(["error 2"]);
      expectMetaTouched(node.data.meta, false);
      expect(node.data.meta.succeeded).toBe(false);

      node = formState[1].children.s;
      expect(node.data.errors.client).toEqual([]);
      expectMetaTouched(node.data.meta, false);
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

      const formState = renderer.root.findByType(ObjectField).props.link
        .formState;

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

    it("validates newly mounted Fields", () => {
      function expectClientErrors(link) {
        const tree = link.formState[1];
        return expect(forgetShape(tree).data.errors.client);
      }

      const renderFn = jest.fn(() => null);
      const validationA = jest.fn(() => ["error a"]);
      const validationB = jest.fn(() => ["error b"]);
      const renderer = TestRenderer.create(
        <Form initialValue={{key: "hello"}}>
          {link => (
            <ObjectField link={link}>
              {link => (
                <>
                  <LinkTap link={link.key}>{renderFn}</LinkTap>
                  <TestField link={link.key} validation={validationA} />
                  {/*<TestField link={link.key} validation={validationB} />*/}
                </>
              )}
            </ObjectField>
          )}
        </Form>
      );
      expect(renderFn).toHaveBeenCalledTimes(2);

      let link, node;

      // Initial render
      link = renderFn.mock.calls[0][0];
      // Note that here we expose "pending" as part of our API...
      // TODO(dmnd): It'd be nice if we could avoid this.
      expectClientErrors(link).toEqual("pending");
      node = forgetShape(link.formState[1]);
      expect(node.data.meta.succeeded).toBe(false);
      expectMetaTouched(node.data.meta, false);

      // After the second render the error arrives.
      link = renderFn.mock.calls[1][0];
      expectClientErrors(link).toEqual(["error a"]);
      node = forgetShape(link.formState[1]);
      expect(node.data.meta.succeeded).toBe(false);
      expectMetaTouched(node.data.meta, false);

      expect(validationA).toHaveBeenCalledTimes(1);
      expect(validationA).toHaveBeenCalledWith("hello");

      // When a new Field is mounted, we expect the new errors to show up.
      renderFn.mockClear();
      validationA.mockClear();
      renderer.update(
        <Form initialValue={{key: "hello"}}>
          {link => (
            <ObjectField link={link}>
              {link => (
                <>
                  <LinkTap link={link.key}>{renderFn}</LinkTap>
                  <TestField link={link.key} validation={validationA} />
                  <TestField link={link.key} validation={validationB} />
                </>
              )}
            </ObjectField>
          )}
        </Form>
      );
      expect(renderFn).toHaveBeenCalledTimes(2);

      // There's an initial render where the field hasn't yet been validated
      // TODO(dmnd): It'd be nice if we could avoid this.
      link = renderFn.mock.calls[0][0];
      expectClientErrors(link).toEqual(["error a"]);
      node = forgetShape(link.formState[1]);
      expect(node.data.meta.succeeded).toBe(false);
      expectMetaTouched(node.data.meta, false);

      // After the update, the new error should be present.
      link = renderFn.mock.calls[1][0];
      expectClientErrors(link).toEqual(["error a", "error b"]);
      node = forgetShape(link.formState[1]);
      expect(node.data.meta.succeeded).toBe(false);
      expectMetaTouched(node.data.meta, false);

      // Validation functions should receive the correct parameters. These
      // assertions protect against bugs that confuse relative and absolute
      // paths/values.
      expect(validationA).toHaveBeenCalledTimes(1);
      expect(validationA).toHaveBeenCalledWith("hello");
      expect(validationB).toHaveBeenCalledTimes(1);
      expect(validationB).toHaveBeenCalledWith("hello");
    });

    it("updates errors when a new validation function is provided via props", () => {
      const renderer = TestRenderer.create(
        <Form initialValue="hello">
          {link => <TestField link={link} validation={() => ["error 1"]} />}
        </Form>
      );

      let link = renderer.root.findAllByType(TestField)[0].props.link;
      let errors = link.formState[1].data.errors.client;
      expect(errors).toEqual(["error 1"]);

      renderer.update(
        <Form initialValue="hello">
          {link => <TestField link={link} validation={() => ["error 2"]} />}
        </Form>
      );

      link = renderer.root.findAllByType(TestField)[0].props.link;
      errors = link.formState[1].data.errors.client;
      expect(errors).toEqual(["error 2"]);
    });

    it("doesn't break when elements are reused", () => {
      const objectValidation0 = jest.fn(() => []);
      const objectValidation1 = jest.fn(() => []);
      const arrayValidation0 = jest.fn(() => []);
      const arrayValidation1 = jest.fn(() => []);

      const initialValue = {
        o: {
          a: "alpha",
          b: "beta",
        },
        a: ["zach", "desmond"],
        f: "theseus", // tag field
      };

      const renderer = TestRenderer.create(
        <Form initialValue={initialValue}>
          {link => (
            <ObjectField link={link}>
              {(links, {value}) => (
                <>
                  <ObjectField link={links.o}>
                    {links =>
                      value.f === "theseus" ? (
                        <TestField
                          link={links.a}
                          validation={objectValidation0}
                          key="reuse"
                        />
                      ) : (
                        <TestField
                          link={links.b}
                          validation={objectValidation1}
                          key="reuse"
                        />
                      )
                    }
                  </ObjectField>
                  <ArrayField link={links.a}>
                    {links =>
                      value.f === "theseus" ? (
                        <TestField
                          link={links[0]}
                          validation={arrayValidation0}
                          key="reuse"
                        />
                      ) : (
                        <TestField
                          link={links[1]}
                          validation={arrayValidation1}
                          key="reuse"
                        />
                      )
                    }
                  </ArrayField>
                  <TestField link={links.f} />
                </>
              )}
            </ObjectField>
          )}
        </Form>
      );

      expect(objectValidation0).toHaveBeenCalledTimes(1);
      expect(objectValidation0).toHaveBeenCalledWith("alpha");
      expect(arrayValidation0).toHaveBeenCalledTimes(1);
      expect(arrayValidation0).toHaveBeenCalledWith("zach");
      expect(objectValidation1).toHaveBeenCalledTimes(0);
      expect(arrayValidation1).toHaveBeenCalledTimes(0);

      objectValidation0.mockClear();
      arrayValidation0.mockClear();

      // Change the tag field
      renderer.root.findAllByType(TestInput)[2].instance.change("foo");

      // TODO(zgotsch): If we instead change the first TestField, this first
      //   validation gets called once on the way up. We would prefer that this
      //   doesn't happen.
      expect(objectValidation0).toHaveBeenCalledTimes(0);
      expect(arrayValidation0).toHaveBeenCalledTimes(0);
      expect(objectValidation1).toHaveBeenCalledTimes(1);
      expect(objectValidation1).toHaveBeenCalledWith("beta");
      expect(arrayValidation1).toHaveBeenCalledTimes(1);
      expect(arrayValidation1).toHaveBeenCalledWith("desmond");
    });

    it("doesn't break when elements are reused with customChange", () => {
      const objectValidation0 = jest.fn(() => []);
      const objectValidation1 = jest.fn(() => []);
      const arrayValidation0 = jest.fn(() => []);
      const arrayValidation1 = jest.fn(() => []);

      const initialValue = {
        o: {
          a: "alpha",
          b: "beta",
        },
        a: ["zach", "desmond"],
        f: "theseus", // tag field
      };
      const otherValue = {
        o: {
          a: "gamma",
          b: "delta",
        },
        a: ["bryan", "kaye"],
        f: "minotaur",
      };

      const renderer = TestRenderer.create(
        <Form initialValue={initialValue}>
          {link => (
            <ObjectField link={link} customChange={() => otherValue}>
              {(links, {value}) => (
                <>
                  <ObjectField link={links.o}>
                    {links =>
                      value.f === "theseus" ? (
                        <TestField
                          link={links.a}
                          validation={objectValidation0}
                          key="reuse"
                        />
                      ) : (
                        <TestField
                          link={links.b}
                          validation={objectValidation1}
                          key="reuse"
                        />
                      )
                    }
                  </ObjectField>
                  <ArrayField link={links.a}>
                    {links =>
                      value.f === "theseus" ? (
                        <TestField
                          link={links[0]}
                          validation={arrayValidation0}
                          key="reuse"
                        />
                      ) : (
                        <TestField
                          link={links[1]}
                          validation={arrayValidation1}
                          key="reuse"
                        />
                      )
                    }
                  </ArrayField>
                  <TestField link={links.f} />
                </>
              )}
            </ObjectField>
          )}
        </Form>
      );

      expect(objectValidation0).toHaveBeenCalledTimes(1);
      expect(objectValidation0).toHaveBeenCalledWith("alpha");
      expect(arrayValidation0).toHaveBeenCalledTimes(1);
      expect(arrayValidation0).toHaveBeenCalledWith("zach");
      expect(objectValidation1).toHaveBeenCalledTimes(0);
      expect(arrayValidation1).toHaveBeenCalledTimes(0);

      objectValidation0.mockClear();
      arrayValidation0.mockClear();

      // Change the tag field
      renderer.root.findAllByType(TestInput)[2].instance.change("foo");

      // TODO(zgotsch): If we instead change the first TestField, this first
      //   validation gets called once on the way up. We would prefer that this
      //   doesn't happen.
      expect(objectValidation0).toHaveBeenCalledTimes(0);
      expect(arrayValidation0).toHaveBeenCalledTimes(0);
      expect(objectValidation1).toHaveBeenCalledTimes(1);
      expect(objectValidation1).toHaveBeenCalledWith("delta");
      expect(arrayValidation1).toHaveBeenCalledTimes(1);
      expect(arrayValidation1).toHaveBeenCalledWith("kaye");
    });
  });

  describe("Form manages form state", () => {
    it("creates the initial formState from initialValue and externalErrors", () => {
      const onSubmit = jest.fn();
      const renderFn = jest.fn(() => null);
      TestRenderer.create(
        <Form
          initialValue={1}
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
          blurred: false,
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
                <>
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
                </>
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
                <>
                  <NaughtyRenderingField
                    link={link.naughty}
                    validation={() => ["Naughty", "errors"]}
                  />
                  <TestField
                    link={link.nice}
                    validation={() => ["Nice", "errors"]}
                  />
                </>
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
          blurred: false,
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

      let rootFormState = renderer.root.findByType(TestForm).props.link
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

      rootFormState = renderer.root.findByType(TestForm).props.link
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
      let link = renderer.root.findAllByType(TestField)[0].props.link;
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

      link = renderer.root.findAllByType(TestField)[0].props.link;
      errors = link.formState[1].data.errors.client;
      expect(errors).toEqual(["error 1"]);
    });
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
    expect(onSubmit).toHaveBeenLastCalledWith(1, undefined, {
      valid: {
        client: true,
        external: true,
      },
    });
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
    expect(onSubmit).toHaveBeenLastCalledWith(
      expect.anything(),
      "extra",
      expect.anything()
    );
  });

  it("Calls onSubmit with validation info when submitted", () => {
    const onSubmit = jest.fn();
    const renderFn = jest.fn(link => (
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
    ));
    TestRenderer.create(
      <Form
        initialValue={""}
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
    expect(onSubmit).toHaveBeenLastCalledWith("", undefined, {
      valid: {
        client: false,
        external: false,
      },
    });
  });

  it("Enforces types on onSubmit", () => {
    const onSubmit: (value: number, extra: "extra") => void = () => {};
    TestRenderer.create(
      // $FlowExpectedError[incompatible-type]
      <Form initialValue={1} onSubmit={onSubmit}>
        {(_, onSubmit) => (
          <button
            onClick={() => {
              onSubmit();
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

  describe("performance", () => {
    it("batches setState calls when unmounting components", () => {
      // Record the number of render and commit phases
      let renders = 0;
      let commits = 0;
      class RenderCalls extends React.Component<{||}> {
        componentDidUpdate() {
          commits += 1;
        }

        render() {
          renders += 1;
          return (
            <div>
              Rendered {renders} times, committed {commits} times.
            </div>
          );
        }
      }

      const validation = jest.fn();

      // N in the O(N) sense for this perf test.
      const N = 10;

      const renderer = TestRenderer.create(
        <Form initialValue={"A string"}>
          {link => (
            <>
              <RenderCalls />
              <>
                {[...Array(N).keys()].map(i => (
                  <Field key={i} link={link} validation={validation}>
                    {() => <div>input</div>}
                  </Field>
                ))}
              </>
            </>
          )}
        </Form>
      );

      // One render for initial mount, and another after Form validates
      // everything from componentDidMount.
      // TODO(dmnd): Can we adjust implementation to make this only render once?
      expect(renders).toBe(1 + 1);
      expect(commits).toBe(1);
      expect(validation).toBeCalledTimes(N);

      renders = 0;
      commits = 0;
      validation.mockClear();

      // now unmount all the fields
      renderer.update(
        <Form initialValue={"A string"}>
          {() => (
            <>
              <RenderCalls />
            </>
          )}
        </Form>
      );

      // We expect only two renders. The first to build the VDOM without Fields.
      // Then during reconciliation React realizes the Fields have to unmount,
      // so it calls componentWillUnmount on each Field, which then causes a
      // setState for each Field. But then we expect that React batches all
      // these setStates into a single render, not one render per each Field.
      expect(renders).toBe(1 + 1);
      expect(renders).not.toBe(1 + N);

      // Similarly, we expect only 2 commits, not one for each Field. You might
      // expect only a single commit, but componentWillUnmount happens during
      // the commit phase, so when setState is called React enqueues another
      // render phase which commits separately. Oh well. At least the number of
      // commits is constant!
      expect(commits).toBe(1 + 1);
      expect(commits).not.toBe(1 + N);
    });
  });

  describe("Tracer", () => {
    it("registers TracerDelegate when traceDirty equals true", () => {
      const renderFn = jest.fn(() => null);

      const renderer = TestRenderer.create(
        <Form initialValue={1} traceDirty={true}>
          {renderFn}
        </Form>
      );

      expect(Tracer.delegates.length).toBe(1);
      expect(Tracer.isDirty()).toBe(false);

      renderer.unmount();

      expect(Tracer.delegates.length).toBe(0);
    });

    it("updates dirty after form state changes", () => {
      const renderFn = jest.fn(link => (
        <FormContext.Consumer>
          {() => <TestField link={link} />}
        </FormContext.Consumer>
      ));

      const renderer = TestRenderer.create(
        <Form initialValue={"Hello"} traceDirty={true}>
          {renderFn}
        </Form>
      );

      expect(Tracer.isDirty()).toBe(false);

      const inner = renderer.root.findByType(TestInput);
      inner.instance.change("World");

      expect(Tracer.isDirty()).toBe(true);

      const linkOnSubmit = renderFn.mock.calls[0][1];
      linkOnSubmit();
      // reset isDirty after form submits
      expect(Tracer.isDirty()).toBe(false);
    });

    it("customizes isDirty by using customDirty", () => {
      const renderFn = jest.fn(() => null);
      const customDirty = jest.fn(() => true);

      TestRenderer.create(
        <Form initialValue={1} traceDirty={true} customDirty={customDirty}>
          {renderFn}
        </Form>
      );

      expect(Tracer.isDirty()).toBe(true);
      expect(customDirty).toHaveBeenCalledTimes(1);
    });
  });
});
