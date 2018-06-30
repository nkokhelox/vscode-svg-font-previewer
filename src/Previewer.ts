

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
    let editorSvgContent = this.document.getText();

    let parser = new xml.DOMParser();
    let xmlFontContent = parser.parseFromString(editorSvgContent, `text/xml`);
    let htmlDocument = parser.parseFromString('<!doctype html/>', `text/html`);

    let fontNodes = xmlFontContent.getElementsByTagName('font-face') || xmlFontContent.getElementsByTagName('font').getAttribute('id');

    let htmlBody = htmlDocument.createElement(`body`);

    if (!fontNodes || fontNodes.length <= 0) { // Normal svg image
      let iconContainer = htmlDocument.createElement('a');
      iconContainer.setAttribute('style', 'text-decoration:none; color:inherit; display:block; margin: 0 auto; width:6em; height:6em; padding:.5em;');
      iconContainer.setAttribute('href', '#');
      iconContainer.appendChild(xmlFontContent);

      let iconSvgPath = htmlDocument.createElement('dt');
      iconSvgPath.setAttribute('style', 'margin:0');
      iconSvgPath.setAttribute('class', 'glyph');
      iconSvgPath.appendChild(iconContainer);

      let svgContent = htmlDocument.createElement(`dl`);
      svgContent.setAttribute('style', 'outline: dotted 1px; width: 8em; height: 8em; padding: .5em;');
      svgContent.appendChild(iconSvgPath);

      htmlBody.appendChild(svgContent);

    } else { // Font svg
      for (let i = 0; fontNodes && i < fontNodes.length; i++) {
        let fontNode = fontNodes[i];
        let ascent = fontNode.getAttribute('ascent');
        let descent = fontNode.getAttribute('descent');
        let fontFamily = fontNode.getAttribute('font-family');
        let unitsPerEm = fontNode.getAttribute('units-per-em');

        let fontDescriptionElement = parser.parseFromString(`<p><b>Font Name = ${fontFamily}</b> 1em = ${unitsPerEm} ascent = ${ascent} descent = ${descent}</p>`);

        htmlBody.appendChild(fontDescriptionElement);

        let glyphList = xmlFontContent.getElementsByTagName('glyph');
        for (let index = 0; index < glyphList.length; index++) {
          let glyphIcon = glyphList[index];
          if (glyphIcon) {
            let svgPathData = glyphIcon.getAttribute('d');
            let unicodeChar = glyphIcon.getAttribute('unicode');
            let iconName = glyphIcon.getAttribute('glyph-name');
            let horizontalUnits = glyphIcon.getAttribute('horiz-adv-x') || unitsPerEm;
            let hexChar = unicodeChar ? (unicodeChar.charCodeAt(0).toString(16)) : null;

            if (svgPathData) {
              let pathElement = htmlDocument.createElement(`path`);
              pathElement.setAttribute('transform', `translate(0,${unitsPerEm}) scale(1, -1)`);
              pathElement.setAttribute('style', 'fill:currentcolor');
              pathElement.setAttribute('d', svgPathData);

              let svgElement = htmlDocument.createElement(`svg`);
              svgElement.setAttribute('viewBox', `0 0 ${horizontalUnits * 1} ${unitsPerEm * 1}`);
              svgElement.setAttribute('style', 'height:2em');
              svgElement.appendChild(pathElement);

              let iconContainer = htmlDocument.createElement('a');
              iconContainer.setAttribute('style', `text-decoration:none; color:inherit; display:block; margin-bottom:90px;margin: auto; width:4em; height:4em; padding:.5em;`);
              iconContainer.setAttribute('href', '#');
              iconContainer.appendChild(svgElement);

              let iconSvgPath = htmlDocument.createElement('dt');
              iconSvgPath.setAttribute('style', 'margin:0');
              iconSvgPath.setAttribute('class', 'glyph');
              iconSvgPath.appendChild(iconContainer);

              let iconSvgName = htmlDocument.createElement(`span`);
              iconSvgName.setAttribute('id', `icon-name`);
              iconSvgName.setAttribute('style', `margin: 0; bottom: 0; font-size:15px; overflow:hidden; width:100%;`);
              iconSvgName.appendChild(htmlDocument.createTextNode(iconName));

              let iconSvgChar = htmlDocument.createElement(`p`);
              iconSvgChar.setAttribute('id', `icon-char`);
              iconSvgChar.setAttribute('style', `font-size:10px; overflow:hidden; width:100%;`);
              iconSvgChar.appendChild(htmlDocument.createTextNode(hexChar));

              let svgContent = htmlDocument.createElement(`dl`);
              svgContent.setAttribute('style', 'margin: 0 0 .5em .5em; float: left; outline: currentcolor dotted 1px; width: 10em; min-height: 10em; padding: .5em;');
              svgContent.appendChild(iconSvgChar);
              svgContent.appendChild(iconSvgPath);
              svgContent.appendChild(iconSvgName);

              htmlBody.appendChild(svgContent);
            }
          }
        }
      }
    }

    let htmlContent = htmlDocument.createElement(`html`);
    htmlContent.appendChild(parser.parseFromString('<head><meta charset="utf-8"><title>SVG font preview</title></head>'));
    htmlContent.appendChild(htmlBody);

    htmlDocument.appendChild(htmlContent);

    return new xml.XMLSerializer().serializeToString(htmlDocument);
  }
}
