// @flow

import FeedbackStrategies from "../feedbackStrategies";

describe("feedbackStrategies", () => {
  describe("provided strategies", () => {
    describe("Always", () => {
      it("always returns true", () => {
        expect(FeedbackStrategies.Always()).toBe(true);
      });
    });

    describe("Touched", () => {
      it("returns true when the field is touched", () => {
        // $FlowFixMe
        expect(FeedbackStrategies.Touched(null, {touched: true})).toBe(true);
      });
      it("returns false when the field is not touched", () => {
        // $FlowFixMe
        expect(FeedbackStrategies.Touched(null, {touched: false})).toBe(false);
      });
    });

    describe("Changed", () => {
      it("returns true when the field is changed", () => {
        // $FlowFixMe
        expect(FeedbackStrategies.Changed(null, {changed: true})).toBe(true);
      });
      it("returns false when the field is not changed", () => {
        // $FlowFixMe
        expect(FeedbackStrategies.Changed(null, {changed: false})).toBe(false);
      });
    });

    describe("ClientValidationSucceeded", () => {
      it("returns true when the field has passed client validations in the past", () => {
        expect(
          // $FlowFixMe
          FeedbackStrategies.ClientValidationSucceeded(null, {succeeded: true})
        ).toBe(true);
      });
      it("returns false when the field has not passed client validations in the past", () => {
        expect(
          // $FlowFixMe
          FeedbackStrategies.ClientValidationSucceeded(null, {succeeded: false})
        ).toBe(false);
      });
    });

    describe("Pristine", () => {
      it("returns true when the form is pristine", () => {
        // $FlowFixMe
        expect(FeedbackStrategies.Pristine({pristine: true})).toBe(true);
      });
      it("returns false when the form is not pristine", () => {
        // $FlowFixMe
        expect(FeedbackStrategies.Pristine({pristine: false})).toBe(false);
      });
    });

    describe("Submitted", () => {
      it("returns true when the form is submitted", () => {
        // $FlowFixMe
        expect(FeedbackStrategies.Submitted({submitted: true})).toBe(true);
      });
      it("returns false when the form is not submitted", () => {
        // $FlowFixMe
        expect(FeedbackStrategies.Submitted({submitted: false})).toBe(false);
      });
    });
  });
});
