/* eslint-disable space-before-function-paren */
/* eslint-disable no-implicit-coercion */
/* eslint-disable new-cap */
/* eslint-disable no-use-before-define */
/* eslint-disable no-template-curly-in-string */
'use strict';

var traverse = require('@babel/traverse').default;
var t = require('@babel/types');
var u = require('@daybrush/utils');

function _getTypeId(str, filename) {
    return str ? '$ts:' + str + (filename ? '<file>' + filename + '</file>' : '') : '';
}
function getTypeId(filename) {
    // eslint-disable-next-line no-invalid-this
    return _getTypeId(this.string, filename);
}

function _find(type, info) {
    if (!info) {
        return null;
    }
    if (info.nodeType === type) {
        return info;
    }
    for (var key in info) {
        if (Array.isArray(info[key])) {
            var result = info[key].map(function (subinfo) {
                var r = _find(type, subinfo);

                if (r) {
                    return r;
                }

                return undefined;
            }).filter(function (r) {
                return r;
            });

            if (result.length) {
                if (result.length === 1) {
                    return result[0];
                }

                return result;
            }
        } else if (typeof info[key] === 'object') {
            var objectResult = _find(type, info[key]);

            if (objectResult) {
                return objectResult;
            }
        }
    }

    return null;
}


function map(arr, property) {
    return arr.map(function (v) {
        return v[property];
    });
}
function removeQuotation(str) {
    return str ? str.replace(/^'([^']*)'$/g, '$1').replace(/^"([^"]*)"$/g, '$1') : '';
}
function getValue(target, type, values) {
    if (Array.isArray(target)) {
        return target.map(function (v) {
            return v[type] || v.string;
        }).join(removeQuotation(values[1]) || ', ');
    } else if (typeof target === 'object') {
        return target[type] || target.string;
    } else if (typeof target === 'undefined') {
        return '';
    } else {
        return target;
    }
}
// function replaceHTML(nodeType, content) {
//     return content ? '<span class="ts-style ts-' + nodeType.replace('TS', '').toLowerCase() + '">' + content + '</span>' : '';
// }
function replaceUnicode(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function calcValue(str, info, type) {
    return (str || '').split('+').map(function (v) {
        var str2 = v.trim();

        if (str2.indexOf("'") > -1 || str2.indexOf('"') > -1) {
            return removeQuotation(str2);
        } else {
            return getValue(info[str2], type, []);
        }
    }).join('');
}
function checkValue(target) {
    if (Array.isArray(target)) {
        return target.length;
    } else if (typeof target === 'object') {
        return target.string;
    } else {
        var type = typeof target;

        return type === 'boolean' || type === 'number' || !!target;
    }
}
function checkCalc(str, info) {
    return (str || '').split('+').filter(function (v) {
        var str2 = v.trim();

        if (str2.indexOf("'") > -1 || str2.indexOf('"') > -1) {
            return false;
        } else {
            return checkValue(info[str2]);
        }
    }).length > 0;
}
function _replaceTemplate(str, info, type) {
    return str.replace(/\$([a-z]*)\{((?:(?:'[^']*')|(?:"[^"]*")|(?:[^}]))*)\}/g, function (all, syntax, value) {
        var values = u.splitComma(value);
        var target = info[values[0]];

        if (syntax === 'if' || syntax === 'eq') {
            var condition;
            var rv;

            if (syntax === 'if') {
                if (values.length === 1) {
                    rv = checkCalc(values[0], info) ? values[0] : '';
                } else {
                    if (Array.isArray(target)) {
                        condition = target.length;
                    } else if (typeof target === 'object') {
                        condition = target.string;
                    } else {
                        condition = target;
                    }
                    rv = condition ? values[1] : values[2];
                }
            } else if (syntax === 'eq') {
                var left = calcValue(values[0], info, 'string');
                var right = calcValue(values[1], info, 'string');

                rv = left === right ? values[2] : values[3];
            }

            return calcValue(rv, info, type);
        }

        return getValue(target, type, values);
    });
}
function replaceTemplate(str, info) {
    info.string = _replaceTemplate(str, info, 'string');
    info.html = _replaceTemplate(replaceUnicode(str), info, 'html');
}

function read(node, types, others) {
    var obj = {};
    var name;

    // eslint-disable-next-line guard-for-in
    for (name in types) {
        var type = types[name];

        if (type === 'type') {
            // eslint-disable-next-line no-use-before-define
            obj[name] = parse(node[name], node, name);
        } else if (type === 'array') {
            // eslint-disable-next-line no-loop-func
            obj[name] = (node[name] || []).map(function (n) {
                // eslint-disable-next-line no-use-before-define
                return parse(n, node, name);
            });
        } else if (type === 'get') {
            // eslint-disable-next-line no-use-before-define
            obj[name] = parse(node[name], node, name).string;
        } else if (type === 'value') {
            obj[name] = name in node ? node[name] : '';
        }
    }
    // eslint-disable-next-line guard-for-in
    for (name in others) {
        obj[name] = others[name];

        if (typeof obj[name] === 'string') {
            if (name === 'template') {
                continue;
            } else if (obj[name].indexOf('@alias:') === 0) {
                obj[name] = obj[obj[name].substring(7)];
            } else {
                obj[name] = _replaceTemplate(obj[name], obj, 'string');
            }
        }
    }

    return obj;
}

var types = {
    _parse: function (node, parentNode, property) {
        var rv = {};
        var nodeType = node.type;

        if (types[nodeType]) {
            rv = types[nodeType](node, parentNode, property);
        } else {
            rv = {
                isNotExist: true,
                string: nodeType
            };
        }
        if (!rv.nodeType) {
            rv.nodeType = nodeType;
        }

        if (rv.template) {
            replaceTemplate(rv.template, rv);
        }
        if (!('string' in rv)) {
            rv.string = rv.nodeType || '';
        }

        if (!rv.html) {
            rv.html = replaceUnicode(rv.string);
        }
        rv.node = node;

        return rv;
    },
    File: function (node) {
        return read(node, {
            program: 'type',
            comments: 'value',
            tokens: 'value'
        }, {
            template: '${program}'
        });
    },
    Program: function (node) {
        return read(node, {
            body: 'array',
            directives: 'array',
            sourceType: 'value',
            sourceFile: 'value'
        }, {
            template: '${body, "\n"}'
        });
    },
    ImportDeclaration: function (node) {
        return read(node, {
            specifiers: 'array',
            source: 'type'
        }, {
            template: 'import ${specifiers} from ${source}'
        });
    },
    ImportSpecifier: function (node) {
        return read(node, {
            local: 'type',
            imported: 'type',
            importKind: 'value'
        }, {
            key: '${local}',
            alias: '${imported}',
            template: '${local}$eq{local, imported, "", ": " + imported}'
        });
    },
    ImportNamespaceSpecifier: function (node) {
        return read(node, {
            local: 'type'
        }, {
            key: '*',
            alias: '${local}',
            template: '* as ${local}'
        });
    },
    ImportDefaultSpecifier: function (node) {
        return read(node, {
            local: 'type'
        }, {
            key: 'default',
            alias: '${local}',
            template: '${local}'
        });
    },
    ExportNamedDeclaration: function (node) {
        var info = read(node, {
            declaration: 'type',
            specifiers: 'array',
            source: 'value'
        }, {
            template: 'export ${declaration}'
        });

        if (!info.specifiers.length) {
            info.specifiers = [
                {
                    key: info.declaration.id.string,
                    alias: info.declaration.id.string
                }
            ];
        }

        return info;
    },
    ExportDefaultDeclaration: function (node) {
        var info = read(node, {
            declaration: 'type'
        }, {
            template: 'export default ${declaration}'
        });
        var key = info.declaration.name || info.declaration.id;

        info.specifiers = [
            {
                string: 'default',
                key: (key && (typeof key === 'string' ? key : key.string)) || '',
                alias: 'default'
            }
        ];

        return info;
    },
    BlockStatement: function (node) {
        return read(node, {
        }, {
            template: '{}'
        });
    },
    ExportSpecifier: function (node) {
        return read(node, {
            local: 'type',
            exported: 'type'
        }, {
            key: '${local}',
            alias: '${exported}',
            template: '${local}$eq{local, exported, "", " as " + exported}'
        });
    },
    VariableDeclaration: function (node) {
        var info = read(node, {
            kind: 'value',
            declarations: 'array',
            declare: 'value'
        }, {
            template: '$if{declare, "declare "}${kind} ${declarations}'
        });

        info.id = info.declarations[0].id;

        return info;
    },
    VariableDeclarator: function (node) {
        return read(node, {
            id: 'type',
            init: 'type',
            definie: 'value'
        }, {
            template: '${id}$if{init, " = " + init}'
            // template: '${id}'
        });
    },
    ArrayPattern: function (node) {
        return read(node, {
            elements: 'array',
            decorators: 'array',
            typeAnnotation: 'type'
        }, {
            template: '[${elements}]$if{typeAnnotation, ": " + typeAnnotation}'
        });
    },
    TSAsExpression: function (node) {
        return read(node, {
            expression: 'type',
            typeAnnotation: 'type'
        }, {
            template: '${expression} as ${typeAnnotation}'
        });
    },
    TSInterfaceDeclaration: function TSInterfaceDeclaration(node) {
        var info = read(node, {
            id: 'type',
            typeParameters: 'type',
            extends: 'array',
            body: 'type',
            declare: 'value'
        }, {
            template: 'interface ${id}${typeParameters} $if{extends, "extends "}${extends, ", "}'
        });

        return info;
    },
    TSInterfaceBody: function TSInterfaceBody(node) {
        var info = read(node, {
            body: 'array'
        });

        return info.body;
    },
    TSPropertySignature: function TSPropertySignature(node) {
        return read(node, {
            key: 'type',
            typeAnnotation: 'type',
            initializer: 'type',
            computed: 'value',
            optional: 'value',
            readonly: 'value'
        }, {
            template: '${key}$if{optional,"?"}$if{": " + typeAnnotation}'
        });
    },
    TSThisType: function TSThisType() {
        return {
            template: 'this'
        };
    },
    TSIndexSignature: function TSIndexSignature(node) {
        var info = read(node, {
            parameters: 'array',
            typeAnnotation: 'type',
            readonly: 'value'
        });

        info.key = {
            string: '[' + map(info.parameters, 'string').join(', ') + ']',
            html: '[' + map(info.parameters, 'html').join(', ') + ']'
        };
        info.template = '$eq{readonly, "-", "-"}$if{readonly,"readonly"}${key}: ${typeAnnotation}';

        return info;
    },
    TSMethodSignature: function TSMethodSignature(node) {
        var info = read(node, {
            key: 'type',
            typeParameters: 'type',
            parameters: 'array',
            typeAnnotation: 'type',
            computed: 'value',
            optional: 'value'
        }, {
            type: '${typeParameters}(${parameters}) => $if{typeAnnotation, typeAnnotation, "void"}',
            template: '${key}$if{optional,"?"}${typeParameters}(${parameters})$if{typeAnnotation,": "}${typeAnnotation}'
        });

        return info;
    },
    TSExpressionWithTypeArguments: function TSExpressionWithTypeArguments(node) {
        var info = read(node, {
            expression: 'type',
            typeParameters: 'type'
        }, {
            template: '${expression}${typeParameters}'
        });

        return info;
    },
    TSCallSignatureDeclaration: function TSCallSignatureDeclaration(node) {
        var info = read(node, {
            typeParameters: 'type',
            parameters: 'array',
            typeAnnotation: 'type'
        });
        var key = {
            string: info.typeParameters.string + '(' + map(info.parameters, 'string').join(', ') + ')'
        };

        info.key = key;
        info.name = key;
        info.type = info.typeAnnotation.string;
        info.template = '${key}: ${typeAnnotation}';

        return info;
    },
    TSNonNullExpression: function TSNonNullExpression(node) {
        return read(node, {
            expression: 'type'
        }, {
            template: '${expression}!'
        });
    },
    TSOptionalType: function TSOptionalType(node) {
        return read(node, {
            typeAnnotation: 'type'
        }, {
            template: '${typeAnnotation}?'
        });
    },
    TSTupleType: function TSTupleType(node) {
        return read(node, {
            elementTypes: 'array'
        }, {
            template: '[${elementTypes}]'
        });
    },
    TSTypePredicate: function TSTypePredicate(node) {
        return read(node, {
            parameterName: 'type',
            typeAnnotation: 'type'
        }, {
            template: '${parameterName} is ${typeAnnotation}'
        });
    },
    TSTypeAliasDeclaration: function TSTypeAliasDeclaration(node) {
        return read(node, {
            id: 'type',
            typeParameters: 'type',
            typeAnnotation: 'type',
            declare: 'value'
        }, {
            template: '${id}${typeParameters} = ${typeAnnotation}'
        });
    },
    TSLiteralType: function TSLiteralType(node) {
        return parse(node.literal, node);
    },
    StringLiteral: function StringLiteral(node) {
        return read(node, {
            value: 'value'
        }, {
            template: '${id}',
            id: '"${value}"'
        });
    },
    NullLiteral: function NullLiteral(node) {
        return read(node, {}, {
            template: 'null',
            id: 'null'
        });
    },
    NumericLiteral: function NumericLiteral(node) {
        return read(node, {
            value: 'value'
        }, {
            template: '${id}',
            id: '${value}'
        });
    },
    BooleanLiteral: function BooleanLiteral(node) {
        return read(node, {
            value: 'value'
        }, {
            template: '${id}',
            id: '${value}'
        });
    },
    ObjectPattern: function ObjectPattern(node) {
        return read(node, {
            properties: 'array',
            decorators: 'array',
            typeAnnotation: 'type'
        }, {
            template: '{${properties}}$if{": " + typeAnnotation}'
        });
    },
    ObjectProperty: function ObjectProperty(node) {
        return read(node, {
            key: 'type',
            value: 'type',
            computed: 'value',
            shortahnd: 'value',
            decorators: 'array'
        }, {
            template: '${key}$if{": " + value}'
        });
    },
    AssignmentPattern: function AssignmentPattern(node) {
        return read(node, {
            left: 'type',
            right: 'type',
            decorators: 'array',
            typeAnnotation: 'type'
        }, {
            template: '${left} = ${right}'
        });
    },
    TSTypeLiteral: function TSTypeLiteral(node) {
        return read(node, {
            members: 'array'
        }, {
            template: '$if{"{" + members + "}"}'
        });
    },
    ClassMethod: function ClassMethod(node) {
        return read(node, {
            key: 'type',
            params: 'array',
            generator: 'value',
            async: 'value',
            returnType: 'type',
            typeParameters: 'type',
            accessibility: 'value'
        }, {
            parameters: '@alias:params',
            template: '$if{accessibility, accessibility + " "}${key}${typeParameters}(${parameters})$if{returnType, ": " + returnType}'
        });
    },
    MethodDefinition: function MethodDefinition(node) {
        return read(node.value, {
            params: 'array',
            generator: 'value',
            async: 'value',
            returnType: 'type',
            typeParameters: 'type',
            accessibility: 'value'
        }, {
            key: parse(node.key, node, 'key'),
            parameters: '@alias:params',
            template: '$if{accessibility, accessibility + " "}${key}${typeParameters}(${parameters})$if{returnType, ": " + returnType}'
        });
    },
    TSDeclareMethod: function TSDeclareMethod(node) {
        return this.ClassMethod(node);
    },
    ClassDeclaration: function ClassDeclaration(node) {
        return read(node, {
            id: 'type',
            superClass: 'type',
            decorators: 'array',
            abstract: 'value',
            declare: 'value',
            implements: 'array',
            minxins: 'value',
            superTypeParameters: 'type',
            typeParameters: 'type',
            body: 'type'
        }, {
            template: '$if{decorators, decorators + "\n"}class ${id}${typeParameters}$if{superClass, " extends " + superClass}$if{implements, " implements " + implements}'
        });
    },
    ClassBody: function ClassBody(node) {
        return read(node, {
            body: 'array'
        }, {
            template: '${body, ";\n"}'
        });
    },
    ClassProperty: function (node) {
        return read(node, {
            key: 'type',
            value: 'type',
            typeAnnotation: 'type',
            decorators: 'type',
            computed: 'value',
            abstract: 'value',
            accessibility: 'value',
            definite: 'value',
            optional: 'value',
            readonly: 'value',
            static: 'value'
        }, {
            template: '$if{accessibility + " "}$if{static, "static "}$if{abstract, "abstract "}${key}$if{": " + typeAnnotation}'
        });
    },
    Decorator: function Decorator(node) {
        return read(node, {
            expression: 'type'
        }, {
            template: '@${expression}'
        });
    },
    ArrayExpression: function ArrayExpression(node) {
        return read(node, {
            elements: 'array'
        }, {
            template: '[${elements}]'
        });
    },
    ObjectExpression: function ObjectExpression(node) {
        return read(node, {
            properties: 'array'
        }, {
            template: '{${properties}}'
        });
    },
    TemplateLiteral: function TemplateLiteral(node) {
        var info = read(node, {
            quasis: 'array',
            expressions: 'array'
        });
        var quasis = info.quasis;
        var expressions = info.expressions;

        var str = quasis[0] ? quasis[0].string : '';
        var length = quasis.length;

        for (var i = 1; i < length; ++i) {
            str += '${' + expressions[i - 1].string + '}';
            str += quasis[i].string;
        }
        info.string = '`' + str + '`';

        return info;
    },
    TemplateElement: function TemplateElement(node) {
        return read(node, {
            value: 'value',
            tail: 'value'
        }, {
            template: '${value}'
        });
    },
    CallExpression: function (node) {
        return read(node, {
            callee: 'type',
            arguments: 'array',
            optional: 'value',
            typeArguments: 'type',
            typeParameters: 'type'
        }, {
            template: '${callee}${typeParameters}(${arguments})'
        });
    },
    TSModuleDeclaration: function (node) {
        return read(node, {
            id: 'type',
            body: 'type',
            declare: 'value',
            global: 'value'
        }, {
            template: '$if{declare, "declare "}module ${id}'
        });
    },
    TSModuleBlock: function (node) {
        return read(node, {
            body: 'array'
        }, {
            template: '${body}'
        });
    },
    MemberExpression: function (node) {
        // object.a
        // object.b

        return read(node, {
            object: 'type',
            property: 'type',
            copmuted: 'value',
            optional: 'value'
        }, {
            template: '${object}.${property}'
        });
    },
    ThisExpression: function () {
        return {
            template: 'this',
            key: 'this'
        };
    },
    BinaryExpression: function (node) {
        // a === b
        return read(node, {
            operator: 'value',
            left: 'type',
            right: 'type'
        }, {
            template: '${left} ${operator} ${right}'
        });
    },
    TSQualifiedName: function (node) {
        return read(node, {
            left: 'type',
            right: 'type'
        }, {
            template: '${left}.${right}'
        });
    },
    TSInferType: function (node) {
        // infer T
        return read(node, {
            typeParameter: 'type'
        }, {
            template: 'infer ${typeParameter}'
        });
    },
    TSTypeOperator: function (node) {
        return read(node, {
            operator: 'value',
            typeAnnotation: 'type'
        }, {
            template: '${operator} ${typeAnnotation}'
        });
    },
    TSTypeParameter: function (node) {
        // a extends keyof T = U
        return read(node, {
            constraint: 'type',
            default: 'type',
            name: 'value'
        }, {
            template: '${name}$if{constraint, " extends " + constraint}$if{default, " = " + default}'
        });
    },
    TSConstructSignatureDeclaration: function (node) {
        return read(node, {
            typeParameters: 'type',
            parameters: 'array',
            typeAnnotation: 'type'
        }, {
            template: 'new${typeParameters}(${parameters})$if{typeAnnotation, ": " + typeAnnotation}'
        });
    },
    TSNeverKeyword: function () {
        return {
            template: 'never',
            key: 'never'
        };
    },
    TSNumberKeyword: function () {
        return {
            template: 'number',
            key: 'number'
        };
    },
    TSStringKeyword: function () {
        return {
            template: 'string',
            key: 'string'
        };
    },
    TSNullKeyword: function () {
        return {
            template: 'null',
            key: 'null'
        };
    },
    TSObjectKeyword: function () {
        return {
            template: 'object',
            key: 'object'
        };
    },
    TSVoidKeyword: function () {
        return {
            template: 'void',
            key: 'void'
        };
    },
    TSBooleanKeyword: function () {
        return {
            template: 'boolean',
            key: 'boolean'
        };
    },
    TSAnyKeyword: function () {
        return {
            template: 'any',
            key: 'any'
        };
    },
    FunctionDeclaration: function (node) {
        return read(node, {
            id: 'type',
            params: 'array',
            returnType: 'type',
            typeParameters: 'type',
            aysnc: 'value',
            declare: 'value',
            generator: 'value'
        }, {
            parameters: '@alias:params',
            template: '$if{declare, "declare "}$if{async, "async "}function$if{generator, "*"} ${id}(${parameters})$if{returnType, ":  " + returnType}'
        });
    },
    TSDeclareFunction: function (node) {
        return this.FunctionDeclaration(node);
    },
    Identifier: function (node) {
        return read(node, {
            typeAnnotation: 'type',
            name: 'value',
            optional: 'value'
        }, {
            id: '@alias:name',
            template: '${id}$if{optional, "?"}$if{typeAnnotation, ": " + typeAnnotation}'
        });
    },
    TSFunctionType: function (node) {
        return read(node, {
            parameters: 'array',
            typeAnnotation: 'type',
            typeParameters: 'type'
        }, {
            returnType: '@alias:typeAnnotation',
            template: '${typeParameters}(${parameters}) => ${typeAnnotation}'
        });
    },
    TSTypeAnnotation: function (node) {
        return read(node, {
            typeAnnotation: 'type'
        }, {
            template: '${typeAnnotation}'
        });
    },
    TSUnionType: function (node) {
        // A | B | C
        return read(node, {
            types: 'array'
        }, {
            template: '${types, " | "}'
        });
    },
    TSIntersectionType: function (node) {
        // A & B & C
        return read(node, {
            types: 'array'
        }, {
            template: '${types, " & "}'
        });
    },
    TSParenthesizedType: function (node) {
        // (A)
        return read(node, {
            typeAnnotation: 'type'
        }, {
            template: '(${typeAnnotation})'
        });
    },
    TSTypeParameterDeclaration: function (node) {
        // <A, B, C, D>
        // <T, U, R>
        return read(node, {
            params: 'array'
        }, {
            template: '$if{params, "<" + params + ">"}'
        });
    },
    TSTypeReference: function (node) {
        // ?
        return read(node, {
            typeName: 'type',
            typeParameters: 'type'
        }, {
            template: '${typeName}${typeParameters}'
        });
    },
    TSTypeParameterInstantiation: function (node) {
        // Be similar to: TSTypeParameterDeclaration
        // <T, U, R>
        // <CSSDeclaratation>
        return read(node, {
            params: 'array'
        }, {
            template: '$if{params, "<" + params + ">"}'
        });
    },
    TSArrayType: function (node) {
        // number[]
        // string[]
        return read(node, {
            elementType: 'type'
        }, {
            template: '${elementType}[]'
        });
    },
    RestElement: function (node) {
        // ...args
        // ...args: any[],
        return read(node, {
            argument: 'type',
            typeAnnotation: 'type'
        }, {
            template: '...${argument}$if{typeAnnotation, ": " + typeAnnotation}',
            id: '...${argument}'
        });
    },
    TSIndexedAccessType: function (node) {
        // Inteface["propertyName"]
        return read(node, {
            objectType: 'type',
            indexType: 'type'
        }, {
            template: '${objectType}[${indexType}]'
        });
    },
    TSConstructorType: function (node) {
        // new <T>(a: T, ...args: any[]) => ABC
        return read(node, {
            typeParameters: 'type',
            typeAnnotation: 'type',
            parameters: 'array'
        }, {
            template: 'new ${typeParameters}(${parameters}) => ${typeAnnotation}'
        });
    },
    NewExpression: function (node) {
        // new Date<T>()
        return read(node, {
            callee: 'type',
            arguments: 'array',
            optional: 'value',
            typeArguments: 'type',
            typeParameters: 'type'
        }, {
            template: 'new ${callee}${typeParameters}(${arguments})'
        });
    },
    ExpressionStatement: function (node) {
        // expression
        return parse(node.expression, node);
    },
    UnaryExpression: function (node) {
        // -1
        // ~1
        // +1
        return read(node, {
            operator: 'value',
            argument: 'type',
            prefix: 'value'
        }, {
            template: '${operator}${argument}'
        });
    },
    TSConditionalType: function (node) {
        return read(node, {
            checkType: 'type',
            extendsType: 'type',
            trueType: 'type',
            falseType: 'type'
        }, {
            template: '${checkType} extends ${extendsType} ? ${trueType} : ${falseType}'
        });
    },
    ArrowFunctionExpression: function (node) {
        return read(node, {
            params: 'array',
            async: 'value',
            expression: 'value',
            generator: 'value',
            returnType: 'type',
            typeParameters: 'type',
            body: 'type'

        }, {
            template: '$if{async, "async "}${typeParameters}(${params}) => ${body}'
        });
    },
    TSParameterProperty: function (node) {
        return read(node, {
            parameter: 'type',
            accessibility: 'value',
            readonly: 'value'
        }, {
            template: '${accessibility} ${parameter}'
        });
    },
    TSMappedType: function (node) {
        // [K in keyof T]?: (Equals<{-readonly [P in K]: T[K]}>)
        return read(node, {
            typeParameter: 'type',
            typeAnnotation: 'type',
            optional: 'value',
            readonly: 'value'
        }, {
            template: '$eq{readonly, "-", "-"}$if{readonly, "readonly "}[${typeParameter}]$if{optional, "?"}: ${typeAnnotation}'
        });
    },
    TSTypeQuery: function (node) {
        return read(node, {
            exprName: 'type'
        }, {
            template: 'typeof ${exprName}'
        });
    },
    TSUndefinedKeyword: function () {
        return {
            string: 'undefined',
            key: 'undefined'
        };
    },
    RegExpLiteral: function (node) {
        return read(node, {
            pattern: 'value',
            flags: 'value'
        }, {
            template: '/${pattern}/${flags}'
        });
    }
};

function parse(node, parentNode, property) {
    var rv = {};

    if (!node || !node.type) {
        rv = {
            string: '',
            html: '',
            nodeType: ''
        };
    } else {
        rv = types._parse(node, parentNode, property);
    }
    rv.node = node;
    rv.typeId = getTypeId;

    return rv;
}

function debug(func, selector) {
    var searchFunc = function () {
        return true;
    };

    if (selector && selector !== '*') {
        if (typeof selector === 'string') {
            searchFunc = function (info, node) {
                return node.type.toLowerCase() === selector.toLowerCase();
            };
        } else if (selector instanceof RegExp) {
            searchFunc = function (info, node) {
                return node.type.match(selector);
            };
        } else if (typeof selector === 'function') {
            searchFunc = selector;
        }
    }

    var original = types._parse;


    types._parse = function (node, parentNode, property) {
        var info = original(node, parentNode, property);

        if (searchFunc(info, node, parentNode, property)) {
            func(info, node, parentNode, property);
        }

        return info;
    };
}

function find(type, node) {
    return _find(type, parse(node));
}
function convert(ast) {
    traverse(ast, {
        ClassMethod: function (path) {
            var node = path.node;

            node.type = 'MethodDefinition';
            node.value = t.functionExpression(null, node.params.map(function (param) {
                if (param.type === 'TSParameterProperty') {
                    return param.parameter;
                } else {
                    return param;
                }
            }), node.body, node.generator, node.async);
            node.value.returnType = node.returnType;
            node.value.typeParameters = node.typeParameters;

            node.value.accessibility = node.accessibility;
            node.value.start = node.start + node.key.name.length;
            node.value.end = node.end;
            node.value.loc = {
                start: {
                    line: node.loc.start.line,
                    column: 0
                },
                end: {
                    line: node.loc.end.line,
                    column: node.loc.end.column
                }
            };
        }
    });
}

var isDebug = false;

function enableDebug() {
    isDebug = true;
}
debug(function (info, node, parentNode, property) {
    if (!isDebug) {
        return;
    }
    console.log('register TS TYPE: ' + node.type, 'parent TS Type: ' + (parentNode && parentNode.type) + '.' + property);
}, function (info) {
    return info.isNotExist;
});
// debug(function(info) {
//   console.log(info.string);
// }, "RegExpLiteral");

// debug(function(info) {
//   console.log(info.string, info.checkType.typeAnnotation);
// }, function(info, node, parentNode, property) {
//   return info.nodeType === "TSConditionalType";
// })

// debug(function(info, node, parentNode, property) {
//     // console.log("EX", info.string, parentNode.type, property);
// }, "VariableDeclaration")
exports.enableDebug = enableDebug;
exports.debug = debug;
exports.parse = parse;
exports.find = find;
exports.findInfo = _find;
exports.getTypeId = _getTypeId;
exports.convert = convert;
