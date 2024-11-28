import { AbstractParser, EnclosingContext } from "../../constants";
import * as Parser from "tree-sitter";
import * as Python from "tree-sitter-python";

type TreeCursor = Parser.TreeCursor & {
  currentNode(): Parser.SyntaxNode;
  gotoNextSibling(): boolean;
};

export class PythonParser implements AbstractParser {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(Python);
  }

  findEnclosingContext(
    file: string,
    lineStart: number,
    lineEnd: number
  ): EnclosingContext {
    try {
      const tree = this.parser.parse(file);
      let largestEnclosingContext: Parser.SyntaxNode = null;
      let largestSize = 0;

      const cursor = tree.walk() as TreeCursor;

      do {
        const node = cursor.currentNode();

        // Process only function and class definitions
        if (
          node.type === "function_definition" ||
          node.type === "class_definition" ||
          node.type === "async_function_definition"
        ) {
          const startLine = node.startPosition.row + 1;
          const endLine = node.endPosition.row + 1;

          if (startLine <= lineStart && lineEnd <= endLine) {
            const size = endLine - startLine;
            if (size > largestSize) {
              largestSize = size;
              largestEnclosingContext = node;
            }
          }
        }
      } while (cursor.gotoNextSibling());

      if (largestEnclosingContext) {
        const convertedContext = {
          loc: {
            start: { line: largestEnclosingContext.startPosition.row + 1 },
            end: { line: largestEnclosingContext.endPosition.row + 1 },
          },
          type: largestEnclosingContext.type,
        };

        return {
          enclosingContext: convertedContext,
        } as EnclosingContext;
      }

      return { enclosingContext: null };
    } catch (error) {
      console.error("Error parsing Python file:", error);
      return { enclosingContext: null };
    }
  }

  dryRun(file: string): { valid: boolean; error: string } {
    try {
      const tree = this.parser.parse(file);

      // Check for ERROR nodes in the syntax tree
      let hasErrors = false;
      const cursor = tree.walk() as TreeCursor;

      do {
        if (cursor.currentNode().type === "ERROR") {
          hasErrors = true;
          break;
        }
      } while (cursor.gotoNextSibling());

      if (hasErrors) {
        return {
          valid: false,
          error: "Syntax error detected in Python code",
        };
      }

      return {
        valid: true,
        error: "",
      };
    } catch (error) {
      return {
        valid: false,
        error: error.toString(),
      };
    }
  }
}
