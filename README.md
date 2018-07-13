# SVG Font Previewer

[![Build Status](https://travis-ci.org/nkokhelox/svg-font-viewer.svg?branch=master)](https://travis-ci.org/nkokhelox/svg-font-viewer)

SVG Font Previewer is built for viewing SVG files, especially SVG font files.

## Requirements
- This depends on [xmldom npm librabry](https://www.npmjs.com/package/xmldom)
- It currently makes use of vscode webview interface.
- `SVG` file should meet this criteria for it to work with this extension, `resourceLangId == svg`  or `resourceLangId == xml` and `fileExtension == .svg`

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

## Features
This extension supports viewing SVG Fonts and SVG images
- For SVG font it will show the `font name`, `em size scale`, `font icons`.
- For other SVG's it will just show preview of the SVG as an image.
- I wish i can say it previews any SVG file. 😉

#### Invoke from the command pelette
- ![Imgur](https://i.imgur.com/aAKukkJ.png)

#### Invoke from editor actions (Where you usually find preview buttons)
- ![Imgur](https://i.imgur.com/kQqXcr6.png)

#### Changes with the themes
- ![Imgur](https://i.imgur.com/oqkY9Zk.gif)

## Known Issues

- The command is available for any `XML` document, still investigating if there's a way to make this extension only work for `SVG`'s without loosing the native VSCode `XML` support.

- If there's a wide icon from the font file, then that icon will flow over icons on the right.
  - ***[Workaround]** If this hides some icons then, resizing the preview window may help.*
  - ![Imgur](https://i.imgur.com/yG6NMwg.gif)

## Release Notes

- Quickly preview the font details and how the actual SVG font icons look like.
- Sort the icons preview by icon names or by icone unicodes in ascending or descending order.
- For detailed changes see our [CHANGELOG.md](CHANGELOG.md)

### 1.1.1

Initial public release of SVG Font Previewer
- Enhancing the way to work with SVG's on VSCode.
- Packaging the read me related documents.

--------------------------------------

## Credits

* [**JsFiddle user**](http://jsfiddle.net/iegik/r4ckgdc0/)
* [Yoco technologies](https://www.yoco.co.za/careers#/)
* [Stackoverflow](https://stackoverflow.com/users/story/6941707)
* [icomoon.io](https://icomoon.io/)
