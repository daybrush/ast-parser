const {find: _find, findInfo} = require("../parser");
const {parse: babelParse} = require("@babel/parser");

function getNode(code) {
  return babelParse(code, {
    sourceType: "module",
    plugins: ["classProperties", "typescript"],
  });
}
function find(type, code) {
  return _find(type, getNode(code));
}


describe(`test parser`, () => {
  it (`test VariableDeclaration`, () => {
    const info = find("VariableDeclaration", `
      const a = {a: 1, b: 2}
    `);
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
  });
  it (`test VariableDeclarator(Object)`, () => {
    const info = find("VariableDeclarator", `
      const {a, b: c, c: d = e}: {a, b, c} = a;
    `);

    expect(info.id.nodeType).toBe("ObjectPattern");
    expect(info.id.string).toBe("{a: a, b: c, c: d = e}: {a, b, c}");
    expect(info.id.typeAnnotation.string).toBe("{a, b, c}");
    expect(info.string).toBe("{a: a, b: c, c: d = e}: {a, b, c} = a");
  })
  it (`test ObjectExpression, ObjectProperty`, () => {
    const info = find("ObjectExpression", `
      const a = {a: 1, b: 2}
    `);

    const info2 = findInfo("ObjectProperty", info);

    expect(info.string).toBe("{a: 1, b: 2}");
    expect(info2.length).toBe(2);
    expect(info2[0].string).toBe("a: 1");
    expect(info2[0].key.string).toBe("a");
    expect(info2[0].value.string).toBe("1");
    expect(info2[1].string).toBe("b: 2");
    expect(info2[1].key.string).toBe("b");
    expect(info2[1].value.string).toBe("2");
  });
  it (`test NewExpression`, () => {
    // Given, When
    const info = find("NewExpression", `new Date<a>()`);
    const info2 = find("NewExpression", `new Date<A>(a, b, c)`);

    // Then
    expect(info.string).toBe("new Date<a>()");
    expect(info2.string).toBe("new Date<A>(a, b, c)");
  });
  it (`test ClassDeclaration, ClassProperty, ClassMethod`, () => {
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
    expect(info2[0].accessibility).toBe("");
    expect(info2[0].key.string).toBe("a");
    expect(info2[0].string).toBe("a");
    expect(info2[1].string).toBe("b: number");
    expect(info2[2].string).toBe("private c: string");
    expect(info2[3].string).toBe("public static d: () => void");
    expect(info2[4].string).toBe("public static abstract e: () => void");
    expect(info3[0].string).toBe("constructor(a: string, private b?: number)");
    expect(info3[1].string).toBe("public method1(): number");
  });
});

describe("test typescript type", () => {
  it (`test TSTupleType`, () => {
    // Given, When
    const info = find("TSTupleType", `const a:[1, 2, 3]`);
    const info2 = find("TSTupleType", `const a:[number, void, any, never]`);

    // Then
    expect(info.string).toBe("[1, 2, 3]");
    expect(info2.string).toBe("[number, void, any, never]");
  });
  it (`test TSModuleDeclaration`, () => {
    // Given, When
    const info = find("TSModuleDeclaration", `
      declare module Window {
        export class SomeClass {
            private _someField: string = null;
            constructor (value: bool) {
                // omitted
            }
            private _someMethod() {
                // omitted
            }
        }
    }
  `);
    const info2 = find("TSModuleDeclaration", `
      namespace Validation {
          export interface StringValidator {
              isAcceptable(s: string): boolean;
          }
      }
    `);

    // Then
    expect(info.string).toBe("declare module Window");
    expect(info2.string).toBe("module Validation");
  });
  it (`test TSNullKeyword`, () => {
    // Given, When
    const info = find("VariableDeclarator", `
      const a: null = null;
  `);

    // Then
    expect(info.string).toBe("a: null = null");
    expect(info.id.string).toBe("a: null");
    expect(info.id.typeAnnotation.string).toBe("null");
    expect(info.id.typeAnnotation.typeAnnotation.string).toBe("null");
    expect(info.id.typeAnnotation.typeAnnotation.key).toBe("null");
  });
});