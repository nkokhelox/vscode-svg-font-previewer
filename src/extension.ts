'use strict';

import * as vscode from 'vscode';
import TextDocumentContentProvider from './Previewer';

export function activate(context: vscode.ExtensionContext) {

    function svgFileMeta() {
        let editor = vscode.window.activeTextEditor;
        return editor ?
            {
                isSvgFile: editor.document.languageId.toLowerCase() === "svg" || editor.document.fileName.toLowerCase().endsWith('.svg'),
                document: editor.document
            } :
            {
                isSvgFile: false,
                document: undefined
            }
    }
    
    function getFileName(document: vscode.TextDocument): string {
        return document.fileName.split('/').pop() || 'svgFontPreview';//).split('\\').slice(-1)[0] || ''): '';
    }

    let { isSvgFile, document } = svgFileMeta();

    if (isSvgFile && document) {
        let preveiwProvider = new TextDocumentContentProvider(document);
        let previewUri = vscode.Uri.parse(`svgFontPreview://authority?file${getFileName(document)}`);
        let preveiwRegistration = vscode.workspace.registerTextDocumentContentProvider('svgFontPreview', preveiwProvider);
        let disposable = vscode.commands.registerTextEditorCommand('extension.svgFontPreview', () => {
            let editorView = vscode.window.activeTextEditor;
            let toggleViewColumn = editorView && editorView.viewColumn ? editorView.viewColumn % 3 + 1 : vscode.ViewColumn.Two;
            return vscode.commands.executeCommand('vscode.previewHtml', previewUri, toggleViewColumn, previewUri.query);
        });

        vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
            if (e.document) {
                preveiwProvider.update(e.document);
            }
        });

        context.subscriptions.push(disposable, preveiwRegistration);
    } else {
        let disposable = vscode.commands.registerCommand('extension.svgFontPreview', () => {
            vscode.window.showInformationMessage('Non-SVG file document');
        });

        context.subscriptions.push(disposable);
    }
}

// this method is called when your extension is deactivated
export function deactivate() {
}
