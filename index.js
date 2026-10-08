import * as core from "@actions/core";
import * as setup from "./lib/setup-semver-cli";

(async () => {
  try {
    await setup();
  } catch (err) {
    core.setFailed(err.message);
  }
})();
