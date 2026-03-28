import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';

/** Developer Break — sidebar arcade; save in any editor fires rocket in the game webview. */
export function activate(context: vscode.ExtensionContext) {
  const provider = new SidebarProvider(context.extensionUri, context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, provider)
  );

  const saveListener = vscode.workspace.onDidSaveTextDocument(() => {
    provider.postSaveBoost();
  });
  context.subscriptions.push(saveListener);
}

export function deactivate() {}
