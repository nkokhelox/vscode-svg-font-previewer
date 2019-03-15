# Change Log
All notable changes to the "SVG Font" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.1] - 2018-07-08
- Initial release

## [0.0.2] - 2018-07-08
- Icon box rescales to fit the name

## [0.0.3] - 2018-07-08
- Sorted icons by name

## [0.0.4] - 2018-07-08
- Sorted icons by unicode

## [0.0.5] - 2018-07-08
- Make sorting configurable

## [0.0.6] - 2018-07-08
- Prompt if extension is activated and configuration changes

## [0.0.7] - 2018-07-08
- Prompt if extension is activated and document saves

## [0.0.8] - 2018-07-08
- Using webview for now

## [0.0.9] - 2018-07-08
- Key binding

## [0.1.0] - 2018-07-08
- License update

## [0.1.1] - 2018-07-08
- Adding the extension icon

## [0.1.2] - 2018-07-08
- Adding the extension icon (Tiny png version)

## [0.1.3] - 2018-07-08
- Adding travis ci

## [0.1.4] - 2018-07-08
- Publish

## [0.1.5] - 2018-07-08
- Fixing the display name

## [0.1.6] - 2018-07-08
- Enable preview of other SVG files

## [0.1.7] - 2018-07-08
- Updated extension's home page to be github default project website 

## [0.9.9] - 2018-07-08
- Playing with the vsce publisher

## [1.0.0] - 2018-07-08
- Full version release

## [1.1.0] - 2018-07-08
- Testing what vsce publish minor do.

## [1.1.1] - 2018-07-08
- Activate the extension when workspace has .svg files.

## [1.1.2] - 2018-07-08
- Shredding some bytes, the *.md files were packaged twice.

## [1.1.3] - 2018-07-08
- Support for svg language id.

## [1.1.4] - 2019-03-15
- Rebuilt with updated dependency modules to remedy the following issues:
  - [CVE-2018-3774](https://nvd.nist.gov/vuln/detail/CVE-2018-3774): Incorrect parsing in url-parse <1.4.3 returns wrong hostname which leads to multiple vulnerabilities such as SSRF, Open Redirect, Bypass Authentication Protocol.
  - [CVE-2018-16491](https://nvd.nist.gov/vuln/detail/CVE-2018-16491): A prototype pollution vulnerability was found in node.extend <1.1.7, ~<2.0.1 that allows an attacker to inject arbitrary properties onto Object.prototype.
