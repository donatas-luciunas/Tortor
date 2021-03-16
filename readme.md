# tortor

## Problems

* As application grows it becomes more difficult to develop because of slowing feedback loops
* Classic approach to tests conflicts with encapsulation

## Solution

* [Maintain **tortor** environment](#tortor-environment)
* [**tortor** will accompany you with current variable values](#tortor-extension)

## **tortor** environment

Please take a look at [sample](/sample).

BTW [nock](https://github.com/nock/nock) can be very helpful.

## **tortor** extension

Hit `CTRL+SHIFT+'` and **tortor** will provide values for variables mentioned in current scope.

![demo](/demo.gif)

## Vision

* `global.tortor` regions should be dimmed for better readability
* With help of this extension you could validate your code with your test dataset while coding
  * Extension could support bigger datasets and provide you insights instead of exact values
* Such an approach to tests could become a new normal