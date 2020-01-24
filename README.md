# tsserver-live-reload

Restarts the TypeScript language server whenever it detects that the language server has changed on disk (useful for 
developers working on TypeScript itself).

## Features

This extension monitors the `"typescript.tsdk"` folder locations set in your user and workspace settings to detect changes
to the TypeScript language server (`tsserver.js`). When it detects the file has changed, it restarts the TypeScript language server.

## Extension Settings

This extension contributes the following settings:

* `tsserver-live-reload.enable`: enable/disable this extension

## Release Notes

### 1.0.0

Initial release of tsserver-live-reload
