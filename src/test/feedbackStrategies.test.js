// @flow

import FeedbackStrategies, {
  type FeedbackStrategy,
  and,
  or,
  not,
} from "../feedbackStrategies";

describe("feedbackStrategies", () => {
  describe("provided strategies", () => {
    describe("Always", () => {
      it("always returns true", () => {
        expect(FeedbackStrategies.Always()).toBe(true);
      });
    });

    describe("Touched", () => {
      it("returns true when the field is touched", () => {
        // $FlowFixMe[prop-missing]
        // $FlowFixMe[incompatible-call]
        expect(FeedbackStrategies.Touched(null, {touched: true})).toBe(true);
      });
      it("returns false when the field is not touched", () => {
        // $FlowFixMe[prop-missing]
        // $FlowFixMe[incompatible-call]
        expect(FeedbackStrategies.Touched(null, {touched: false})).toBe(false);
      });
    });

    describe("Blurred", () => {
      it("returns true when the field is blurred", () => {
        // $FlowFixMe[prop-missing]
        // $FlowFixMe[incompatible-call]
        expect(FeedbackStrategies.Blurred(null, {blurred: true})).toBe(true);
      });
      it("returns false when the field is not blurred", () => {
        // $FlowFixMe[prop-missing]
        // $FlowFixMe[incompatible-call]
        expect(FeedbackStrategies.Blurred(null, {blurred: false})).toBe(false);
      });
    });

    describe("Changed", () => {
      it("returns true when the field is changed", () => {
        // $FlowFixMe[prop-missing]
        // $FlowFixMe[incompatible-call]
        expect(FeedbackStrategies.Changed(null, {changed: true})).toBe(true);
      });
      it("returns false when the field is not changed", () => {
        // $FlowFixMe[prop-missing]
        // $FlowFixMe[incompatible-call]
        expect(FeedbackStrategies.Changed(null, {changed: false})).toBe(false);
      });
    });

    describe("ClientValidationSucceeded", () => {
      it("returns true when the field has passed client validations in the past", () => {
        expect(
          // $FlowFixMe[prop-missing]
          // $FlowFixMe[incompatible-call]
          FeedbackStrategies.ClientValidationSucceeded(null, {succeeded: true})
        ).toBe(true);
      });
      it("returns false when the field has not passed client validations in the past", () => {
        expect(
          // $FlowFixMe[prop-missing]
          // $FlowFixMe[incompatible-call]
          FeedbackStrategies.ClientValidationSucceeded(null, {succeeded: false})
        ).toBe(false);
      });
    });

    describe("Pristine", () => {
      it("returns true when the form is pristine", () => {
        // $FlowFixMe[prop-missing]
        expect(FeedbackStrategies.Pristine({pristine: true})).toBe(true);
      });
      it("returns false when the form is not pristine", () => {
        // $FlowFixMe[prop-missing]
        expect(FeedbackStrategies.Pristine({pristine: false})).toBe(false);
      });
    });

    describe("Submitted", () => {
      it("returns true when the form is submitted", () => {
        // $FlowFixMe[prop-missing]
        expect(FeedbackStrategies.Submitted({submitted: true})).toBe(true);
      });
      it("returns false when the form is not submitted", () => {
        // $FlowFixMe[prop-missing]
        expect(FeedbackStrategies.Submitted({submitted: false})).toBe(false);
      });
    });
  });

  describe("combining strategies", () => {
    const t: FeedbackStrategy = () => true;
    const f: FeedbackStrategy = () => false;

    function callStrategy(strategy: FeedbackStrategy) {
      // $FlowFixMe[incompatible-call]
      return strategy();
    }

    describe("and()", () => {
      it("behaves like boolean conjunction", () => {
        expect(callStrategy(and(t, t))).toBe(true);
        expect(callStrategy(and(t, f))).toBe(false);
        expect(callStrategy(and(f, t))).toBe(false);
        expect(callStrategy(and(f, f))).toBe(false);
      });
    });

    describe("or()", () => {
      it("behaves like boolean disjunction", () => {
        expect(callStrategy(or(t, t))).toBe(true);
        expect(callStrategy(or(t, f))).toBe(true);
        expect(callStrategy(or(f, t))).toBe(true);
        expect(callStrategy(or(f, f))).toBe(false);
      });
    });

    describe("not()", () => {
      it("behaves like boolean negation", () => {
        expect(callStrategy(not(t))).toBe(false);
        expect(callStrategy(not(f))).toBe(true);
      });
    });
  });
});
