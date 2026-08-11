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
let gutterPreviewEnabled: boolean = true;

const webviewPanels = new Map<string, vscode.WebviewPanel>();
const panelDocuments = new Map<string, vscode.Uri>();
const panelGlyphLines = new Map<string, number[]>();
const gutterDecorations = new Map<string, vscode.TextEditorDecorationType[]>();

export function deactivate() {
    webviewPanels.forEach(panel => panel.dispose());
    gutterDecorations.forEach(decorations => decorations.forEach(decoration => decoration.dispose()));
    gutterDecorations.clear();
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
                vscode.window.visibleTextEditors.forEach(editor => updateGutterGlyphs(editor.document));
            }
        }
    );

    vscode.workspace.onDidOpenTextDocument(
        (document: vscode.TextDocument) => {
            if (autoOpenPreview) {
                activatePreviewPanel(context, document, true, true);
            }
            updateGutterGlyphs(document);
        }
    );

    // Glyphs rendered inline on the editor gutter
    // (https://github.com/nkokhelox/vscode-svg-font-previewer/issues/26)
    vscode.window.onDidChangeVisibleTextEditors(
        (editors: readonly vscode.TextEditor[]) => editors.forEach(editor => updateGutterGlyphs(editor.document))
    );

    vscode.workspace.onDidSaveTextDocument(
        (document: vscode.TextDocument) => updateGutterGlyphs(document)
    );

    vscode.workspace.onDidCloseTextDocument(
        (document: vscode.TextDocument) => disposeGutterDecorations(document.uri.toString())
    );

    vscode.window.visibleTextEditors.forEach(editor => updateGutterGlyphs(editor.document));

    // Editor -> preview: highlight the glyph whose definition the cursor is on
    // (https://github.com/nkokhelox/vscode-svg-font-previewer/issues/27)
    vscode.window.onDidChangeTextEditorSelection(
        (event: vscode.TextEditorSelectionChangeEvent) => {
            const fileName = getFileName(event.textEditor.document);
            const panel = webviewPanels.get(fileName);
            const glyphLines = panelGlyphLines.get(fileName);
            if (panel && glyphLines && glyphLines.length > 0) {
                const cursorLine = event.selections[0].active.line + 1; // editor lines are 0-based, xmldom's are 1-based
                let glyphLine = 0;
                for (const line of glyphLines) {
                    if (line > cursorLine) {
                        break;
                    }
                    glyphLine = line;
                }
                if (glyphLine > 0) {
                    panel.webview.postMessage({ command: 'highlightGlyph', line: glyphLine });
                }
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
                panelDocuments.set(fileName, document.uri);
                if (refreshContent || panel.webview.html === undefined || panel.webview.html === null) {
                    const preview = previewSvgFont(parser, xmlFontContent)
                    if (preview) {
                        panel.webview.html = preview.html;
                        panelGlyphLines.set(fileName, preview.glyphLines);
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
    panelOptions: object = { preserveFocus: true, enableScripts: true }
): vscode.WebviewPanel | undefined {
    const maybeExistingPanel = webviewPanels.get(fileName);

    if (maybeExistingPanel) {
        return maybeExistingPanel;
    }

    if (makeNewPanel) {
        const editorView = vscode.window.activeTextEditor;
        const toggleViewColumn = editorView && editorView.viewColumn ? editorView.viewColumn % 3 + 1 : vscode.ViewColumn.Two;
        const newPanel = vscode.window.createWebviewPanel('svgFontPreview', fileName, toggleViewColumn, panelOptions);

        // Preview -> editor: clicking a glyph reveals its definition line
        // (https://github.com/nkokhelox/vscode-svg-font-previewer/issues/27)
        newPanel.webview.onDidReceiveMessage(
            (message: any) => {
                if (message && message.command === 'revealGlyph' && typeof message.line === 'number') {
                    revealDocumentLine(fileName, message.line);
                }
            },
            null,
            context.subscriptions
        );

        newPanel.onDidDispose(
            () => {
                webviewPanels.delete(fileName);
                panelDocuments.delete(fileName);
                panelGlyphLines.delete(fileName);
            },
            null,
            context.subscriptions
        );
        webviewPanels.set(fileName, newPanel);

        return newPanel;
    }
}

function disposeGutterDecorations(documentKey: string) {
    const decorations = gutterDecorations.get(documentKey);
    if (decorations) {
        decorations.forEach(decoration => decoration.dispose());
        gutterDecorations.delete(documentKey);
    }
}

function updateGutterGlyphs(document: vscode.TextDocument) {
    const documentKey = document.uri.toString();
    disposeGutterDecorations(documentKey);

    if (!gutterPreviewEnabled || !isSvg(document)) {
        return;
    }

    const editors = vscode.window.visibleTextEditors.filter(editor => editor.document.uri.toString() === documentKey);
    if (editors.length === 0) {
        return;
    }

    const xmlFontContent = new DOMParser().parseFromString(document.getText(), `text/xml`);
    const fontNodes = xmlFontContent.getElementsByTagName('font');
    if (!fontNodes || fontNodes.length <= 0) {
        return;
    }

    const decorations: vscode.TextEditorDecorationType[] = [];
    for (let fontIndex = 0; fontIndex < fontNodes.length; fontIndex++) {
        const fontNode = fontNodes[fontIndex];
        const fontFace = fontNode.getElementsByTagName('font-face')[0];
        const unitsPerEm = (fontFace && fontFace.getAttribute('units-per-em')) || "1";

        const glyphList = fontNode.getElementsByTagName('glyph');
        for (let glyphIndex = 0; glyphIndex < glyphList.length; glyphIndex++) {
            const glyphIcon = glyphList[glyphIndex];
            const svgPathData = glyphIcon && glyphIcon.getAttribute('d');
            const glyphLine = (glyphIcon && glyphIcon.lineNumber) || 0;
            if (!svgPathData || glyphLine <= 0 || glyphLine > document.lineCount) {
                continue;
            }

            const horizontalUnits = glyphIcon.getAttribute('horiz-adv-x') || unitsPerEm;
            const glyphFill = glyphIcon.getAttribute('fill');
            // Rendered as a `before` attachment (between the line number and the text)
            // at half a line's height, honouring iconRenderMode and the glyph's own fill.
            const iconSize = '0.75em';
            const decoration = vscode.window.createTextEditorDecorationType({
                light: { before: { contentIconPath: gutterIconUri(svgPathData, glyphFill, horizontalUnits, unitsPerEm, '#424242'), width: iconSize, height: iconSize, margin: '0 0.4em 0 0' } },
                dark: { before: { contentIconPath: gutterIconUri(svgPathData, glyphFill, horizontalUnits, unitsPerEm, '#C5C5C5'), width: iconSize, height: iconSize, margin: '0 0.4em 0 0' } },
            });

            const lineRange = document.lineAt(glyphLine - 1).range;
            editors.forEach(editor => editor.setDecorations(decoration, [lineRange]));
            decorations.push(decoration);
        }
    }

    if (decorations.length > 0) {
        gutterDecorations.set(documentKey, decorations);
    }
}

function gutterIconUri(svgPathData: string, glyphFill: string | null, horizontalUnits: string, unitsPerEm: string, themeColor: string): vscode.Uri {
    // Same renderMode semantics as the preview pane, with the theme color standing
    // in for currentColor; a glyph's own paintable fill wins where fill applies.
    let paintAttributes: string;
    switch (renderMode) {
        case Render.STROKE:
            paintAttributes = `stroke="${themeColor}" stroke-width="${strokeWidth}" fill="none"`;
            break;
        case Render.FILL:
            paintAttributes = `fill="${glyphFill && glyphFill !== 'none' ? glyphFill : themeColor}"`;
            break;
        case Render.MIXED:
            if (glyphFill === 'none') {
                paintAttributes = `stroke="${themeColor}" stroke-width="${strokeWidth}" fill="none"`;
            } else {
                paintAttributes = `fill="${glyphFill || themeColor}"`;
            }
            break;
        default: // Render.BOTH
            paintAttributes = `fill="#fc8d8d" stroke="black" stroke-width="${strokeWidth}"`;
            break;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-${strokeWidth} -${strokeWidth} ${strokeWidth + (+horizontalUnits) * 1.2} ${strokeWidth + (+unitsPerEm) * 1.2}">` +
        `<path transform="translate(0,${unitsPerEm}) scale(1, -1)" ${paintAttributes} d="${svgPathData.replace(/"/g, '&quot;')}"/>` +
        `</svg>`;
    return vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function revealDocumentLine(fileName: string, line: number) {
    const documentUri = panelDocuments.get(fileName);
    if (!documentUri) {
        return;
    }
    const existingEditor = vscode.window.visibleTextEditors.find(editor => editor.document.uri.toString() === documentUri.toString());
    const viewColumn = existingEditor ? existingEditor.viewColumn : vscode.ViewColumn.One;
    vscode.window.showTextDocument(documentUri, { viewColumn: viewColumn, preserveFocus: true }).then(editor => {
        const lineRange = editor.document.lineAt(Math.min(line, editor.document.lineCount) - 1).range;
        editor.selection = new vscode.Selection(lineRange.start, lineRange.end);
        editor.revealRange(lineRange, vscode.TextEditorRevealType.InCenter);
    });
}

function previewSvgFont(parser: typeof DOMParser, xmlFontContent: any): { html: string, glyphLines: number[] } | undefined {
    // Setup the html to show in the preview
    const htmlDocument = parser.parseFromString('<!doctype html>', `text/html`);
    const htmlBody = htmlDocument.createElement(`body`);
    const glyphLines: number[] = [];

    // Search/filter bar (https://github.com/nkokhelox/vscode-svg-font-previewer/issues/28)
    const searchInput = htmlDocument.createElement(`input`);
    searchInput.setAttribute('id', 'glyph-search');
    searchInput.setAttribute('type', 'search');
    searchInput.setAttribute('list', 'glyph-search-suggestions');
    searchInput.setAttribute('placeholder', 'Search glyphs by name or unicode');
    searchInput.setAttribute('oninput', 'filterGlyphs()');
    searchInput.setAttribute('style', 'width:100%; box-sizing:border-box; padding:.4em .6em; font-size:15px; color:var(--vscode-input-foreground, inherit); background:var(--vscode-input-background, inherit); border:1px solid var(--vscode-input-border, currentColor);');

    const searchSuggestions = htmlDocument.createElement(`datalist`);
    searchSuggestions.setAttribute('id', 'glyph-search-suggestions');

    const searchMessage = htmlDocument.createElement(`p`);
    searchMessage.setAttribute('id', 'glyph-search-message');
    searchMessage.setAttribute('style', 'display:none; font-style:italic;');

    const searchBar = htmlDocument.createElement(`div`);
    searchBar.setAttribute('id', 'glyph-search-bar');
    searchBar.setAttribute('style', 'position:sticky; top:0; z-index:1; padding:.5em 0; background:var(--vscode-editor-background, inherit);');
    searchBar.appendChild(searchInput);
    searchBar.appendChild(searchSuggestions);
    searchBar.appendChild(searchMessage);
    htmlBody.appendChild(searchBar);

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
                    <ul>
                        <li><i><b>RenderMode:</b> ${renderMode}</i></li>
                        <li><i><b>StrokeWidth:</b> ${strokeWidth}</i></li>
                    </ul>
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
                    svgElement.setAttribute('viewBox', `-${strokeWidth} -${strokeWidth} ${strokeWidth + ((+horizontalUnits) * 1) * 1.2} ${strokeWidth + ((+unitsPerEm) * 1) * 1.2}`);
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
                    svgContent.setAttribute('class', 'glyph-item');
                    svgContent.setAttribute('data-name', iconName.toLowerCase());
                    svgContent.setAttribute('data-unicode', hexChar.toLowerCase());

                    const glyphLine = glyphIcon.lineNumber || 0; // 1-based source line, provided by xmldom's locator
                    if (glyphLine > 0) {
                        svgContent.setAttribute('data-line', `${glyphLine}`);
                        glyphLines.push(glyphLine);
                    }
                    svgContent.appendChild(glyphUnicode);
                    svgContent.appendChild(glyphDiv);
                    svgContent.appendChild(glyphName);

                    const nameSuggestion = htmlDocument.createElement(`option`);
                    nameSuggestion.setAttribute('value', iconName);
                    searchSuggestions.appendChild(nameSuggestion);

                    fontIcons.push(new SortableTag(iconName, hexChar, svgContent));
                }
            }
        }

        const sortOrderFactor = sortByOrder === TagSortOrder.DESC ? -1 : 1;
        fontIcons = sortByField === TagSortBy.NONE ? fontIcons : fontIcons.sort((a, b) => a.get(sortByField) < b.get(sortByField) ? -1 * sortOrderFactor : 1 * sortOrderFactor);
        fontIcons.forEach(x => htmlBody.appendChild(x.element));
    }

    // NOTE: keep this script free of '<', '>' and '&' characters - the XMLSerializer
    // escapes them in text nodes, which would corrupt the script in the webview.
    const filterScript = htmlDocument.createElement(`script`);
    filterScript.appendChild(htmlDocument.createTextNode(`
        function filterGlyphs() {
            var query = document.getElementById('glyph-search').value.trim().toLowerCase();
            var message = document.getElementById('glyph-search-message');
            var glyphs = document.getElementsByClassName('glyph-item');
            var visibleCount = 0;
            Array.prototype.forEach.call(glyphs, function (glyph) {
                var name = glyph.getAttribute('data-name') || '';
                var unicode = glyph.getAttribute('data-unicode') || '';
                var isMatch = query === '' || name.indexOf(query) === 0 || unicode.indexOf(query) === 0;
                glyph.style.display = isMatch ? '' : 'none';
                if (isMatch) { visibleCount += 1; }
            });
            if (visibleCount === 0) {
                message.textContent = 'No glyph with "' + query + '" found.';
                message.style.display = 'block';
            } else {
                message.style.display = 'none';
            }
        }

        var vscodeApi = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

        function highlightGlyph(glyph, scrollToGlyph) {
            Array.prototype.forEach.call(document.querySelectorAll('.glyph-highlight'), function (highlighted) {
                highlighted.classList.remove('glyph-highlight');
            });
            if (glyph) {
                glyph.classList.add('glyph-highlight');
                if (scrollToGlyph) {
                    glyph.scrollIntoView({ block: 'center' });
                }
            }
        }

        Array.prototype.forEach.call(document.getElementsByClassName('glyph-item'), function (glyph) {
            glyph.addEventListener('click', function () {
                highlightGlyph(glyph, false);
                var line = Number(glyph.getAttribute('data-line'));
                if (vscodeApi) {
                    if (line) {
                        vscodeApi.postMessage({ command: 'revealGlyph', line: line });
                    }
                }
            });
        });

        window.addEventListener('message', function (event) {
            var message = event.data || {};
            if (message.command === 'highlightGlyph') {
                highlightGlyph(document.querySelector('.glyph-item[data-line="' + message.line + '"]'), true);
            }
        });
    `));
    htmlBody.appendChild(filterScript);

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
                    cursor: pointer;
                }
                dl.glyph-highlight {
                    outline: var(--vscode-focusBorder, currentcolor) solid 2px;
                    filter: invert(0);
                }
            </style>
        </head>`
    ));
    htmlContent.setAttribute('lang', 'en');
    htmlContent.appendChild(htmlBody);
    htmlDocument.appendChild(htmlContent);

    const html = new XMLSerializer().serializeToString(htmlDocument);

    return { html: html, glyphLines: glyphLines.sort((a, b) => a - b) };
}

function loadConfig() {
    let config = vscode.workspace.getConfiguration('svg-font-previewer');

    autoOpenPreview = config.get<boolean>("autoOpenPreview", false);
    gutterPreviewEnabled = config.get<boolean>("gutterGlyphPreview", true);
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
