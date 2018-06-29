'use strict';

import * as vscode from 'vscode';
import * as xml from 'xmldom';

export function activate(context: vscode.ExtensionContext) {

    class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
        public provideTextDocumentContent(uri: vscode.Uri): string {
            return this.previewSvg();
        }

        public update(uri: vscode.Uri) {
            vscode.window.showInformationMessage('The font file has changed, preview needs to be reopened');
        }

        previewSvg(): string {
            const editorSvgContent = vscode.window.activeTextEditor.document.getText();

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
                for (let i = 0; fontNodes && i < fontNodes.length; i++) {
                    const fontNode = fontNodes[i];
                    const ascent = fontNode.getAttribute('ascent');
                    const descent = fontNode.getAttribute('descent');
                    const fontFamily = fontNode.getAttribute('font-family');
                    const unitsPerEm = fontNode.getAttribute('units-per-em');

                    const fontDescriptionElement = parser.parseFromString(`<p><b>Font Name = ${fontFamily}</b> 1em = ${unitsPerEm} ascent = ${ascent} descent = ${descent}</p>`);

                    htmlBody.appendChild(fontDescriptionElement);

                    const glyphList = xmlFontContent.getElementsByTagName('glyph');
                    for (let index = 0; index < glyphList.length; index++) {
                        const glyphIcon = glyphList[index];
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
                                iconContainer.setAttribute('style', `text-decoration:none; color:inherit; display:block; margin-bottom:90px;margin: auto; width:4em; height:4em; padding:.5em;`);
                                iconContainer.setAttribute('href', '#');
                                iconContainer.appendChild(svgElement);

                                const iconSvgPath = htmlDocument.createElement('dt');
                                iconSvgPath.setAttribute('style', 'margin:0');
                                iconSvgPath.setAttribute('class', 'glyph');
                                iconSvgPath.appendChild(iconContainer);

                                const iconSvgName = htmlDocument.createElement(`span`);
                                iconSvgName.setAttribute('id', `icon-name`);
                                iconSvgName.setAttribute('style', `margin: 0; bottom: 0; font-size:15px; overflow:hidden; width:100%;`);
                                iconSvgName.appendChild(htmlDocument.createTextNode(iconName));

                                const iconSvgChar = htmlDocument.createElement(`p`);
                                iconSvgChar.setAttribute('id', `icon-char`);
                                iconSvgChar.setAttribute('style', `font-size:10px; overflow:hidden; width:100%;`);
                                iconSvgChar.appendChild(htmlDocument.createTextNode(hexChar));

                                const svgContent = htmlDocument.createElement(`dl`);
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

            const htmlContent = htmlDocument.createElement(`html`);
            htmlContent.appendChild(parser.parseFromString('<head><meta charset="utf-8"><title>SVG font preview</title></head>'));
            htmlContent.appendChild(htmlBody);

            htmlDocument.appendChild(htmlContent);

            return new xml.XMLSerializer().serializeToString(htmlDocument);
        }
    }

    let preveiwProvider = new TextDocumentContentProvider();
    let preveiwRegistration = vscode.workspace.registerTextDocumentContentProvider('pisd-previewer', preveiwProvider);

    vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
        if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
            preveiwProvider.update(e.document.uri);
        }
    });
    let previewUri = vscode.Uri.parse('pisd-previewer://authority/preview');

    let disposable = vscode.commands.registerCommand('extension.pisdPreview', () => {
        const editorView = vscode.window.activeTextEditor;
        const toggleViewColumn = editorView && editorView.viewColumn ? editorView.viewColumn % 3 + 1 : vscode.ViewColumn.Two;
        return vscode.commands.executeCommand('vscode.previewHtml', previewUri, toggleViewColumn, 'pisd-previewer');
    });

    context.subscriptions.push(disposable, preveiwRegistration);
}

// this method is called when your extension is deactivated
export function deactivate() {
}
