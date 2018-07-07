# README
SVG Font Previewer is built for viewing SVG files, especially SVG font files.

## Features
This extension supports viewing SVG Fonts and SVG images
- For SVG font it will show the `font name`, `em size scale`, `font icons`.
- For other SVG's it will just show preview of the SVG as an image.
- I wish i can say it previews any SVG file. 😉

## Requirements
- This depends on [xmldom npm librabry](https://www.npmjs.com/package/xmldom)
- It currently makes use of vscode webview interface.
- `SVG` file should meet this criteria for it to work with this extension, `resourceLangId == xml` and `fileExtension == .svg`

## Extension Settings
This extension contributes the following settings:
- `svg-font-previewer.iconSortOrder`: `enum[asc, desc]` 
  - `asc:` **(default)** ascending sort order _(small comes first e.g. 0->9->A->Z->a->z)_
  - `desc:` descending sort order _(larger comes first e.g. z->a->Z->A->9->0)_
- `svg-font-previewer.iconSortBy`: `enum[unicode, name, none]`
  - `none:` **(default)** do not sort at all
  - `unicode`: the icon unicode
  - `name:` the icon name
- `svg-font-previewer.autoOpenPreview`: `boolean`
  - `true:` **(default)** also open the SVG preview when opening the SVG file.
    - _This was done so that poeple can preview SVG automatically just by installing this extension. Then they'll learn to turn it off them selves if they want to_
  - `false:` don't automatically open the SVG preview when opening the SVG file.

## Known Issues

- The command is available for any `XML` document, still investigating if there's a way to make this extension only work for `SVG`'s without loosing the native VSCode `XML` support.

## Release Notes

- Quickly preview the font details and how the actual SVG font icons look like.
- Sort the icons preview by icon names or by icone unicodes in ascending or descending order.
- For detailed changes see our [CHANGELOG.md](CHANGELOG.md)
### 0.0.1

Initial release of SVG Font Previewer
- Enhancing the way to work with SVG's on VSCode.

--------------------------------------

## Credits

* [Anonymous JsFiddle user](http://jsfiddle.net/iegik/r4ckgdc0/)
