import * as vscode from 'vscode';

const SKIN_STORAGE_KEY = 'doodleJump.characterSkin';
const ALLOWED_SKINS = [
  'android',
  'apple',
  'swift',
  'flutter',
  'python',
  'js',
  'kotlin',
  'rust',
] as const;

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'doodleJump.gameView';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    this._context.subscriptions.push(
      webviewView.webview.onDidReceiveMessage((msg) => {
        if (msg?.type === 'setSkin' && typeof msg.skin === 'string') {
          const skin = msg.skin;
          if ((ALLOWED_SKINS as readonly string[]).includes(skin)) {
            void this._context.globalState.update(SKIN_STORAGE_KEY, skin);
          }
        }
      })
    );
  }

  postSaveBoost() {
    if (this._view) {
      this._view.webview.postMessage({ type: 'saveBoost' });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'game.js')
    );
    const nonce = getNonce();
    const savedSkin =
      this._context.globalState.get<string>(SKIN_STORAGE_KEY) ?? 'android';
    const initJson = JSON.stringify({ skin: savedSkin });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Developer Break</title>
</head>
<body>
  <div id="hud" class="hud-hidden">
    <span id="score">0</span>
    <span id="hint">A/D move · Space=shoot bugs · Cmd/Ctrl+S=rocket</span>
  </div>
  <div id="canvas-wrap">
    <canvas id="game" tabindex="0" title="Developer Break — focus canvas to play"></canvas>
  </div>
  <script nonce="${nonce}">
    window.__DJ_VSCODE__ = acquireVsCodeApi();
    window.__DJ_INIT__ = ${initJson};
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
