import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { GitContext } from '../types.js';

export async function validateTags(
  context: GitContext,
  startTag: string,
  endTag: string
): Promise<void> {
  try {
    const tags = await context.git.tags();
    const existingTags = tags.all;
    
    if (!existingTags.includes(startTag)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `開始タグ '${startTag}' がリポジトリに存在しません（${context.workingDir}）。\n利用可能なタグ: ${existingTags.join(', ')}`
      );
    }
    
    if (!existingTags.includes(endTag)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `終了タグ '${endTag}' がリポジトリに存在しません（${context.workingDir}）。\n利用可能なタグ: ${existingTags.join(', ')}`
      );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `タグの検証中にエラーが発生しました（${context.workingDir}）: ${error instanceof Error ? error.message : '不明なエラー'}`
    );
  }
}
