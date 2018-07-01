'use strict';
import * as vscode from 'vscode';
import * as xml from 'xmldom';

const webviewPanels = new Map<string, vscode.WebviewPanel>();

export function activate(context: vscode.ExtensionContext) {
    const openPreviewCommand = vscode.commands.registerTextEditorCommand(
        'extension.svgFontPreview',
        () => {
            const editorView = vscode.window.activeTextEditor;

            if (editorView) {
                const htmlContentString = getPreviewContent(editorView);
                const fileName = getFileName(editorView);
                if (htmlContentString) {
                    const panel = getWebViewPanel(fileName, htmlContentString);
                    if (panel) {
                        panel.onDidDispose(() => webviewPanels.delete(fileName), null, context.subscriptions);
                        panel.reveal(panel.viewColumn);
                    }
                }
                else {
                    vscode.window.showInformationMessage(`'${fileName}' is not the SVG file`);
                }
            } else {
                vscode.window.showInformationMessage(`There's no open document`);
            }
        }
    );


    // context.subscriptions.push(
    //     vscode.window.onDidChangeActiveTextEditor((textEditor) => {
    //         const { isSvgFile, document } = svgFileMeta(textEditor);
    // refresh the view.
    //     }),
    // );

    /*
      context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((textDocument)=> {
          // console.log('onDidOpenTextDocument', textDocument.uri)
      }))
      */

    context.subscriptions.push(openPreviewCommand);
}

// this method is called when your extension is deactivated
export function deactivate() {
    console.log('----------------------------');
}

// // on save call this and tell the webview to reload.
// function updatePreviewContent(fileName: string, panelOptions: object, htmlContentString: string): void {
//     const panel = getWebViewPanel(fileName, panelOptions, htmlContentString, false);
//     if (panel) {
//         panel.webview.html = htmlContentString;
//         // reload the panel
//     }
// }

function getWebViewPanel(fileName: string, htmlContentString: string, makeNewPanel: boolean = true, panelOptions: object = {}): vscode.WebviewPanel | undefined {
    const maybeExistingPanel = webviewPanels.get(fileName);

    if (maybeExistingPanel) {
        return maybeExistingPanel;
    }

    if (makeNewPanel) {
        const editorView = vscode.window.activeTextEditor;
        const toggleViewColumn = editorView && editorView.viewColumn ? editorView.viewColumn % 3 + 1 : vscode.ViewColumn.Two;
        const newPanel = vscode.window.createWebviewPanel('svgFontPreview', fileName, toggleViewColumn, panelOptions);

        newPanel.webview.html = htmlContentString;
        webviewPanels.set(fileName, newPanel);

        return newPanel;
    }
}

function getFileName(editor: vscode.TextEditor): string {
    if (editor) {
        return editor.document.fileName.split('/').pop() || 'svgFontPreview';
    }
    return 'SVG Font Preview';
}

function getPreviewContent(editor: vscode.TextEditor): string | undefined {
    return previewSvg(editor.document);
}

function previewSvg(document: vscode.TextDocument): string | undefined {
    const editorSvgContent = document.getText();

    const parser = new xml.DOMParser();
    const xmlFontContent = parser.parseFromString(editorSvgContent, `text/xml`);
    const htmlDocument = parser.parseFromString('<!doctype html>', `text/html`);

    const fontNodes = xmlFontContent.getElementsByTagName('font-face') || xmlFontContent.getElementsByTagName('font').getAttribute('id');

    const htmlBody = htmlDocument.createElement(`body`);

    let renderContent = false;

    if ((!fontNodes || fontNodes.length <= 0) && document.languageId.toLowerCase() === 'xml' && document.fileName.toLowerCase().endsWith('.svg')) { // Normal svg image
        const iconContainer = htmlDocument.createElement('a');
        iconContainer.setAttribute('style', 'text-decoration:none; color:inherit; display:block; margin: 0 auto; min-width:6em; min-height:6em; padding:.5em;');
        iconContainer.setAttribute('href', '#');
        iconContainer.appendChild(xmlFontContent);

        const iconSvgPath = htmlDocument.createElement('dt');
        iconSvgPath.setAttribute('style', 'margin:0');
        iconSvgPath.setAttribute('class', 'glyph');
        iconSvgPath.appendChild(iconContainer);

        const svgContent = htmlDocument.createElement(`dl`);
        svgContent.setAttribute('style', 'outline: dotted 1px; min-width: 8em; min-height: 8em; padding: .5em;');
        svgContent.appendChild(iconSvgPath);

        htmlBody.appendChild(svgContent);

        renderContent = true;
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
            const fontIcons = [];

            for (let fontIconIndex = 0; fontIconIndex < glyphList.length; fontIconIndex++) {
                renderContent = true;

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
                        svgContent.setAttribute('id', iconName);
                        svgContent.appendChild(iconSvgChar);
                        svgContent.appendChild(iconSvgPath);
                        svgContent.appendChild(iconSvgName);

                        fontIcons.push(svgContent);
                    }
                }
            }

            // make sort decision configurable.
            fontIcons.sort((a, b) => a.getAttribute('id') < b.getAttribute('id') ? -1 : 1).forEach(node => htmlBody.appendChild(node));
        }
    }

    let htmlContentString = undefined;
    if (renderContent) {
        const htmlContent = htmlDocument.createElement(`html`);
        htmlContent.appendChild(parser.parseFromString(`<head><meta charset="UTF-8"><title>SVG font preview</title></head>`));
        htmlContent.setAttribute('lang', 'en');
        htmlContent.appendChild(htmlBody);
        htmlDocument.appendChild(htmlContent);

        htmlContentString = new xml.XMLSerializer().serializeToString(htmlDocument);
    }

    return htmlContentString;
}
