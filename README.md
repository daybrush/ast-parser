# ast-parser

```sh
$ npm i ast-parser -D
```

```js
const {parse: babelParse} = require("@babel/parser");
const {parse: astParse, find, findInfo} = require("ast-parser");

function getNode(code) {
  return babelParse(code, {
    sourceType: "module",
    plugins: ["classProperties", "typescript"],
  });
}

expect(astParse(getNode(code)).nodeType).toBe("File");
expect(astParse(getNode(code).program).nodeType).toBe("Program");

const info = astParse(getNode(`
  const a = {a: 1, b: 2};
`)).program.body[0];
const info2 = info.declarations[0];

expect(info.nodeType).toBe("VariableDeclaration");
expect(info.kind).toBe("const");
expect(info.declarations.length).toBe(1);

expect(info2.id.nodeType).toBe("Identifier");
expect(info2.id.name).toBe("a");
expect(info2.id.string).toBe("a");
expect(info2.init.nodeType).toBe("ObjectExpression");
expect(info2.init.string).toBe("{a: 1, b: 2}");
expect(info.string).toBe("const a = {a: 1, b: 2}");

expect(
  astParse(getNode(`
    const a = {a: 1, b: 2};
  `)).program.body[0]
).).toBe("VariableDeclaration");
```

## find ObjectExpression, ObjectProperty
```js
const info = find("ObjectExpression", getNode(`
  const a = {a: 1, b: 2};
`));
const info2 = findInfo("ObjectProperty", info);

expect(info.string).toBe("{a: 1, b: 2}");
expect(info2.length).toBe(2);
expect(info2[0].string).toBe("a: 1");
expect(info2[0].key.string).toBe("a");
expect(info2[0].value.string).toBe("1");
expect(info2[1].string).toBe("b: 2");
expect(info2[1].key.string).toBe("b");
expect(info2[1].value.string).toBe("2");
```

## find ClassProperty
```js
const info = find("ClassDeclaration", `
  class A extends B implements C {
    a = "0";
    b: number = "1";
    private c: string = "2";
    public static d: () => void = () => ({});
    public static abstract e: () => void;
    constructor(a: string, private b?: number) {

    }
    public method1(): number {

    }
  }
`);
const info2 = findInfo("ClassProperty", info);
const info3 = findInfo("ClassMethod", info);

expect(info.string).toBe("class A extends B implements C");
expect(info2.length).toBe(5);
expect(info3.length).toBe(2);
expect(info2[0].string).toBe("a");
expect(info2[1].string).toBe("b: number");
expect(info2[2].string).toBe("private c: string");
expect(info2[3].string).toBe("public static d: () => void");
expect(info2[4].string).toBe("public static abstract e: () => void");
expect(info3[0].string).toBe("constructor(a: string, private b?: number)");
expect(info3[1].string).toBe("public method1(): number");
```

