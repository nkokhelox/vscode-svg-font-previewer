# SVG Font Previewer

[![Node.js CI](https://github.com/nkokhelox/vscode-svg-font-previewer/actions/workflows/node.js.yml/badge.svg?branch=master)](https://github.com/nkokhelox/vscode-svg-font-previewer/actions/workflows/node.js.yml)

SVG Font Previewer is built for viewing *SVG Font* files only.
This will render all of the glyphs in the font file and also show their names.

## Requirements
- This depends on [xmldom npm library](https://www.npmjs.com/package/xmldom)
- It currently makes use of vscode webview interface.
- `SVG` file should meet this criteria for it to work with this extension, `resourceLangId == svg`  or `resourceLangId == xml` and `fileExtension == .svg`

## Extension Settings
This extension contributes the following settings:
- `svg-font-previewer.iconSortOrder`: `enum[ascending, descending]` 
  - `ascending:` **(default)** ascending sort order _(small comes first e.g. 0 -> 9 -> A -> Z -> a -> z)_
  - `descending:` descending sort order _(larger comes first e.g. z -> a -> Z -> A -> 9 -> 0)_
- `svg-font-previewer.iconSortBy`: `enum[unicode, name, none]`
  - `none:` **(default)** do not sort at all
  - `unicode`: the icon unicode
  - `name:` the icon name
- `svg-font-previewer.autoOpenPreview`: `boolean`
  - `true:` **(default)** also open the SVG preview when opening the SVG file.
    - _This was done so that people can preview SVG automatically just by installing this extension. Then they'll learn to turn it off them selves if they want to_
  - `false:` don't automatically open the SVG preview when opening the SVG file.
- `svg-font-previewer.iconRender`: `enum[mixed, stroke, fill, both]`
  - `mixed:` this will render the glyphs fill and switch to glyph stroke only if the glyph has fill=none property.
  - `stroke:` this will render the glyph stroke only (it'll just draw the outline of icon).
  - `fill:` this will render the glyph fill only.
  - `both:` this will render both the glyph fill and stroke.
- `svg-font-previewer.iconRenderStrokeWidth`: `integer`
  - The width of the stroke to be drawn based on the render mode.

## Features
This extension supports viewing SVG Fonts only.
- For SVG font it will show the `font name`, `em size scale`, `font icons`.

#### Invoke from the command palette
- ![Imgur](https://i.imgur.com/aAKukkJ.png)

#### Invoke from editor actions (Where you usually find preview buttons)
- ![Imgur](https://i.imgur.com/kQqXcr6.png)

#### Changes with the themes
- ![Imgur](https://i.imgur.com/oqkY9Zk.gif)

## Known Issues

- The command is available for any `XML` document.

- If there's a wide icon from the font file, then that icon may flow over icons on the right.
  - ***[Workaround]** If this hides some icons then, resizing the preview window may help.*
  - ![Imgur](https://i.imgur.com/yG6NMwg.gif)

## Release Notes

- Quickly preview the font details and how the actual SVG font icons look like.
- Sort the icons preview by icon names or by icon unicode in ascending or descending order.


### Updates
- For detailed changes see our [CHANGELOG.md](CHANGELOG.md)

--------------------------------------

## Credits

* [**Artūrs Jansons**](https://jsfiddle.net/user/iegik/fiddles/)
* [Yoco technologies](https://grnh.se/7723f8371)
* [Stackoverflow](https://stackoverflow.com/users/story/6941707)
* [icomoon.io](https://icomoon.io/)
