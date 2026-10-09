"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = 1;
exports.name = 'import-meta-transformer';
exports.factory = function factory({ configSet }) {
    const ts = configSet.compilerModule;
    return (context) => (sourceFile) => {
        function visitor(node) {
            if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
                return ts.factory.createObjectLiteralExpression([
                    ts.factory.createPropertyAssignment(
                        ts.factory.createIdentifier('url'),
                        ts.factory.createStringLiteral('http://localhost/')
                    )
                ]);
            }
            return ts.visitEachChild(node, visitor, context);
        }
        return ts.visitNode(sourceFile, visitor);
    };
};
