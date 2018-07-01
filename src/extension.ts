'use strict';

import * as vscode from 'vscode';
import TextDocumentContentProvider from './Previewer';

export function activate(context: vscode.ExtensionContext) {

    function svgFileMeta() {
        const editor = vscode.window.activeTextEditor;
        return editor ?
            {
                isSvgFile: editor.document.fileName.toLowerCase().endsWith('.svg'),
                document: editor.document
            } :
            {
                isSvgFile: false,
                document: undefined
            }
    }
    
    function getFileName(document: vscode.TextDocument): string {
        return document.fileName.split('/').pop() || 'svgFontPreview';
    }

    const { isSvgFile, document } = svgFileMeta();

    if (isSvgFile && document) {
        const preveiwProvider = new TextDocumentContentProvider(document);
        const previewUri = vscode.Uri.parse(`svgFontPreview://svgFile?${getFileName(document)}`);
        const preveiwRegistration = vscode.workspace.registerTextDocumentContentProvider('svgFontPreview', preveiwProvider);
        const disposable = vscode.commands.registerTextEditorCommand('extension.svgFontPreview', () => {
            const editorView = vscode.window.activeTextEditor;
            const toggleViewColumn = editorView && editorView.viewColumn ? editorView.viewColumn % 3 + 1 : vscode.ViewColumn.Two;
            return vscode.commands.executeCommand('vscode.previewHtml', previewUri, toggleViewColumn, previewUri.query);
        });

        context.subscriptions.push(disposable, preveiwRegistration);
    } else {
        const disposable = vscode.commands.registerCommand('extension.svgFontPreview', () => {
            vscode.window.showInformationMessage('File name must be *.svg');
        });

        context.subscriptions.push(disposable);
    }
}

// this method is called when your extension is deactivated
export function deactivate() {
}
