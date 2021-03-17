# Tortor

## Problems

* As application grows it becomes more difficult to develop because of slowing feedback loops
* Classic approach to tests conflicts with encapsulation

## Solution

* [Maintain Tortor environment](#tortor-environment)
* [Tortor will accompany you with current variable values](#tortor-extension)

## Tortor environment

Please take a look at [sample](/sample).

BTW [nock](https://github.com/nock/nock) can be very helpful.

## Tortor extension

Hit `CTRL+SHIFT+'` and Tortor will provide values for variables mentioned in current scope.

![demo](/demo.gif)

As this extension is still in development the only way to enable it in your VS Code is to add `--extensionDevelopmentPath={extensionFolder}` while starting it. [More info](https://code.visualstudio.com/api/working-with-extensions/testing-extension)

## Plans

* Publish this in [VS Code Extension Marketplace](https://marketplace.visualstudio.com/vscode)
* `global.tortor` regions should be dimmed for better readability

Encountered the same problem as https://github.com/tiffon/vscode-todone - cannot proceed

## Vision

* With help of this extension you could validate your code with your test dataset while coding
  * Extension could support bigger datasets and provide you insights instead of exact values
* Such an approach to tests could become a new normal