export interface ASTType {
  nodeType: string;
  string: string;
  typeId: (filename?: string) => string;
  [key: string]: any;
}

export declare function find(type: string, node: any): ASTType;
export declare function findInfo(type: string, info: any): ASTType;
export declare function debug(
  func: (info: ASTType, node: any, parentNode, any, properyt: string) => void,
  selector: string | ((info: ASTType, node: any) => boolean),
): void;

export declare function parse(node: any, parentNode?: any, property?: string);
export declare function getTypeId(str: string, filename?: string): string;
export declare function convert(node: any): void;

