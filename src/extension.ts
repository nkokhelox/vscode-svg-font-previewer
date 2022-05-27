'use strict';
import * as vscode from 'vscode';
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom')

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
    ASC: 'ascending',
    DESC: 'descending',
    map: new Map([
        ['ascending', 'ascending'],
        ['descending', 'descending']
    ])
};

const Render = {
    MIXED: 'mixed',
    STROKE: 'stroke',
    FILL: 'fill',
    BOTH: 'both',
    map: new Map([
        ['mixed', 'mixed'],
        ['fill', 'fill'],
        ['stroke', 'stroke'],
        ['both', 'both'],
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

let strokeWidth: number = 1;
let renderMode: string = Render.MIXED;
let sortByField: string = TagSortBy.NONE;
let sortByOrder: string = TagSortOrder.ASC;
let autoOpenPreview: boolean = true;

const webviewPanels = new Map<string, vscode.WebviewPanel>();

export function deactivate() {
    webviewPanels.forEach(panel => panel.dispose());
}

export function activate(context: vscode.ExtensionContext) {
    loadConfig();

    context.subscriptions.push(
        vscode.commands.registerTextEditorCommand(
            'extension.svgFontPreview',
            () => {
                const editorView = vscode.window.activeTextEditor;
                if (editorView) {
                    activatePreviewPanel(context, editorView.document, false, true);
                }
            }
        )
    );

    vscode.workspace.onDidChangeConfiguration(
        (event: vscode.ConfigurationChangeEvent) => {
            if (event.affectsConfiguration('svg-font-previewer')) {
                loadConfig();
                if (webviewPanels.size > 0) {
                    vscode.window.showInformationMessage(`Configuration updated, reopen your font ${webviewPanels.size === 1 ? 'preview' : 'previews'}`);
                }
            }
        }
    );

    vscode.workspace.onDidOpenTextDocument(
        (document: vscode.TextDocument) => {
            if (autoOpenPreview) {
                activatePreviewPanel(context, document, true, true);
            }
        }
    );
}

function activatePreviewPanel(context: vscode.ExtensionContext, document: vscode.TextDocument, isAutoActivation: boolean, refreshContent: boolean = false) {
    if (isSvg(document)) {
        const fileName = getFileName(document);
        const editorSvgContent = document.getText();

        const parser = new DOMParser();
        const xmlFontContent = parser.parseFromString(editorSvgContent, `text/xml`);
        const fontNodes = xmlFontContent.getElementsByTagName('font');

        if (!fontNodes || fontNodes.length <= 0) { // Normal svg image
            !isAutoActivation && showInvalidFontFile(getFileName(document));
        } else { // Font svg
            const panel = getWebViewPanel(fileName, context);
            if (panel) {
                if (refreshContent || panel.webview.html === undefined || panel.webview.html === null) {
                    const htmlContentString = previewSvgFont(parser, xmlFontContent)
                    if (htmlContentString) {
                        panel.webview.html = htmlContentString;
                    } else {
                        vscode.window.showInformationMessage(`'${fileName}' is not the SVG file`);
                    }
                }

                panel.reveal(panel.viewColumn);
            }
        }
    } else {
        !isAutoActivation && showInvalidFontFile(getFileName(document));
    }
}

function getWebViewPanel(
    fileName: string,
    context: vscode.ExtensionContext,
    makeNewPanel: boolean = true,
    panelOptions: object = { preserveFocus: true }
): vscode.WebviewPanel | undefined {
    const maybeExistingPanel = webviewPanels.get(fileName);

    if (maybeExistingPanel) {
        return maybeExistingPanel;
    }

    if (makeNewPanel) {
        const editorView = vscode.window.activeTextEditor;
        const toggleViewColumn = editorView && editorView.viewColumn ? editorView.viewColumn % 3 + 1 : vscode.ViewColumn.Two;
        const newPanel = vscode.window.createWebviewPanel('svgFontPreview', fileName, toggleViewColumn, panelOptions);

        newPanel.onDidDispose(() => webviewPanels.delete(fileName), null, context.subscriptions);
        webviewPanels.set(fileName, newPanel);

        return newPanel;
    }
}

function previewSvgFont(parser: typeof DOMParser, xmlFontContent: any): string | undefined {
    // Setup the html to show in the preview
    const htmlDocument = parser.parseFromString('<!doctype html>', `text/html`);
    const htmlBody = htmlDocument.createElement(`body`);

    // Parsing the font icons and building the preview html
    const fontNodes = xmlFontContent.getElementsByTagName('font');
    for (let fontIndex = 0; fontNodes && fontIndex < fontNodes.length; fontIndex++) {
        const fontNode = fontNodes[fontIndex];
        const fontFamily = fontNode.getAttribute('id');
        const fontHorizAdvX = fontNode.getAttribute('horiz-adv-x') || "0";
        const fontWidth = parseInt(fontHorizAdvX);

        const fontFace = fontNode.getElementsByTagName('font-face')[0];
        const unitsPerEm = fontFace.getAttribute('units-per-em') || "1";
        const descent = fontFace.getAttribute('descent');
        const ascent = fontFace.getAttribute('ascent');

        try {
            const fontMetaData = parser.parseFromString(`<p><i>${xmlFontContent.getElementsByTagName('metadata')[0].textContent}</i></p>`);
            htmlBody.appendChild(fontMetaData);
        } catch (error) {
            console.error(error);
        }

        const fontDescriptionElement = parser.parseFromString(`
                    <ul>
                        <li><b>font name:</b> ${fontFamily}</li>
                        <li><b>horiz-adv-x:</b> ${fontHorizAdvX}</li>
                        <li><b>1em:</b> ${unitsPerEm}</li>
                        <li><b>ascent:</b> ${ascent}</li>
                        <li><b>descent:</b> ${descent}</li>
                    </ul>
                `);
        htmlBody.appendChild(fontDescriptionElement);

        const glyphList = fontNode.getElementsByTagName('glyph');
        let fontIcons = [];

        for (let fontIconIndex = 0; fontIconIndex < glyphList.length; fontIconIndex++) {

            const glyphIcon = glyphList[fontIconIndex];
            if (glyphIcon) {
                const svgPathData = glyphIcon.getAttribute('d');
                const unicodeChar = glyphIcon.getAttribute('unicode');
                const iconName = glyphIcon.getAttribute('glyph-name') || '????';
                const horizontalUnits = glyphIcon.getAttribute('horiz-adv-x') || unitsPerEm;
                const hexChar = unicodeChar ? (unicodeChar.charCodeAt(0).toString(16)) : "";
                const iconWidth = parseInt(horizontalUnits);
                const emWidth = 4 + Math.round(iconWidth / fontWidth);

                if (svgPathData) {
                    const pathElement = htmlDocument.createElement(`path`);
                    pathElement.setAttribute('transform', `translate(0,${unitsPerEm}) scale(1, -1)`);
                    pathElement.setAttribute('d', svgPathData);
                    switch (renderMode) {
                        case Render.STROKE:
                            pathElement.setAttribute('stroke', 'currentColor');
                            pathElement.setAttribute('stroke-width', `${strokeWidth}`);
                            pathElement.setAttribute('fill', 'none');
                            break;
                        case Render.FILL:
                            pathElement.setAttribute('fill', 'currentColor');
                            break;
                        case Render.MIXED:
                            const fill = glyphIcon.getAttribute('fill');
                            if (fill) {
                                pathElement.setAttribute('stroke', 'currentColor');
                                pathElement.setAttribute('stroke-width', `${strokeWidth}`);
                                pathElement.setAttribute('fill', 'none');
                            } else {
                                pathElement.setAttribute('fill', 'currentColor');
                            }
                            break;
                        default:
                            pathElement.setAttribute('fill', '#fc8d8d');
                            pathElement.setAttribute('stroke', 'black');
                            pathElement.setAttribute('stroke-width', `${strokeWidth}`);
                            break;
                    }

                    const svgElement = htmlDocument.createElement(`svg`);
                    svgElement.setAttribute('viewBox', `0 0 ${((+horizontalUnits) * 1) * 1.2} ${((+unitsPerEm) * 1) * 1.2}`);
                    svgElement.setAttribute('style', 'height:4em;');
                    svgElement.appendChild(pathElement);

                    const iconContainer = htmlDocument.createElement('a');
                    iconContainer.setAttribute('style', `text-decoration:none; color:inherit; display:block; margin: auto auto 30px auto; width:${emWidth}em; height:4em; padding:.5em;`);
                    iconContainer.setAttribute('title', iconName);
                    iconContainer.appendChild(svgElement);

                    const iconSvgPath = htmlDocument.createElement('dt');
                    iconSvgPath.setAttribute('style', 'margin:0');
                    iconSvgPath.setAttribute('class', 'glyph');
                    iconSvgPath.appendChild(iconContainer);

                    const glyphDiv = htmlDocument.createElement(`div`);
                    glyphDiv.appendChild(iconSvgPath);
                    glyphDiv.setAttribute('style', `text-align: center;margin-left: auto;margin-right: auto;`);

                    const glyphName = htmlDocument.createElement(`a`);
                    glyphName.setAttribute('title', "icon name");
                    glyphName.setAttribute('id', `icon-name-${iconName}`);
                    glyphName.appendChild(htmlDocument.createTextNode(iconName));
                    const glyphNameStyle = `margin: 0; bottom: 0; font-size:15px; overflow:hidden; width:100%;`;
                    if (renderMode == Render.BOTH) {
                        glyphName.setAttribute('style', `${glyphNameStyle} color:black;`);
                    } else {
                        glyphName.setAttribute('style', glyphNameStyle);
                    }

                    const glyphUnicode = htmlDocument.createElement(`a`);
                    glyphUnicode.setAttribute('title', "glyph unicode");
                    glyphUnicode.setAttribute('id', `icon-char-${hexChar}`);
                    glyphUnicode.appendChild(htmlDocument.createTextNode(hexChar));
                    const glyphUnicodeStyle = `font-size:10px; overflow:hidden; width:100%;`;
                    if (renderMode == Render.BOTH) {
                        glyphUnicode.setAttribute('style', `${glyphUnicodeStyle} color:black;`);
                    } else {
                        glyphUnicode.setAttribute('style', glyphUnicodeStyle);
                    }

                    const svgContent = htmlDocument.createElement(`dl`);
                    if (renderMode == Render.BOTH) {
                        svgContent.setAttribute('style', 'background-color:#ffffff;');
                    }
                    svgContent.setAttribute('id', iconName);
                    svgContent.appendChild(glyphUnicode);
                    svgContent.appendChild(glyphDiv);
                    svgContent.appendChild(glyphName);

                    fontIcons.push(new SortableTag(iconName, hexChar, svgContent));
                }
            }
        }

        const sortOrderFactor = sortByOrder === TagSortOrder.DESC ? -1 : 1;
        fontIcons = sortByField === TagSortBy.NONE ? fontIcons : fontIcons.sort((a, b) => a.get(sortByField) < b.get(sortByField) ? -1 * sortOrderFactor : 1 * sortOrderFactor);
        fontIcons.forEach(x => htmlBody.appendChild(x.element));
    }

    const htmlContent = htmlDocument.createElement(`html`);
    htmlContent.appendChild(parser.parseFromString(
        `<head>
            <meta charset="UTF-8">
            <title>SVG font preview</title>
            <style>
                dl { 
                    float: left; 
                    padding: .5em;
                    min-width: 10em; 
                    min-height: 10em; 
                    margin: 0 0 .5em .5em;
                    outline: currentcolor dotted 1px; 
                    filter: invert(.1);
                }
                dl:hover {
                    outline: currentcolor solid 1px;
                    filter: invert(0);
                }
            </style>
        </head>`
    ));
    htmlContent.setAttribute('lang', 'en');
    htmlContent.appendChild(htmlBody);
    htmlDocument.appendChild(htmlContent);

    const html = new XMLSerializer().serializeToString(htmlDocument);

    console.log(html);

    return html;

}

function loadConfig() {
    let config = vscode.workspace.getConfiguration('svg-font-previewer');

    autoOpenPreview = config.get<boolean>("autoOpenPreview", false);
    renderMode = Render.map.get(config.get<string>("iconRenderMode", Render.MIXED)) || Render.MIXED;
    strokeWidth = (config.get<number>("iconRenderStrokeWidth", 1));
    sortByField = TagSortBy.map.get(config.get<string>("iconSortBy", TagSortBy.NONE)) || TagSortBy.NONE;
    sortByOrder = TagSortOrder.map.get(config.get<string>("iconSortOrder", TagSortOrder.ASC)) || TagSortOrder.ASC;
}

function getFileName(document: vscode.TextDocument): string {
    return `SVG Font: ${document.fileName.split('/').pop()}`;
}

function isSvg(document: vscode.TextDocument): boolean {
    const lowerLanguageId = document.languageId.trim().toLowerCase();
    return lowerLanguageId == 'svg' || lowerLanguageId === 'xml' && getFileName(document).trim().toLowerCase().endsWith('.svg');
}

function showInvalidFontFile(documentName: string): void {
    vscode.window.showInformationMessage(`'${documentName}' is not a valid SVG Font file.`);
}
