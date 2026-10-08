// Node.js core
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

// External
import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import * as io from "@actions/io";
import { getOctokit } from "@actions/github";

// return value in [amd64, arm64]
function mapArch(arch) {
  const mappings = {
    x64: "amd64",
  };
  return mappings[arch] || arch;
}

// os in [darwin, linux, win32...] (https://nodejs.org/api/os.html#os_os_platform)
// return value in [darwin, linux, windows]
function mapOS(os) {
  const mappings = {
    win32: "windows",
  };
  return mappings[os] || os;
}

async function downloadCLI(url) {
  core.debug(`Downloading Semver CLI from ${url}`);
  const pathToCLI = await tc.downloadTool(url);

  let fixedCLIPath = path.resolve(path.dirname(pathToCLI), "semver");
  if (os.platform().startsWith("win")) {
    fixedCLIPath = `${fixedCLIPath}.exe`;
  }

  io.mv(pathToCLI, fixedCLIPath);
  await fs.chmod(fixedCLIPath, 0o755);

  core.debug(`Semver CLI path is ${fixedCLIPath}`);

  if (!fixedCLIPath) {
    throw new Error(`Unable to download Semver CLI from ${url}`);
  }

  return fixedCLIPath;
}

async function run() {
  try {
    const version = core.getInput("version");
    const octokit = getOctokit();

    let release;
    if (version == "latest") {
      release = await octokit.rest.repos.getLatestRelease({
        owner: "jghiloni",
        repo: "semver",
      });
    } else {
      release = await octokit.rest.repos.getReleaseByTag({
        owner: "jghiloni",
        repo: "semver",
        tag: version,
      });
    }

    const tagName = release.tagName;
    const platformOS = mapOS(os.platform());
    const platformArch = mapArch(os.arch());
    const ext = platformOS === "windows" ? ".exe" : "";

    const fileName = `semver_${platformOS}_${platformArch}_${tagName}${ext}`;
    let downloadURL;
    for (const asset of release.data.assets) {
      if (asset.name === fileName) {
        downloadURL = asset.browser_download_url;
        break;
      }
    }

    if (!downloadURL) {
      throw new Error(
        `could not find download url for os: ${platformOS}, arch: ${platformArch}, version: ${tagName}`,
      );
    }

    const cliPath = await downloadCLI(downloadURL);
    core.addPath(cliPath);
  } catch (err) {
    core.error(err);
    throw err;
  }
}
