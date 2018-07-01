'use strict';
import * as vscode from 'vscode';
import * as xml from 'xmldom';

export default class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  document: vscode.TextDocument;

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this._onDidChange.event;
  }

  constructor(svgDocument: vscode.TextDocument) {
    this.document = svgDocument;
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    return this.previewSvg();
  }

  public update(svgDocument: vscode.TextDocument) {
    this.document = svgDocument;
    this._onDidChange.fire(svgDocument.uri);
  }

  previewSvg(): string {
    const editorSvgContent = this.document.getText();

    const parser = new xml.DOMParser();
    const xmlFontContent = parser.parseFromString(editorSvgContent, `text/xml`);
    const htmlDocument = parser.parseFromString('<!doctype html/>', `text/html`);

    const fontNodes = xmlFontContent.getElementsByTagName('font-face') || xmlFontContent.getElementsByTagName('font').getAttribute('id');

    const htmlBody = htmlDocument.createElement(`body`);

    if (!fontNodes || fontNodes.length <= 0) { // Normal svg image
      const iconContainer = htmlDocument.createElement('a');
      iconContainer.setAttribute('style', 'text-decoration:none; color:inherit; display:block; margin: 0 auto; width:6em; height:6em; padding:.5em;');
      iconContainer.setAttribute('href', '#');
      iconContainer.appendChild(xmlFontContent);

      const iconSvgPath = htmlDocument.createElement('dt');
      iconSvgPath.setAttribute('style', 'margin:0');
      iconSvgPath.setAttribute('class', 'glyph');
      iconSvgPath.appendChild(iconContainer);

      const svgContent = htmlDocument.createElement(`dl`);
      svgContent.setAttribute('style', 'outline: dotted 1px; width: 8em; height: 8em; padding: .5em;');
      svgContent.appendChild(iconSvgPath);

      htmlBody.appendChild(svgContent);

    } else { // Font svg
      for (let fontIndex = 0; fontNodes && fontIndex < fontNodes.length; fontIndex++) {
        const fontNode = fontNodes[fontIndex];
        const ascent = fontNode.getAttribute('ascent');
        const descent = fontNode.getAttribute('descent');
        const fontFamily = fontNode.getAttribute('font-family');
        const unitsPerEm = fontNode.getAttribute('units-per-em');

        const fontDescriptionElement = parser.parseFromString(`<p><b>Font Name = ${fontFamily}</b> 1em = ${unitsPerEm} ascent = ${ascent} descent = ${descent}</p>`);

        htmlBody.appendChild(fontDescriptionElement);

        const glyphList = xmlFontContent.getElementsByTagName('glyph');
        for (let fontIconIndex = 0; fontIconIndex < glyphList.length; fontIconIndex++) {
          const glyphIcon = glyphList[fontIconIndex];
          if (glyphIcon) {
            const svgPathData = glyphIcon.getAttribute('d');
            const unicodeChar = glyphIcon.getAttribute('unicode');
            const iconName = glyphIcon.getAttribute('glyph-name');
            const horizontalUnits = glyphIcon.getAttribute('horiz-adv-x') || unitsPerEm;
            const hexChar = unicodeChar ? (unicodeChar.charCodeAt(0).toString(16)) : null;

            if (svgPathData) {
              const pathElement = htmlDocument.createElement(`path`);
              pathElement.setAttribute('transform', `translate(0,${unitsPerEm}) scale(1, -1)`);
              pathElement.setAttribute('style', 'fill:currentcolor');
              pathElement.setAttribute('d', svgPathData);

              const svgElement = htmlDocument.createElement(`svg`);
              svgElement.setAttribute('viewBox', `0 0 ${horizontalUnits * 1} ${unitsPerEm * 1}`);
              svgElement.setAttribute('style', 'height:2em');
              svgElement.appendChild(pathElement);

              const iconContainer = htmlDocument.createElement('a');
              iconContainer.setAttribute('style', `text-decoration:none; color:inherit; display:block; margin-bottom:90px;margin: auto; width:3em; height:4em; padding:.5em;`);
              iconContainer.appendChild(svgElement);

              const iconSvgPath = htmlDocument.createElement('dt');
              iconSvgPath.setAttribute('style', 'margin:0');
              iconSvgPath.setAttribute('class', 'glyph');
              iconSvgPath.appendChild(iconContainer);

              const iconSvgName = htmlDocument.createElement(`span`);
              iconSvgName.setAttribute('id', `icon-name-${iconName}`);
              iconSvgName.setAttribute('style', `margin: 0; bottom: 0; font-size:15px; overflow:hidden; width:100%;`);
              iconSvgName.appendChild(htmlDocument.createTextNode(iconName));

              const iconSvgChar = htmlDocument.createElement(`p`);
              iconSvgChar.setAttribute('id', `icon-char-${hexChar}`);
              iconSvgChar.setAttribute('style', `font-size:10px; overflow:hidden; width:100%;`);
              iconSvgChar.appendChild(htmlDocument.createTextNode(hexChar));

              const svgContent = htmlDocument.createElement(`dl`);
              svgContent.setAttribute('style', 'margin: 0 0 .5em .5em; float: left; outline: currentcolor dotted 1px; min-width: 10em; min-height: 10em; padding: .5em;');
              svgContent.appendChild(iconSvgChar);
              svgContent.appendChild(iconSvgPath);
              svgContent.appendChild(iconSvgName);

              htmlBody.appendChild(svgContent);
            }
          }
        }
      }
    }

    const htmlContent = htmlDocument.createElement(`html`);
    htmlContent.appendChild(parser.parseFromString('<head><meta charset="utf-8"><title>SVG font preview</title></head>'));
    htmlContent.appendChild(htmlBody);

    htmlDocument.appendChild(htmlContent);

    return new xml.XMLSerializer().serializeToString(htmlDocument);
  }
}
