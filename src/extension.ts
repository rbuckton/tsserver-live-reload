import * as fs from 'fs';
import * as path from "path";
import * as vscode from 'vscode';

const watchers = new Map<string, fs.FSWatcher>();
const statCache = new Map<string, fs.Stats>();
let timer: any;
let enabled = true;

// handles extension activation.
export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(maybeWatchTypeScript));
	context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(watchTypeScript));
	enabled = vscode.workspace.getConfiguration("tsserver-live-reload").get("enable", true);
	if (enabled) {
		watchTypeScript();
	}
}

// handles extension deactivation.
export function deactivate() {
	if (enabled) {
		stopAllWatchers();
	}

	statCache.clear();
}

// Update watchers if the typescript.tsdk configuration section has changed.
function maybeWatchTypeScript(e: vscode.ConfigurationChangeEvent) {
	if (e.affectsConfiguration("typescript.tsdk")) {
		watchTypeScript();
	}
	if (e.affectsConfiguration("tsserver-live-reload.enable")) {
		const wasEnabled = enabled;
		enabled = vscode.workspace.getConfiguration("tsserver-live-reload").get("enable", true);
		if (wasEnabled !== enabled) {
			if (enabled) {
				watchTypeScript();
				// Catch up with any changes
				for (const file of watchers.keys()) {
					maybeReloadTypeScript(file);
				}
			}
			else {
				stopAllWatchers();
			}
		}
	}
}

// Update the set of watchers.
function watchTypeScript() {
	if (!enabled) return;
	const tsdk = vscode.workspace.getConfiguration("typescript").inspect("tsdk");
	const watchedFiles = new Set(watchers.keys());
	if (tsdk) {
		watchTsdkFolder(tsdk.workspaceValue, watchedFiles);
		watchTsdkFolder(tsdk.workspaceFolderValue, watchedFiles);
		watchTsdkFolder(tsdk.globalValue, watchedFiles);
	}
	for (const file of watchedFiles) {
		const watcher = watchers.get(file);
		if (watcher) watcher.close();
		watchers.delete(file);
	}
}

// Stop all file watchers.
function stopAllWatchers() {
	clearTimeout(timer);
	timer = undefined;

	for (const [key, watcher] of watchers) {
		watchers.delete(key);
		watcher.close();
	}
}

// Watch for changes to "tsserver.js" in the provided tsdk folder.
function watchTsdkFolder(folder: unknown, watchedFiles: Set<string>) {
	if (!enabled) return;
	if (typeof folder === "string") {
		const file = path.join(folder, "tsserver.js");
		if (!watchedFiles.delete(file)) {
			hasChanged(file);
			const watcher = fs.watch(file, { persistent: true }, () => maybeReloadTypeScript(file));
			watchers.set(file, watcher);
		}
	}
}

// Check whether the provided file has changed since the last time this function was called for the provided file.
function hasChanged(file: string) {
	let thisStat: fs.Stats | undefined;
	try { thisStat = fs.statSync(file); } catch {}

	const lastStat = statCache.get(file);
	if ((lastStat && lastStat.mtimeMs) !== (thisStat && thisStat.mtimeMs)) {
		if (thisStat) {
			statCache.set(file, thisStat);
		}
		else {
			statCache.delete(file);
		}
		return true;
	}
	return false;
}

// Reload TypeScript if the provided tsserver.js file has changed.
function maybeReloadTypeScript(file: string) {
	if (!enabled) return;
	if (!hasChanged(file)) return;
	if (timer) clearTimeout(timer);
	timer = setTimeout(reloadTypeScript, 500);
}

// Trigger the "typscript.restartTsServer" command.
function reloadTypeScript() {
	if (!enabled) return;
	vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Detected changes to the TypeScript Language Server, restarting..." }, () => vscode.commands.executeCommand("typescript.restartTsServer"));
}

