'use strict';
import * as vscode from 'vscode';
import * as xml from 'xmldom';

const TagSortBy = {
    UNICODE: 'unicode',
    NAME: 'name',
    NONE: 'none',
    map: new Map([
        ['none', 'none'],
        ['name', 'name'],
        ['unicode', 'unicode']
    ])
};

const TagSortOrder = {
    ASC: 'asc',
    DESC: 'desc',
    map: new Map([
        ['asc', 'asc'],
        ['desc', 'desc']
    ])
};

class SortableTag {
    private fields = new Map<string, string>();
    readonly element: any;

    constructor(name: string, unicode: string, element: any) {
        this.fields.set(TagSortBy.UNICODE, unicode);
        this.fields.set(TagSortBy.NAME, name);
        this.element = element;
    }

    get(key: string | undefined): string {
        return (key ?
            this.fields.get(key) || this.fields.get(TagSortBy.NAME) :
            this.fields.get(TagSortBy.NAME)) || '';
    }
}

let sortByField: string = TagSortBy.NONE;
let sortByOrder: string = TagSortOrder.ASC;
let autoOpenPreview: boolean = true;

const webviewPanels = new Map<string, vscode.WebviewPanel>();

loadConfig();

export function deactivate() {
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand(
            'extension.svgFontPreview',
            () => {
                const editorView = vscode.window.activeTextEditor;
                if (editorView) {
                    activatePreviewPanel(context, editorView.document, true);
                }
            }
        )
    );

    vscode.workspace.onDidChangeConfiguration(
        (event: vscode.ConfigurationChangeEvent) => {
            if (event.affectsConfiguration('svg-font-previewer') && webviewPanels.size > 0) {
                loadConfig();
                vscode.window.showInformationMessage(`Configuration updated, reopen your font ${webviewPanels.size === 1 ? 'preview' : 'previews'}`);
            }
        }
    );

    vscode.workspace.onDidSaveTextDocument(
        (document: vscode.TextDocument) => {
            if (webviewPanels.has(getFileName(document))) {
                vscode.window.showInformationMessage(`${getFileName(document)} document saved, reopen the preview`);
            }
        }
    );

    vscode.workspace.onDidOpenTextDocument(
        (document: vscode.TextDocument) => {
            if (autoOpenPreview && getFileName(document).trim().toLowerCase().endsWith('.svg')) {
                activatePreviewPanel(context, document);
            }
        }
    );
}

function activatePreviewPanel(context: vscode.ExtensionContext, document: vscode.TextDocument, refreshContent: boolean = false) {
    const fileName = getFileName(document);
    const panel = getWebViewPanel(fileName, context);
    if (panel) {
        if (refreshContent || panel.webview.html === undefined || panel.webview.html === null) {
            const htmlContentString = previewSvg(document);
            if (htmlContentString) {
                panel.webview.html = htmlContentString;
            } else {
                vscode.window.showInformationMessage(`'${fileName}' is not the SVG file`);
            }
        }

        panel.reveal(panel.viewColumn, true);
    }
}

function getWebViewPanel(
    fileName: string,
    context: vscode.ExtensionContext,
    makeNewPanel: boolean = true,
    panelOptions: object = {}
): vscode.WebviewPanel | undefined {
    const maybeExistingPanel = webviewPanels.get(fileName);

    if (maybeExistingPanel) {
        return maybeExistingPanel;
    }

    if (makeNewPanel) {
        const editorView = vscode.window.activeTextEditor;
        const toggleViewColumn = editorView && editorView.viewColumn ? editorView.viewColumn % 3 + 1 : vscode.ViewColumn.Two;
        const newPanel = vscode.window.createWebviewPanel('svgFontPreview', fileName, { preserveFocus: true, viewColumn: toggleViewColumn }, panelOptions);

        newPanel.onDidDispose(() => webviewPanels.delete(fileName), null, context.subscriptions);
        webviewPanels.set(fileName, newPanel);

        return newPanel;
    }
}

function getFileName(document: vscode.TextDocument): string {
    return document.fileName.split('/').pop() || 'SVG Font Preview';
}

function previewSvg(document: vscode.TextDocument): string | undefined {
    const editorSvgContent = document.getText();

    const parser = new xml.DOMParser();
    const xmlFontContent = parser.parseFromString(editorSvgContent, `text/xml`);
    const htmlDocument = parser.parseFromString('<!doctype html>', `text/html`);

    const fontNodes = xmlFontContent.getElementsByTagName('font-face') || xmlFontContent.getElementsByTagName('font').getAttribute('id');

    const htmlBody = htmlDocument.createElement(`body`);

    let renderContent = false;

    if ((!fontNodes || fontNodes.length <= 0) && document.languageId.toLowerCase() === 'svg') { // Normal svg image
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
            let fontIcons = [];

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
                        svgElement.setAttribute('viewBox', `0 0 ${(horizontalUnits * 1) * 1.2} ${(unitsPerEm * 1) * 1.2}`);
                        svgElement.setAttribute('style', 'height:4em');
                        svgElement.appendChild(pathElement);

                        const iconContainer = htmlDocument.createElement('a');
                        iconContainer.setAttribute('style', `text-decoration:none; color:inherit; display:block; margin: auto auto 30px auto; width:3em; height:4em; padding:.5em;`);
                        iconContainer.setAttribute('href', '#${iconName}');
                        iconContainer.setAttribute('name', iconName);
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

                        fontIcons.push(new SortableTag(iconName, hexChar, svgContent));
                    }
                }
            }

            const sortOrderFactor = sortByOrder === TagSortOrder.DESC ? -1 : 1;
            fontIcons = sortByField === TagSortBy.NONE ? fontIcons : fontIcons.sort((a, b) => a.get(sortByField) < b.get(sortByField) ? -1 * sortOrderFactor : 1 * sortOrderFactor)
            fontIcons.forEach(x => htmlBody.appendChild(x.element));
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

function loadConfig() {
    let config = vscode.workspace.getConfiguration('svg-font-previewer');

    autoOpenPreview = config.get<boolean>("autoOpenPreview", false);
    sortByField = TagSortBy.map.get(config.get<string>("iconSortBy", TagSortBy.NONE)) || TagSortBy.NONE;
    sortByOrder = TagSortOrder.map.get(config.get<string>("iconSortOrder", TagSortOrder.ASC)) || TagSortOrder.ASC;
}
