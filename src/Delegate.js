// @flow strict

type Options = {
  // If currentUrl is not equal to newUrl, shouldConfirm returns false by default.
  +confirmOnSamePage?: boolean,
  // If customizeDirty is undefined, shouldConfirm use dirty instead.
  +customizeDirty?: (newUrl: string | null, dirty: boolean) => boolean,
};

class Delegate {
  +confirmOnSamePage: boolean;
  +customizeDirty:
    | ((newUrl: string | null, dirty: boolean) => boolean)
    | typeof undefined;
  +currentUrl: string;
  // componentDidUpdate on Form keeps dirty updated
  dirty: boolean = false;

  constructor(currentUrl: string, options?: Options) {
    const actualOptions = options || {};
    this.confirmOnSamePage = !!actualOptions.confirmOnSamePage;
    this.customizeDirty = actualOptions.customizeDirty;
    this.currentUrl = currentUrl;
  }

  shouldConfirm(newUrl: string | null): boolean {
    if (!this.confirmOnSamePage && this.currentUrl === newUrl) {
      return false;
    } else if (this.customizeDirty) {
      return this.customizeDirty(newUrl, this.dirty);
    } else {
      return this.dirty;
    }
  }
}

export default Delegate;
